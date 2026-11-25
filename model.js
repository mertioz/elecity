(() => {
  "use strict";

  const HOURS = 24;
  const VOLTAGE = 20;
  const CHARGE_EFFICIENCY = 0.96;
  const DISCHARGE_EFFICIENCY = 0.95;
  const RESERVE = 0.10;
  const WEAR = 0.015;
  const EPSILON = 1e-7;

  const GRID = { name: "Raccordement réseau", r: 1.45, x: 0.90, limit: 48 };
  const DISTRICTS = [
    {
      name: "Résidentiel", r: 2.40, x: 1.15, limit: 24, pf: 0.96,
      profile: [218, 198, 182, 178, 189, 227, 302, 380, 362, 291, 271, 263,
        252, 245, 252, 272, 315, 390, 480, 501, 474, 426, 350, 282]
    },
    {
      name: "Tertiaire", r: 1.70, x: 0.85, limit: 20, pf: 0.93,
      profile: [75, 73, 72, 71, 76, 88, 121, 212, 319, 382, 410, 415,
        398, 406, 420, 415, 392, 326, 232, 171, 139, 126, 105, 90]
    },
    {
      name: "Services publics", r: 1.25, x: 0.64, limit: 9, pf: 0.91,
      profile: [79, 75, 73, 73, 75, 78, 90, 105, 122, 136, 145, 148,
        152, 151, 150, 147, 143, 145, 150, 159, 152, 130, 108, 90]
    }
  ];
  const DISTRICT_IDS = ["residential", "business", "services"];
  const CITY_SIZES = {
    1: { label: "Compacte", lots: 4 },
    2: { label: "Étendue", lots: 8 },
    3: { label: "Grande", lots: 12 }
  };
  const at = (hour, start, end) => hour >= start && hour < end;
  const BUILDINGS = {
    house: { name: "Maison", power: 7, profile: (hour) => at(hour, 17, 22) ? 1 : at(hour, 6, 9) ? 0.72 : 0.32 },
    apartment: { name: "Immeuble", power: 60, profile: (hour) => at(hour, 17, 23) ? 1 : at(hour, 6, 10) ? 0.75 : 0.41 },
    office: { name: "Bureaux", power: 85, profile: (hour) => at(hour, 8, 18) ? 1 : at(hour, 6, 20) ? 0.56 : 0.18 },
    market: { name: "Supermarché", power: 145, profile: (hour) => at(hour, 8, 21) ? 1 : 0.46 },
    school: { name: "École", power: 65, profile: (hour) => at(hour, 7, 17) ? 1 : 0.16 },
    hospital: { name: "Hôpital", power: 250, profile: (hour) => at(hour, 7, 20) ? 1 : 0.76 },
    industry: { name: "Atelier industriel", power: 180, profile: (hour) => at(hour, 6, 22) ? 1 : 0.42 },
    charger: { name: "Recharge électrique", power: 120, profile: (hour) => at(hour, 17, 23) ? 1 : at(hour, 8, 17) ? 0.50 : 0.22 }
  };
  const ORIGINAL_BUILDINGS = [
    ...Array.from({ length: 8 }, (_, i) => ({
      id: "original-maison-" + (i + 1), name: "Maison " + (i + 1), type: "house",
      district: "residential", share: 1 / 8, x: -11.7 + Math.floor(i / 2) * 7.8,
      z: i % 2 ? 4.2 : -4.8, width: 5.6, depth: 5.6, height: 4.6
    })),
    ...[
      [-10, -4.4, 5.8, 7, 12.5, 0xb8cbc5], [-1.7, -4.4, 6.7, 8.3, 18, 0xccd7d1],
      [8.6, -3.9, 7.9, 7.9, 14.8, 0xb7c8c3], [-6.8, 6, 8.7, 4.2, 6.4, 0xc4c5b4],
      [5.8, 6, 8.5, 4.5, 9.4, 0xc3d0c3]
    ].map(([x, z, width, depth, height, color], i) => ({
      id: "original-bureau-" + (i + 1), name: "Bureaux " + (i + 1), type: "office",
      district: "business", share: 1 / 5, x, z, width, depth, height, color
    })),
    {
      id: "original-centre", name: "Centre municipal", type: "office", kind: "Services publics",
      district: "services", share: 0.82, x: -7.2, z: -2, width: 10.6, depth: 13.2, height: 4.8
    },
    {
      id: "original-terrain", name: "Complexe sportif", type: "school", kind: "Équipement sportif",
      district: "services", share: 0.18, x: 6.9, z: 1, width: 13.6, depth: 12.6, height: 0.8
    }
  ];

  const DEFAULTS = {
    solar: 1250, capacity: 1400, batteryPower: 450, demand: 100, flex: 12,
    importLimit: 1400, exportLimit: 450, offPeak: 0.12, standard: 0.21,
    peak: 0.33, feedIn: 0.065,
    nightEnabled: true, nightStartMinute: 23 * 60, nightEndMinute: 6 * 60
  };

  const PRESETS = {
    sun: { name: "Journée ensoleillée", weather: "Soleil", settings: {}, irradiance: 1, temperature: 20 },
    cloud: {
      name: "Ciel couvert", weather: "Nuages", settings: {}, irradiance: 0.47, temperature: 16
    },
    peak: {
      name: "Pointe de demande", weather: "Soleil", settings: { demand: 145, importLimit: 1150 },
      irradiance: 0.9, temperature: 25
    },
    outage: {
      name: "Coupure du réseau", weather: "Soleil", settings: {}, irradiance: 0.85,
      temperature: 21, outage: [18, 21]
    }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const sum = (items, getValue) => items.reduce((total, item) => total + getValue(item), 0);
  const getSettings = (key) => ({ ...DEFAULTS, ...PRESETS[key].settings });
  const loss = (line, p, q) => line.lossCoefficient * (p * p + q * q);

  function getNetwork() {
    const cable = ({ r, x, limit }) => ({ length: 5, resistance: r / 5, reactance: x / 5, limit });
    return {
      size: 1,
      buildings: [],
      originalOverrides: {},
      objectNames: {},
      voltage: VOLTAGE,
      tolerance: 5,
      grid: cable(GRID),
      districts: DISTRICTS.map((line, i) => ({
        id: DISTRICT_IDS[i], name: line.name, scale: 100, pf: line.pf, profile: line.profile.slice(),
        cable: cable(line)
      }))
    };
  }

  function originalBuildings(network) {
    const peaks = Object.fromEntries(network.districts.map((district) => [district.id, Math.max(...district.profile)]));
    return ORIGINAL_BUILDINGS.map((building) => {
      const override = network.originalOverrides?.[building.id];
      const basePower = peaks[building.district] * building.share;
      return {
        ...building, name: override?.name ?? building.name, power: override?.power ?? basePower,
        basePower, profile: override?.profile, stock: true, removed: override?.removed === true
      };
    });
  }

  function allBuildings(network) {
    return [...originalBuildings(network).filter((building) => !building.removed), ...(network.buildings ?? [])];
  }

  function buildingReferenceProfile(network, building) {
    if (building.profile) return building.profile.slice();
    const district = network.districts.find(({ id }) => id === building.district);
    const peak = building.stock ? Math.max(...district.profile) : 0;
    return Array.from({ length: HOURS }, (_, hour) =>
      building.power * (peak ? district.profile[hour] / peak : BUILDINGS[building.type].profile(hour)));
  }

  function electricalNetwork(network) {
    const { voltage, tolerance } = network;
    function line(cable) {
      const r = cable.length * cable.resistance;
      return {
        ...cable, r, x: cable.length * cable.reactance,
        lossCoefficient: r / (1000 * voltage ** 2)
      };
    }
    const originals = originalBuildings(network);
    return {
      voltage, tolerance,
      grid: { ...line(network.grid), name: network.objectNames?.grid ?? GRID.name },
      districts: network.districts.map((district) => ({ ...district, ...line(district.cable) })),
      originals,
      additions: network.buildings ?? [],
      buildings: [...originals.filter((building) => !building.removed), ...(network.buildings ?? [])]
    };
  }

  function nightWindow(config) {
    function minute(setting, legacy, fallback) {
      const hours = config[legacy];
      if (Number.isInteger(hours) && hours >= 0 && hours < 24) return hours * 60;
      const precise = config[setting];
      return Number.isInteger(precise) && precise >= 0 && precise < 1440 ? precise : fallback;
    }
    return {
      nightStartMinute: minute("nightStartMinute", "nightStart", DEFAULTS.nightStartMinute),
      nightEndMinute: minute("nightEndMinute", "nightEnd", DEFAULTS.nightEndMinute)
    };
  }

  function tariffAt(hour, config) {
    const { nightStartMinute: start, nightEndMinute: end } = nightWindow(config);
    const isPeak = at(hour, 17, 22);
    const regular = isPeak ? config.peak : config.standard;
    const startOfHour = hour * 60;
    const ranges = start <= end ? [[start, end]] : [[0, end], [start, 1440]];
    const nightSpans = [];
    if (config.nightEnabled) {
      for (const [from, to] of ranges) {
        const left = Math.max(0, from - startOfHour);
        const right = Math.min(60, to - startOfHour);
        if (right > left) nightSpans.push([left, right]);
      }
    }
    const nightMinutes = sum(nightSpans, ([left, right]) => right - left);
    const price = nightMinutes === 60 ? config.offPeak : nightMinutes === 0 ? regular
      : (config.offPeak * nightMinutes + regular * (60 - nightMinutes)) / 60;
    const tariff = nightMinutes === 60 ? "Heures creuses"
      : nightMinutes > 0 ? "Mixte" : isPeak ? "Pointe" : "Standard";
    return { price, tariff, nightMinutes, nightSpans };
  }

  function hourlyProfiles(preset, config, network) {
    const cloudCover = [0.76, 0.82, 0.67, 0.92, 1.12, 0.85, 1.04, 0.72, 0.89, 1.10, 0.81, 0.94];
    const districtScale = network.districts.map((district) => district.scale * config.demand / 10000);
    return Array.from({ length: HOURS }, (_, hour) => {
      const daylight = Math.max(0, Math.sin(Math.PI * (hour + 0.5 - 6) / 13));
      const cloudFactor = preset.weather === "Nuages" ? cloudCover[clamp(hour - 7, 0, 11)] : 1;
      const irradiance = (hour >= 6 && hour < 19) ? 1000 * daylight * preset.irradiance * cloudFactor : 0;
      const cellTemperature = preset.temperature + 25 * irradiance / 800;
      const dc = config.solar * irradiance / 1000 * (1 - 0.0037 * (cellTemperature - 25));
      const pv = Math.min(config.solar * 0.85, dc * 0.965);
      const island = Boolean(preset.outage && hour >= preset.outage[0] && hour < preset.outage[1]);
      const districts = network.districts.map((district, index) => district.profile[hour] * districtScale[index]);
      const buildingBase = {};
      const fixedDemand = [0, 0, 0];
      for (const building of network.originals) {
        const index = DISTRICT_IDS.indexOf(building.district);
        const initial = network.districts[index].profile[hour] * districtScale[index] * building.share;
        const newDemand = building.removed ? 0 : building.profile ? building.profile[hour] * districtScale[index]
          : building.power === building.basePower ? initial
          : building.basePower ? initial * building.power / building.basePower
            : BUILDINGS[building.type].profile(hour) * building.power * districtScale[index];
        districts[index] += newDemand - initial;
        if (!building.removed) buildingBase[building.id] = newDemand;
        if (building.profile) fixedDemand[index] += newDemand;
      }
      for (const building of network.additions) {
        const index = DISTRICT_IDS.indexOf(building.district);
        const reference = building.profile?.[hour] ?? building.power * BUILDINGS[building.type].profile(hour);
        const demand = reference * districtScale[index];
        districts[index] += demand;
        buildingBase[building.id] = demand;
        if (building.profile) fixedDemand[index] += demand;
      }
      return {
        hour, irradiance, pv, island, ...tariffAt(hour, config),
        importLimit: island ? 0 : config.importLimit,
        exportLimit: island ? 0 : config.exportLimit,
        districts: districts.map((power) => Math.max(0, power)), buildingBase, fixedDemand
      };
    });
  }

  function profileWithDemand(profile, districts, network) {
    const q = districts.map((p, index) => p * Math.tan(Math.acos(network.districts[index].pf)));
    return {
      ...profile, districts, reactive: q, totalQ: sum(q, (value) => value),
      demand: sum(districts, (value) => value),
      branchLoss: districts.reduce((value, p, i) => value + loss(network.districts[i], p, q[i]), 0)
    };
  }

  function demandSchedules(profiles, config, network) {
    const original = profiles.map((hour) => profileWithDemand(hour, hour.districts, network));
    if (config.flex === 0 || config.demand === 0) return [original];

    const schedules = [original];
    for (const fraction of [0.5, 1]) {
      for (const policy of ["lissé", "solaire"]) {
        const demand = profiles.map((hour) => hour.districts.slice());
        for (let i = 0; i < network.districts.length; i++) {
          let remaining = 0;
          for (let hour = 17; hour < 22; hour++) {
            const eligible = Math.max(0, demand[hour][i] - profiles[hour].fixedDemand[i]);
            const shifted = eligible * config.flex / 100 * fraction;
            demand[hour][i] -= shifted;
            remaining += shifted;
          }
          const slots = [11, 12, 13, 14, 15];
          if (policy === "lissé") {
            for (const hour of slots) demand[hour][i] += remaining / slots.length;
            continue;
          }
          // Répartit l'appoint par petits pas vers le plus grand surplus prévu.
          const increment = remaining / 40;
          const limits = slots.map((hour) => profiles[hour].districts[i] * 1.25);
          for (let step = 0; step < 40; step++) {
            let chosen = -1;
            let bestSurplus = -Infinity;
            for (let slot = 0; slot < slots.length; slot++) {
              const hour = slots[slot];
              const surplus = profiles[hour].pv - sum(demand[hour], (p) => p);
              if (surplus > bestSurplus && demand[hour][i] + increment <= limits[slot] + EPSILON) {
                chosen = hour;
                bestSurplus = surplus;
              }
            }
            if (chosen < 0) {
              // La quantité retirée en soirée est toujours reportée intégralement.
              for (const hour of slots) demand[hour][i] += increment * (40 - step) / slots.length;
              break;
            }
            demand[chosen][i] += increment;
          }
        }
        schedules.push(profiles.map((hour, index) => profileWithDemand(hour, demand[index], network)));
      }
    }
    return schedules;
  }

  function dispatch(hour, charge, discharge, config, network) {
    const gridLine = network.grid;
    const net = (served) => hour.demand * served + hour.branchLoss * served ** 2
      + charge - discharge - hour.pv;
    const meter = (p, served) => hour.island ? p : p + loss(gridLine, p, hour.totalQ * served);
    if (discharge > EPSILON && net(1) < -EPSILON) return null;

    let served = 1;
    if (meter(net(1), 1) > hour.importLimit + EPSILON) {
      if (charge > EPSILON) return null;
      let lower = 0;
      let upper = 1;
      for (let step = 0; step < 36; step++) {
        const middle = (lower + upper) / 2;
        if (meter(net(middle), middle) > hour.importLimit) upper = middle;
        else lower = middle;
      }
      served = lower;
    }

    let p = net(served);
    let curtailed = 0;
    if (meter(p, served) < -hour.exportLimit - EPSILON) {
      // Inversion stable de P compteur = P barre + a × (P barre² + Q²).
      const a = hour.island ? 0 : gridLine.lossCoefficient;
      const target = -hour.exportLimit - a * (hour.totalQ * served) ** 2;
      const boundedP = 2 * target / (1 + Math.sqrt(1 + 4 * a * target));
      curtailed = boundedP - p;
      p = boundedP;
    }

    const grid = hour.island ? 0 : meter(p, served);
    const imported = Math.max(0, grid);
    const exported = Math.max(0, -grid);
    return {
      p, charge, discharge, imported, exported, served,
      curtailed, unmet: hour.demand * (1 - served),
      loss: hour.branchLoss * served ** 2 + (hour.island ? 0 : loss(gridLine, p, hour.totalQ * served)),
      bill: imported * hour.price - exported * config.feedIn
    };
  }

  function better(unmet, cost, referenceUnmet, referenceCost) {
    return unmet < referenceUnmet - EPSILON
      || (Math.abs(unmet - referenceUnmet) <= EPSILON && cost < referenceCost - EPSILON);
  }

  function planStorage(hours, config, network) {
    const usable = config.capacity * (1 - RESERVE);
    if (usable === 0 || config.batteryPower === 0) {
      const actions = hours.map((hour) => dispatch(hour, 0, 0, config, network));
      return {
        actions, states: Array(HOURS).fill(config.capacity * RESERVE),
        unmet: sum(actions, (action) => action.unmet), cost: sum(actions, (action) => action.bill)
      };
    }

    const resolution = Math.max(72, 2 * Math.ceil(usable / (config.batteryPower * CHARGE_EFFICIENCY)));
    const increment = usable / resolution;
    const up = Math.min(resolution, Math.floor((config.batteryPower * CHARGE_EFFICIENCY + EPSILON) / increment));
    const down = Math.min(resolution, Math.floor((config.batteryPower + EPSILON) / (increment * DISCHARGE_EFFICIENCY)));
    const actionsByHour = hours.map((hour) => Array.from({ length: up + down + 1 }, (_, index) => {
      const delta = (index - down) * increment;
      return dispatch(hour, Math.max(0, delta / CHARGE_EFFICIENCY),
        Math.max(0, -delta * DISCHARGE_EFFICIENCY), config, network);
    }));

    let futureUnmet = new Float64Array(resolution + 1).fill(Infinity);
    let futureCost = new Float64Array(resolution + 1).fill(Infinity);
    // État final identique à l'état initial, tous deux à la réserve minimale.
    futureUnmet[0] = 0;
    futureCost[0] = 0;
    const nextState = Array.from({ length: HOURS }, () => new Int32Array(resolution + 1));

    for (let hour = HOURS - 1; hour >= 0; hour--) {
      const currentUnmet = new Float64Array(resolution + 1).fill(Infinity);
      const currentCost = new Float64Array(resolution + 1).fill(Infinity);
      for (let state = 0; state <= resolution; state++) {
        const first = Math.max(0, state - down);
        const last = Math.min(resolution, state + up);
        for (let end = first; end <= last; end++) {
          const action = actionsByHour[hour][end - state + down];
          if (!action || !Number.isFinite(futureCost[end])) continue;
          const unmet = action.unmet + futureUnmet[end];
          const cost = action.bill + action.discharge * WEAR + futureCost[end];
          if (better(unmet, cost, currentUnmet[state], currentCost[state])) {
            currentUnmet[state] = unmet;
            currentCost[state] = cost;
            nextState[hour][state] = end;
          }
        }
      }
      futureUnmet = currentUnmet;
      futureCost = currentCost;
    }

    const states = [];
    let state = 0;
    const actions = hours.map((_, hour) => {
      const end = nextState[hour][state];
      const action = actionsByHour[hour][end - state + down];
      states.push(config.capacity * RESERVE + end * increment);
      state = end;
      return action;
    });
    return { actions, states, unmet: futureUnmet[0], cost: futureCost[0] };
  }

  function lineMetrics(line, p, q, receivedVoltage, network, open = false) {
    const apparent = Math.hypot(p, q);
    const current = apparent / (Math.sqrt(3) * network.voltage);
    const loading = 100 * current / line.limit;
    const voltageDeviation = 100 * (receivedVoltage - network.voltage) / network.voltage;
    return {
      name: line.name, length: line.length, limit: line.limit, resistance: line.resistance, reactance: line.reactance,
      p, q, apparent, current, voltage: Math.max(0, receivedVoltage), voltageDeviation, loading, open,
      warning: !open && (loading > 100 || Math.abs(voltageDeviation) > network.tolerance)
    };
  }

  function allocateBuildingDemand(hours, reference, building) {
    const district = DISTRICT_IDS.indexOf(building.district);
    const baseline = reference.map((hour) => hour.buildingBase[building.id]);
    if (building.profile) return baseline;
    const shifts = hours.map((hour, index) => hour.districts[district] - reference[index].districts[district]);
    const removed = shifts.map((delta, index) =>
      delta < 0 ? -delta * baseline[index] / (reference[index].districts[district] - reference[index].fixedDemand[district]) : 0);
    const added = sum(shifts, (delta) => Math.max(0, delta));
    const shareOfShift = added ? sum(removed, (value) => value) / added : 0;
    return shifts.map((delta, index) => baseline[index] - removed[index] + Math.max(0, delta) * shareOfShift);
  }

  function finalize(hours, plan, config, reference, network) {
    const buildings = network.buildings.map((building) => ({
      id: building.id, demand: allocateBuildingDemand(hours, reference, building)
    }));
    const rows = hours.map((hour, index) => {
      const action = plan.actions[index];
      const q = hour.totalQ * action.served;
      const energized = !hour.island || hour.pv + action.discharge > EPSILON;
      const nominal = network.voltage;
      const upstreamDrop = hour.island ? 0 : (network.grid.r * action.p + network.grid.x * q) / (1000 * nominal);
      const bus = energized ? nominal - upstreamDrop : 0;
      const lines = hour.districts.map((demand, i) => {
        const line = network.districts[i];
        const p = demand * action.served;
        const reactive = hour.reactive[i] * action.served;
        const voltage = bus - (line.r * p + line.x * reactive) / (1000 * nominal);
        return lineMetrics(line, p, reactive, voltage, network);
      });
      lines.unshift(lineMetrics(network.grid, action.imported - action.exported, hour.island ? 0 : q, bus, network, hour.island));
      const soc = plan.states[index];
      const buildingLoads = Object.fromEntries(buildings.map((building) => {
        const demand = building.demand[index];
        return [building.id, { demand, supplied: demand * action.served }];
      }));
      return {
        ...hour, ...action, bus: Math.max(0, bus), nominal, energized, lines, buildingLoads, soc, q, servedLoad: hour.demand * action.served,
        socPercent: config.capacity ? 100 * soc / config.capacity : 0,
        shift: hour.demand - reference[index].demand,
        pvUsed: hour.pv - action.curtailed, cost: action.bill + action.discharge * WEAR,
        batteryLoss: action.charge * (1 - CHARGE_EFFICIENCY)
          + action.discharge * (1 / DISCHARGE_EFFICIENCY - 1)
      };
    });
    const totals = {};
    for (const key of ["demand", "servedLoad", "pv", "pvUsed", "charge", "discharge", "imported",
      "exported", "loss", "batteryLoss", "bill", "cost", "curtailed", "unmet"]) {
      totals[key] = sum(rows, (row) => row[key]);
    }
    totals.shifted = sum(rows, (row) => Math.max(0, row.shift));
    totals.peak = Math.max(...rows.map((row) => row.imported));
    totals.warningHours = rows.filter((row) => row.lines.some((line) => line.warning)).length;
    totals.minVoltage = Math.min(...rows.flatMap((row) => row.lines.map((line) => line.voltage)));
    return { rows, totals };
  }

  function simulate(key = "sun", settings = getSettings(key), network = getNetwork()) {
    settings = { ...getSettings(key), ...settings };
    const circuit = electricalNetwork(network);
    const profiles = hourlyProfiles(PRESETS[key], settings, circuit);
    const schedules = demandSchedules(profiles, settings, circuit);
    const reference = schedules[0];
    const baseline = planStorage(reference, { ...settings, batteryPower: 0 }, circuit);
    let bestHours = reference;
    let optimized = baseline;
    for (const candidate of schedules) {
      const plan = planStorage(candidate, settings, circuit);
      if (better(plan.unmet, plan.cost, optimized.unmet, optimized.cost)) {
        bestHours = candidate;
        optimized = plan;
      }
    }
    return {
      baseline: finalize(reference, baseline, settings, reference, circuit),
      optimized: finalize(bestHours, optimized, settings, reference, circuit)
    };
  }

  const api = {
    simulate, getSettings, getNetwork, originalBuildings, allBuildings, buildingReferenceProfile, nightWindow, tariffAt,
    PRESETS, GRID, DISTRICTS, DISTRICT_IDS, CITY_SIZES, BUILDINGS, ORIGINAL_BUILDINGS,
    HOURS, VOLTAGE, RESERVE, CHARGE_EFFICIENCY, DISCHARGE_EFFICIENCY, WEAR
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.GridLab = api;
})();
