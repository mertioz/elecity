"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const grid = require("./terrain-model.js");
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.0001, a + " ≈ " + b);
const cable = (id, from, to, custom = {}) => ({ id, from, to, name: "Câble " + id, ...grid.cableDefaults, ...custom });

test("Sur le terrain vide la demande et les flux valent zéro", () => {
  const { daily, rows } = grid.simulate(grid.blank("vide"));
  assert.equal(rows.length, 24);
  assert.equal(daily.generated, 0);
  assert.equal(daily.losses, 0);
  assert.deepEqual(rows[12].nodes, {});
});

test("Une centrale alimente une maison en passant par deux poteaux et les pertes sont déduites", () => {
  const world = grid.normalize({
    ...grid.blank("transfert"),
    nodes: [
      grid.device("centrale", "nuclear", 0, 0), grid.device("a", "pole", 20, 0),
      grid.device("b", "pole", 40, 0), { ...grid.device("maison", "house", 60, 0), profile: Array(24).fill(40) }
    ],
    cables: [cable("un", "centrale", "a"), cable("deux", "a", "b"), cable("trois", "b", "maison")]
  });
  const { rows } = grid.simulate(world);
  const key = rows[12];
  near(key.nodes.maison.received, 40);
  near(key.nodes.b.inbound, key.nodes.b.outbound);
  near(key.generated, key.served + key.losses);
  assert.ok(key.losses > 0);
  assert.ok(key.cables.deux.current > 0);
  assert.ok(key.nodes.maison.voltage < 20);
  assert.ok(rows[12].nodes.centrale.fuel < rows[0].nodes.centrale.fuel);
});

test("Un câble ouvert isole la charge et son profil horaire reste lisible", () => {
  const world = grid.normalize({
    ...grid.blank("isole"),
    nodes: [grid.device("source", "grid", 0, 0), {
      ...grid.device("bureau", "office", 21, 0), profile: Array.from({ length: 24 }, (_, i) => i * 5)
    }],
    cables: [cable("un", "source", "bureau", { enabled: false })]
  });
  const row = grid.simulate(world).rows[12];
  assert.equal(row.nodes.bureau.demand, 60);
  assert.equal(row.nodes.bureau.received, 0);
  assert.equal(row.nodes.bureau.voltage, 0);
  assert.equal(row.cables.un.current, 0);
});

test("Une batterie stocke le surplus solaire et peut le rendre après le coucher du soleil", () => {
  const world = grid.normalize({
    ...grid.blank("stock"),
    nodes: [
      grid.device("solaire", "solar", 0, 0), { ...grid.device("batterie", "battery", 32, 0), charge: 0 },
      { ...grid.device("maison", "house", 64, 0), profile: Array.from({ length: 24 }, (_, i) => i > 19 ? 100 : 0) }
    ],
    cables: [cable("un", "solaire", "batterie"), cable("deux", "batterie", "maison")]
  });
  const { rows } = grid.simulate(world);
  assert.ok(rows[10].nodes.batterie.soc > 0);
  assert.ok(rows[20].nodes.batterie.generated >= 100);
  near(rows[20].generated, rows[20].served + rows[20].losses);
});

test("Une sauvegarde restitue les positions et les caractéristiques des câbles", () => {
  const draft = { ...grid.blank("test", "Carte des Pins"),
    nodes: [grid.device("poteau", "pole", 12, 33), grid.device("charge", "charger", 90, 15)],
    cables: [cable("un", "charge", "poteau", { length: 2.3 })] };
  const state = grid.load({ getItem: () => JSON.stringify({ version: 1, worlds: [draft], active: "test" }) });
  assert.equal(state.worlds[0].cables[0].length, 2.3);
  assert.equal(state.worlds[0].nodes[0].x, 12);
});

test("Le coût des achats extérieurs suit le tarif pondéré du créneau", () => {
  const world = grid.blank("tarif");
  world.tariffs = { ...world.tariffs, nightStartMinute: 22 * 60 + 30, nightEndMinute: 6 * 60 };
  world.nodes = [
    grid.device("reseau", "grid", 0, 0), { ...grid.device("maison", "house", 100, 0), profile: Array(24).fill(500) }
  ];
  world.cables = [cable("lien", "reseau", "maison")];
  const row = grid.simulate(grid.normalize(world)).rows[22];
  assert.equal(row.tariff.nightMinutes, 30);
  near(row.bill, row.purchased * (world.tariffs.offPeak + world.tariffs.standard) / 2);
  assert.ok(row.purchased > row.served);
});

