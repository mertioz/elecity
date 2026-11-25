"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const model = require("./model.js");
const projects = require("./projects.js");

test("La copie d’une ville crée un réseau et des réglages indépendants", () => {
  const workspace = projects.load();
  const demo = workspace.cities[0];
  demo.scenarios.sun = { standard: 0.29 };
  const another = projects.add(workspace, { ...demo, name: "Bellevue" });
  another.network.districts[0].profile[12] = 987;
  another.scenarios.sun.standard = 0.42;
  assert.equal(workspace.activeId, another.id);
  assert.notEqual(demo.network.districts[0].profile[12], 987);
  assert.equal(demo.scenarios.sun.standard, 0.29);
  const restored = projects.load({ getItem: () => JSON.stringify(workspace) });
  assert.equal(restored.cities[1].name, "Bellevue");
  assert.equal(restored.cities[1].network.districts[0].profile[12], 987);
});

test("Le fichier JSON transporte le réseau et les tarifs, et les noms importés restent distincts", () => {
  const workspace = projects.load();
  const network = model.getNetwork();
  network.grid.length = 5.75;
  const city = projects.add(workspace, { name: "Bellevue", network, scenarios: { sun: { offPeak: 0.092 } } });
  const restored = projects.add(workspace, projects.decode(projects.encode(city)));
  assert.equal(restored.name, "Bellevue (2)");
  assert.equal(restored.network.grid.length, 5.75);
  assert.equal(restored.scenarios.sun.offPeak, 0.092);
});

test("Les fichiers de ville refusent une longueur négative et un profil incomplet", () => {
  const network = model.getNetwork();
  const payload = { name: "Bellevue", network, scenarios: {} };
  network.grid.length = -1;
  assert.throws(() => projects.decode(projects.encode(payload)), /Longueur/);
  network.grid.length = 5;
  network.districts[0].profile.pop();
  assert.throws(() => projects.decode(projects.encode(payload)), /24 puissances/);
});

test("Une ville historique conserve ses réglages en heures et reçoit une taille de ville par défaut", () => {
  const workspace = projects.load();
  const demo = workspace.cities[0];
  delete demo.network.size;
  delete demo.network.buildings;
  demo.scenarios.sun = { nightEnabled: true, nightStart: 22, nightEnd: 7 };
  const { cities } = projects.load({ getItem: () => JSON.stringify(workspace) });
  assert.equal(cities[0].network.size, 1);
  assert.deepEqual(cities[0].network.buildings, []);
  assert.equal(cities[0].scenarios.sun.nightStartMinute, 1320);
  assert.equal(cities[0].scenarios.sun.nightEndMinute, 420);
});

test("La taille limite les terrains d’un quartier et les bâtiments restent dans le fichier de ville", () => {
  const network = model.getNetwork();
  network.size = 2;
  network.buildings = Array.from({ length: 5 }, (_, i) => ({
    id: "habitat-" + i, name: "Maison " + i, type: "house", district: "residential", power: 12.3
  }));
  const restored = projects.decode(projects.encode({ name: "Bellevue", network, scenarios: {} }));
  assert.equal(restored.network.size, 2);
  assert.equal(restored.network.buildings.length, 5);
  assert.equal(restored.network.buildings[4].power, 12.3);
  network.size = 1;
  assert.throws(() => projects.networkOf(network), /assez de terrains/);
});

test("Un terrain choisi reste affecté et les anciens bâtiments utilisent les terrains encore libres", () => {
  const network = model.getNetwork();
  const template = { name: "Bâtiment ajouté", type: "office", district: "business", power: 40 };
  network.buildings = [{ ...template, id: "ancien" }, { ...template, id: "nouveau", lot: 0 }, { ...template, id: "manuel", lot: 3 }];
  network.originalOverrides["original-maison-1"] = { name: "Maison du parc", power: 26.5, removed: true };
  const city = projects.decode(projects.encode({ name: "Bellevue", network, scenarios: {} }));
  assert.deepEqual(city.network.buildings.map(({ lot }) => lot), [1, 0, 3]);
  assert.deepEqual(projects.availableLots(city.network, "business"), [2]);
  assert.equal(city.network.originalOverrides["original-maison-1"].removed, true);
  network.buildings[2].lot = 0;
  assert.throws(() => projects.networkOf(network), /terrain est déjà occupé/);
});

test("Les noms des équipements restent associés à leur type après export et import", () => {
  const network = model.getNetwork();
  network.objectNames = { solar: "Parc Est", grid: "Raccordement Nord" };
  const restored = projects.decode(projects.encode({ name: "Bellevue", network, scenarios: {} }));
  assert.deepEqual(restored.network.objectNames, { solar: "Parc Est", grid: "Raccordement Nord" });
  const renamed = model.simulate("sun", undefined, restored.network).baseline;
  assert.equal(renamed.rows[12].lines[0].name, "Raccordement Nord");
  assert.equal(renamed.totals.demand, model.simulate("sun").baseline.totals.demand);
});
