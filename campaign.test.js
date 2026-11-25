"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const game = require("./campaign-model.js");

test("La partie démarre à 10 CR avec un groupe déjà raccordé et les anciennes sauvegardes restent lisibles", () => {
  const initial = game.newGame();
  assert.equal(initial.game.budget, 10);
  assert.ok(initial.built.includes("starter"));
  assert.ok(game.worldOf(initial).cables.some(({ from, to }) => from === "poste" && to === "starter"));
  assert.throws(() => game.buy(initial, "mill"), /Il manque/);
  assert.throws(() => game.buy(initial, "starter"), /occupé/);
  assert.deepEqual(game.load({ getItem: () => null }), initial);
  const saved = { ...initial, built: ["house"], game: { ...initial.game, budget: 100, elapsed: 3 } };
  delete saved.jobs;
  delete saved.storageMode;
  saved.settings={starter:70,mill:100,plant:100,pump:100};
  const previous = game.load({ getItem: () => JSON.stringify(saved) });
  assert.deepEqual(previous.built, saved.built);
  assert.equal(previous.game.budget, 100);
  assert.equal(previous.game.elapsed, 3);
  assert.equal(previous.settings.starter,70);
  assert.equal(previous.settings.windfarm,100);
  assert.equal(previous.storageMode,"auto");
  assert.equal(previous.jobs.trains,0);
});

test("La séquence produit selon le nombre de commandes justes et reste limitée à une par heure", () => {
  const base = game.newGame();
  const expected = game.sequence(base);
  const good = game.manual(base, expected);
  const bad = game.manual(base, expected.map((letter) => letter === "A" ? "B" : "A"));
  assert.equal(game.production(good).starter, 13);
  assert.equal(game.production(bad).starter, 0);
  assert.throws(() => game.manual(good, expected), /déjà/);
  const played = game.advance(good);
  assert.equal(played.state.game.elapsed, 1);
  assert.equal(played.state.manual, null);
  assert.ok(played.last.credit > 0);
  const afterBoundary = game.advance(base).state;
  const prepared = game.manual(afterBoundary, expected, base.game.elapsed);
  assert.equal(prepared.manual.at, afterBoundary.game.elapsed);
  assert.equal(prepared.manual.hits, 5);
});

test("Le joueur peut financer le moulin, automatiser les recettes puis augmenter le nombre d’habitants", () => {
  let state = game.newGame();
  let deliveries = 0;
  for (let i = 0; state.game.budget < 114 && i < 120; i++) {
    if (state.fuel < 20) {
      state = game.refuel(state);
      deliveries++;
    }
    state = game.advance(game.manual(state, game.sequence(state))).state;
  }
  assert.equal(deliveries, 1);
  state = game.buy(state, "mill");
  for (let i = 0; state.game.budget < 42 && i < 24; i++) state = game.advance(state).state;
  const withHouse = Object.values(state.game.city.homes).reduce((sum, home) => sum + home.people, 0);
  const expanded = game.buy(state, "apartment-a");
  const withFlats = Object.values(expanded.game.city.homes).reduce((sum, home) => sum + home.people, 0);
  assert.ok(withFlats > withHouse);
  const passive = game.advance(expanded);
  assert.ok(passive.row.nodes.mill.generated > 0);
  assert.ok(passive.last.credit > 0);
  assert.equal(expanded.manual, null);
});

test("Le surcadencement est limité à 150 % et le coût en combustible ou en débit augmente plus vite", () => {
  let state = game.newGame();
  state = { ...state, game: { ...state.game, budget: 500 } };
  state = game.buy(state, "mill");
  state = game.manual(state, game.sequence(state));
  const normal = game.production(state);
  const at125 = game.production(game.tune(game.tune(state, "starter", 125), "mill", 125));
  const at150 = game.production(game.tune(game.tune(state, "starter", 150), "mill", 150));
  assert.ok(at150.starter > at125.starter && at125.starter > normal.starter);
  assert.ok(at150.mill > at125.mill && at125.mill > normal.mill);
  assert.ok(at150.fuelPerKwh - at125.fuelPerKwh > at125.fuelPerKwh - normal.fuelPerKwh);
  assert.ok(at150.used - at125.used > at125.used - normal.used);
  assert.ok(at150.used <= at150.flow);
  assert.ok(game.production(game.tune(state, "mill", 55)).mill < normal.mill);
  assert.throws(() => game.tune(state, "starter", 151), /150/);
});