test("Un tronçon limité signale le courant atteint et le bâtiment signale sa demande non servie", () => {
  const world = grid.blank("courant");
  world.nodes = [grid.device("reseau", "grid", 0, 0),
    { ...grid.device("maison", "office", 100, 0), profile: Array(24).fill(500) }];
  world.cables = [cable("troncon", "reseau", "maison", { amperage: 2 })];
  const row = grid.simulate(grid.normalize(world)).rows[12];
  near(row.cables.troncon.current, 2);
  assert.ok(row.cables.troncon.issues.includes("current"));
  assert.deepEqual(row.nodes.maison.issues, ["unmet"]);
  assert.equal(grid.connectionIssue(world, "maison", "reseau"), "duplicate");
  assert.equal(grid.connectionIssue(world, "reseau", "reseau"), "loop");
});

test("Le diagnostic distingue une ligne hors service, une longueur incohérente et une tension basse", () => {
  const world = grid.blank("diagnostics");
  world.nodes = [
    grid.device("reseau", "grid", 0, 0),
    { ...grid.device("atelier", "industry", 120, 0), profile: Array(24).fill(1500) },
    grid.device("poteau", "pole", 200, 0),
    grid.device("isole", "pole", 270, 0)
  ];
  world.cables = [
    cable("long", "reseau", "atelier", { length: 20, resistance: 1 }),
    cable("court", "atelier", "poteau", { enabled: false, length: 0.01 }),
    cable("mort", "poteau", "isole")
  ];
  const row = grid.simulate(grid.normalize(world)).rows[12];
  assert.ok(row.cables.long.issues.includes("voltage"));
  assert.deepEqual(row.cables.court.issues, ["open", "length"]);
  assert.deepEqual(row.cables.mort.issues, ["unpowered"]);
});

test("La progression épuise les stocks et une prévision ou un renommage ne les réinitialise pas", () => {
  const world = grid.blank("partie");
  world.nodes = [
    { ...grid.device("centrale", "nuclear", 0, 0), water: 0.2, waterRate: 2 },
    { ...grid.device("maison", "house", 50, 0), profile: Array(24).fill(500) }
  ];
  world.cables = [cable("mt", "centrale", "maison")];
  const initial = grid.normalize(world);
  const prediction = grid.forecast(initial);
  assert.equal(initial.game.elapsed, 0);
  near(initial.game.stocks.centrale.water, 0.2);
  assert.equal(prediction.rows[1].nodes.centrale.generated, 0);
  const stepped = grid.advance(initial).world;
  assert.equal(stepped.game.elapsed, 1);
  near(stepped.game.stocks.centrale.water, 0);
  const after = grid.normalize({ ...stepped, nodes: stepped.nodes.map((node) =>
    node.id === "centrale" ? { ...node, name: "Centrale des Lilas", water: 7.5 } : node) });
  assert.equal(grid.forecast(after).rows[0].nodes.centrale.generated, 0);
  assert.ok(grid.forecast(after).rows[0].nodes.centrale.issues.includes("coolant"));
  near(after.game.stocks.centrale.water, 0);
});

test("La pompe sans électricité ne déplace rien, puis l’eau permet le redémarrage au créneau suivant", () => {
  const world = grid.blank("pompage");
  world.nodes = [
    { ...grid.device("bassin", "water", 0, 0), water: 10, recharge: 0 },
    grid.device("pompe", "pump", 20, 0),
    { ...grid.device("centrale", "nuclear", 40, 0), water: 2 },
    { ...grid.device("maison", "house", 100, 0), profile: Array(24).fill(200) },
    grid.device("secours", "grid", 20, 30)
  ];
  world.game.stocks.centrale = { fuel: 40, water: 0 };
  world.cables = [
    cable("entree", "bassin", "pompe", { medium: "water" }),
    cable("sortie", "pompe", "centrale", { medium: "water" }),
    cable("mt", "centrale", "maison")
  ];
  const dry = grid.advance(grid.normalize(world));
  near(dry.row.cables.sortie.sent, 0);
  assert.ok(dry.row.nodes.pompe.issues.includes("pumpPower"));
  const restored = grid.normalize({ ...dry.world, cables: [...dry.world.cables, cable("alimentation", "secours", "pompe")] });
  const pumping = grid.advance(restored);
  near(pumping.row.nodes.centrale.generated, 0);
  near(pumping.row.cables.entree.sent, 2);
  near(pumping.row.cables.sortie.sent, 2);
  near(pumping.world.game.stocks.centrale.water, 2);
  near(pumping.world.game.stocks.bassin.water, 8);
  assert.ok(grid.advance(pumping.world).row.nodes.centrale.generated > 0);
});

