"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const model = require("./model.js");
const tolerance = 1e-5;

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
}

function verifyBalances(result, config) {
  const { baseline, optimized } = result;
  near(optimized.totals.demand, baseline.totals.demand);
  assert.ok(optimized.totals.unmet <= baseline.totals.unmet + tolerance);
  for (const strategy of Object.values(result)) {
    assert.equal(strategy.rows.length, 24);
    let previousSoc = config.capacity * model.RESERVE;
    for (const row of strategy.rows) {
      assert.ok(row.charge >= 0 && row.discharge >= 0);
      assert.ok(row.charge * row.discharge === 0);
      assert.ok(Math.max(row.charge, row.discharge) <= config.batteryPower + tolerance);
      assert.ok(row.soc >= config.capacity * model.RESERVE - tolerance);
      assert.ok(row.soc <= config.capacity + tolerance);
      assert.ok(row.imported <= row.importLimit + tolerance);
      assert.ok(row.exported <= row.exportLimit + tolerance);
      assert.ok(row.imported * row.exported === 0);
      assert.ok(row.curtailed >= 0 && row.pvUsed >= -tolerance);
      assert.ok(row.unmet <= tolerance || row.charge === 0);
      assert.ok(row.discharge === 0 || row.exported <= tolerance);
      near(row.demand, row.servedLoad + row.unmet);
      near(row.pv, row.pvUsed + row.curtailed);
      near(row.imported + row.pvUsed + row.discharge, row.servedLoad + row.loss + row.charge + row.exported);
      near(row.soc, previousSoc + row.charge * model.CHARGE_EFFICIENCY - row.discharge / model.DISCHARGE_EFFICIENCY);
      near(row.cost, row.imported * row.price - row.exported * config.feedIn + row.discharge * model.WEAR);
      for (const line of row.lines) {
        near(line.apparent, Math.hypot(line.p, line.q));
        near(line.apparent, Math.sqrt(3) * row.nominal * line.current);
        near(line.loading, 100 * line.current / line.limit);
      }
      previousSoc = row.soc;
    }
    near(previousSoc, config.capacity * model.RESERVE);
    near(strategy.rows.reduce((value, row) => value + row.shift, 0), 0);
    for (let i = 0; i < model.DISTRICTS.length; i++) {
      near(strategy.rows.reduce((value, row) => value + row.districts[i], 0),
        baseline.rows.reduce((value, row) => value + row.districts[i], 0));
    }
  }
}

for (const key of Object.keys(model.PRESETS)) {
  test(`Bilans et contraintes sur 24 h · ${model.PRESETS[key].name}`, () => {
    const config = model.getSettings(key);
    verifyBalances(model.simulate(key, config), config);
  });
}

test("Le scénario ensoleillé réduit les coûts sans dégrader le service", () => {
  const { baseline, optimized } = model.simulate("sun");
  near(optimized.totals.unmet, 0);
  assert.ok(optimized.totals.cost < baseline.totals.cost);
  assert.ok(optimized.totals.shifted > 0);
  assert.ok(optimized.totals.discharge > 0);
});

test("Le plan privilégie l’énergie servie pendant la coupure, avec un poste hors tension sans source", () => {
  const { baseline, optimized } = model.simulate("outage");
  assert.ok(optimized.totals.unmet < baseline.totals.unmet);
  assert.ok(optimized.totals.cost > baseline.totals.cost);
  const reference = baseline.rows[19];
  assert.equal(reference.lines[0].open, true);
  assert.equal(reference.energized, false);
  near(reference.bus, 0);
  const backup = optimized.rows[19];
  assert.equal(backup.energized, true);
  near(backup.bus, model.VOLTAGE);
  near(backup.imported + backup.exported, 0);
});

test("Sans soleil ni batterie, l’import couvre exactement la demande et les pertes", () => {
  const config = { ...model.getSettings("sun"), solar: 0, capacity: 0, flex: 0 };
  const result = model.simulate("sun", config);
  verifyBalances(result, config);
  const { totals } = result.optimized;
  near(totals.imported, totals.demand + totals.loss);
  near(totals.pv + totals.charge + totals.discharge, 0);
});