test("La prévision est pure et les calculatrices utilisent les unités saisies", () => {
  const state = game.newGame();
  const standard = JSON.stringify(state);
  assert.equal(game.forecast(state).length, 24);
  assert.equal(JSON.stringify(state), standard);
  assert.ok(Math.abs(game.hydraulics(1, 10, .8, 2).energy - 156.96) < 1e-8);
  const reading = game.electrical({ power: 120, voltage: 20, pf: .8, length: 1, resistance: .4, reactance: .08, hours: 2 });
  assert.equal(reading.apparent, 150);
  assert.equal(reading.energy, 240);
  assert.ok(reading.loss > 0 && reading.dropPercent > 0);
});

test("La centrale surcadencée épuise le réservoir et la pompe ne le remplit qu’avec du courant", () => {
  const fresh = game.tune(game.newGame(), "starter", 0);
  const funded = { ...fresh, game: { ...fresh.game, budget: 1000 } };
  assert.throws(() => game.buy(funded, "pump"), /d’abord la centrale/);
  const plant = game.buy(funded, "plant");
  const high = game.tune(plant, "plant", 150);
  const nominal = game.advance(plant);
  const boosted = game.advance(high);
  assert.equal(game.production(high).plant, 67.5);
  assert.ok(game.production(high).plantAvailable > game.production(plant).plantAvailable);
  assert.ok(boosted.state.game.stocks.plant.fuel < nominal.state.game.stocks.plant.fuel);
  assert.ok(boosted.state.game.stocks.plant.water < nominal.state.game.stocks.plant.water);
  let dry = game.buy(high, "pump");
  dry = { ...dry, game: { ...dry.game, stocks: { ...dry.game.stocks, plant: { ...dry.game.stocks.plant, water: 0 } } } };
  const stopped = game.advance(dry);
  assert.equal(stopped.row.nodes.plant.generated, 0);
  assert.equal(stopped.row.waterDelivered, 0);
  assert.ok(stopped.row.nodes.pump.issues.includes("pumpPower"));
  const again = game.buy(dry, "mill");
  const fast = game.tune(again, "pump", 150);
  assert.ok(game.production(fast).pump > 3 * game.production(again).pump);
  const wet = game.advance(fast);
  assert.ok(wet.row.nodes.pump.received > 0);
  assert.ok(wet.row.waterDelivered > 0);
  assert.ok(game.advance(wet.state).row.nodes.plant.generated > 0 || game.production(wet.state).plantAvailable > 0);
});