test("Le jeu compte une série de 24 heures, sauvegarde l’heure et débite le ravitaillement", () => {
  let world = grid.blank("mission");
  world.nodes = [
    grid.device("source", "grid", 0, 0),
    { ...grid.device("maison", "house", 45, 0), profile: Array(24).fill(40) },
    grid.device("centrale", "nuclear", 90, 0)
  ];
  world.cables = [cable("mt", "source", "maison")];
  world.game.stocks.centrale = { fuel: 4, water: 2 };
  world = grid.normalize(world);
  for (let hour = 0; hour < 24; hour++) world = grid.advance(world).world;
  assert.equal(world.game.best, 24);
  assert.equal(grid.forecast(world).rows[0].tick, 36);
  const order = grid.refuel(world, "centrale", 3);
  near(order.cost, 480);
  near(order.world.game.stocks.centrale.fuel, 7);
  near(order.world.game.budget, world.game.budget - 480);
  const loaded = grid.load({ getItem: () => JSON.stringify({ version: 1, worlds: [order.world], active: world.id }) });
  assert.equal(loaded.worlds[0].game.elapsed, 24);
  near(loaded.worlds[0].game.stocks.centrale.water, 2);
});

test("Les habitants se plaignent, quittent un logement mal desservi, puis reviennent après rétablissement", () => {
  let world = grid.blank("quartier");
  world.nodes = [
    { ...grid.device("maison", "house", 50, 0), profile: Array(24).fill(80) },
    grid.device("source", "grid", 0, 0)
  ];
  world = grid.normalize(world);
  assert.equal(grid.forecast(world).rows[0].nodes.maison.demand, 80);
  assert.equal(world.game.city.homes.maison.people, 4);
  const first = grid.advance(world);
  assert.equal(first.world.game.city.homes.maison.people, 4);
  assert.ok(first.row.events.complaints > 0);
  world = grid.advance(grid.advance(first.world).world).world;
  assert.equal(world.game.city.homes.maison.people, 3);
  assert.equal(world.game.city.departures, 1);
  assert.equal(grid.forecast(world).rows[0].nodes.maison.demand, 60);
  world = grid.normalize({ ...world, cables: [cable("mt", "source", "maison")] });
  for (let h = 0; h < 4; h++) world = grid.advance(world).world;
  assert.equal(world.game.city.homes.maison.people, 4);
  assert.equal(world.game.city.arrivals, 1);
});

test("Le secours met les patients à l’abri jusqu’à son épuisement et les soins reprennent au rétablissement", () => {
  let world = grid.blank("hopital");
  world.nodes = [grid.device("hopital", "hospital", 50, 0), grid.device("source", "grid", 0, 0)];
  world = grid.normalize(world);
  for (let h = 0; h < 2; h++) world = grid.advance(world).world;
  assert.equal(world.game.city.deaths, 0);
  assert.equal(world.game.city.hospitals.hopital.backup, 0);
  const blackout = grid.advance(world);
  assert.ok(blackout.row.events.deaths > 0);
  assert.ok(blackout.row.nodes.hopital.issues.includes("deaths"));
  const restored = grid.normalize({ ...blackout.world, cables: [cable("mt", "source", "hopital")] });
  const powered = grid.advance(restored);
  assert.equal(powered.row.events.deaths, 0);
  assert.ok(powered.world.game.city.hospitals.hopital.backup > 0);
  assert.equal(powered.world.game.city.deaths, blackout.world.game.city.deaths);
});

test("Un hôpital reçoit la puissance en priorité sur les logements", () => {
  const world = grid.blank("priorite");
  world.nodes = [
    { ...grid.device("maison", "house", 50, 0), profile: Array(24).fill(130) },
    grid.device("hopital", "hospital", 50, 40),
    { ...grid.device("source", "grid", 0, 0), power: 255 }
  ];
  world.cables = [cable("a", "source", "maison"), cable("b", "source", "hopital")];
  const row = grid.forecast(grid.normalize(world)).rows[0];
  assert.ok(row.nodes.hopital.received >= 249.99);
  assert.ok(row.nodes.maison.received < 6);
});

test("Les crédits sont débités à la construction et un retrait rembourse seulement le coût payé", () => {
  const world = grid.blank("monnaie");
  const purchased = { ...grid.device("maison", "house", 0, 0), paid: grid.prices.house };
  const drafted = grid.spend(world, purchased.paid);
  assert.equal(drafted.game.budget, world.game.budget - grid.prices.house);
  assert.throws(() => grid.spend(drafted, 5000), /Crédits insuffisants/);
  const restored = grid.normalize({ ...drafted, nodes: [purchased] });
  const { world: sold, amount } = grid.refund(restored, restored.nodes);
  assert.equal(amount, 30);
  assert.equal(sold.game.budget, drafted.game.budget + amount);
  assert.equal(grid.credit, "CR");
});
