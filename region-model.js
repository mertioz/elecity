(() => {
  "use strict";

  const EPSILON = 1e-6;
  const HOURS = 24;
  const MIN_DISTANCE = 12;
  const positionFields = {
    x: ["Position est / ouest", "km", -120, 120, 1],
    z: ["Position sud / nord", "km", -120, 120, 1]
  };
  const plantFields = {
    power: ["Puissance électrique maximale", "MW", 0, 50, 0.1],
    fuel: ["Stock de combustible (équivalent électrique)", "MWh", 0, 10000, 0.1],
    water: ["Stock d’eau de refroidissement", "m³", 0, 100000, 1],
    waterRate: ["Eau consommée par MWh produit", "m³/MWh", 0, 50, 0.1]
  };
  const lineFields = {
    voltage: ["Tension de la liaison", "kV", 10, 225, 1],
    resistance: ["Résistance par phase", "Ω/km", 0.01, 1, 0.01],
    amps: ["Courant admissible", "A", 1, 600, 1],
    route: ["Longueur posée / distance directe", "%", 100, 160, 1],
    poles: ["Nombre de pylônes intermédiaires", "", 1, 18, 1]
  };
  const plantDefaults = { power: 2.5, fuel: 40, water: 240, waterRate: 3, enabled: true };
  const lineDefaults = { voltage: 63, resistance: 0.22, amps: 65, route: 110, poles: 5, enabled: true };
  const cityKey = (id) => "city:" + id;
  const plantKey = (id) => "plant:" + id;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const candidates = Array.from({ length: 121 }, (_, index) => ({
    x: (index % 11 - 5) * 24, z: (Math.floor(index / 11) - 5) * 24
  })).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || b.x - a.x || a.z - b.z);

  function numberFields(raw, fields) {
    return Object.fromEntries(Object.entries(fields).map(([key, [label, , min, max, step]]) => {
      const n = raw?.[key];
      const steps = (n - min) / step;
      if (!Number.isFinite(n) || n < min || n > max || Math.abs(steps - Math.round(steps)) > 1e-7) {
        throw new Error(label + " hors plage ou précision incorrecte.");
      }
      return [key, n];
    }));
  }

  function validName(value) {
    const name = typeof value === "string" ? value.trim() : "";
    if (name.length < 2 || name.length > 48 || /[\x00-\x1f\x7f]/u.test(name)) throw new Error("Renseigne un nom de 2 à 48 caractères.");
    return name;
  }

  function validId(id, used) {
    if (typeof id !== "string" || !/^[a-z0-9-]{1,48}$/u.test(id) || used.has(id)) {
      throw new Error("Identifiant régional invalide ou déjà utilisé.");
    }
    used.add(id);
    return id;
  }

  function isFree(position, existing) {
    return existing.every((other) => distance(position, other) >= MIN_DISTANCE);
  }

  function nextPosition(existing, preferred) {
    if (preferred && Number.isFinite(preferred.x) && Number.isFinite(preferred.z)) {
      const clamp = (value) => Math.max(-120, Math.min(120, Math.round(value)));
      const pick = { x: clamp(preferred.x), z: clamp(preferred.z) };
      if (isFree(pick, existing)) return pick;
    }
    return { ...candidates.find((point) => isFree(point, existing)) };
  }

  function normalize(raw, cities) {
    const locations = {};
    const occupied = [];
    for (const city of cities) {
      if (!Object.hasOwn(raw?.locations ?? {}, city.id)) continue;
      const position = numberFields(raw.locations[city.id], positionFields);
      if (!isFree(position, occupied)) throw new Error("Laisse au moins 12 km entre les sites.");
      locations[city.id] = position;
      occupied.push(position);
    }
    const stock = raw?.plants ?? [];
    if (!Array.isArray(stock) || stock.length > 10) throw new Error("La région peut contenir jusqu’à 10 centrales.");
    const plantIds = new Set();
    const plants = stock.map((plant) => {
      const position = numberFields(plant, positionFields);
      if (!isFree(position, occupied)) throw new Error("Laisse au moins 12 km entre les sites.");
      occupied.push(position);
      return { id: validId(plant.id, plantIds), name: validName(plant.name), ...position,
        ...numberFields(plant, plantFields), enabled: plant.enabled !== false };
    });
    for (const city of cities) {
      if (Object.hasOwn(locations, city.id)) continue;
      const position = nextPosition(occupied);
      locations[city.id] = position;
      occupied.push(position);
    }
    const endpoints = new Set([...cities.map(({ id }) => cityKey(id)), ...plants.map(({ id }) => plantKey(id))]);
    const cables = raw?.lines ?? [];
    if (!Array.isArray(cables) || cables.length > 80) throw new Error("La région peut contenir jusqu’à 80 liaisons.");
    const lineIds = new Set();
    const pairs = new Set();
    const lines = cables.map((line) => {
      if (!endpoints.has(line.from) || !endpoints.has(line.to) || line.from === line.to) throw new Error("Choisis deux sites différents.");
      const pair = [line.from, line.to].sort().join("|");
      if (pairs.has(pair)) throw new Error("Ces sites sont déjà reliés.");
      pairs.add(pair);
      return {
        id: validId(line.id, lineIds), name: validName(line.name), from: line.from, to: line.to,
        ...numberFields(line, lineFields), enabled: line.enabled !== false
      };
    });
    return { locations, plants, lines };
  }

  function sites(region, cities) {
    return [
      ...cities.map((city) => ({ key: cityKey(city.id), id: city.id, name: city.name, kind: "city", ...region.locations[city.id] })),
      ...region.plants.map((plant) => ({ ...plant, key: plantKey(plant.id), kind: "plant" }))
    ];
  }

  function lineParameters(line, nodes) {
    const direct = distance(nodes.get(line.from), nodes.get(line.to));
    const length = direct * line.route / 100;
    const resistance = length * line.resistance;
    const thermal = Math.sqrt(3) * line.voltage * line.amps;
    const alpha = resistance / (1000 * line.voltage ** 2);
    const capacity = Math.min(thermal, 0.1 / alpha);
    return { ...line, direct, length, resistance, thermal, capacity, alpha };
  }

  function shortest(start, target, adjacency) {
    const distances = new Map([[start, 0]]);
    const previous = new Map();
    const pending = new Set([start]);
    while (pending.size) {
      let current;
      let cost = Infinity;
      for (const id of pending) {
        if (distances.get(id) < cost) { current = id; cost = distances.get(id); }
      }
      pending.delete(current);
      if (current === target) {
        const arcs = [];
        for (let node = target; node !== start;) {
          const arc = previous.get(node);
          arcs.push(arc);
          node = arc.from;
        }
        return { arcs: arcs.reverse(), cost };
      }
      for (const arc of adjacency.get(current)) {
        const { line, sign } = arc;
        if (line.sent > EPSILON && line.direction !== sign || line.capacity - line.sent < EPSILON) continue;
        const next = cost + line.length * 0.01 + line.alpha * 1e6;
        if (next < (distances.get(arc.to) ?? Infinity)) {
          distances.set(arc.to, next);
          previous.set(arc.to, arc);
          pending.add(arc.to);
        }
      }
    }
    return null;
  }

  function routeTransfer(arcs, input, maximum, commit = false) {
    let delivered = input;
    for (const { line, sign } of arcs) {
      const after = line.sent + delivered;
      if (after > line.capacity + EPSILON) return null;
      const increment = line.alpha * (after ** 2 - line.sent ** 2);
      if (commit) {
        line.sent = after;
        line.direction = sign;
      }
      delivered -= increment;
    }
    return delivered <= maximum + EPSILON ? delivered : null;
  }

  function redistribute(recipient, sources, adjacency) {
    while (recipient.remaining > EPSILON) {
      let chosen;
      let route;
      for (const source of sources) {
        if (source.available <= EPSILON || source.key === recipient.key) continue;
        if (chosen && chosen.kind !== source.kind) break;
        const candidate = shortest(source.key, recipient.key, adjacency);
        if (candidate && (!route || candidate.cost < route.cost)) {
          chosen = source;
          route = candidate;
        }
      }
      if (!route) break;
      const { arcs } = route;
      let low = 0;
      let high = Math.min(chosen.available, arcs[0].line.capacity - arcs[0].line.sent);
      for (let i = 0; i < 32; i++) {
        const mid = (low + high) / 2;
        if (routeTransfer(arcs, mid, recipient.remaining) === null) high = mid;
        else low = mid;
      }
      if (low <= EPSILON) break;
      const delivered = routeTransfer(arcs, low, recipient.remaining, true);
      chosen.available -= low;
      recipient.remaining -= delivered;
      recipient.received += delivered;
    }
  }

  function routeNetwork(keys, lines, sources, recipients) {
    const adjacency = new Map(keys.map((key) => [key, []]));
    for (const line of lines) {
      if (line.open) continue;
      adjacency.get(line.from).push({ from: line.from, to: line.to, sign: 1, line });
      adjacency.get(line.to).push({ from: line.to, to: line.from, sign: -1, line });
    }
    for (const recipient of recipients) redistribute(recipient, sources, adjacency);
  }

  function simulate(region, cities, localRows) {
    const nodes = new Map(sites(region, cities).map((node) => [node.key, node]));
    const lines = region.lines.map((line) => lineParameters(line, nodes));
    const resources = new Map(region.plants.map((plant) => [plant.id, { fuel: plant.fuel, water: plant.water }]));
    const rows = Array.from({ length: HOURS }, (_, hour) => {
      const townRows = new Map(cities.map(({ id }) => [cityKey(id), localRows.get(id)[hour]]));
      const currentLines = lines.map((line) => ({ ...line, sent: 0, direction: 0,
        open: !line.enabled || townRows.get(line.from)?.island || townRows.get(line.to)?.island || false }));
      const territories = [...townRows].map(([key, row]) => ({
        key, kind: "city", row, available: row.exported, remaining: row.imported, received: 0
      }));
      const plants = region.plants.map((plant) => {
        const stock = resources.get(plant.id);
        const limit = plant.enabled ? 1000 * Math.min(plant.power, stock.fuel,
          plant.waterRate ? stock.water / plant.waterRate : Infinity) : 0;
        return { key: plantKey(plant.id), id: plant.id, kind: "plant", limit, available: limit, plant };
      });
      const suppliers = [...territories.filter(({ available }) => available > EPSILON), ...plants];
      routeNetwork([...nodes.keys()], currentLines, suppliers, territories);

      const measured = Object.fromEntries(currentLines.map((line) => {
        const losses = line.alpha * line.sent ** 2;
        return [line.id, {
          sent: line.sent, received: line.sent - losses, losses, direction: line.direction,
          loading: 100 * line.sent / line.capacity, current: line.sent / (Math.sqrt(3) * line.voltage),
          drop: line.resistance * line.sent / (1000 * line.voltage), open: line.open
        }];
      }));
      const production = Object.fromEntries(plants.map(({ id, limit, available, plant }) => {
        const stock = resources.get(id);
        const power = limit - available;
        const useWater = power / 1000 * plant.waterRate;
        stock.fuel = Math.max(0, stock.fuel - power / 1000);
        stock.water = Math.max(0, stock.water - useWater);
        return [id, { power, fuel: stock.fuel, water: stock.water, useWater, available: limit }];
      }));
      const towns = Object.fromEntries(territories.map(({ key, row, available, remaining, received }) => [key, {
        demand: row.demand, served: row.servedLoad, unmet: row.unmet, localLosses: row.loss, island: row.island,
        purchased: Math.max(0, remaining), sold: Math.max(0, available), imported: received, exported: row.exported - available
      }]));
      const total = (items, field) => Object.values(items).reduce((sum, item) => sum + item[field], 0);
      return {
        hour, lines: measured, plants: production, towns,
        losses: total(measured, "losses"), nuclear: total(production, "power"), delivered: total(towns, "imported"),
        upstream: total(towns, "purchased"), localLosses: total(towns, "localLosses"), unmet: total(towns, "unmet")
      };
    });
    const daily = Object.fromEntries(["losses", "nuclear", "delivered", "upstream", "localLosses", "unmet"]
      .map((key) => [key, rows.reduce((sum, row) => sum + row[key], 0)]));
    return { rows, daily, lines: new Map(lines.map((line) => [line.id, line])) };
  }

  const api = { normalize, sites, simulate, routeNetwork, nextPosition, cityKey, plantKey, positionFields, plantFields, lineFields, plantDefaults, lineDefaults };
  if (typeof module === "object") module.exports = api;
  else globalThis.GridLabRegional = api;
})();