test("Une campagne financée depuis 10 CR atteint les contrats du plateau et conserve ses bilans", () => {
  let state=game.buy(game.newGame(),"breeze");
  assert.equal(state.game.budget,2);
  assert.throws(()=>game.buy(state,"freight"),/Poste des Hauts/);
  const order=["greenhouse","mill","apartment-a","apartment-b","solar","battery","ridge","windfarm","pumped","freight","plant","pump","hospital"];
  const seen=new Set();
  for (let i=0;i<480;i++) {
    if (!state.built.includes("mill") && state.fuel<20 && state.game.budget>=game.fuelPack.price) state=game.refuel(state);
    const id=order.find((item)=>!state.built.includes(item));
    if (id && state.game.budget>=game.slots.find((slot)=>slot.id===id).price) state=game.buy(state,id);
    if (!state.built.includes("mill")) state=game.manual(state,game.sequence(state));
    const {row,state:next,last}=game.advance(state);
    assert.ok(Math.abs(row.generated-row.served-row.charged-row.losses)<.0001);
    assert.ok(Math.abs(next.game.budget-state.game.budget-last.credit+row.bill)<1e-7);
    assert.ok(Math.abs(last.sales-game.income*(row.buildingServed-(row.nodes.greenhouse?.received??0)-(row.nodes.freight?.received??0)))<1e-6);
    if (last.freight) { assert.ok([7,19].includes(row.hour)); assert.equal(last.freight,game.trainPrice); seen.add("train"); }
    if (last.crop) { assert.equal(last.crop,game.harvestPrice); seen.add("crop"); }
    if (row.nodes.breeze.generated>0) seen.add("wind");
    if (row.nodes.pumped?.stored>0) seen.add("pump");
    if (row.nodes.pumped?.generated>0) seen.add("turbine");
    state=next;
    if (!id && state.jobs.trains>=game.trainGoal && state.game.best>=24 && seen.size===5) break;
  }
  assert.ok(order.every((id)=>state.built.includes(id)));
  assert.ok(state.jobs.trains>=game.trainGoal && state.game.best>=24);
  assert.ok(Object.values(state.game.city.homes).reduce((n,home)=>n+home.people,0)>=30);
  assert.deepEqual([...seen].sort(),["crop","pump","train","turbine","wind"]);
  const loaded=game.load({getItem:()=>JSON.stringify(state)});
  assert.deepEqual(loaded.jobs,state.jobs);
  assert.deepEqual(loaded.game.stocks,state.game.stocks);
  const world=game.worldOf(state);
  assert.equal(world.cables.find((wire)=>wire.to==="freight").from,"ridge");
  assert.ok(world.cables.some((wire)=>wire.from==="east-pole" && wire.to==="west-pole"));
});

test("La station respecte la consigne, les rendements, les stocks et les limites du vent", () => {
  let state=game.newGame(); state.game.budget=2500;
  for (const id of ["apartment-b","ridge","pumped","windfarm"]) state=game.buy(state,id);
  state=game.setStorageMode(state,"charge");
  let next=game.advance(state), meter=next.row.nodes.pumped;
  assert.ok(meter.charge>0 && meter.generated===0);
  assert.ok(Math.abs(meter.soc-meter.charge*.86)<1e-9);
  const filled=next.state.game.stocks.pumped.soc;
  state=game.setStorageMode(game.tune(next.state,"windfarm",0),"discharge");
  next=game.advance(state); meter=next.row.nodes.pumped;
  assert.equal(next.row.nodes.windfarm.available,0);
  assert.ok(meter.charge===0 && meter.generated>0);
  assert.ok(Math.abs(filled-meter.soc-meter.generated/.88)<1e-9);
  assert.equal(game.load({getItem:()=>JSON.stringify(state)}).storageMode,"discharge");
  assert.throws(()=>game.setStorageMode(state,"other"));
});

test("Une serre sans courant et un quai mal alimenté ne rapportent aucune prime", () => {
  let state=game.newGame(); state.game.budget=1000;
  for (const id of ["greenhouse","apartment-b","ridge","freight"]) state=game.buy(state,id);
  const day=game.forecast(state);
  assert.ok(day.every(({last})=>last.crop===0 && last.freight===0 && last.sales===0));
  assert.equal(day.at(-1).state.jobs.missed,2);
  assert.deepEqual(state.jobs,{cropHours:0,harvests:0,loading:0,trains:0,missed:0});
});