test("Une injection interdite provoque l’écrêtement du surplus", () => {
  const config = { ...model.getSettings("sun"), solar: 3000, exportLimit: 0, capacity: 4000, batteryPower: 50 };
  const result = model.simulate("sun", config);
  verifyBalances(result, config);
  near(result.optimized.totals.exported, 0);
  assert.ok(result.optimized.totals.curtailed > 0);
  assert.ok(result.optimized.totals.discharge > 0);
});

test("Aucune source et aucun import disponible imposent le délestage intégral", () => {
  const config = { ...model.getSettings("sun"), solar: 0, capacity: 0, importLimit: 0 };
  const result = model.simulate("sun", config);
  verifyBalances(result, config);
  near(result.optimized.totals.unmet, result.optimized.totals.demand);
  near(result.optimized.totals.servedLoad + result.optimized.totals.loss, 0);
});

test("En l’absence de demande, le surplus respecte toujours le plafond d’injection", () => {
  const config = { ...model.getSettings("sun"), demand: 0, solar: 3000, exportLimit: 100 };
  const result = model.simulate("sun", config);
  verifyBalances(result, config);
  near(result.optimized.totals.demand, 0);
  assert.ok(result.optimized.totals.curtailed > 0);
  near(result.optimized.rows[12].exported, 100);
});

test("Les dépassements de courant sont signalés dans les scénarios fortement chargés", () => {
  const config = { ...model.getSettings("peak"), demand: 220, solar: 0, importLimit: 2600 };
  const result = model.simulate("peak", config);
  verifyBalances(result, config);
  assert.ok(result.optimized.totals.warningHours > 0);
});

test("La plage creuse traverse minuit et exclut l’heure de fin", () => {
  const config = { ...model.getSettings("sun"), nightStart: 22, nightEnd: 5, offPeak: 0.08 };
  const { optimized } = model.simulate("sun", config);
  const night = optimized.rows.filter((row) => row.tariff === "Heures creuses");
  assert.deepEqual(night.map((row) => row.hour), [0, 1, 2, 3, 4, 22, 23]);
  assert.ok(night.every((row) => row.price === 0.08));
  assert.equal(optimized.rows[5].tariff, "Standard");
  assert.equal(optimized.rows[21].tariff, "Pointe");
});

test("Un créneau creux actif prime sur la pointe et peut rester dans la même journée", () => {
  const config = { ...model.getSettings("sun"), nightStart: 18, nightEnd: 21 };
  const { baseline } = model.simulate("sun", config);
  assert.deepEqual(baseline.rows.map((row) => row.tariff).slice(16, 23),
    ["Standard", "Pointe", "Heures creuses", "Heures creuses", "Heures creuses", "Pointe", "Standard"]);
});

test("Désactiver les heures creuses change la facture et le plan de charge", () => {
  const config = { ...model.getSettings("sun"), solar: 0, flex: 0, standard: 0.22, peak: 0.22, offPeak: 0.03 };
  const enabled = model.simulate("sun", config);
  verifyBalances(enabled, config);
  const disabledConfig = { ...config, nightEnabled: false };
  const disabled = model.simulate("sun", disabledConfig);
  verifyBalances(disabled, disabledConfig);
  assert.ok(enabled.optimized.rows.filter((row) => row.tariff === "Heures creuses").some((row) => row.charge > 0));
  assert.ok(disabled.optimized.rows.every((row) => row.price === 0.22 && row.charge === 0));
  assert.ok(enabled.optimized.totals.cost < disabled.optimized.totals.cost);
});

test("Un profil personnalisé et les propriétés d’un câble déterminent P, Q, I, les pertes et la chute de tension", () => {
  const network = model.getNetwork();
  network.voltage = 15;
  network.districts.forEach((district) => district.profile.fill(0));
  const district = network.districts[0];
  district.name = "Nord";
  district.profile.fill(120);
  district.pf = 0.8;
  district.cable = { length: 10, resistance: 0.8, reactance: 0.3, limit: 5 };
  const config = { ...model.getSettings("sun"), solar: 0, capacity: 0, flex: 0 };
  const result = model.simulate("sun", config, network);
  verifyBalances(result, config);
  const row = result.optimized.rows[12];
  const line = row.lines[1];
  const branchLoss = 8 * (120 ** 2 + 90 ** 2) / (1000 * 15 ** 2);
  const upstreamLoss = 1.45 * ((120 + branchLoss) ** 2 + 90 ** 2) / (1000 * 15 ** 2);
  assert.equal(line.name, "Nord");
  near(line.p, 120);
  near(line.q, 90);
  near(line.current, 150 / (Math.sqrt(3) * 15));
  near(line.voltage, row.bus - (8 * 120 + 3 * 90) / 15000);
  near(row.loss, branchLoss + upstreamLoss);
  assert.equal(line.warning, true);
});

