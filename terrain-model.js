(() => {
  "use strict";

  const model = typeof module === "object" ? require("./model.js") : globalThis.GridLab;
  const grid = typeof module === "object" ? require("./region-model.js") : globalThis.GridLabRegional;
  const EPS = 1e-6;
  const storageKey = "gridlab-terrain-v1";
  const efficiency = 0.94;
  const land = 2000;
  const fuelPrice = 160;
  const servicePrice = 0.32;
  const missionHours = 24;
  const credit = "CR";
  const freightLoading = (hour) => (hour >= 5 && hour <= 7) || (hour >= 17 && hour <= 19);
  function windAt(tick) {
    return Math.max(0, 8.0 + 2.55 * Math.sin(tick * Math.PI / 15 - .65) + 2.15 * Math.cos(tick * Math.PI / 28 + .45) + 1.05 * Math.sin(tick * Math.PI / 6));
  }
  const sunAt = (hour) => hour < 6 || hour >= 19 ? 0 : Math.sin((hour - 5.5) / 13 * Math.PI);
  function windPower(rated, wind, setting) {
    if (wind < 3 || wind >= 24) return 0;
    const resource = (wind ** 3 - 27) / (10 ** 3 - 27);
    const extra = (Math.sqrt(1 + 6 * Math.max(0, resource - 1)) - 1) / 3;
    return rated * Math.min(setting, Math.min(1, resource) + Math.min(.5, extra));
  }
  const prices = {
    pole: 22, substation: 135, nuclear: 850, thermal: 500, solar: 210, battery: 255, grid: 160,
    water: 115, pump: 135, house: 75, apartment: 240, office: 195, market: 190, school: 160,
    hospital: 460, industry: 220, charger: 130
  };
  const residenceDefaults = { house: 4, apartment: 56 };
  const groups = {
    distribution: "Distribution",
    generation: "Production et stockage",
    water: "Eau et pompage",
    consumers: "Consommation"
  };
  const catalog = {
    starter: { label: "Groupe d’appoint", icon: "bolt", kind: "starter", radius: 8, power: 0 },
    mill: { label: "Moulin hydraulique", icon: "water", kind: "mill", radius: 13, power: 0 },
    microWind: { label: "Petite éolienne", icon: "bolt", kind: "wind", radius: 6, power: 2.4 },
    windFarm: { label: "Parc éolien des Crêtes", icon: "bolt", kind: "wind", radius: 19, power: 48 },
    greenhouse: { label: "Serre maraîchère", icon: "building", kind: "load", radius: 9, power: 1.2, profile: (hour) => hour < 7 || hour >= 19 ? 1 : .46 },
    station: { label: "Poste des Hauts", icon: "bolt", kind: "relay", radius: 10 },
    dispatch: { label: "Poste programmable", icon: "bolt", kind: "relay", radius: 10 },
    pumped: { label: "Station de pompage-turbinage", icon: "water", kind: "battery", radius: 17, power: 36, capacity: 140, charge: 0, chargeEfficiency: .86, dischargeEfficiency: .88 },
    freight: { label: "Halle ferroviaire", icon: "building", kind: "load", radius: 16, power: 34, profile: (hour) => freightLoading(hour) ? 1 : .035 },
    pole: { label: "Poteau MT", group: "distribution", icon: "tower", kind: "relay", radius: 2 },
    substation: { label: "Poste de distribution", group: "distribution", icon: "bolt", kind: "relay", radius: 9 },
    nuclear: { label: "Centrale nucléaire", group: "generation", icon: "atom", kind: "plant", radius: 17, power: 2500, fuel: 40, water: 8, waterRate: 3 },
    thermal: { label: "Centrale thermique", group: "generation", icon: "factory", kind: "plant", radius: 13, power: 850, fuel: 18, water: 100, waterRate: 0 },
    solar: { label: "Parc solaire", group: "generation", icon: "sun", kind: "solar", radius: 14, power: 350 },
    battery: { label: "Batterie", group: "generation", icon: "battery", kind: "battery", radius: 8, power: 250, capacity: 800, charge: 40 },
    grid: { label: "Réseau extérieur", group: "generation", icon: "tower", kind: "grid", radius: 7, power: 1800 },
    water: { label: "Point d’eau", group: "water", icon: "water", kind: "water", radius: 12, water: 100, recharge: 0.6 },
    pump: { label: "Pompe électrique", group: "water", icon: "pump", kind: "pump", radius: 6, power: 12, flow: 6 },
    ...Object.fromEntries(Object.entries(model.BUILDINGS).map(([type, entry]) => [type, {
      label: entry.name, group: "consumers", kind: "load", power: entry.power,
      radius: type === "house" ? 5 : type === "charger" ? 6 : 8,
      icon: type === "house" ? "home" : type === "industry" ? "factory" : type === "charger" ? "bolt" : "building",
      profile: entry.profile
    }]))
  };
  const fields = {
    voltage: ["Tension nominale MT", "kV", 5, 36, 0.1],
    power: ["Puissance de référence", "kW", 0, 100000, 0.1],
    capacity: ["Capacité", "kWh", 0, 100000, 0.1],
    charge: ["Charge initiale", "%", 0, 100, 0.1],
    fuel: ["Capacité de combustible", "MWh élec.", 0, 10000, 0.1],
    water: ["Capacité du stock d’eau", "m³", 0, 1000000, 0.1],
    waterRate: ["Eau par MWh", "m³/MWh", 0, 100, 0.1],
    recharge: ["Recharge naturelle", "m³/h", 0, 5000, 0.1],
    flow: ["Débit maximal", "m³/h", 0, 5000, 0.1],
    inhabitants: ["Capacité d’accueil", "habitants", 1, 5000, 1],
    beds: ["Lits", "", 1, 2000, 1],
    emergency: ["Autonomie de secours", "h", 0, 48, 0.1],
    resistance: ["Résistance par phase", "Ω/km", 0.01, 2, 0.01],
    amperage: ["Courant admissible", "A", 1, 1000, 1],
    slack: ["Longueur posée / distance", "%", 100, 180, 1],
    length: ["Longueur imposée (0 = automatique)", "km", 0, 100, 0.01]
  };
  const deviceFields = {
    starter: ["power"], mill: ["power"], wind: ["power"],
    relay: [], plant: ["power", "fuel", "water", "waterRate"], solar: ["power"], battery: ["power", "capacity", "charge"],
    grid: ["power"], load: ["power"], water: ["water", "recharge"], pump: ["power", "flow"]
  };
  const cableKeys = ["resistance", "amperage", "slack", "length"];
  const cableDefaults = { resistance: 0.32, amperage: 50, slack: 107, length: 0, enabled: true };
  const tariffFields = {
    offPeak: ["Prix en heures creuses", "CR/kWh", 0, 2, 0.001],
    standard: ["Prix standard", "CR/kWh", 0, 2, 0.001],
    peak: ["Prix de pointe", "CR/kWh", 0, 2, 0.001]
  };
  const diagnostics = {
    open: {
      title: "Circuit ouvert", detail: "La liaison ou l’un de ses modèles est hors service pour ce créneau.",
      tip: "En suivant le trajet des flèches, à quel endroit la continuité du circuit s’interrompt-elle ?"
    },
    unpowered: {
      title: "Câble sans tension", detail: "Aucune source active ne met ce tronçon sous tension à cette heure.",
      tip: "Quelles sources pourraient être disponibles à l’heure affichée sur la frise ?"
    },
    current: {
      title: "Courant admissible atteint", detail: "La simulation plafonne le transfert à la limite de courant de ce câble.",
      tip: "Quelles charges partagent ce tronçon pendant le créneau affiché ?"
    },
    voltage: {
      title: "Chute de tension élevée", detail: "La baisse atteint 5 % de la tension nominale sur le trajet simulé.",
      tip: "Compare les tensions de départ et d’arrivée sur plusieurs tronçons. Où l’écart grandit-il le plus ?"
    },
    length: {
      title: "Longueur imposée incohérente", detail: "La longueur saisie est inférieure à la distance entre les deux modèles. Le calcul utilise leur distance directe.",
      tip: "Qu’indique la distance entre les extrémités par rapport à la longueur renseignée ?"
    },
    unmet: {
      title: "Demande partiellement ou non servie", detail: "Ce modèle reçoit moins de puissance qu’il n’en demande à cette heure.",
      tip: "Remonte le trajet jusqu’à la source et observe à quel point le débit ou la tension change."
    },
    duplicate: {
      title: "Connexion déjà présente", detail: "Un câble existe déjà entre ces deux modèles.",
      tip: "Repère sur la carte les deux extrémités du câble qui suit le même trajet."
    },
    loop: {
      title: "Extrémités identiques", detail: "Le départ et l’arrivée désignent le même modèle.",
      tip: "Suivre le futur trajet sur la carte permet-il de distinguer deux points de raccordement ?"
    },
    ports: {
      title: "Prises incompatibles", detail: "Ces deux modèles ne disposent pas de prises compatibles pour ce type de liaison.",
      tip: "Quelles prises de chaque modèle sont destinées à l’eau ou à l’électricité ?"
    },
    coolant: {
      title: "Eau de refroidissement épuisée", detail: "Le stock d’eau de la centrale est vide au début du créneau. La production est suspendue.",
      tip: "Peux-tu suivre un trajet d’eau jusqu’à la centrale et trouver d’où viendrait l’énergie pour la faire circuler ?"
    },
    fuel: {
      title: "Combustible épuisé", detail: "Le stock de combustible est vide au début du créneau.",
      tip: "Observe la vitesse à laquelle le stock baisse quand la demande augmente."
    },
    plumbing: {
      title: "Circuit d’eau incomplet", detail: "La pompe a besoin d’une prise d’eau et d’une destination active.",
      tip: "En suivant chaque canalisation à partir de la pompe, où arrives-tu de chaque côté ?"
    },
    dry: {
      title: "Prise d’eau à sec", detail: "Les points d’eau reliés à la pompe sont vides au début du créneau.",
      tip: "Compare la consommation d’eau et le rythme de recharge du point d’eau."
    },
    pumpPower: {
      title: "Pompe insuffisamment alimentée", detail: "La puissance électrique reçue limite le débit de pompage.",
      tip: "Suis le câble de la pompe. La source peut-elle démarrer avec ses réserves actuelles ?"
    },
    complaints: {
      title: "Habitants mécontents", detail: "Le logement reçoit trop peu d’électricité et les plaintes s’accumulent. Les coupures répétées peuvent provoquer des départs.",
      tip: "À quelles heures ce logement reçoit-il le moins d’énergie par rapport à sa demande ?"
    },
    departures: {
      title: "Départs d’habitants", detail: "Des habitants quittent ce logement après plusieurs heures de service insuffisant.",
      tip: "Compare les heures de départ au relevé d’énergie et aux autres charges du quartier."
    },
    care: {
      title: "Hôpital sur secours", detail: "L’alimentation principale est insuffisante pour assurer tous les soins. L’hôpital utilise son autonomie de secours.",
      tip: "Combien d’heures d’autonomie reste-t-il au rythme actuel ?"
    },
    deaths: {
      title: "Patients décédés", detail: "Dans la simulation, des patients sont décédés après une insuffisance prolongée d’électricité et de secours.",
      tip: "À quel créneau et sur quel trajet l’autonomie a-t-elle cessé de couvrir le manque ?"
    }
  };

  function valueOf(value, key) {
    const [label, , min, max, step] = fields[key] ?? tariffFields[key];
    const increments = (value - min) / step;
    if (!Number.isFinite(value) || value < min || value > max || Math.abs(increments - Math.round(increments)) > 1e-6) {
      throw new Error(label + " hors plage.");
    }
    return value;
  }

  function tariffsOf(raw = {}) {
    const defaults = model.getSettings("sun");
    const minutes = model.nightWindow(raw);
    return {
      nightEnabled: typeof raw.nightEnabled === "boolean" ? raw.nightEnabled : defaults.nightEnabled,
      ...minutes, ...Object.fromEntries(Object.keys(tariffFields).map((key) => [key, valueOf(raw[key] ?? defaults[key], key)]))
    };
  }

  function nameOf(input) {
    const name = typeof input === "string" ? input.trim() : "";
    if (name.length < 2 || name.length > 48 || /[\x00-\x1f\x7f]/u.test(name)) {
      throw new Error("Renseigne un nom de 2 à 48 caractères.");
    }
    return name;
  }

  function uniqueId(id, used) {
    if (typeof id !== "string" || !/^[a-z0-9-]{1,48}$/u.test(id) || used.has(id)) throw new Error("Identifiant invalide.");
    used.add(id);
    return id;
  }

  function coordinate(value) {
    if (!Number.isInteger(value) || Math.abs(value) > land) throw new Error("Cette position est en dehors du terrain.");
    return value;
  }

  function blank(id, name = "Nouvelle ville") {
    return { id, name, voltage: 20, scenario: "sun", nodes: [], cables: [], tariffs: tariffsOf(), game: gameOf(null, []) };
  }

  function living(type) {
    return Object.hasOwn(residenceDefaults, type);
  }

  function deviceParameters(type) {
    const keys = deviceFields[catalog[type].kind];
    if (living(type)) return [...keys, "inhabitants"];
    if (type === "hospital") return [...keys, "beds", "emergency"];
    return keys;
  }

  function deviceValue(type, key) {
    if (key === "inhabitants") return residenceDefaults[type];
    if (key === "beds") return 60;
    if (key === "emergency") return 2;
    return catalog[type][key];
  }

  function cityOf(previous, nodes) {
    const whole = (value, initial = 0) => Number.isSafeInteger(value) && value >= 0 ? value : initial;
    const homes = Object.fromEntries(nodes.filter((node) => living(node.type)).map((node) => {
      const last = previous?.homes?.[node.id];
      return [node.id, {
        people: Math.min(node.inhabitants, whole(last?.people, node.inhabitants)),
        badHours: whole(last?.badHours), goodHours: whole(last?.goodHours),
        complaints: whole(last?.complaints), departures: whole(last?.departures)
      }];
    }));
    const hospitals = Object.fromEntries(nodes.filter((node) => node.type === "hospital").map((node) => {
      const last = previous?.hospitals?.[node.id];
      return [node.id, {
        patients: Math.min(node.beds, whole(last?.patients, node.beds)),
        backup: Math.max(0, Math.min(node.emergency, Number.isFinite(last?.backup) ? last.backup : node.emergency)),
        deaths: whole(last?.deaths), treated: whole(last?.treated)
      }];
    }));
    const fields = ["complaints", "departures", "arrivals", "deaths", "treated"];
    const journal = Array.isArray(previous?.journal) ? previous.journal.slice(-24).filter((entry) =>
      entry && Number.isSafeInteger(entry.tick) && entry.tick >= 0 && fields.includes(entry.kind) &&
      Number.isSafeInteger(entry.count) && entry.count > 0
    ).map(({ tick, kind, count }) => ({ tick, kind, count })) : [];
    return {
      homes, hospitals, journal,
      ...Object.fromEntries(fields.map((key) => [key, whole(previous?.[key])]))
    };
  }

  function gameOf(previous, nodes) {
    const safe = (value, fallback) => Number.isFinite(value) ? value : fallback;
    const whole = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    const store = (value, start, cap) => Math.max(0, Math.min(cap, safe(value, start)));
    const stocks = Object.fromEntries(nodes.flatMap((node) => {
      const kind = catalog[node.type].kind;
      const stock = previous?.stocks?.[node.id];
      if (kind === "battery") return [[node.id, { soc: store(stock?.soc, node.capacity * node.charge / 100, node.capacity) }]];
      if (kind === "plant") return [[node.id, {
        fuel: store(stock?.fuel, node.fuel, node.fuel), water: store(stock?.water, node.water, node.water)
      }]];
      if (kind === "water") return [[node.id, { water: store(stock?.water, node.water, node.water) }]];
      return [];
    }));
    return {
      elapsed: whole(previous?.elapsed), continuity: whole(previous?.continuity), best: whole(previous?.best),
      budget: safe(previous?.budget, 3200), stocks, city: cityOf(previous?.city, nodes)
    };
  }

  function device(id, type, x, z) {
    const spec = catalog[type];
    return {
      id, type, x, z, name: spec.label, enabled: true,
      ...Object.fromEntries(deviceParameters(type).map((key) => [key, deviceValue(type, key)]))
    };
  }

  function normalize(raw) {
    const ids = new Set();
    const coords = new Set();
    if (!Array.isArray(raw.nodes) || raw.nodes.length > 140 || !Array.isArray(raw.cables) || raw.cables.length > 260) {
      throw new Error("La carte accepte 140 modèles et 260 câbles.");
    }
    const nodes = raw.nodes.map((node) => {
      if (!Object.hasOwn(catalog, node.type)) throw new Error("Modèle inconnu.");
      const { kind } = catalog[node.type];
      const x = coordinate(node.x);
      const z = coordinate(node.z);
      const position = x + "/" + z;
      if (coords.has(position)) throw new Error("Un modèle occupe déjà cette position.");
      coords.add(position);
      let profile;
      if (kind === "load" && node.profile != null) {
        if (!Array.isArray(node.profile) || node.profile.length !== 24) throw new Error("Renseigne les 24 puissances horaires.");
        profile = node.profile.map((power) => valueOf(power, "power"));
      }
      return {
        id: uniqueId(node.id, ids), name: nameOf(node.name), type: node.type, x, z, enabled: node.enabled !== false,
        paid: Math.max(0, Number.isFinite(node.paid) ? node.paid : 0),
        ...Object.fromEntries(deviceParameters(node.type).map((key) => [key, valueOf(node[key] ?? deviceValue(node.type, key), key)])),
        ...(profile ? { profile } : {})
      };
    });
    const cableIds = new Set();
    const endpoints = new Set();
    const types = new Map(nodes.map((node) => [node.id, catalog[node.type].kind]));
    const cables = raw.cables.map((line) => {
      if (!ids.has(line.from) || !ids.has(line.to) || line.from === line.to) throw new Error("Relie deux modèles différents.");
      const medium = line.medium ?? "electric";
      if (!compatible(types.get(line.from), types.get(line.to), medium)) throw new Error(diagnostics.ports.detail);
      const segment = medium + "/" + [line.from, line.to].sort().join("/");
      if (endpoints.has(segment)) throw new Error("Ces modèles sont déjà reliés.");
      endpoints.add(segment);
      return {
        id: uniqueId(line.id, cableIds), name: nameOf(line.name), from: line.from, to: line.to,
        medium, enabled: line.enabled !== false, paid: Math.max(0, Number.isFinite(line.paid) ? line.paid : 0),
        ...Object.fromEntries(cableKeys.map((key) => [key, valueOf(line[key] ?? cableDefaults[key], key)]))
      };
    });
    return {
      id: uniqueId(raw.id, new Set()), name: nameOf(raw.name), voltage: valueOf(raw.voltage, "voltage"),
      scenario: Object.hasOwn(model.PRESETS, raw.scenario) ? raw.scenario : "sun", nodes, cables,
      tariffs: tariffsOf(raw.tariffs ?? {}), game: gameOf(raw.game, nodes)
    };
  }

  function load(storage) {
    try {
      const saved = JSON.parse(storage?.getItem(storageKey));
      const ids = new Set();
      if (saved?.version === 1 && Array.isArray(saved.worlds) && saved.worlds.length <= 30) {
        const worlds = saved.worlds.map((world) => {
          uniqueId(world.id, ids);
          return normalize(world);
        });
        if (worlds.length) return { version: 1, worlds, active: ids.has(saved.active) ? saved.active : worlds[0].id };
      }
    } catch { /* Les fichiers de sauvegarde restent importables. */ }
    return { version: 1, worlds: [blank("terrain-initial")], active: "terrain-initial" };
  }

  function profileOf(node) {
    return node.profile ?? Array.from({ length: 24 }, (_, hour) => node.power * catalog[node.type].profile(hour));
  }

  function compatible(a, b, medium) {
    if (medium === "electric") return a !== "water" && b !== "water";
    if (medium !== "water") return false;
    return (a === "pump" && ["water", "plant"].includes(b)) || (b === "pump" && ["water", "plant"].includes(a));
  }

  function connectionMedium(world, from, to) {
    const kind = (id) => catalog[world.nodes.find((node) => node.id === id)?.type]?.kind;
    return compatible(kind(from), kind(to), "water") ? "water" : "electric";
  }

  function connectionIssue(world, from, to, medium = connectionMedium(world, from, to)) {
    if (from === to) return "loop";
    const kind = (id) => catalog[world.nodes.find((node) => node.id === id)?.type]?.kind;
    if (!compatible(kind(from), kind(to), medium)) return "ports";
    if (world.cables.some((line) => (line.medium ?? "electric") === medium &&
      (line.from === from && line.to === to || line.from === to && line.to === from))) {
      return "duplicate";
    }
    return undefined;
  }

  function lineParameters(cable, nodes, voltage) {
    const a = nodes.get(cable.from);
    const b = nodes.get(cable.to);
    const direct = Math.hypot(b.x - a.x, b.z - a.z, (b.elevation ?? 0) - (a.elevation ?? 0)) / 1000;
    const length = Math.max(direct, cable.length || direct * cable.slack / 100);
    const resistance = length * cable.resistance;
    const alpha = resistance / (1000 * voltage ** 2);
    return { ...cable, direct, length, imposedLength: cable.length, resistance, voltage, alpha,
      capacity: Math.min(Math.sqrt(3) * voltage * cable.amperage, 0.1 / alpha, cable.powerLimit ?? Infinity),
      open: !cable.enabled || !a.enabled || !b.enabled || cable.powerLimit === 0
    };
  }

  function voltageAt(keys, live, lines, nominal) {
    const voltages = new Map(keys.map((key) => [key, live.has(key) ? nominal : 0]));
    for (let i = 0; i < keys.length; i++) {
      let change = false;
      for (const line of lines) {
        if (line.open) continue;
        const forward = line.direction >= 0;
        const source = forward ? line.from : line.to;
        const target = forward ? line.to : line.from;
        const propagated = Math.max(0, voltages.get(source) - line.drop);
        if (propagated > voltages.get(target) + EPS) {
          voltages.set(target, propagated);
          change = true;
        }
        if (!line.direction && voltages.get(target) > voltages.get(source) + EPS) {
          voltages.set(source, voltages.get(target));
          change = true;
        }
      }
      if (!change) break;
    }
    return voltages;
  }

  function checkDiagnostics(lines, meters, voltage) {
    for (const line of lines) {
      const { from, to, drop, current, amperage, open, imposedLength, direct } = line;
      const start = meters[from].voltage;
      const end = meters[to].voltage;
      const flags = [];
      if (open) flags.push("open");
      else {
        if (Math.max(start, end) < EPS) flags.push("unpowered");
        if (current >= amperage - EPS) flags.push("current");
        const low = Math.min(start, end);
        if (drop >= 0.05 * voltage || low > EPS && low <= 0.95 * voltage) flags.push("voltage");
      }
      if (imposedLength > 0 && imposedLength + EPS < direct) flags.push("length");
      line.issues = flags;
    }
    for (const meter of Object.values(meters)) {
      meter.issues = meter.demand - meter.received > 0.01 ? ["unmet"] : [];
    }
  }

  function pumpingPlans(objects, pipes, stocks) {
    const adjacent = new Map(objects.map((node) => [node.id, []]));
    for (const pipe of pipes) {
      if (pipe.open) continue;
      adjacent.get(pipe.from).push({ id: pipe.to, pipe });
      adjacent.get(pipe.to).push({ id: pipe.from, pipe });
    }
    const nodes = new Map(objects.map((node) => [node.id, node]));
    return objects.filter((node) => catalog[node.type].kind === "pump" && node.enabled).map((pump) => {
      const links = adjacent.get(pump.id);
      const intake = links.filter(({ id }) => catalog[nodes.get(id).type].kind === "water");
      const outlets = links.filter(({ id }) => catalog[nodes.get(id).type].kind === "plant");
      const missing = !intake.length || !outlets.length;
      const space = outlets.some(({ id }) => nodes.get(id).water - stocks.get(id).water > EPS);
      const supply = intake.some(({ id }) => stocks.get(id).water > EPS);
      const requested = space && supply && pump.flow > EPS ? pump.power : 0;
      return { pump, intake, outlets, missing, space, supply, requested };
    });
  }

  function circulateWater(plans, stocks, data, nodes) {
    const send = (pipe, from, volume) => {
      pipe.sent += volume;
      pipe.received = pipe.sent;
      pipe.direction = pipe.from === from ? 1 : -1;
    };
    for (const plan of plans) {
      const { pump, intake, outlets, requested, space, supply, missing } = plan;
      const meter = data[pump.id];
      meter.issues = meter.issues.filter((issue) => issue !== "unmet");
      if (missing) meter.issues.push("plumbing");
      else if (space && !supply) meter.issues.push("dry");
      else if (space && supply && pump.flow > EPS && (requested <= EPS || meter.received + 0.01 < requested)) {
        meter.issues.push("pumpPower");
      }
      if (requested <= EPS || meter.received <= EPS) continue;
      let remaining = pump.flow * Math.min(1, meter.received / requested);
      for (const outlet of outlets) {
        const end = stocks.get(outlet.id);
        for (const source of intake) {
          const start = stocks.get(source.id);
          const volume = Math.max(0, Math.min(remaining, start.water, nodes.get(outlet.id).water - end.water));
          if (volume <= EPS) continue;
          start.water -= volume;
          end.water += volume;
          remaining -= volume;
          send(source.pipe, source.id, volume);
          send(outlet.pipe, pump.id, volume);
          meter.waterFlow += volume;
          data[source.id].waterFlow += volume;
          data[outlet.id].waterFlow += volume;
        }
      }
    }
  }

  function needFactor(node, city) {
    const home = city.homes[node.id];
    if (home) return home.people / node.inhabitants;
    const ward = city.hospitals[node.id];
    if (ward) return 0.55 + 0.45 * ward.patients / node.beds;
    return 1;
  }

  function service(node, meter) {
    if (!node.enabled) return 0;
    return meter.demand > EPS ? Math.min(1, meter.received / meter.demand) : Number(meter.voltage > EPS);
  }

  function evolveCity(city, objects, data, demand, tick) {
    const events = { complaints: 0, departures: 0, arrivals: 0, deaths: 0, treated: 0 };
    const hour = tick % 24;
    const profiles = new Map(demand.map((entry) => [entry.key, entry.base]));
    const residents = Object.values(city.homes).reduce((sum, home) => sum + home.people, 0);
    for (const node of objects) {
      const meter = data[node.id];
      const coverage = service(node, meter);
      const home = city.homes[node.id];
      const ward = city.hospitals[node.id];
      if (home) {
        const waiting = node.enabled && home.people > 0 && profiles.get(node.id) <= EPS;
        let leaving = 0;
        if (!waiting && coverage < 0.95) {
          home.goodHours = 0;
          home.badHours++;
          const complaints = home.people ? Math.max(1, Math.ceil(home.people * (1 - coverage) * 0.5)) : 0;
          home.complaints += complaints;
          events.complaints += complaints;
          if (complaints) meter.issues.push("complaints");
          if (home.badHours >= 3 && home.people) {
            leaving = Math.min(home.people, Math.max(1, Math.ceil(home.people * (1 - coverage) * 0.15)));
            home.people -= leaving;
            home.departures += leaving;
            events.departures += leaving;
            meter.issues.push("departures");
          }
        } else if (!waiting) {
          home.badHours = 0;
          home.goodHours++;
          if (home.goodHours >= 4 && home.people < node.inhabitants) {
            const arrivals = Math.min(node.inhabitants - home.people, Math.max(1, Math.ceil(node.inhabitants * 0.08)));
            home.people += arrivals;
            home.goodHours = 0;
            events.arrivals += arrivals;
          }
        }
        meter.community = { ...home, leaving };
      }
      if (ward) {
        let deaths = 0;
        if (coverage < 0.8) {
          if (ward.patients) {
            const deficit = (0.8 - coverage) / 0.8;
            const protectedByReserve = Math.min(deficit, ward.backup);
            ward.backup -= protectedByReserve;
            const uncovered = deficit - protectedByReserve;
            meter.issues.push("care");
            if (uncovered > EPS) {
              deaths = Math.min(ward.patients, Math.max(1, Math.ceil(ward.patients * 0.09 * uncovered)));
              ward.patients -= deaths;
              ward.deaths += deaths;
              events.deaths += deaths;
              meter.issues.push("deaths");
            }
          }
        } else {
          ward.backup = Math.min(node.emergency, ward.backup + 0.75);
          if (hour % 6 === 5 && ward.patients) {
            const treated = Math.max(1, Math.floor(ward.patients / 15));
            ward.patients -= treated;
            ward.treated += treated;
            events.treated += treated;
          }
          if (hour % 3 === 0 && hour >= 6 && hour <= 21) {
            ward.patients = Math.min(node.beds, ward.patients + Math.max(1, Math.ceil(residents / 28)));
          }
        }
        meter.care = { ...ward, deathsThisHour: deaths };
      }
    }
    for (const [kind, count] of Object.entries(events)) {
      city[kind] += count;
      if (count) city.journal.push({ tick, kind, count });
    }
    city.journal = city.journal.slice(-24);
    return events;
  }

  function simulateWindow(world, start, count, game) {
    const { voltage, nodes: objects } = world;
    const scenario = model.PRESETS[world.scenario];
    const nodes = new Map(objects.map((node) => [node.id, node]));
    const keys = [...nodes.keys()];
    const definitions = world.cables.map((cable) => lineParameters(cable, nodes, voltage));
    const stocks = new Map(Object.entries(game.stocks).map(([id, stock]) => [id, { ...stock }]));
    const city = cityOf(game.city, objects);
    const loads = [];
    for (const node of objects) {
      const kind = catalog[node.type].kind;
      if (kind === "load") loads.push({ node, profile: profileOf(node) });
    }
    const priority = ["mill", "wind", "solar", "plant", "battery", "starter", "grid"];
    const rows = Array.from({ length: count }, (_, offset) => {
      const tick = start + offset;
      const hour = tick % 24;
      const weather = world.weather;
      const wind = weather?.wind ?? windAt(tick);
      const tariff = model.tariffAt(hour, world.tariffs ?? tariffsOf());
      const links = definitions.map((line) => ({ ...line, direction: 0, sent: 0, received: 0, loss: 0, issues: [] }));
      const lines = links.filter((line) => line.medium !== "water");
      const pipes = links.filter((line) => line.medium === "water");
      const plans = pumpingPlans(objects, pipes, stocks);
      const sun = sunAt(hour) * scenario.irradiance * (weather?.sun ?? 1);
      const sourceEnabled = !(scenario.outage && hour >= scenario.outage[0] && hour < scenario.outage[1]);
      const suppliers = objects.flatMap((node) => {
        const kind = catalog[node.type].kind;
        if (!priority.includes(kind) || !node.enabled) return [];
        let power = node.power;
        const stock = stocks.get(node.id);
        if (kind === "solar") power *= Math.max(0, sun);
        else if (kind === "wind") power = windPower(power, wind, node.windSetting ?? 1);
        else if (kind === "grid" && !sourceEnabled) power = 0;
        else if (kind === "battery") power = node.storageMode === "charge" ? 0 : Math.min(power, stock.soc * (catalog[node.type].dischargeEfficiency ?? efficiency));
        else if (kind === "plant") power = Math.min(power, stock.fuel * 1000 / (node.fuelFactor ?? 1), node.waterRate ? stock.water * 1000 / node.waterRate : Infinity);
        return [{ key: node.id, kind, available: power, limit: power }];
      }).sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind));
      const demand = loads.map(({ node, profile }) => {
        const base = profile[hour];
        const draw = node.enabled ? base * needFactor(node, city) * (scenario.settings.demand ?? 100) / 100 : 0;
        return { key: node.id, base, remaining: draw, demand: draw, received: 0 };
      });
      const pumps = plans.map(({ pump, requested }) => ({ key: pump.id, remaining: requested, demand: requested, received: 0 }));
      const hospitals = demand.filter(({ key }) => nodes.get(key).type === "hospital");
      const regular = demand.filter(({ key }) => nodes.get(key).type !== "hospital");
      const productive = (entry) => ["greenhouse", "freight"].includes(nodes.get(entry.key).type);
      grid.routeNetwork(keys, lines, suppliers, [...hospitals, ...pumps, ...regular.filter((entry)=>!productive(entry)), ...regular.filter(productive)]);
      const charging = suppliers.filter(({ kind, key, available, limit }) => kind === "battery" && nodes.get(key).storageMode !== "discharge" && limit - available <= EPS)
        .map(({ key }) => {
          const node = nodes.get(key);
          const remaining = Math.max(0, Math.min(node.power, (node.capacity - stocks.get(key).soc) / (catalog[node.type].chargeEfficiency ?? efficiency)));
          return { key, remaining, received: 0 };
        });
      grid.routeNetwork(keys, lines, suppliers.filter(({ kind }) => kind === "solar" || kind === "mill" || kind === "wind"), charging);
      const data = Object.fromEntries(objects.map((node) => [node.id, {
        demand: 0, received: 0, generated: 0, inbound: 0, outbound: 0, charge: 0, stored: 0, available: 0,
        waterFlow: 0, startWater: stocks.get(node.id)?.water, startFuel: stocks.get(node.id)?.fuel,
        ...stocks.get(node.id)
      }]));
      const live = new Set(suppliers.filter(({ limit }) => limit > EPS).map(({ key }) => key));
      for (const supply of suppliers) {
        const generated = Math.max(0, supply.limit - supply.available);
        data[supply.key].generated = generated;
        data[supply.key].available = supply.limit;
        const stock = stocks.get(supply.key);
        if (supply.kind === "battery") {
          stock.soc = Math.max(0, stock.soc - generated / (catalog[nodes.get(supply.key).type].dischargeEfficiency ?? efficiency));
          data[supply.key].soc = stock.soc;
        } else if (supply.kind === "plant") {
          const plant = nodes.get(supply.key);
          stock.fuel = Math.max(0, stock.fuel - generated / 1000 * (plant.fuelFactor ?? 1));
          stock.water = Math.max(0, stock.water - generated / 1000 * plant.waterRate);
          Object.assign(data[supply.key], stock);
        }
      }
      for (const entry of [...demand, ...pumps]) {
        data[entry.key].demand = entry.demand;
        data[entry.key].received = Math.min(entry.demand, entry.received);
      }
      for (const { key, received } of charging) {
        const stock = stocks.get(key);
        const stored = received * (catalog[nodes.get(key).type].chargeEfficiency ?? efficiency);
        stock.soc = Math.min(nodes.get(key).capacity, stock.soc + stored);
        data[key].soc = stock.soc;
        data[key].charge = received;
        data[key].stored = stored;
      }
      for (const line of lines) {
        line.loss = line.alpha * line.sent ** 2;
        line.received = line.sent - line.loss;
        line.current = line.sent / (Math.sqrt(3) * voltage);
        line.drop = line.resistance * line.sent / (1000 * voltage);
        const from = line.direction >= 0 ? line.from : line.to;
        const to = line.direction >= 0 ? line.to : line.from;
        data[from].outbound += line.sent;
        data[to].inbound += line.received;
      }
      const deliveredVoltages = voltageAt(keys, live, lines, voltage);
      for (const key of keys) data[key].voltage = deliveredVoltages.get(key);
      checkDiagnostics(lines, data, voltage);
      for (const { id, type, enabled, waterRate } of objects) {
        const kind = catalog[type].kind;
        if (kind === "plant" && enabled) {
          if (data[id].startFuel <= EPS) data[id].issues.push("fuel");
          if (waterRate > EPS && data[id].startWater <= EPS) data[id].issues.push("coolant");
        }
        if (kind === "water" && enabled && data[id].startWater <= EPS) data[id].issues.push("dry");
      }
      circulateWater(plans, stocks, data, nodes);
      for (const node of objects) {
        const kind = catalog[node.type].kind;
        if (kind === "water" && node.enabled) {
          const stock = stocks.get(node.id);
          stock.water = Math.min(node.water, stock.water + node.recharge);
        }
        if (stocks.has(node.id)) Object.assign(data[node.id], stocks.get(node.id));
      }
      for (const pipe of pipes) if (pipe.open) pipe.issues.push("open");
      const total = (field) => Object.values(data).reduce((sum, node) => sum + node[field], 0);
      const purchased = suppliers.reduce((sum, source) => sum + (source.kind === "grid" ? data[source.key].generated : 0), 0);
      const buildingDemand = demand.reduce((total, entry) => total + entry.demand, 0);
      const buildingServed = demand.reduce((total, entry) => total + Math.min(entry.demand, entry.received), 0);
      const events = evolveCity(city, objects, data, demand, tick);
      return { hour, tick, wind, weather, nodes: data, cables: Object.fromEntries(links.map((line) => [line.id, line])),
        tariff, purchased, bill: tariff.price * purchased, events,
        demand: total("demand"), served: total("received"), generated: total("generated"), buildingDemand, buildingServed,
        losses: lines.reduce((sum, line) => sum + line.loss, 0), charged: total("charge"), stored: total("stored"),
        waterDelivered: objects.filter(({ type }) => catalog[type].kind === "plant").reduce((sum, node) => sum + data[node.id].waterFlow, 0) };
    });
    const daily = Object.fromEntries(["demand", "served", "generated", "losses", "charged", "purchased", "bill", "waterDelivered"]
      .map((field) => [field, rows.reduce((sum, row) => sum + row[field], 0)]));
    return { rows, daily, stocks: Object.fromEntries(stocks), city };
  }

  function simulate(world) {
    return simulateWindow(world, 0, 24, gameOf(null, world.nodes));
  }

  function forecast(world) {
    const game = gameOf(world.game, world.nodes);
    return simulateWindow(world, game.elapsed + 12, 24, game);
  }

  function advance(world) {
    const game = gameOf(world.game, world.nodes);
    const { rows: [row], stocks, city } = simulateWindow(world, game.elapsed + 12, 1, game);
    const continuity = row.buildingDemand > EPS && row.buildingServed / row.buildingDemand >= 0.95 ? game.continuity + 1 : 0;
    return {
      row, world: { ...world, game: {
        stocks, city, elapsed: game.elapsed + 1, continuity,
        best: Math.max(continuity, game.best), budget: game.budget + row.buildingServed * servicePrice - row.bill
      } }
    };
  }

  function refuel(world, id, requested) {
    const plant = world.nodes.find((node) => node.id === id && catalog[node.type].kind === "plant");
    if (!plant || !Number.isFinite(requested) || requested <= 0) throw new Error("Renseigne une quantité de combustible.");
    const game = gameOf(world.game, world.nodes);
    const stock = game.stocks[id];
    const amount = Math.min(plant.fuel - stock.fuel, requested);
    if (amount <= EPS) throw new Error("Le stock de combustible est déjà plein.");
    const cost = amount * fuelPrice;
    if (cost > game.budget + EPS) throw new Error("Le budget est insuffisant pour ce ravitaillement.");
    stock.fuel += amount;
    game.budget -= cost;
    return { world: { ...world, game }, amount, cost };
  }

  function cablePrice(world, from, to, medium) {
    const a = world.nodes.find((node) => node.id === from);
    const b = world.nodes.find((node) => node.id === to);
    if (!a || !b) throw new Error("Choisis deux modèles sur la carte.");
    return (medium === "water" ? 12 : 8) + Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 0.10);
  }

  function spend(world, price) {
    if (!Number.isFinite(price) || price < 0) throw new Error("Prix invalide.");
    if (price > world.game.budget + EPS) throw new Error("Crédits insuffisants pour cet achat.");
    return { ...world, game: { ...world.game, budget: world.game.budget - price } };
  }

  function refund(world, receipts) {
    const amount = Math.floor(receipts.reduce((total, item) => total + (item.paid ?? 0), 0) * 0.4);
    return { world: { ...world, game: { ...world.game, budget: world.game.budget + amount } }, amount };
  }

  function resetGame(world) {
    return { ...world, game: gameOf(null, world.nodes) };
  }

  const api = { storageKey, land, groups, catalog, fields, tariffFields, deviceParameters, cableDefaults, cableKeys,
    valueOf, nameOf, blank, device, normalize, load, profileOf, simulate, forecast, advance, refuel, resetGame,
    diagnostics, connectionIssue, connectionMedium, fuelPrice, servicePrice, missionHours, credit, prices, freightLoading,
    cablePrice, spend, refund, windAt, sunAt };
  if (typeof module === "object") module.exports = api;
  else globalThis.GridLabTerrain = api;
})();
