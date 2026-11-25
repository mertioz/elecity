(() => {
  "use strict";

  const grid = typeof module === "object" ? require("./terrain-model.js") : globalThis.GridLabTerrain;
  const valley = typeof module === "object" ? require("./valley.js") : globalThis.GridLabValley;
  const storageKey = "gridlab-campagne-v1";
  const startingCredits = 10;
  const income = 1.60;
  const fuelPack = { price: 24, energy: 100 };
  const hydraulicHead = 4.8;
  const hydraulicEfficiency = 0.76;
  const harvestHours = 6;
  const harvestPrice = 8;
  const trainPrice = 96;
  const trainGoal = 3;
  const dispatchRating = 60;
  const programs = {
    dispatch: { start: 7, end: 22, inside: 45, outside: 40, response: "fixed", adjustment: 20 },
    greenhouse: { start: 7, end: 20, mode: "always" },
    pumped: { start: 17, end: 23 }
  };
  const weatherResponses = { fixed: "Fixe", follow: "Suivre la météo", compensate: "Compenser la météo" };
  const greenhouseModes = { always: "Toute la journée", scheduled: "Sur la plage" };
  const skies = [
    { label: "Ciel dégagé", sun: 1, breeze: 1, river: 1, temperature: 19 },
    { label: "Nuageux", sun: .72, breeze: .94, river: 1, temperature: 16 },
    { label: "Pluie", sun: .48, breeze: 1.02, river: 1.15, temperature: 13 },
    { label: "Venteux", sun: .87, breeze: 1.21, river: 1, temperature: 15 }
  ];
  const slots = [
    { id: "starter", type: "starter", name: "Groupe d’appoint", x: -52, z: 25, price: 10, note: "Une séquence de cinq boutons prépare l’énergie du créneau." },
    { id: "mill", type: "mill", name: "Moulin hydraulique", x: -68, z: -28, price: 114, note: "Transforme le débit du ruisseau en production continue." },
    { id: "house", type: "house", name: "Maison du Pont", x: 23, z: 16, inhabitants: 6, power: 7, residents: 4, price: 0 },
    { id: "apartment-a", type: "apartment", name: "Les Tilleuls", x: 54, z: -13, inhabitants: 16, power: 12, residents: 4, price: 42, note: "16 places. Les habitants s’installent si le courant reste fiable." },
    { id: "apartment-b", type: "apartment", name: "Les Terrasses", x: 51, z: 44, inhabitants: 20, power: 15, residents: 5, price: 78, note: "20 places. Prévois de la puissance pour les heures de pointe." },
    { id: "battery", type: "battery", name: "Batterie de quartier", x: -34, z: 55, capacity: 35, power: 13, charge: 0, price: 75, note: "Stocke le surplus des renouvelables et restitue l’énergie quand la demande augmente." },
    { id: "solar", type: "solar", name: "Parc solaire", x: -19, z: -55, power: 26, price: 105, note: "Complète le moulin pendant la journée." },
    { id: "hospital", type: "hospital", name: "Clinique du Ruisseau", x: 66, z: -54, power: 13, beds: 18, emergency: 2, price: 115, note: "Soins prioritaires. L’autonomie de secours couvre deux heures sans courant." },
    { id: "plant", type: "nuclear", name: "Centrale du Ruisseau", x: 8, z: 96, power: 45, fuel: 4, water: 2.4, waterRate: 22, price: 360, note: "La centrale nucléaire apporte une réserve de puissance. Le combustible et l’eau du réservoir s’épuisent en produisant." },
    { id: "pump", type: "pump", name: "Pompe de refroidissement", x: -76, z: 75, power: 1.8, flow: 1.6, price: 80, requires: "plant", note: "Remplit le réservoir de la centrale avec l’eau du ruisseau. La pompe doit recevoir du courant pour fonctionner." },
    { id: "breeze", type: "microWind", name: "Éolienne de prairie", x: -40, z: -16, price: 8, power: 2.4, note: "Une première source automatique. Le vent change d’heure en heure et fait aussi tourner le rotor la nuit." },
    { id: "greenhouse", type: "greenhouse", name: "Serre maraîchère", x: 18, z: -33, price: 9, power: 1.2, note: "Six heures alimentées à 90 % donnent une récolte de 8 CR. Le froid de la nuit augmente sa demande." },
    { id: "dispatch", type: "dispatch", name: "Poste programmable", x: -1, z: 40, price: 160, requires: "apartment-a", note: "Pilote le départ des logements et de la serre. Programme le plafond en kW selon l’heure et la météo." },
    { id: "ridge", type: "station", name: "Poste des Hauts", x: -163, z: -16, price: 180, requires: "apartment-b", note: "Construit deux pylônes et franchit la rivière. Les installations du plateau passent par ce départ moyenne tension." },
    { id: "windfarm", type: "windFarm", name: "Parc éolien des Crêtes", x: -215, z: -62, power: 48, price: 290, requires: "ridge", feed: "ridge", note: "Deux grandes éoliennes alimentent le plateau. Leur surplus peut être mis en réserve pour la gare." },
    { id: "pumped", type: "pumped", name: "Station de pompage-turbinage", x: -226, z: 45, power: 36, capacity: 140, charge: 0, price: 410, requires: "ridge", feed: "ridge", note: "L’eau du bassin supérieur stocke jusqu’à 140 kWh. Choisis quand pomper le surplus renouvelable et quand turbiner." },
    { id: "freight", type: "freight", name: "Halle ferroviaire", x: -154, z: 79, power: 34, price: 340, requires: "ridge", feed: "ridge", note: "Deux trains par jour. Alimente le quai à 95 % de 05 h à 08 h ou de 17 h à 20 h pour gagner 96 CR au départ." }
  ];
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  const adjustable = { starter: "combustible", mill: "débit d’eau", plant: "combustible et eau de refroidissement", pump: "courant", breeze: "vent", windfarm: "vent" };
  const storageModes = { auto: "Automatique", charge: "Pompage seul", discharge: "Turbinage seul", scheduled: "Programme horaire" };
  const hub = grid.device("poste", "substation", -7, 1);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function inWindow(hour, { start, end }) {
    if (start === end) return true;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  function weatherAt(tick) {
    const sky = skies[Math.floor(tick / 24) % skies.length];
    const hour = tick % 24;
    const wind = grid.windAt(tick) * sky.breeze;
    const sunlight = grid.sunAt(hour) * sky.sun;
    const renewable = wind >= 10 || sunlight >= .65 ? 1 : wind < 7 && sunlight < .35 ? -1 : 0;
    const temperature = Math.round(sky.temperature + 4 * Math.sin((hour - 8) * Math.PI / 12));
    return { label: sky.label, sun: sky.sun, wind, river: sky.river, temperature, renewable };
  }

  function validProgramField(key, value) {
    if (key === "response") return Object.hasOwn(weatherResponses, value);
    if (key === "mode") return Object.hasOwn(greenhouseModes, value);
    const max = key === "start" || key === "end" ? 23 : key === "adjustment" ? 50 : dispatchRating;
    return Number.isInteger(value) && value >= 0 && value <= max;
  }

  function programsFrom(raw) {
    return Object.fromEntries(Object.entries(programs).map(([id, defaults]) => [id,
      Object.fromEntries(Object.entries(defaults).map(([key, value]) => {
        const saved = raw?.[id]?.[key];
        return [key, validProgramField(key, saved) ? saved : value];
      }))
    ]));
  }

  function setProgram(state, id, values) {
    if (!Object.hasOwn(programs, id) || !state.built.includes(id)) throw new Error("Programme indisponible pour cette installation.");
    const next = { ...state.programs[id], ...values };
    if (!Object.keys(programs[id]).every(key => validProgramField(key, next[key]))) throw new Error("Vérifie les heures et les limites de puissance.");
    return { ...state, programs: programsFrom({ ...state.programs, [id]: next }) };
  }

  function dispatchAt(program, hour, weather) {
    const active = inWindow(hour, program);
    const base = active ? program.inside : program.outside;
    const direction = program.response === "follow" ? 1 : program.response === "compensate" ? -1 : 0;
    const limit = clamp(base * (1 + direction * weather.renewable * program.adjustment / 100), 0, dispatchRating);
    return { active, base, limit };
  }

  function hydraulics(flow, head, efficiency, hours = 1) {
    const power = 9.81 * flow * head * efficiency;
    return { power, energy: power * hours };
  }

  function electrical({ power, voltage, pf, length, resistance, reactance, hours }) {
    const apparent = power / pf;
    const sin = Math.sqrt(Math.max(0, 1 - pf ** 2));
    const reactive = apparent * sin;
    const current = apparent / (Math.sqrt(3) * voltage);
    const drop = Math.sqrt(3) * current * length * (resistance * pf + reactance * sin);
    const loss = 3 * current ** 2 * resistance * length / 1000;
    return { apparent, reactive, current, drop, dropPercent: drop / (10 * voltage), loss, energy: power * hours, lostEnergy: loss * hours };
  }

  function worldOf(state, production = {}) {
    const starter = grid.blank("ruisseau", "Le Ruisseau");
    const tick = 12 + (state.game?.elapsed ?? 0);
    const hour = tick % 24;
    const weather = production.weather ?? weatherAt(tick);
    const hasDispatch = state.built.includes("dispatch");
    const nodes = [hub];
    const cables = [];
    for (const id of state.built) {
      const slot = byId.get(id);
      const node = grid.device(id, slot.type, slot.x, slot.z);
      const settings = Object.fromEntries(grid.deviceParameters(slot.type).filter((key) => slot[key] !== undefined)
        .map((key) => [key, slot[key]]));
      nodes.push({ ...node, ...settings, name: slot.name });
      const guided = hasDispatch && ["house", "apartment-a", "apartment-b", "greenhouse"].includes(id);
      const from = guided ? "dispatch" : id === "ridge" ? "west-pole" : slot.feed ?? "poste";
      cables.push({ ...grid.cableDefaults, id: "liaison-" + id, name: "Départ " + slot.name, from, to: id });
    }
    if (state.built.includes("ridge")) {
      nodes.push({ ...grid.device("east-pole", "pole", -66, -5), name: "Pylône de la prairie" },
        { ...grid.device("west-pole", "pole", -126, -5), name: "Pylône du plateau" });
      cables.push({ ...grid.cableDefaults, id: "poste-rive", name: "Départ vers les Hauts", from: "poste", to: "east-pole" },
        { ...grid.cableDefaults, id: "traversee", name: "Traversée de la rivière", from: "east-pole", to: "west-pole" });
    }
    if (state.built.includes("pump")) {
      nodes.push({ ...grid.device("intake", "water", -101, 77), name: "Prise d’eau du ruisseau", water: 8, recharge: 8 });
      cables.push(
        { ...grid.cableDefaults, id: "aspiration", name: "Conduite d’aspiration", from: "intake", to: "pump", medium: "water" },
        { ...grid.cableDefaults, id: "refroidissement", name: "Conduite de refroidissement", from: "pump", to: "plant", medium: "water" }
      );
    }
    const verified = grid.normalize({ ...starter, nodes, cables, game: state.game });
    verified.weather = weather;
    if (hasDispatch) {
      verified.dispatch = dispatchAt(state.programs.dispatch, hour, weather);
      verified.cables.find(cable => cable.to === "dispatch").powerLimit = verified.dispatch.limit;
    }
    // Les puissances instantanées ne sont pas des réglages saisis au dixième.
    for (const node of verified.nodes) {
      node.elevation = node.type === "water" ? 0 : valley.height(node.x, node.z);
      if (Object.hasOwn(production, node.id)) node.power = production[node.id];
      if (grid.catalog[node.type].kind === "wind") node.windSetting = state.settings[node.id] / 100;
      if (node.id === "pumped") node.storageMode = state.storageMode === "scheduled"
        ? inWindow(hour, state.programs.pumped) ? "discharge" : "charge" : state.storageMode;
      if (node.id === "greenhouse") {
        const program = state.programs.greenhouse;
        if (program.mode === "scheduled" && !inWindow(hour, program)) node.power = 0;
      }
      if (node.id === "plant" && production.plantPenalty !== undefined) {
        node.fuelFactor = production.plantPenalty;
        node.waterRate *= production.plantPenalty;
      }
      if (node.id === "pump" && production.pumpFlow !== undefined) node.flow = production.pumpFlow;
    }
    return verified;
  }

  function newGame() {
    const state = { version: 1, built: ["house", "starter"], settings: Object.fromEntries(Object.keys(adjustable).map((id) => [id, 100])), fuel: 180,
      manual: null, served: 0, income: 0, last: null, game: null, storageMode: "auto", programs: programsFrom(),
      jobs: { cropHours: 0, harvests: 0, loading: 0, trains: 0, missed: 0 } };
    const game = worldOf(state).game;
    return { ...state, game: { ...game, budget: startingCredits, city: {
      ...game.city, homes: { ...game.city.homes, house: { ...game.city.homes.house, people: 4 } }
    } } };
  }

  function load(storage) {
    try {
      const raw = JSON.parse(storage?.getItem(storageKey));
      if (!raw || raw.version !== 1 || !Array.isArray(raw.built)) return newGame();
      const valid = newGame();
      const owned = (id) => byId.has(id) && raw.built.includes(id) && (!byId.get(id).requires || owned(byId.get(id).requires));
      const built = [...new Set(["house", ...raw.built.filter(owned)])];
      const settings = Object.fromEntries(Object.keys(adjustable).map((id) => [id,
        Number.isInteger(raw.settings?.[id]) ? clamp(raw.settings[id], 0, 150) : 100]));
      const finite = (n, fallback) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : fallback;
      const state = { ...valid, built, settings, game: raw.game ?? valid.game,
        fuel: finite(raw.fuel, 180), served: finite(raw.served, 0), income: finite(raw.income, 0), programs: programsFrom(raw.programs) };
      if (Object.hasOwn(storageModes, raw.storageMode)) state.storageMode = raw.storageMode;
      for (const key of Object.keys(state.jobs)) if (Number.isSafeInteger(raw.jobs?.[key]) && raw.jobs[key] >= 0) state.jobs[key] = raw.jobs[key];
      state.jobs.cropHours %= harvestHours;
      state.jobs.loading = Math.min(2, state.jobs.loading);
      if (raw.last && [raw.last.hour, raw.last.delivered, raw.last.credit].every((n) => Number.isFinite(n) && n >= 0)) {
        state.last = { hour: raw.last.hour, delivered: raw.last.delivered, credit: raw.last.credit,
          sales: finite(raw.last.sales, raw.last.credit), crop: finite(raw.last.crop, 0), freight: finite(raw.last.freight, 0),
          fuel: finite(raw.last.fuel, 0), water: finite(raw.last.water, 0) };
      }
      state.game = worldOf(state).game;
      if (built.includes("starter") && raw.manual?.at === state.game.elapsed && Number.isInteger(raw.manual.hits)
          && raw.manual.hits >= 0 && raw.manual.hits <= 5) state.manual = { at: raw.manual.at, hits: raw.manual.hits };
      return state;
    } catch { return newGame(); }
  }

  function buy(state, id) {
    const slot = byId.get(id);
    if (!slot || state.built.includes(id)) throw new Error("Cet emplacement est déjà occupé.");
    if (slot.requires && !state.built.includes(slot.requires)) throw new Error(requirement(slot));
    if (state.game.budget + 1e-6 < slot.price) throw new Error("Il manque " + Math.ceil(slot.price - state.game.budget) + " CR.");
    const draft = { ...state, built: [...state.built, id] };
    const game = worldOf(draft).game;
    if (slot.residents !== undefined) game.city.homes[id].people = slot.residents;
    return { ...draft, game: { ...game, budget: game.budget - slot.price } };
  }

  function requirement(slot) {
    return slot.requires === "plant" ? "Construis d’abord la centrale." : "Construction requise · " + byId.get(slot.requires).name;
  }

  function setStorageMode(state, mode) {
    if (!state.built.includes("pumped") || !Object.hasOwn(storageModes, mode)) throw new Error("Consigne de stockage indisponible.");
    return { ...state, storageMode: mode };
  }

  function tune(state, id, percentage) {
    if (!state.built.includes(id) || !Object.hasOwn(adjustable, id)) throw new Error("Cette installation ne se règle pas.");
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 150) throw new Error("Choisis une puissance de 0 à 150 %.");
    return { ...state, settings: { ...state.settings, [id]: percentage } };
  }

  function refuel(state, id = "starter") {
    if (id === "plant") {
      const { world } = grid.refuel(worldOf(state), id, 1);
      return { ...state, game: world.game };
    }
    if (!state.built.includes("starter")) throw new Error("Installe d’abord le groupe.");
    if (state.game.budget + 1e-6 < fuelPack.price) throw new Error("Le bidon coûte " + fuelPack.price + " CR.");
    if (state.fuel > 260) throw new Error("Le réservoir peut contenir jusqu’à 360 kWh de combustible.");
    return { ...state, fuel: state.fuel + fuelPack.energy, game: { ...state.game, budget: state.game.budget - fuelPack.price } };
  }

  function sequence(state, shownAt = state.game.elapsed) {
    let seed = 83 + shownAt * 31;
    return Array.from({ length: 5 }, () => {
      seed = (seed * 16807) % 2147483647;
      return ["A", "B", "C", "D"][seed % 4];
    });
  }

  function manual(state, input, shownAt = state.game.elapsed) {
    if (!state.built.includes("starter") || state.manual?.at === state.game.elapsed) throw new Error("Le groupe a déjà été préparé pour cette heure.");
    if (!Array.isArray(input) || input.length !== 5 || input.some((key) => !["A", "B", "C", "D"].includes(key))) throw new Error("Termine les cinq commandes.");
    const expected = sequence(state, shownAt);
    const hits = input.filter((key, index) => key === expected[index]).length;
    return { ...state, manual: { at: state.game.elapsed, hits } };
  }

  function river(tick) {
    const hour = tick % 24;
    return 1.10 + 0.16 * Math.sin((hour - 3) * Math.PI / 12) + 0.06 * Math.cos(tick * Math.PI / 31);
  }

  function penalty(rate) {
    const over = Math.max(0, rate - 1);
    return 1 + 0.35 * over + 1.3 * over ** 2;
  }

  function production(state) {
    const tick = 12 + state.game.elapsed;
    const weather = weatherAt(tick);
    const manualRate = state.settings.starter / 100;
    const wheelRate = state.settings.mill / 100;
    const heads = state.manual?.at === state.game.elapsed ? state.manual.hits : 0;
    const scored = heads * 2 + (heads === 5 ? 3 : 0);
    const fuelPerKwh = penalty(manualRate) / 0.32;
    const starter = state.built.includes("starter") ? Math.min(scored * manualRate, state.fuel / fuelPerKwh) : 0;
    const flow = river(tick) * weather.river;
    const wheelPenalty = penalty(wheelRate);
    const used = state.built.includes("mill") ? Math.min(flow, flow * 0.43 * wheelRate * wheelPenalty) : 0;
    const mill = hydraulics(used, hydraulicHead, hydraulicEfficiency / wheelPenalty).power;
    const plantRate = state.settings.plant / 100;
    const plant = byId.get("plant").power * plantRate;
    const plantPenalty = penalty(plantRate);
    const plantWaterRate = byId.get("plant").waterRate * plantPenalty;
    const tank = state.game.stocks.plant;
    const plantAvailable = tank ? Math.min(plant, tank.fuel * 1000 / plantPenalty, tank.water * 1000 / plantWaterRate) : 0;
    const pumpRate = state.settings.pump / 100;
    const pump = byId.get("pump").power * pumpRate ** 3;
    const pumpFlow = byId.get("pump").flow * pumpRate;
    return { starter, mill, flow, used, fuelPerKwh, scored, millPenalty: wheelPenalty, weather,
      plant, plantPenalty, plantWaterRate, plantAvailable, pump, pumpFlow };
  }

  function advance(state) {
    const sources = production(state);
    const world = worldOf(state, sources);
    const { row, world: next } = grid.advance(world);
    const generated = row.nodes.starter?.generated ?? 0;
    const extracted = row.nodes.mill?.generated ?? 0;
    const fuel = generated * sources.fuelPerKwh;
    const water = sources.mill > 0 ? sources.used * extracted / sources.mill : 0;
    const jobs = { ...state.jobs };
    const greenhouse = row.nodes.greenhouse;
    const terminal = row.nodes.freight;
    const qualifies = (meter, ratio) => meter && meter.demand > 0 && meter.received + 1e-6 >= ratio * meter.demand;
    if (qualifies(greenhouse, .90)) jobs.cropHours++;
    const crop = jobs.cropHours === harvestHours ? harvestPrice : 0;
    if (crop) { jobs.harvests++; jobs.cropHours = 0; }
    let freight = 0;
    if (terminal && grid.freightLoading(row.hour)) {
      jobs.loading = qualifies(terminal, .95) ? jobs.loading + 1 : 0;
      if (row.hour === 7 || row.hour === 19) {
        if (jobs.loading === 3) { freight = trainPrice; jobs.trains++; }
        else jobs.missed++;
        jobs.loading = 0;
      }
    } else jobs.loading = 0;
    // La serre et le quai appartiennent au village. Leurs recettes proviennent de la vente des récoltes et des contrats.
    const billable = Math.max(0, row.buildingServed - (greenhouse?.received ?? 0) - (terminal?.received ?? 0));
    const sales = billable * income;
    const credit = sales + crop + freight;
    const last = { hour: row.hour, delivered: row.buildingServed, credit, sales, crop, freight, fuel, water };
    return { row, sources, world, last, state: {
      ...state, jobs, manual: null, fuel: Math.max(0, state.fuel - fuel),
      served: state.served + row.buildingServed, income: state.income + credit, last,
      game: { ...next.game, budget: state.game.budget + credit - row.bill }
    } };
  }

  function forecast(initial, hours = 24) {
    let state = initial;
    return Array.from({ length: hours }, () => {
      const result = advance(state);
      state = result.state;
      return result;
    });
  }

  const api = { storageKey, startingCredits, slots, adjustable, storageModes, weatherResponses, greenhouseModes,
    harvestHours, harvestPrice, trainPrice, trainGoal, dispatchRating, income, fuelPack, hydraulicHead, hydraulicEfficiency,
    newGame, load, worldOf, buy, requirement, tune, setStorageMode, setProgram, refuel, manual, sequence, production, advance, forecast, hydraulics, electrical };
  if (typeof module === "object") module.exports = api;
  else globalThis.GridLabCampaign = api;
})();