test("Un câble plus long augmente les pertes du réseau et le coût d’achat à demande égale", () => {
  const config = { ...model.getSettings("sun"), solar: 0, capacity: 0, flex: 0 };
  const network = model.getNetwork();
  const before = model.simulate("sun", config, network).baseline;
  network.grid.length *= 2;
  const after = model.simulate("sun", config, network).baseline;
  near(after.totals.demand, before.totals.demand);
  assert.ok(after.totals.loss > before.totals.loss);
  assert.ok(after.totals.bill > before.totals.bill);
  assert.ok(after.rows[12].bus < before.rows[12].bus);
});

test("Les minutes creuses de chaque côté de minuit pondèrent le tarif et la facture", () => {
  const config = { ...model.getSettings("sun"), nightStartMinute: 22 * 60 + 17, nightEndMinute: 6 * 60 + 43 };
  const result = model.simulate("sun", config);
  const rows = result.baseline.rows;
  assert.equal(rows.reduce((minutes, row) => minutes + row.nightMinutes, 0), 506);
  assert.deepEqual(rows[22].nightSpans, [[17, 60]]);
  assert.deepEqual(rows[6].nightSpans, [[0, 43]]);
  assert.equal(rows[6].tariff, "Mixte");
  near(rows[22].price, (43 * config.offPeak + 17 * config.standard) / 60);
  near(rows[6].bill, rows[6].imported * rows[6].price - rows[6].exported * config.feedIn);
  near(rows[23].price, config.offPeak);
  verifyBalances(result, config);
});

test("Une plage qui recouvre une heure en deux segments conserve les minutes aux deux extrémités", () => {
  const config = { ...model.getSettings("sun"), nightStartMinute: 22 * 60 + 40, nightEndMinute: 22 * 60 + 15 };
  assert.deepEqual(model.tariffAt(22, config).nightSpans, [[0, 15], [40, 60]]);
  assert.equal(model.tariffAt(22, config).nightMinutes, 35);
});

test("La puissance choisie d’un bâtiment alimente le profil du quartier et conserve son énergie lors du report", () => {
  const network = model.getNetwork();
  const office = { id: "bureaux-a", name: "Bureaux A", type: "office", district: "business", power: 150 };
  network.buildings.push(office);
  const { optimized, baseline } = model.simulate("sun", undefined, network);
  const demo = model.simulate("sun").baseline;
  near(baseline.rows[12].districts[1] - demo.rows[12].districts[1], 150);
  near(baseline.rows[0].buildingLoads[office.id].demand, 27);
  const energy = (strategy) => strategy.rows.reduce((total, row) => total + row.buildingLoads[office.id].demand, 0);
  near(energy(optimized), energy(baseline));
  near(optimized.totals.demand, baseline.totals.demand);
  assert.ok(optimized.totals.shifted > 0);
});

test("Modifier puis retirer une maison d’origine recalcule la charge du quartier", () => {
  const network = model.getNetwork();
  const house = model.originalBuildings(network).find(({ type }) => type === "house");
  const initial = model.simulate("sun", undefined, network).baseline.rows[12];
  const houseLoad = initial.buildingLoads[house.id].demand;
  near(houseLoad, network.districts[0].profile[12] / 8);
  network.originalOverrides[house.id] = { power: 20 };
  const changed = model.simulate("sun", undefined, network).baseline.rows[12];
  assert.ok(changed.buildingLoads[house.id].demand < houseLoad);
  near(initial.districts[0] - changed.districts[0], houseLoad - changed.buildingLoads[house.id].demand);
  network.originalOverrides[house.id].removed = true;
  const removed = model.simulate("sun", undefined, network).baseline.rows[12];
  assert.ok(!(house.id in removed.buildingLoads));
  near(initial.districts[0] - removed.districts[0], houseLoad);
});
