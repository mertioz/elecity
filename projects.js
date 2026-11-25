(() => {
  "use strict";

  const model = typeof module === "object" ? require("./model.js") : globalThis.GridLab;
  const regional = typeof module === "object" ? require("./region-model.js") : globalThis.GridLabRegional;
  const storageKey = "gridlab-workspace-v1";
  const maxCities = 30;
  const maxName = 48;
  const buildingPower = ["Pointe de référence", "kW", 0, 500, 0.1];
  const originalPower = ["Pointe de référence", "kW", 0, 1000, 0.1];
  const originalIds = new Set(model.ORIGINAL_BUILDINGS.map(({ id }) => id));
  const namedObjects = ["solar", "battery", "grid", "bus"];

  const cableFields = {
    length: ["Longueur", "km", 0.05, 12, 0.01],
    resistance: ["Résistance linéique R", "Ω/km", 0.001, 1, 0.001],
    reactance: ["Réactance linéique X", "Ω/km", 0, 0.75, 0.001],
    limit: ["Courant admissible", "A", 1, 1200, 1]
  };
  const cityFields = {
    voltage: ["Tension nominale", "kV", 10, 35, 0.1],
    tolerance: ["Écart de tension avant alerte", "%", 1, 15, 0.1]
  };
  const districtFields = {
    scale: ["Facteur de demande du quartier", "%", 0, 220, 1],
    pf: ["Facteur de puissance (cos φ)", "", 0.8, 1, 0.01]
  };
  const cablePresets = {
    overhead: { name: "Aérien · démo", resistance: 0.32, reactance: 0.34, limit: 95 },
    aluminum: { name: "Souterrain aluminium · démo", resistance: 0.25, reactance: 0.11, limit: 150 },
    copper: { name: "Souterrain cuivre · démo", resistance: 0.125, reactance: 0.1, limit: 220 }
  };

  function nameOf(value) {
    const name = typeof value === "string" ? value.trim() : "";
    if (name.length < 2 || name.length > maxName || /[\x00-\x1f\x7f]/u.test(name)) {
      throw new Error("Le nom doit contenir de 2 à 48 caractères visibles.");
    }
    return name;
  }

  function ranged(value, field) {
    const [label, , min, max, step] = field;
    const precision = Math.abs((value - min) / step - Math.round((value - min) / step));
    if (!Number.isFinite(value) || value < min || value > max || precision > 1e-7) {
      throw new Error(label + " hors plage ou précision incorrecte.");
    }
    return value;
  }

  function numericObject(value, schema) {
    return Object.fromEntries(Object.entries(schema).map(([key, field]) => [key, ranged(value?.[key], field)]));
  }

  function hourlyProfile(value, max) {
    if (!Array.isArray(value) || value.length !== model.HOURS) throw new Error("Renseigne les 24 puissances du bâtiment.");
    return value.map((power) => ranged(power, ["Puissance horaire", "kW", 0, max, 0.1]));
  }

  function availableLots(network, district, except) {
    const taken = new Set(network.buildings.filter((building) => building.district === district && building.id !== except)
      .map((building) => building.lot));
    return Array.from({ length: model.CITY_SIZES[network.size].lots }, (_, lot) => lot).filter((lot) => !taken.has(lot));
  }

  function networkOf(value) {
    if (!Array.isArray(value?.districts) || value.districts.length !== model.DISTRICT_IDS.length) {
      throw new Error("Le réseau doit contenir les trois quartiers de la maquette.");
    }
    const size = value.size ?? 1;
    if (!Number.isInteger(size) || !Object.hasOwn(model.CITY_SIZES, size)) throw new Error("Taille de ville invalide.");
    const rawBuildings = value.buildings ?? [];
    if (!Array.isArray(rawBuildings) || rawBuildings.length > 36) throw new Error("Liste de bâtiments invalide.");
    const ids = new Set();
    const limit = model.CITY_SIZES[size].lots;
    const occupied = new Map(model.DISTRICT_IDS.map((id) => [id, new Set()]));
    const buildings = rawBuildings.map((building) => {
      const { id, type, district, lot } = building ?? {};
      if (typeof id !== "string" || !/^[a-z0-9-]{1,48}$/u.test(id) || ids.has(id) || originalIds.has(id)
          || !Object.hasOwn(model.BUILDINGS, type) || !model.DISTRICT_IDS.includes(district)) {
        throw new Error("Identifiant, type ou quartier de bâtiment invalide.");
      }
      ids.add(id);
      if (lot !== undefined) {
        const districtLots = occupied.get(district);
        if (!Number.isInteger(lot) || lot < 0 || lot >= limit) throw new Error("La taille choisie ne comprend pas tous les terrains occupés.");
        if (districtLots.has(lot)) throw new Error("Ce terrain est déjà occupé.");
        districtLots.add(lot);
      }
      const profile = building.profile == null ? {} : { profile: hourlyProfile(building.profile, buildingPower[3]) };
      return { id, type, district, lot, name: nameOf(building.name), power: ranged(building.power, buildingPower), ...profile };
    });
    for (const building of buildings) {
      if (building.lot !== undefined) continue;
      const districtLots = occupied.get(building.district);
      let lot = 0;
      while (districtLots.has(lot)) lot++;
      if (lot >= limit) throw new Error("Cette taille de ville n’offre pas assez de terrains pour tous les bâtiments du quartier.");
      building.lot = lot;
      districtLots.add(lot);
    }
    const originalOverrides = {};
    for (const [id, entry] of Object.entries(value.originalOverrides ?? {})) {
      if (!originalIds.has(id) || !entry || typeof entry !== "object") throw new Error("Bâtiment d’origine invalide.");
      originalOverrides[id] = {};
      if (entry.name !== undefined) originalOverrides[id].name = nameOf(entry.name);
      if (entry.power !== undefined) originalOverrides[id].power = ranged(entry.power, originalPower);
      if (entry.profile != null) originalOverrides[id].profile = hourlyProfile(entry.profile, originalPower[3]);
      if (entry.removed === true) originalOverrides[id].removed = true;
    }
    return {
      size, buildings, originalOverrides,
      objectNames: Object.fromEntries(namedObjects.filter((key) => Object.hasOwn(value.objectNames ?? {}, key))
        .map((key) => [key, nameOf(value.objectNames[key])])),
      ...numericObject(value, cityFields),
      grid: numericObject(value.grid, cableFields),
      districts: model.DISTRICT_IDS.map((id, index) => {
        const district = value.districts[index];
        if (district?.id !== id || !Array.isArray(district.profile) || district.profile.length !== model.HOURS) {
          throw new Error("Le profil de chaque quartier doit comporter 24 puissances horaires.");
        }
        return {
          id, name: nameOf(district.name), ...numericObject(district, districtFields),
          profile: district.profile.map((value) => ranged(value, ["Puissance horaire", "kW", 0, 1000, 1])),
          cable: numericObject(district.cable, cableFields)
        };
      })
    };
  }

  function scenariosOf(raw) {
    const scenarios = {};
    for (const key of Object.keys(model.PRESETS)) {
      if (!raw?.[key] || typeof raw[key] !== "object") continue;
      const defaults = model.getSettings(key);
      const saved = raw[key];
      scenarios[key] = Object.fromEntries(Object.keys(defaults).filter((field) => {
        const value = saved[field];
        return typeof defaults[field] === "boolean" ? typeof value === "boolean" : Number.isFinite(value);
      }).map((field) => [field, saved[field]]));
      Object.assign(scenarios[key], model.nightWindow(saved));
    }
    return scenarios;
  }

  function cleanCity(value, id) {
    return { id, name: nameOf(value?.name), network: networkOf(value?.network), scenarios: scenariosOf(value?.scenarios) };
  }

  function load(storage) {
    try {
      const value = JSON.parse(storage.getItem(storageKey));
      if (value?.version !== 1 || !Array.isArray(value.cities) || !value.cities.length || value.cities.length > maxCities) {
        throw new Error("Espace absent ou illisible.");
      }
      const ids = new Set();
      const cities = value.cities.map((city) => {
        const id = city?.id;
        if (typeof id !== "string" || !/^[a-z0-9-]{1,48}$/u.test(id) || ids.has(id)) throw new Error("Identifiant invalide.");
        ids.add(id);
        return cleanCity(city, id);
      });
      let region;
      try { region = regional.normalize(value.region, cities); }
      catch { region = regional.normalize(null, cities); }
      return { version: 1, cities, region, activeId: ids.has(value.activeId) ? value.activeId : cities[0].id };
    } catch {
      const cities = [{
        id: "demo", name: "Ville de démonstration", network: model.getNetwork(), scenarios: {}
      }];
      return { version: 1, activeId: "demo", cities, region: regional.normalize(null, cities) };
    }
  }

  function sameName(cities, name, except) {
    return cities.some((city) => city.id !== except && city.name.localeCompare(name, "fr", { sensitivity: "accent" }) === 0);
  }

  function add(workspace, value) {
    if (workspace.cities.length >= maxCities) throw new Error("Cet espace contient déjà 30 villes.");
    const city = cleanCity(value, crypto.randomUUID());
    let suffix = 2;
    const name = city.name;
    while (sameName(workspace.cities, city.name)) {
      const ending = " (" + suffix++ + ")";
      city.name = name.slice(0, maxName - ending.length) + ending;
    }
    workspace.cities.push(city);
    workspace.activeId = city.id;
    workspace.region = regional.normalize(workspace.region, workspace.cities);
    return city;
  }

  function encode(city) {
    const { name, network, scenarios } = city;
    return JSON.stringify({ format: "gridlab-city", version: 1, city: { name, network, scenarios } }, null, 2);
  }

  function decode(text) {
    const data = JSON.parse(text);
    if (data?.format !== "gridlab-city" || data.version !== 1) throw new Error("Ce fichier ne correspond pas à une ville GridLab.");
    return cleanCity(data.city);
  }

  const api = {
    load, add, encode, decode, sameName, storageKey, maxCities, maxName,
    nameOf, networkOf, availableLots, cableFields, cityFields, districtFields, cablePresets, buildingPower, originalPower
  };
  if (typeof module === "object") module.exports = api;
  else globalThis.GridLabProjects = api;
})();
