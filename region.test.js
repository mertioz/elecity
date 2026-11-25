"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const regional = require("./region-model.js");
const projects = require("./projects.js");
const model = require("./model.js");
const series = (row) => Array.from({ length: 24 }, () => ({
  imported: 0, exported: 0, demand: 0, servedLoad: 0, unmet: 0, loss: 0, island: false, ...row
}));
const city = (id) => ({ id, name: id.toUpperCase() });
const cable = (id, from, to, changes = {}) => ({ id, name: "Liaison " + id, from, to, ...regional.lineDefaults, ...changes });
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.0001, a + " ≈ " + b);

test("Les anciennes villes reçoivent des positions séparées et les liens restent persistants", () => {
  const workspace = projects.load();
  const renamed = projects.add(workspace, { name: "Bellevue", network: model.getNetwork(), scenarios: {} });
  const key = regional.cityKey(renamed.id);
  workspace.region.lines.push(cable("premiere", "city:demo", key));
  const restored = projects.load({ getItem: () => JSON.stringify(workspace) });
  assert.equal(restored.region.lines[0].to, key);
  const [a, b] = regional.sites(restored.region, restored.cities);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 12);
});

test("Le transfert dans les deux sens mesure précisément le débit et les pertes", () => {
  const cities = [city("nord"), city("sud")];
  const region = regional.normalize({ lines: [cable("l1", "city:nord", "city:sud")] }, cities);
  const north = series({ imported: 700 });
  const south = series({ exported: 600 });
  north[2] = { ...north[2], imported: 0, exported: 400 };
  south[2] = { ...south[2], exported: 0, imported: 900 };
  const result = regional.simulate(region, cities, new Map([["nord", north], ["sud", south]]));
  const opening = result.rows[0];
  const reading = opening.lines.l1;
  assert.equal(reading.direction, -1);
  near(reading.sent, 600);
  assert.ok(reading.losses > 0);
  near(reading.sent, reading.received + reading.losses);
  near(opening.towns["city:nord"].imported, reading.received);
  near(opening.towns["city:nord"].purchased + reading.received, 700);
  assert.equal(result.rows[2].lines.l1.direction, 1);
});

test("La centrale transmet à travers un relais et s'arrête à l'épuisement du stock d'eau", () => {
  const cities = [city("relais"), city("cible")];
  const region = regional.normalize({
    locations: { relais: { x: 0, z: 0 }, cible: { x: 24, z: 0 } },
    plants: [{ id: "reacteur", name: "Centrale", x: -24, z: 0, ...regional.plantDefaults, fuel: 3, water: 2, waterRate: 4 }],
    lines: [cable("l1", "plant:reacteur", "city:relais"), cable("l2", "city:relais", "city:cible")]
  }, cities);
  const result = regional.simulate(region, cities, new Map([["relais", series()], ["cible", series({ imported: 700 })]]));
  const first = result.rows[0];
  near(first.nuclear, 500);
  near(first.plants.reacteur.water, 0);
  near(first.plants.reacteur.fuel, 2.5);
  near(first.lines.l1.received, first.lines.l2.sent);
  near(first.nuclear, first.delivered + first.losses);
  assert.ok(first.delivered > 480);
  assert.equal(result.rows[1].nuclear, 0);
  near(result.rows[1].upstream, 700);
});

test("Le délestage local est préservé et le transfert respecte le courant admissible", () => {
  const cities = [city("nord"), city("sud")];
  const region = regional.normalize({ lines: [cable("l1", "city:nord", "city:sud", { amps: 1 })] }, cities);
  const north = series({ exported: 1000 });
  const south = series({ imported: 800 });
  south[1] = { ...south[1], imported: 0, island: true, unmet: 170 };
  const result = regional.simulate(region, cities, new Map([["nord", north], ["sud", south]]));
  near(result.rows[0].lines.l1.current, 1);
  assert.equal(result.rows[1].lines.l1.open, true);
  assert.equal(result.rows[1].lines.l1.sent, 0);
  assert.equal(result.rows[1].unmet, 170);
});

test("Le profil horaire personnalisé du bâtiment est sauvegardé et reste fixe pendant le pilotage", () => {
  const network = model.getNetwork();
  const house = model.originalBuildings(network)[0];
  const profile = Array.from({ length: 24 }, (_, i) => i === 3 ? 12 : i === 19 ? 48.5 : 0);
  network.originalOverrides[house.id] = { profile };
  network.buildings.push({ id: "atelier", name: "Atelier", type: "industry", district: "business", power: 100, profile });
  const decoded = projects.decode(projects.encode({ name: "Cité test", network, scenarios: {} }));
  const { baseline, optimized } = model.simulate("sun", undefined, decoded.network);
  for (const id of [house.id, "atelier"]) {
    for (const [hour, draw] of profile.entries()) {
      near(baseline.rows[hour].buildingLoads[id].demand, draw);
      near(optimized.rows[hour].buildingLoads[id].demand, draw);
    }
  }
});