test("Le poste limite réellement le départ du quartier et sa plage peut traverser minuit", () => {
  let state = game.newGame();
  state.game.budget = 1000;
  assert.throws(() => game.buy(state, "dispatch"), /Les Tilleuls/);
  for (const id of ["apartment-a", "solar", "hospital", "dispatch"]) state = game.buy(state, id);
  state.game.city.homes["apartment-a"].people = 16;
  state = game.setProgram(state, "dispatch", { start: 22, end: 6, inside: 0, outside: 2, response: "fixed" });
  const forecast = game.forecast(state, 20);
  const midday = forecast[0];
  assert.equal(midday.world.cables.find(cable => cable.to === "house").from, "dispatch");
  assert.equal(midday.world.cables.find(cable => cable.to === "hospital").from, "poste");
  assert.ok(Math.abs(midday.row.cables["liaison-dispatch"].sent - 2) < 1e-5);
  assert.ok(midday.row.nodes.house.received + midday.row.nodes["apartment-a"].received <= 2);
  assert.ok(midday.row.nodes.hospital.received > .95 * midday.row.nodes.hospital.demand);
  assert.equal(forecast[10].row.hour, 22);
  assert.equal(forecast[10].row.cables["liaison-dispatch"].open, true);
  assert.equal(forecast[17].row.hour, 5);
  assert.equal(forecast[17].row.cables["liaison-dispatch"].sent, 0);
  assert.equal(forecast[18].world.dispatch.limit, 2);
  assert.equal(forecast[18].row.cables["liaison-dispatch"].open, false);
  assert.throws(() => game.setProgram(state, "dispatch", { outside: -4 }), /limites/);
  assert.deepEqual(game.load({ getItem: () => JSON.stringify(state) }).programs, state.programs);
});

test("La météo modifie la prévision de production et le réglage du poste avec un plafond matériel", () => {
  let state = game.newGame();
  state.game.budget = 1000;
  for (const id of ["apartment-a", "solar", "dispatch"]) state = game.buy(state, id);
  state = game.setProgram(state, "dispatch", { start: 0, end: 0, inside: 20, response: "follow", adjustment: 25 });
  const forecast = game.forecast(state, 48);
  assert.equal(forecast[0].world.dispatch.limit, 25);
  const weak = forecast.find(({ row }) => row.weather.renewable === -1);
  assert.ok(weak);
  assert.equal(weak.world.dispatch.limit, 15);
  assert.equal(game.advance(game.setProgram(state, "dispatch", { response: "compensate" })).world.dispatch.limit, 15);
  assert.equal(game.advance(game.setProgram(state, "dispatch", { inside: 55, adjustment: 50 })).world.dispatch.limit, game.dispatchRating);
  assert.notEqual(forecast[0].row.weather.label, forecast[24].row.weather.label);
  assert.ok(forecast[0].row.nodes.solar.available > forecast[24].row.nodes.solar.available);
});

test("Les programmes de la serre et du stockage déplacent leurs usages sans casser une ancienne partie", () => {
  let state = game.newGame();
  state.game.budget = 1500;
  for (const id of ["greenhouse", "apartment-b", "ridge", "windfarm", "pumped"]) state = game.buy(state, id);
  state = game.setProgram(state, "greenhouse", { start: 7, end: 18, mode: "scheduled" });
  state = game.setProgram(state, "pumped", { start: 18, end: 23 });
  state = game.setStorageMode(state, "scheduled");
  const forecast = game.forecast(state, 12);
  assert.ok(forecast[0].row.nodes.greenhouse.demand > 0);
  assert.ok(forecast[0].row.nodes.pumped.charge > 0);
  assert.equal(forecast[6].row.hour, 18);
  assert.equal(forecast[6].row.nodes.greenhouse.demand, 0);
  assert.equal(forecast[6].row.nodes.pumped.charge, 0);
  assert.equal(forecast[6].world.nodes.find(node => node.id === "pumped").storageMode, "discharge");
  assert.equal(forecast[11].world.nodes.find(node => node.id === "pumped").storageMode, "charge");
  const old = { ...state, storageMode: "auto" };
  delete old.programs;
  const restored = game.load({ getItem: () => JSON.stringify(old) });
  assert.ok(restored.built.includes("pumped"));
  assert.deepEqual(restored.programs, game.newGame().programs);
});
