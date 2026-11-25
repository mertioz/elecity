(() => {
  "use strict";

  const model = globalThis.GridLab;
  const projects = globalThis.GridLabProjects;
  const { assets, create: createCity } = globalThis.GridLabCity;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const icons = {
    bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
    compare: '<path d="M4 20h16M7 16v-4m5 4V5m5 11V8"/>',
    book: '<path d="M5 20V5a2 2 0 0 1 2-2h12v18H7a2 2 0 0 1 0-4h12M9 7h6m-6 4h4"/>',
    network: '<rect x="9" y="2" width="6" height="5" rx="1"/><path d="M12 7v5m-7 0h14M5 12v4m7-4v4m7-4v4"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="9" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/>',
    cable: '<path d="M5 17h2a3 3 0 0 0 3-3v-4a3 3 0 0 1 3-3h6"/><circle cx="4" cy="17" r="2"/><circle cx="20" cy="7" r="2"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
    settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    cloud: '<path d="M6 18a4 4 0 1 1 .5-8 6 6 0 0 1 11.4 1.5h.6a3.3 3.3 0 0 1 0 6.5Z"/>',
    outage: '<path d="m12 3 9 17H3L12 3Zm0 6v4m0 3v.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    activity: '<path d="M2 12h5l3-6 4 12 3-6h5"/>',
    battery: '<rect x="2" y="6" width="17" height="12" rx="2"/><path d="M22 10v4M6 12h4m-2-2v4"/>',
    tower: '<path d="M8 22 11 3h2l3 19M5 8h14M4 14h16M9 18l6-4m-6 0 6 4M6 8v2m12-2v2M5 14v2m14-2v2"/>',
    home: '<path d="m3 11 9-8 9 8v9H3v-9Zm7 9v-6h4v6"/>',
    building: '<path d="M5 21V3h11v18M3 21h18m-5-13h3v13M9 7h3m-3 4h3m-3 4h3"/>',
    public: '<path d="m3 9 9-5 9 5H3Zm1 11h16M6 12v5m6-5v5m6-5v5"/>',
    euro: '<path d="M17 5.5a6 6 0 1 0 0 13M4 10h10M4 14h9"/>',
    play: '<path d="m8 5 12 7-12 7Z"/>',
    pause: '<path d="M8 5h2v14H8zM15 5h2v14h-2z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    moon: '<path d="M20 15a8 8 0 0 1-11-11A8 8 0 1 0 20 15Z"/>',
    rotate: '<path d="M4 11a8 8 0 1 1 2 6m-2-6V5m0 6h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    maximize: '<rect x="6" y="6" width="12" height="12" rx=".5"/>',
    restore: '<path d="M9 6h9v9"/><rect x="5" y="9" width="10" height="10" rx=".4"/>',
    focus: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/><circle cx="12" cy="12" r="2"/>'
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  }

  const workspaceDialogs = ["buildings", "compare", "model"];

  const fields = [
    ["Production et stockage", [
      ["solar", "Puissance crête solaire", "kWc", 0, 3000, 25],
      ["capacity", "Capacité de batterie", "kWh", 0, 4000, 50],
      ["batteryPower", "Puissance de batterie", "kW", 0, 1600, 50]
    ]],
    ["Demande", [
      ["demand", "Niveau de demande", "%", 0, 220, 1],
      ["flex", "Demande déplaçable en pointe", "%", 0, 30, 1]
    ]],
    ["Raccordement", [
      ["importLimit", "Limite d’import", "kW", 0, 2600, 25],
      ["exportLimit", "Limite d’injection", "kW", 0, 2600, 25]
    ]],
    ["Autres tarifs", [
      ["standard", "Tarif standard", "€/kWh", 0, 2, 0.001],
      ["peak", "Tarif de pointe (17 h – 22 h)", "€/kWh", 0, 2, 0.001],
      ["feedIn", "Prix de revente au réseau", "€/kWh", 0, 2, 0.001]
    ]]
  ];
  const nightPriceField = ["offPeak", "Tarif en heures creuses", "€/kWh", 0, 2, 0.001];
  const numericFields = [...fields.flatMap(([, group]) => group), nightPriceField];
  const districtAssets = model.DISTRICT_IDS;
  const lineAssets = ["grid", ...districtAssets];
  const storage = (() => {
    try { return localStorage; } catch { return null; }
  })();
  const workspace = projects.load(storage);
  const regionalModel = globalThis.GridLabRegional;
  const activeCity = () => workspace.cities.find((city) => city.id === workspace.activeId);
  const buildingFromAsset = (key) => key.startsWith("building:") ? state.buildingIndex.get(key.slice(9)) : undefined;
  const assetName = (key) => buildingFromAsset(key)?.name
    ?? activeCity().network.districts.find((district) => district.id === key)?.name
    ?? activeCity().network.objectNames[key] ?? assets[key]?.name;
  const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  function readSettings(scenario, city = activeCity()) {
    const values = model.getSettings(scenario);
    try {
      const legacy = city.id === "demo" ? storage?.getItem("gridlab-v1.1:" + scenario) : null;
      const saved = city.scenarios[scenario] ?? (legacy && JSON.parse(legacy));
      if (!saved) return values;
      for (const [key, , , min, max, step] of numericFields) {
        const value = saved[key];
        const steps = (value - min) / step;
        if (Number.isFinite(value) && value >= min && value <= max && Math.abs(steps - Math.round(steps)) < 1e-7) {
          values[key] = value;
        }
      }
      if (typeof saved.nightEnabled === "boolean") values.nightEnabled = saved.nightEnabled;
      const window = model.nightWindow(saved);
      if (window.nightStartMinute !== window.nightEndMinute) Object.assign(values, window);
    } catch {
      // Le simulateur reste utilisable si le stockage du navigateur est désactivé.
    }
    return values;
  }

  function saveWorkspace() {
    try {
      if (!storage) return false;
      storage.setItem(projects.storageKey, JSON.stringify(workspace));
      return true;
    } catch {
      return false;
    }
  }

  function saveSettings() {
    activeCity().scenarios[state.scenario] = { ...state.config };
    return saveWorkspace();
  }

  const formats = new Map();
  const state = {
    scenario: "sun", config: readSettings("sun"), strategy: "optimized", hour: 12,
    asset: "bus", objectKey: null, result: null, timer: null, buildingIndex: new Map(), sceneMode: "dashboard"
  };
  let city;
  let refreshBuildings;
  let editMap;
  let editObject;
  let region;
  let newCityPosition;
  const themeKey = "gridlab-theme";

  function initialTheme() {
    try { return storage?.getItem(themeKey) === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]').content = dark ? "#181c23" : "#f4f5f7";
    const label = dark ? "Passer au thème clair" : "Passer au thème sombre";
    $("#theme-toggle").setAttribute("aria-label", label);
    $("#theme-toggle").title = label;
    $("#theme-toggle i").innerHTML = icon(dark ? "sun" : "moon");
    city?.setTheme(dark);
    drawChart();
  }
  let chartGeometry = null;
  let noticeTimer;

  function number(value, digits = 0) {
    if (!formats.has(digits)) {
      formats.set(digits, new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: digits, maximumFractionDigits: digits
      }));
    }
    const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
    return formats.get(digits).format(rounded);
  }

  function signed(value, digits = 0) {
    const sign = Math.abs(value) >= 0.5 * 10 ** -digits ? (value < 0 ? "−" : "+") : "";
    return sign + number(Math.abs(value), digits);
  }

  const kw = (value) => `${number(value)} kW`;
  const clock = (hour) => `${String(hour).padStart(2, "0")}:00`;
  const minuteClock = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const readTime = (value) => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
  const interval = (hour) => `${clock(hour)} – ${clock(hour + 1)}`;
  const put = (id, text) => { document.getElementById(id).textContent = text; };
  const selected = () => state.result[state.strategy];

  function status(message) {
    put("notice", message);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => put("notice", ""), 2800);
  }

  function kpi(label, value, unit, detail, tone = "") {
    return `<article class="kpi">
      <h3 class="kpi-label">${label}</h3>
      <strong class="kpi-value">${value} <small>${unit}</small></strong>
      <p class="kpi-foot ${tone}">${detail}</p>
    </article>`;
  }

  function renderDashboard() {
    const { totals } = selected();
    const { baseline, optimized } = state.result;
    const difference = optimized.totals.cost - baseline.totals.cost;
    const costText = state.strategy === "baseline" ? "Sans batterie ni report"
      : Math.abs(difference) < 0.05 ? "Coût équivalent à la référence"
        : `${signed(difference, 1)} € vs sans pilotage`;
    $("#kpis").innerHTML = [
      kpi("Demande totale", number(totals.demand / 1000, 2), "MWh",
        totals.unmet > 0.05 ? `${number(totals.unmet)} kWh non servis` : "Demande entièrement servie",
        totals.unmet > 0.05 ? "warn" : ""),
      kpi("Production solaire", number(totals.pvUsed / 1000, 2), "MWh",
        `${number(state.config.solar)} kWc installés`),
      kpi("Coût d’exploitation", number(totals.cost, 0), "€", costText,
        state.strategy === "optimized" && difference < -0.05 ? "good" : "")
    ].join("");

    const metrics = [
      ["Énergie importée", totals.imported, "kWh"],
      ["Pointe d’import", totals.peak, "kW"],
      ["Énergie injectée", totals.exported, "kWh"],
      ["Solaire écrêté", totals.curtailed, "kWh"],
      ["Batterie chargée / déchargée", `${number(totals.charge)} / ${number(totals.discharge)}`, "kWh"],
      ["Demande déplacée", totals.shifted, "kWh"],
      ["Pertes réseau / stockage", `${number(totals.loss, 1)} / ${number(totals.batteryLoss, 1)}`, "kWh"],
      ["Énergie non servie", totals.unmet, "kWh", totals.unmet > 0.05],
      ["Créneaux en alerte électrique", totals.warningHours, "/ 24", totals.warningHours > 0]
    ];
    $("#day-flows").innerHTML = metrics.map(([label, value, unit, warn]) =>
      `<div><dt>${label}</dt><dd class="${warn ? "warn" : ""}">${typeof value === "number" ? number(value, unit === "kWh" ? 1 : 0) : value} ${unit}</dd></div>`
    ).join("");
    renderHour();
  }

  function assetReading(row, key = state.asset) {
    const building = buildingFromAsset(key);
    if (building) {
      const load = row.buildingLoads[building.id];
      const energy = selected().rows.reduce((sum, hour) => sum + hour.buildingLoads[building.id].supplied, 0);
      return [number(load.supplied, 1), "kW", building.kind ?? model.BUILDINGS[building.type].name, [
        ["Quartier", escapeHtml(assetName(building.district))],
        ["Demande du créneau", `${number(load.demand, 1)} kW`],
        ["Énergie servie sur 24 h", `${number(energy, 1)} kWh`]
      ]];
    }
    switch (key) {
      case "bus":
        return [number(row.bus, 2), "kV", "Tension entre phases", [
          ["Demande", kw(row.demand)],
          ["Puissance distribuée", kw(row.servedLoad)],
          ["Pertes du réseau", `${number(row.loss, 1)} kW`]
        ]];
      case "solar":
        return [number(row.pvUsed), "kW", "Puissance injectée au poste", [
          ["Puissance installée", `${number(state.config.solar)} kWc`],
          ["Irradiance", `${number(row.irradiance)} W/m²`],
          ["Solaire écrêté", kw(row.curtailed)]
        ]];
      case "battery": {
        const mode = row.discharge > 0 ? "Décharge" : row.charge > 0 ? "Charge" : "Au repos";
        return [signed(row.discharge - row.charge), "kW", mode, [
          ["État de charge en fin de créneau", `${number(row.socPercent)} %`],
          ["Énergie stockée", `${number(row.soc)} kWh`],
          ["Capacité installée", `${number(state.config.capacity)} kWh`]
        ]];
      }
      case "grid": {
        const grid = row.imported - row.exported;
        const mode = row.island ? "Interrupteur ouvert" : grid > 0.05 ? "Import depuis le réseau"
          : grid < -0.05 ? "Injection vers le réseau" : "Sans échange actif";
        return [row.island ? "—" : signed(grid), row.island ? "" : "kW", mode, [
          ["Courant", `${number(row.lines[0].current, 1)} A`],
          ["Puissance réactive", `${number(row.lines[0].q, 1)} kvar`],
          ["Limites import / injection", `${number(row.importLimit)} / ${number(row.exportLimit)} kW`]
        ]];
      }
      default: {
        const index = districtAssets.indexOf(key);
        const line = row.lines[index + 1];
        return [number(line.p), "kW", "Puissance reçue par le quartier", [
          ["Demande", kw(row.districts[index])],
          ["Tension entre phases", `${number(line.voltage, 2)} kV`],
          ["Courant / charge de la ligne", `${number(line.current, 1)} A / ${number(line.loading)} %`]
        ]];
      }
    }
  }

  function renderAsset(row) {
    const [value, unit, caption, metrics] = assetReading(row);
    const name = assetName(state.asset);
    put("asset-name", name);
    put("asset-value", value);
    put("asset-unit", unit);
    put("asset-caption", caption);
    $("#city-selection span").textContent = name;
    $("#city-selection strong").textContent = [value, unit].filter(Boolean).join(" ");
    const detail = buildingFromAsset(state.asset) ? `${metrics[2][1]} servis sur 24 h`
      : state.asset === "battery" ? `Stock · ${metrics[0][1]}`
        : state.asset === "solar" ? `Irradiance · ${metrics[1][1]}`
          : `${metrics[0][0]} · ${metrics[0][1]}`;
    put("bubble-name", name);
    put("bubble-value", [value, unit].filter(Boolean).join(" "));
    put("bubble-detail", detail);
  }

  function hideAssetBubble() {
    if (city) city.hideBubble();
    else $("#city-bubble").hidden = true;
  }

  function selectAsset(key, showStats = false) {
    if (!key) {
      hideAssetBubble();
      return;
    }
    state.asset = key;
    city?.select(key, showStats);
    for (const button of $$("#city-fallback [data-asset]")) button.setAttribute("aria-pressed", button.dataset.asset === key);
    renderAsset(selected().rows[state.hour]);
    if (!city) $("#city-bubble").hidden = !showStats;
  }

  function openAssetDetails() {
    editObject(state.asset);
  }

  function renderHour() {
    const row = selected().rows[state.hour];
    const storage = row.discharge - row.charge;
    const grid = row.imported - row.exported;
    $("#hour").value = state.hour;
    $("#hour").setAttribute("aria-valuetext", interval(state.hour));
    $("#chart-hour span").textContent = interval(state.hour);
    put("inspector-time", interval(state.hour));
    put("timeline-time", clock(state.hour));
    const mixed = row.tariff === "Mixte";
    put("price-band", mixed ? `Moyenne · ${row.nightMinutes} min creuses` : row.tariff);
    put("price-value", `${number(row.price, mixed ? 4 : 3)} €/kWh`);
    $("#price-band").classList.toggle("off-peak", row.nightMinutes > 0);
    renderAsset(row);

    const flows = { solar: row.pvUsed, battery: storage, grid };
    const warningsByAsset = { grid: row.lines[0].warning };
    const values = {
      solar: kw(row.pvUsed), battery: `${signed(storage)} kW`, grid: row.island ? "Ouvert" : `${signed(grid)} kW`,
      bus: `${number(row.bus, 2)} kV`
    };
    districtAssets.forEach((key, index) => {
      const line = row.lines[index + 1];
      flows[key] = line.p;
      warningsByAsset[key] = line.warning;
      values[key] = kw(line.p);
    });
    const { objectNames, districts } = activeCity().network;
    const displayNames = { ...objectNames, ...Object.fromEntries(districts.map(({ id, name }) => [id, name])) };
    for (const building of state.buildingIndex.values()) {
      const key = "building:" + building.id;
      displayNames[key] = building.name;
      values[key] = `${number(row.buildingLoads[building.id].supplied, 1)} kW`;
    }
    city?.update(flows, warningsByAsset, values, displayNames);
    for (const button of $$("#city-fallback [data-asset]")) {
      const label = button.querySelector("strong, .map-node-name");
      label.textContent = displayNames[button.dataset.asset] ?? assets[button.dataset.asset].label;
    }
    const networkStatus = $("#network-status");
    networkStatus.classList.toggle("island", row.island);
    networkStatus.querySelector("span").textContent = !row.energized ? "Hors tension" : row.island ? "En îlot" : "Raccordé";

    $$(".wires-input b").forEach((wire, index) => {
      const flow = [row.pvUsed, storage, grid][index];
      wire.classList.toggle("inactive", Math.abs(flow) < 0.05);
      wire.classList.toggle("reverse", flow < -0.05);
    });
    $$(".wires-output b").forEach((wire, index) => wire.classList.toggle("inactive", row.lines[index + 1].p < 0.05));

    const warnings = row.lines.filter((line) => line.warning).length;
    const footer = row.unmet > 0.05 ? `${number(row.unmet, 1)} kWh non servis sur ce créneau`
      : warnings ? `Alerte électrique sur ${warnings} ligne${warnings > 1 ? "s" : ""}`
        : row.curtailed > 0.05 ? `${kw(row.curtailed)} de solaire écrêtés`
          : row.shift > 0.05 ? `${kw(row.shift)} de demande ajoutés par report`
            : row.shift < -0.05 ? `${kw(-row.shift)} de demande déplacés hors pointe`
              : `Demande couverte · ${number(row.loss, 1)} kW de pertes réseau`;
    put("network-note", footer);
    $("#network-alert").classList.toggle("warn", row.unmet > 0.05 || warnings > 0);
    if (state.objectKey) renderObjectMeasurements(row, state.objectKey);
    region?.hourChanged();
    drawChart();
  }

  function drawChart() {
    if (!state.result || !state.objectKey) return;
    const canvas = $("#power-chart");
    const { width, height } = canvas.getBoundingClientRect();
    if (width < 20 || height < 20) return;
    const density = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(density, density);

    const rows = selected().rows;
    const dark = document.documentElement.dataset.theme === "dark";
    const colors = dark ? ["#82d8b5", "#e8b15e", "#9dbdff", "#c5a8ee"]
      : ["#2d8b61", "#cd912e", "#657a9b", "#8a6aae"];
    const chartSeries = objectSeries(state.objectKey);
    const series = chartSeries.map(({ read }) => rows.map(read));
    const extremes = series.flat();
    const range = Math.max(200, ...extremes) - Math.min(0, ...extremes);
    const step = [50, 100, 200, 250, 400, 500, 750, 1000].find((value) => value >= range / 5) || 1250;
    const top = Math.ceil(Math.max(100, ...extremes) / step) * step;
    const bottom = Math.floor(Math.min(0, ...extremes) / step) * step;
    const left = width < 350 ? 39 : 48;
    const right = width - 14;
    const upper = 23;
    const lower = height - 24;
    const x = (hour) => left + (right - left) * hour / 23;
    const y = (power) => lower - (lower - upper) * (power - bottom) / (top - bottom);
    chartGeometry = { left, right };
    ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = dark ? "#a9b5c8" : "#617469";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("kW", left - 7, 7);
    for (let value = bottom; value <= top; value += step) {
      const position = y(value);
      ctx.strokeStyle = dark ? (value === 0 ? "#657184" : "#3a4351") : (value === 0 ? "#c9d5cc" : "#e7ede7");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, position);
      ctx.lineTo(right, position);
      ctx.stroke();
      ctx.fillText(number(value), left - 7, position);
    }
    ctx.textAlign = "center";
    for (const hour of width < 350 ? [0, 6, 12, 18, 23] : [0, 4, 8, 12, 16, 20, 23]) {
      ctx.fillText(clock(hour), x(hour), lower + 15);
    }

    const trace = (values) => {
      ctx.beginPath();
      values.forEach((value, hour) => (hour === 0 ? ctx.moveTo(x(hour), y(value)) : ctx.lineTo(x(hour), y(value))));
    };
    const solarIndex = chartSeries.findIndex(({ tone }) => tone === 1);
    if (solarIndex !== -1) {
      trace(series[solarIndex]);
      ctx.lineTo(right, y(0));
      ctx.lineTo(left, y(0));
      ctx.closePath();
      const solar = ctx.createLinearGradient(0, upper, 0, y(0));
      solar.addColorStop(0, dark ? "#e9b36b49" : "#f6d99470");
      solar.addColorStop(1, dark ? "#e9b36b06" : "#fff5d72b");
      ctx.fillStyle = solar;
      ctx.fill();
    }

    ctx.strokeStyle = dark ? "#788ba5" : "#95ac9a";
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x(state.hour), upper);
    ctx.lineTo(x(state.hour), lower);
    ctx.stroke();
    ctx.setLineDash([]);
    series.forEach((values, index) => {
      trace(values);
      ctx.strokeStyle = colors[chartSeries[index].tone];
      ctx.lineWidth = index === 0 ? 2.4 : 1.8;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x(state.hour), y(values[state.hour]), 3.4, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.stroke();
    });
  }

  const comparisonMetrics = [
    ["Coût d’exploitation", "cost", "€", 2],
    ["Facture nette d’énergie", "bill", "€", 2],
    ["Énergie demandée", "demand", "kWh", 1],
    ["Énergie non servie", "unmet", "kWh", 1, true],
    ["Énergie importée", "imported", "kWh", 1],
    ["Pointe d’import", "peak", "kW", 1, true],
    ["Énergie injectée", "exported", "kWh", 1],
    ["Solaire écrêté", "curtailed", "kWh", 1, true],
    ["Demande déplacée", "shifted", "kWh", 1],
    ["Pertes en ligne", "loss", "kWh", 1],
    ["Pertes de la batterie", "batteryLoss", "kWh", 1],
    ["Créneaux en alerte électrique", "warningHours", "h", 0, true]
  ];

  function renderComparison() {
    const { baseline, optimized } = state.result;
    const base = baseline.totals;
    const opt = optimized.totals;
    const costDiff = opt.cost - base.cost;
    const peakDiff = opt.peak - base.peak;
    const unmetDiff = opt.unmet - base.unmet;
    $("#compare-kpis").innerHTML = [
      kpi("Variation de coût", signed(costDiff, 1), "€",
        `${number(base.cost, 1)} € → ${number(opt.cost, 1)} €`),
      kpi("Variation de pointe", signed(peakDiff), "kW", `${kw(base.peak)} → ${kw(opt.peak)}`),
      kpi("Variation d’énergie non servie", signed(unmetDiff, 1), "kWh",
        `${number(base.unmet, 1)} → ${number(opt.unmet, 1)} kWh`)
    ].join("");
    $("#comparison").innerHTML = comparisonMetrics.map(([label, key, unit, digits, preferLower]) => {
      const difference = opt[key] - base[key];
      const meaningful = Math.abs(difference) >= 0.5 * 10 ** -digits;
      const tone = meaningful && preferLower ? (difference < 0 ? "good" : "warn") : "";
      return `<tr><th scope="row">${label}</th><td>${number(base[key], digits)} ${unit}</td>
        <td>${number(opt[key], digits)} ${unit}</td><td class="${tone}">${signed(difference, digits)} ${unit}</td></tr>`;
    }).join("");
    $("#hourly").innerHTML = optimized.rows.map((hour, i) => {
      const without = baseline.rows[i];
      const label = hour.tariff === "Mixte" ? `${hour.nightMinutes} min creuses` : hour.tariff;
      return `<tr><th scope="row">${interval(i)}</th><td>${number(hour.price, hour.tariff === "Mixte" ? 4 : 3)}<small>${label}</small></td>
        <td>${number(without.imported, 1)}</td><td>${number(hour.imported, 1)}</td>
        <td>${signed(hour.discharge - hour.charge, 1)}</td><td>${number(hour.socPercent, 1)} %</td>
        <td>${number(without.unmet, 1)}</td><td>${number(hour.unmet, 1)}</td></tr>`;
    }).join("");
  }

  function selectView(view) {
    stopPlayback();
    if (view === "dashboard" || view === "region") {
      for (const id of workspaceDialogs) if (document.getElementById(id).open) document.getElementById(id).close();
      const regional = view === "region";
      state.sceneMode = view;
      $("#dashboard").hidden = regional;
      $("#region").hidden = !regional;
      (regional ? $("#region-grid") : $("#dashboard .overview-grid")).append($("#shared-timeline"));
      for (const id of ["dashboard", "region"]) {
        const tab = $(`[data-view="${id}"]`);
        tab.classList.toggle("active", id === view);
        if (id === view) tab.setAttribute("aria-current", "page");
        else tab.removeAttribute("aria-current");
      }
      refreshHeading();
      if (regional) hideAssetBubble();
      region?.show(regional);
    } else {
      hideAssetBubble();
      if (view === "buildings") refreshBuildings();
      document.getElementById(view).showModal();
    }
  }

  function refreshHeading() {
    const regional = state.sceneMode === "region";
    put("page-title", regional ? "Réseau régional" : activeCity().name);
    put("page-description", regional ? "Villes, production et transferts sur 24 h" : "Simulation horaire sur 24 h");
  }

  function run() {
    const network = activeCity().network;
    state.buildingIndex = new Map(model.allBuildings(network).map((building) => [building.id, building]));
    if (state.asset.startsWith("building:") && !buildingFromAsset(state.asset)) state.asset = "bus";
    state.result = model.simulate(state.scenario, state.config, network);
    city?.setExpansion(network);
    city?.select(state.asset);
    $("#weather-icon").innerHTML = icon({ sun: "sun", cloud: "cloud", peak: "activity", outage: "outage" }[state.scenario]);
    const { nightEnabled, nightStartMinute, nightEndMinute, offPeak } = state.config;
    $("#night-toggle").checked = nightEnabled;
    put("night-description", nightEnabled ? `${minuteClock(nightStartMinute)} à ${minuteClock(nightEndMinute)} · ${number(offPeak, 3)} €/kWh`
      : "Désactivées");
    $("#night-bar").replaceChildren(...state.result.optimized.rows.map((row) => {
      const mark = document.createElement("b");
      for (const [start, end] of row.nightSpans) {
        const shade = document.createElement("i");
        shade.style.left = 100 * start / 60 + "%";
        shade.style.width = 100 * (end - start) / 60 + "%";
        mark.append(shade);
      }
      return mark;
    }));
    renderDashboard();
    renderComparison();
    refreshBuildings();
    region?.refresh();
  }

  function stopPlayback() {
    if (state.timer === null) return;
    clearInterval(state.timer);
    state.timer = null;
    $("#play i").innerHTML = icon("play");
    $("#play").setAttribute("aria-label", "Lire la simulation");
    $("#play").setAttribute("aria-pressed", "false");
    city?.play(false);
    region?.play(false);
  }

  function togglePlayback() {
    if (state.timer !== null) {
      stopPlayback();
      return;
    }
    if (state.hour === 23) {
      state.hour = 0;
      renderHour();
    }
    $("#play i").innerHTML = icon("pause");
    $("#play").setAttribute("aria-label", "Mettre la simulation en pause");
    $("#play").setAttribute("aria-pressed", "true");
    city?.play(true);
    region?.play(true);
    state.timer = setInterval(() => {
      state.hour++;
      renderHour();
      if (state.hour === 23) stopPlayback();
    }, 650);
  }

  function setHour(hour) {
    stopPlayback();
    state.hour = Math.max(0, Math.min(23, hour));
    renderHour();
  }

  function filename(name) {
    return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ville";
  }

  function download(content, extension, basename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = basename + "." + extension;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function fieldInput([key, label, unit, min, max, step]) {
    return `<label>${label}<span class="input-unit"><input name="${key}" type="number" min="${min}" max="${max}"
      step="${step}" required>${unit ? "<span>" + unit + "</span>" : ""}</span></label>`;
  }

  function networkInputs(schema) {
    return Object.entries(schema).map(([key, field]) => fieldInput([key, ...field])).join("");
  }

  function readNumbers(form, schema) {
    return Object.fromEntries(Object.keys(schema).map((key) => [key, form.elements.namedItem(key).valueAsNumber]));
  }

  function fillNumbers(form, schema, values) {
    for (const key of Object.keys(schema)) form.elements.namedItem(key).value = values[key];
  }

  function objectSeries(key) {
    const solar = { label: "Solaire", tone: 1, read: (row) => row.pvUsed };
    const grid = { label: "Échange réseau", tone: 2, read: (row) => row.imported - row.exported };
    const battery = { label: "Batterie", tone: 3, read: (row) => row.discharge - row.charge };
    const building = buildingFromAsset(key);
    if (building) {
      return [
        { label: "Demande", tone: 0, read: (row) => row.buildingLoads[building.id].demand },
        { label: "Alimenté", tone: 2, read: (row) => row.buildingLoads[building.id].supplied }
      ];
    }
    switch (key) {
      case "solar": return [solar, { label: "Disponible", tone: 2, read: (row) => row.pv }];
      case "battery": return [battery];
      case "grid": return [grid];
      case "bus": return [{ label: "Demande", tone: 0, read: (row) => row.demand }, solar, grid, battery];
      default: {
        const index = districtAssets.indexOf(key);
        return [
          { label: "Demande", tone: 0, read: (row) => row.districts[index] },
          { label: "Alimenté", tone: 2, read: (row) => row.lines[index + 1].p }
        ];
      }
    }
  }

  function objectDayMetrics(key, series) {
    const { rows, totals } = selected();
    if (key === "solar") return [["Production injectée", totals.pvUsed], ["Énergie écrêtée", totals.curtailed]];
    if (key === "battery") return [["Énergie chargée", totals.charge], ["Énergie déchargée", totals.discharge], ["Pertes", totals.batteryLoss]];
    if (key === "grid") return [["Énergie achetée", totals.imported], ["Énergie injectée", totals.exported]];
    return series.map(({ label, read }) => [label, rows.reduce((total, row) => total + read(row), 0)]);
  }

  function metricMarkup(metrics) {
    return metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  }

  function renderObjectMeasurements(row, key) {
    const [value, unit, caption, metrics] = assetReading(row, key);
    put("object-dialog-title", assetName(key));
    put("object-dialog-subtitle", interval(state.hour));
    put("object-measurement-value", [value, unit].filter(Boolean).join(" "));
    put("object-measurement-caption", caption);

    const singleLine = lineAssets.indexOf(key);
    const lines = key === "bus" ? row.lines : singleLine >= 0 ? [row.lines[singleLine]] : [];
    const lineMetrics = singleLine < 0 ? [] : [
      ["Résistance totale", `${number(lines[0].resistance * lines[0].length, 3)} Ω`],
      ["Réactance totale", `${number(lines[0].reactance * lines[0].length, 3)} Ω`]
    ];
    $("#object-now-metrics").innerHTML = metricMarkup([...metrics, ...lineMetrics]);
    $("#object-lines").hidden = !lines.length;
    put("reading-subtitle", `${interval(state.hour)} · tension entre phases`);
    $("#readings").innerHTML = lines.map((line) => {
      const badgeType = line.open ? "open" : line.warning ? "warn" : "";
      const loading = line.open ? "Ouvert" : `${number(line.loading)} %`;
      return `<tr><th scope="row">${escapeHtml(line.name)}<small>${number(line.length, 2)} km · ${number(line.limit)} A admis</small></th>
        <td>${number(line.p, 1)}</td><td>${number(line.q, 1)}</td><td>${number(line.apparent, 1)}</td>
        <td>${line.open ? "—" : number(line.voltage, 2)}</td><td>${number(line.current, 1)}</td>
        <td><span class="line-badge ${badgeType}"${line.warning ? ' aria-label="Alerte électrique"' : ""}>${loading}</span></td></tr>`;
    }).join("");

    const isBus = key === "bus";
    $("#city-day-summary").hidden = !isBus;
    $("#city-day-flows").hidden = !isBus;
    $("#object-specific-day").hidden = isBus;
    const series = objectSeries(key);
    if (!isBus) {
      $("#object-day-metrics").innerHTML = metricMarkup(objectDayMetrics(key, series)
        .map(([label, energy]) => [label, `${number(energy, 1)} kWh`]));
    }
    const tones = ["load", "pv", "grid", "battery"];
    $("#object-legend").innerHTML = series.map(({ label, tone }) =>
      `<span><b class="swatch ${tones[tone]}"></b>${label}</span>`).join("");
  }

  function saveNetwork(next, message, config = state.config) {
    const valid = projects.networkOf(next);
    stopPlayback();
    activeCity().network = valid;
    if (config !== state.config) {
      state.config = config;
      activeCity().scenarios[state.scenario] = { ...config };
    }
    const saved = saveWorkspace();
    run();
    status(saved ? message : "Modifications disponibles pour cette session. La ville peut être exportée en JSON.");
  }

  function updateBuilding(network, building, changes) {
    if (building.stock) {
      return {
        ...network,
        originalOverrides: {
          ...network.originalOverrides,
          [building.id]: { ...network.originalOverrides[building.id], ...changes }
        }
      };
    }
    return {
      ...network, buildings: network.buildings.map((item) => item.id === building.id ? { ...item, ...changes } : item)
    };
  }

  function initObjectEditor() {
    const dialog = $("#object-dialog");
    const form = $("#object-form");
    const editFields = $("#object-fields");
    const { cityFields, cableFields, districtFields } = projects;
    let target;

    function activeTab(tab) {
      for (const button of $$("[data-object-tab]")) button.setAttribute("aria-pressed", String(button.dataset.objectTab === tab));
      for (const panel of $$("[data-object-panel]")) panel.hidden = panel.dataset.objectPanel !== tab;
      dialog.dataset.pane = tab;
      dialog.scrollTop = 0;
      if (tab === "day") drawChart();
    }

    function configure(key) {
      const { id, network } = activeCity();
      const building = buildingFromAsset(key);
      const district = network.districts.find((entry) => entry.id === key);
      const cable = key === "grid" ? network.grid : district?.cable;
      const equipmentFields = key === "grid" ? fields[2][1]
        : key === "solar" || key === "battery"
          ? fields[0][1].filter(([id]) => key === "solar" ? id === "solar" : id !== "solar")
          : [];
      target = { key, cityId: id, scenario: state.scenario, building, district, cable, equipmentFields };
      const inputs = [];
      let buildingProfile = "";
      if (building) {
        const powerFields = building.stock ? projects.originalPower : projects.buildingPower;
        inputs.push(fieldInput(["power", ...powerFields]));
        buildingProfile = `<div class="config-fieldset object-cable">
          <label class="region-check"><input type="checkbox" name="customProfile"> Consommation différente selon l’heure</label>
          <div id="building-hourly-controls" hidden>
            <div class="profile-inputs">${Array.from({ length: model.HOURS }, (_, hour) =>
              fieldInput([`b${hour}`, clock(hour), "kW", 0, powerFields[3], 0.1])).join("")}</div>
            <p class="setting-hint">Puissances de référence par créneau. Le pilotage ne déplace pas ce profil.</p>
          </div>
        </div>`;
      } else if (key === "bus") {
        inputs.push(networkInputs(cityFields));
      } else if (district) {
        inputs.push(networkInputs(districtFields));
      }
      inputs.push(...equipmentFields.map(fieldInput));
      const policies = cable ? Object.entries(projects.cablePresets).map(([id, preset]) =>
        `<option value="${id}">${preset.name}</option>`).join("") : "";
      editFields.innerHTML = `
        <div class="editor-fields">${inputs.join("")}</div>
        ${buildingProfile}
        ${cable ? `<div class="config-fieldset object-cable">
          <h3>Câble de cet objet</h3>
          <label>Exemple<select id="object-cable-preset"><option value="">Valeurs personnalisées</option>${policies}</select></label>
          <div class="editor-fields">${networkInputs(cableFields)}</div>
        </div>` : ""}
        ${district ? `<details class="profile-editor">
          <summary>Profil de ce quartier</summary>
          <div class="profile-inputs">${district.profile.map((_, hour) => fieldInput([`p${hour}`, clock(hour), "kW", 0, 1000, 1])).join("")}</div>
          <button type="button" class="button button-quiet" id="object-reset-profile">Restaurer le profil de démonstration</button>
        </details>` : ""}`;
      const element = (name) => form.elements.namedItem(name);
      element("name").value = assetName(key);
      if (building) {
        element("power").value = Number(building.power.toFixed(1));
        const values = model.buildingReferenceProfile(network, building);
        const custom = element("customProfile");
        custom.checked = Boolean(building.profile);
        values.forEach((value, hour) => { element("b" + hour).value = Number(value.toFixed(1)); });
        const toggle = () => {
          $("#building-hourly-controls").hidden = !custom.checked;
          element("power").disabled = custom.checked;
          values.forEach((_, hour) => { element("b" + hour).disabled = !custom.checked; });
        };
        custom.addEventListener("change", toggle);
        toggle();
      }
      if (key === "bus") fillNumbers(form, cityFields, network);
      if (cable) {
        fillNumbers(form, cableFields, cable);
        $("#object-cable-preset").addEventListener("change", (event) => {
          const chosen = projects.cablePresets[event.target.value];
          if (!chosen) return;
          for (const id of ["resistance", "reactance", "limit"]) element(id).value = chosen[id];
        });
      }
      if (district) {
        fillNumbers(form, districtFields, district);
        const useProfile = (profile) => profile.forEach((value, hour) => { element("p" + hour).value = value; });
        useProfile(district.profile);
        $("#object-reset-profile").addEventListener("click", () => useProfile(model.DISTRICTS[districtAssets.indexOf(key)].profile));
      }
      for (const [id] of equipmentFields) element(id).value = state.config[id];
      put("object-error", "");
    }

    for (const button of $$("[data-object-tab]")) button.addEventListener("click", () => activeTab(button.dataset.objectTab));
    dialog.addEventListener("close", () => { state.objectKey = null; });
    form.addEventListener("invalid", (event) => {
      const details = event.target.closest("details");
      if (details) details.open = true;
    }, true);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const { key, cityId, scenario, building, district, cable, equipmentFields } = target;
        if (activeCity().id !== cityId || state.scenario !== scenario) throw new Error("Sélectionne à nouveau cet objet.");
        const name = projects.nameOf(form.elements.namedItem("name").value);
        const network = structuredClone(activeCity().network);
        let config = state.config;
        let next = network;
        if (equipmentFields.length) {
          config = { ...config };
          for (const [id] of equipmentFields) config[id] = form.elements.namedItem(id).valueAsNumber;
        }
        if (building) {
          const power = form.elements.namedItem("power").valueAsNumber;
          const custom = form.elements.namedItem("customProfile").checked;
          const changes = { name, profile: custom
            ? Array.from({ length: model.HOURS }, (_, hour) => form.elements.namedItem("b" + hour).valueAsNumber) : null };
          if (!custom && power !== Number(building.power.toFixed(1))) changes.power = power;
          next = updateBuilding(network, building, changes);
        } else if (district) {
          const line = network.districts.find((entry) => entry.id === key);
          Object.assign(line, readNumbers(form, districtFields), {
            name, cable: readNumbers(form, cableFields),
            profile: district.profile.map((_, hour) => form.elements.namedItem("p" + hour).valueAsNumber)
          });
        } else {
          if (name !== assetName(key)) network.objectNames[key] = name;
          if (key === "bus") Object.assign(network, readNumbers(form, cityFields));
          if (key === "grid" && cable) network.grid = readNumbers(form, cableFields);
        }
        saveNetwork(next, "Objet enregistré. Mesures recalculées.", config);
        dialog.close();
      } catch (error) {
        put("object-error", error.message);
      }
    });

    return (key) => {
      if (!assetName(key)) return;
      stopPlayback();
      state.objectKey = key;
      configure(key);
      activeTab("edit");
      renderObjectMeasurements(selected().rows[state.hour], key);
      dialog.showModal();
    };
  }

  function initMapEditor() {
    const dialog = $("#map-dialog");
    const form = $("#map-form");
    const { name, type, district, lot, power } = form.elements;
    const fields = $("#map-building-fields");
    const submit = $("#map-apply");
    const remove = $("#map-remove");
    const enlarge = $("#map-enlarge");
    let building;
    let restore;
    let suggestion;
    const catalog = Object.entries(model.BUILDINGS);
    type.replaceChildren(...catalog.map(([key, entry]) => new Option(entry.name, key)));

    function terrainOptions(preferred) {
      const network = activeCity().network;
      const slots = projects.availableLots(network, district.value, building?.id);
      lot.replaceChildren(...slots.map((index) => new Option("Terrain " + (index + 1), index)));
      if (!slots.length) lot.add(new Option("Aucun terrain libre", ""));
      if (slots.includes(preferred)) lot.value = preferred;
      lot.disabled = slots.length === 0;
      submit.disabled = slots.length === 0;
      enlarge.hidden = slots.length > 0 || network.size === 3;
      put("map-field-note", slots.length > 0 ? ""
        : network.size < 3 ? "Ce quartier est plein. Agrandis la ville ou choisis un autre quartier."
          : "Ce quartier est plein. Choisis un autre quartier.");
    }

    function open(pick = {}) {
      if (["solar", "battery", "grid", "bus"].includes(pick.key)) {
        editObject(pick.key);
        return;
      }
      stopPlayback();
      building = buildingFromAsset(pick.key ?? "");
      restore = pick.restore
        ? model.originalBuildings(activeCity().network).find(({ id, removed }) => id === pick.restore && removed)
        : undefined;
      const original = building?.stock === true;
      const adding = !building && !restore;
      put("map-dialog-title", restore ? "Restaurer le bâtiment" : adding ? "Ajouter un bâtiment" : "Modifier le bâtiment");
      const zone = building?.district ?? restore?.district ?? pick.district
        ?? (districtAssets.includes(pick.key) ? pick.key : districtAssets[0]);
      put("map-dialog-subtitle", restore?.name ?? building?.name ?? assetName(zone));
      put("map-apply", restore ? "Restaurer" : adding ? "Construire ici" : "Enregistrer");
      submit.disabled = false;
      remove.hidden = !building;
      enlarge.hidden = true;
      fields.hidden = Boolean(restore);
      $("#map-type-field").hidden = original;
      $("#map-district-field").hidden = original;
      $("#map-lot-field").hidden = original;
      for (const input of [name, power]) input.disabled = Boolean(restore);
      for (const input of [type, district, lot]) input.disabled = Boolean(restore) || original;
      put("map-field-note", restore ? "La restauration remet le bâtiment à sa place et réintègre sa demande au réseau."
        : original ? "Bâtiment d’origine. Sa demande suit le profil du quartier." : "");

      type.value = building?.type ?? catalog[0][0];
      suggestion = model.BUILDINGS[type.value];
      name.value = building?.name ?? suggestion.name;
      power.max = (original ? projects.originalPower : projects.buildingPower)[3];
      power.value = Number((building?.power ?? suggestion.power).toFixed(1));
      district.replaceChildren(...activeCity().network.districts.map(({ id, name }) => new Option(name, id)));
      district.value = zone;
      if (!restore && !original) terrainOptions(building?.lot ?? pick.lot);
      if (!dialog.open) dialog.showModal();
    }

    type.addEventListener("change", () => {
      const next = model.BUILDINGS[type.value];
      if (!name.value || name.value === suggestion.name) name.value = next.name;
      if (power.valueAsNumber === suggestion.power) power.value = next.power;
      suggestion = next;
    });
    district.addEventListener("change", () => terrainOptions());
    enlarge.addEventListener("click", () => {
      const network = activeCity().network;
      if (network.size < 3) {
        saveNetwork({ ...network, size: network.size + 1 }, "Ville agrandie.");
        terrainOptions();
      }
    });
    for (const id of ["close-map", "map-cancel"]) $("#" + id).addEventListener("click", () => dialog.close());
    remove.addEventListener("click", () => {
      if (!building || !window.confirm("Retirer « " + building.name + " » de cette ville ?")) return;
      const network = activeCity().network;
      const next = building.stock ? updateBuilding(network, building, { removed: true })
        : { ...network, buildings: network.buildings.filter((entry) => entry.id !== building.id) };
      try {
        saveNetwork(next, "Bâtiment retiré. La demande a été recalculée.");
        dialog.close();
      } catch (error) {
        put("map-field-note", error.message);
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const network = activeCity().network;
        let next;
        let id;
        if (restore) {
          id = restore.id;
          next = updateBuilding(network, restore, { removed: false });
        } else {
          id = building?.id ?? crypto.randomUUID();
          const changes = { name: projects.nameOf(name.value), power: power.valueAsNumber };
          if (!building?.stock) {
            if (lot.value === "") throw new Error("Choisis un terrain libre.");
            Object.assign(changes, { type: type.value, district: district.value, lot: Number(lot.value) });
          }
          next = building ? updateBuilding(network, building, changes)
            : { ...network, buildings: [...network.buildings, { id, ...changes }] };
        }
        saveNetwork(next, restore ? "Bâtiment restauré." : building ? "Bâtiment mis à jour." : "Bâtiment ajouté.");
        selectAsset("building:" + id, true);
        dialog.close();
      } catch (error) {
        put("map-field-note", error.message);
      }
    });

    $("#map-edit-action").addEventListener("click", () => open({
      key: state.asset.startsWith("building:") || districtAssets.includes(state.asset) ? state.asset : undefined
    }));
    return open;
  }

  function initBuildings() {
    const size = $("#city-size");
    const form = $("#building-form");
    const types = Object.entries(model.BUILDINGS);
    $("#building-power-field").innerHTML = fieldInput(["power", ...projects.buildingPower]);
    const { type, district, name, power } = form.elements;
    let editing;
    let previousCity;
    let suggested;
    size.replaceChildren(...Object.entries(model.CITY_SIZES).map(([key, entry]) =>
      new Option(entry.label + " · " + entry.lots + " terrains par quartier", key)));
    type.replaceChildren(...types.map(([key, entry]) => new Option(entry.name, key)));

    function resetForm() {
      editing = undefined;
      type.value = types[0][0];
      suggested = types[0][1];
      name.value = suggested.name;
      name.setCustomValidity("");
      power.value = suggested.power;
      district.value = districtAssets[0];
      put("building-editor-title", "Ajouter un bâtiment");
      put("save-building", "Ajouter à la ville");
      $("#cancel-building").hidden = true;
    }

    function refresh() {
      const { id, network } = activeCity();
      const preferredDistrict = district.value;
      district.replaceChildren(...network.districts.map((item) => new Option(item.name, item.id)));
      if (previousCity !== id) {
        previousCity = id;
        resetForm();
      } else {
        district.value = preferredDistrict || districtAssets[0];
      }
      size.value = network.size;
      const limit = model.CITY_SIZES[network.size].lots;
      $("#building-capacity").innerHTML = network.districts.map((item) => {
        const count = network.buildings.filter((building) => building.district === item.id).length;
        return `<div><dt>${escapeHtml(item.name)}</dt><dd>${count} / ${limit} terrains</dd></div>`;
      }).join("");
      $("#building-empty").hidden = network.buildings.length > 0;
      $("#building-table").hidden = network.buildings.length === 0;
      const rows = selected().rows;
      $("#building-list").innerHTML = network.buildings.map((building) => {
        const used = rows.reduce((total, row) => total + row.buildingLoads[building.id].supplied, 0);
        return `<tr>
          <th scope="row">${escapeHtml(building.name)}<small>${model.BUILDINGS[building.type].name}</small></th>
          <td>${escapeHtml(assetName(building.district))}</td><td>${number(building.power, 1)} kW</td>
          <td>${number(used, 1)} kWh</td>
          <td><div class="building-actions">
            <button type="button" data-building="${building.id}" data-action="view">Voir en 3D</button>
            <button type="button" data-building="${building.id}" data-action="edit">Modifier</button>
            <button type="button" data-building="${building.id}" data-action="remove">Supprimer</button>
          </div></td>
        </tr>`;
      }).join("");
    }

    size.addEventListener("change", () => {
      try {
        saveNetwork({ ...activeCity().network, size: Number(size.value) }, "Taille de la ville mise à jour.");
      } catch (error) {
        size.value = activeCity().network.size;
        status(error.message);
      }
    });
    name.addEventListener("input", () => name.setCustomValidity(""));
    type.addEventListener("change", () => {
      const next = model.BUILDINGS[type.value];
      if (!name.value || name.value === suggested.name) name.value = next.name;
      if (power.valueAsNumber === suggested.power) power.value = next.power;
      suggested = next;
    });
    $("#cancel-building").addEventListener("click", resetForm);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const network = activeCity().network;
      try {
        const updated = {
          id: editing || crypto.randomUUID(), name: projects.nameOf(name.value),
          type: type.value, district: district.value, power: power.valueAsNumber
        };
        const previous = network.buildings.find(({ id }) => id === editing);
        if (previous?.district === updated.district) updated.lot = previous.lot;
        const buildings = editing
          ? network.buildings.map((item) => item.id === editing ? updated : item)
          : [...network.buildings, updated];
        saveNetwork({ ...network, buildings }, editing ? "Bâtiment mis à jour." : "Bâtiment ajouté. Simulation recalculée.");
        resetForm();
      } catch (error) {
        status(error.message);
      }
    });
    $("#building-list").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-building]");
      if (!button) return;
      const network = activeCity().network;
      const building = network.buildings.find(({ id }) => id === button.dataset.building);
      if (!building) return;
      switch (button.dataset.action) {
        case "view":
          selectView("dashboard");
          city?.changeCamera("reset");
          selectAsset("building:" + building.id, true);
          break;
        case "edit":
          editing = building.id;
          type.value = building.type;
          suggested = model.BUILDINGS[type.value];
          district.value = building.district;
          name.value = building.name;
          power.value = building.power;
          put("building-editor-title", "Modifier le bâtiment");
          put("save-building", "Enregistrer");
          $("#cancel-building").hidden = false;
          name.focus();
          break;
        case "remove":
          if (!window.confirm("Supprimer « " + building.name + " » de cette ville ?")) return;
          if (state.asset === "building:" + building.id) state.asset = "bus";
          if (editing === building.id) resetForm();
          saveNetwork({ ...network, buildings: network.buildings.filter(({ id }) => id !== building.id) }, "Bâtiment supprimé.");
          break;
      }
    });
    return refresh;
  }

  function initProjects() {
    const selector = $("#active-city");
    const form = $("#city-name-form");
    const dialog = $("#city-dialog");
    const newForm = $("#new-city-form");

    function refreshCityLabels() {
      selector.replaceChildren(...workspace.cities.map((city) => new Option(city.name, city.id)));
      selector.value = workspace.activeId;
      $("#new-city").disabled = workspace.cities.length >= projects.maxCities;
      refreshHeading();
    }

    function enterCity(id, persist = true) {
      stopPlayback();
      hideAssetBubble();
      workspace.activeId = id;
      state.config = readSettings(state.scenario);
      state.asset = "bus";
      refreshCityLabels();
      form.elements.name.value = activeCity().name;
      form.elements.name.setCustomValidity("");
      const saved = persist && saveWorkspace();
      run();
      selectAsset("bus");
      return saved;
    }

    function informSaved(saved, message) {
      status(saved ? message : "Modifications disponibles pour cette session. Tu peux exporter la ville.");
    }

    selector.addEventListener("change", () => enterCity(selector.value));
    $("#new-city").addEventListener("click", () => {
      stopPlayback();
      newForm.reset();
      newForm.elements.name.setCustomValidity("");
      dialog.showModal();
    });
    for (const id of ["close-city", "cancel-city"]) $("#" + id).addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { newCityPosition = undefined; });
    newForm.elements.name.addEventListener("input", () => newForm.elements.name.setCustomValidity(""));
    newForm.addEventListener("submit", (event) => {
      event.preventDefault();
      let newCity;
      try {
        const name = projects.nameOf(newForm.elements.name.value);
        const original = activeCity();
        const copy = newForm.elements.template.value === "copy";
        newCity = projects.add(workspace, {
          name, network: copy ? original.network : model.getNetwork(),
          scenarios: copy ? Object.fromEntries(Object.keys(model.PRESETS).map((key) => [key, readSettings(key, original)])) : {}
        });
        if (newCityPosition) {
          const positions = regionalModel.sites(workspace.region, workspace.cities).filter((node) => node.id !== newCity.id);
          const location = regionalModel.nextPosition(positions, newCityPosition);
          workspace.region = regionalModel.normalize({
            ...workspace.region, locations: { ...workspace.region.locations, [newCity.id]: location }
          }, workspace.cities);
        }
      } catch (error) {
        newForm.elements.name.setCustomValidity(error.message);
        newForm.elements.name.reportValidity();
        return;
      }
      const saved = enterCity(newCity.id);
      dialog.close();
      informSaved(saved, "Ville créée.");
    });

    form.elements.name.addEventListener("input", () => form.elements.name.setCustomValidity(""));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const city = activeCity();
      try {
        const name = projects.nameOf(form.elements.name.value);
        if (projects.sameName(workspace.cities, name, city.id)) throw new Error("Une ville porte déjà ce nom.");
        city.name = name;
        form.elements.name.value = name;
        refreshCityLabels();
        const saved = saveWorkspace();
        run();
        informSaved(saved, "Ville renommée.");
      } catch (error) {
        form.elements.name.setCustomValidity(error.message);
        form.elements.name.reportValidity();
      }
    });

    $("#export-city").addEventListener("click", () => {
      const city = activeCity();
      const scenarios = Object.fromEntries(Object.keys(model.PRESETS).map((key) => [key, readSettings(key)]));
      download(projects.encode({ ...city, scenarios }), "json", "gridlab-" + filename(city.name), "application/json");
      status("Fichier de la ville exporté.");
    });
    $("#import-city").addEventListener("click", () => {
      $("#city-file").click();
    });
    $("#city-file").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      event.target.value = "";
      if (!file) return;
      try {
        if (file.size > 250_000) throw new Error("Le fichier dépasse la limite de 250 ko.");
        const imported = projects.add(workspace, projects.decode(await file.text()));
        const saved = enterCity(imported.id);
        informSaved(saved, "Ville importée.");
      } catch (error) {
        status(error instanceof SyntaxError ? "Le fichier JSON est illisible." : error.message);
      }
    });
    enterCity(workspace.activeId, false);
  }

  function initSettings() {
    const form = $("#settings-form");
    const editableKeys = [...fields[1][1], ...fields[3][1], nightPriceField].map(([key]) => key);
    const group = ([title, inputs]) =>
      `<section class="settings-group"><h3>${title}</h3>${inputs.map(fieldInput).join("")}</section>`;
    $("#setting-fields").innerHTML = `
      <section class="settings-group night-settings" aria-labelledby="night-heading">
        <div class="settings-inline"><h3 id="night-heading">Heures creuses de nuit</h3>
          <input class="switch" name="nightEnabled" type="checkbox" role="switch" aria-label="Activer les heures creuses de nuit">
        </div>
        <label>Début<input type="time" name="nightStart" step="60" required aria-describedby="night-rule"></label>
        <label>Fin<input type="time" name="nightEnd" step="60" required aria-describedby="night-rule"></label>
        ${fieldInput(nightPriceField)}
        <p id="night-rule" class="setting-hint">Saisie à la minute, par exemple 22:17 à 06:43. Le prix affiché est pondéré dans les heures partagées entre deux tarifs.</p>
      </section>
      ${group(fields[3])}
      ${group(fields[1])}`;

    const { nightEnabled, nightStart, nightEnd, offPeak } = form.elements;
    const dialog = $("#settings");

    function validateNightWindow() {
      const collision = nightEnabled.checked && nightStart.value !== "" && nightStart.value === nightEnd.value;
      nightEnd.setCustomValidity(collision ? "Choisissez une heure de fin différente de l’heure de début." : "");
    }

    function updateNightFields() {
      for (const input of [nightStart, nightEnd, offPeak]) input.disabled = !nightEnabled.checked;
      validateNightWindow();
    }

    function populateSettings(values) {
      for (const key of editableKeys) form.elements[key].value = values[key];
      nightEnabled.checked = values.nightEnabled;
      nightStart.value = minuteClock(values.nightStartMinute);
      nightEnd.value = minuteClock(values.nightEndMinute);
      updateNightFields();
    }

    function openSettings(focusNight = false) {
      stopPlayback();
      populateSettings(state.config);
      put("settings-scenario", model.PRESETS[state.scenario].name);
      dialog.showModal();
      if (focusNight) (nightEnabled.checked ? nightStart : nightEnabled).focus();
    }

    $("#open-settings").addEventListener("click", () => openSettings());
    $("#edit-night").addEventListener("click", () => openSettings(true));
    nightEnabled.addEventListener("change", updateNightFields);
    nightStart.addEventListener("input", validateNightWindow);
    nightEnd.addEventListener("input", validateNightWindow);
    $("#close-settings").addEventListener("click", () => dialog.close());
    $("#reset-settings").addEventListener("click", () => populateSettings(model.getSettings(state.scenario)));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const config = { ...state.config };
      for (const key of editableKeys) config[key] = form.elements[key].valueAsNumber;
      config.nightEnabled = nightEnabled.checked;
      config.nightStartMinute = readTime(nightStart.value);
      config.nightEndMinute = readTime(nightEnd.value);
      // Conserve une plage réutilisable si les heures sont désactivées avant l'enregistrement.
      if (config.nightStartMinute === null || config.nightEndMinute === null || config.nightStartMinute === config.nightEndMinute) {
        config.nightStartMinute = state.config.nightStartMinute;
        config.nightEndMinute = state.config.nightEndMinute;
      }
      if (!Number.isFinite(config.offPeak) || config.offPeak < 0 || config.offPeak > 2) config.offPeak = state.config.offPeak;
      state.config = config;
      const saved = saveSettings();
      dialog.close();
      run();
      status(saved ? "Simulation recalculée." : "Réglages appliqués pour cette session.");
    });
  }

  function exportCsv() {
    const measurements = [
      ["Demande_kW", "demand"], ["Alimentee_kW", "servedLoad"],
      ["Solaire_disponible_kW", "pv"], ["Solaire_injecte_au_poste_kW", "pvUsed"],
      ["Solaire_ecrete_kWh", "curtailed"], ["Irradiance_W_m2", "irradiance"],
      ["Import_kW", "imported"], ["Export_kW", "exported"], ["Charge_kW", "charge"],
      ["Decharge_kW", "discharge"], ["Stock_fin_kWh", "soc"], ["Stock_fin_pct", "socPercent"],
      ["Report_kW", "shift"], ["Non_servi_kWh", "unmet"], ["Pertes_reseau_kWh", "loss"],
      ["Pertes_stockage_kWh", "batteryLoss"], ["Tarif_eur_kWh", "price"], ["Regime_tarifaire", "tariff"],
      ["Minutes_creuses", "nightMinutes"],
      ["Facture_nette_eur", "bill"],
      ["Cout_exploitation_eur", "cost"], ["Tension_poste_kV", "bus"], ["Tension_nominale_kV", "nominal"], ["Isole", "island"],
      ["Sous_tension", "energized"]
    ];
    const lineColumns = [["Nom", "name"], ["P_kW", "p"], ["Q_kvar", "q"], ["S_kVA", "apparent"], ["U_kV", "voltage"],
      ["I_A", "current"], ["Charge_pct", "loading"], ["Alerte", "warning"], ["Longueur_km", "length"],
      ["R_ohm_km", "resistance"], ["X_ohm_km", "reactance"], ["I_admissible_A", "limit"]];
    const settingsColumns = [
      ["Solaire_kWc", "solar"], ["Batterie_kWh", "capacity"], ["Batterie_kW", "batteryPower"],
      ["Demande_ref_pct", "demand"], ["Flexible_pct", "flex"], ["Limite_import_kW", "importLimit"],
      ["Limite_export_kW", "exportLimit"], ["Creuses_eur_kWh", "offPeak"], ["Standard_eur_kWh", "standard"],
      ["Pointe_eur_kWh", "peak"], ["Vente_eur_kWh", "feedIn"], ["Creuses_actives", "nightEnabled"],
      ["Creuses_debut_min", "nightStartMinute"], ["Creuses_fin_min", "nightEndMinute"]
    ];
    const lineNames = ["Raccordement", "Residentiel", "Tertiaire", "Services_publics"];
    const exportedCity = activeCity();
    const buildings = exportedCity.network.buildings;
    const buildingColumns = ["Nom", "Type", "Quartier", "Pointe_ref_kW", "Demande_kW", "Alimente_kW"];
    const rows = [["Ville", "Scenario", "Strategie", "Debut", "Fin", ...measurements.map(([label]) => label),
      ...lineNames.flatMap((line) => lineColumns.map(([label]) => `${line}_${label}`)),
      ...settingsColumns.map(([label]) => label), "Taille_ville",
      ...buildings.flatMap((_, index) => buildingColumns.map((label) => `Batiment_${index + 1}_${label}`))]];
    for (const strategy of ["baseline", "optimized"]) {
      for (const row of state.result[strategy].rows) {
        rows.push([
          exportedCity.name, model.PRESETS[state.scenario].name, strategy === "baseline" ? "Sans pilotage" : "Optimisé",
          clock(row.hour), clock(row.hour + 1), ...measurements.map(([, key]) => row[key]),
          ...row.lines.flatMap((line) => lineColumns.map(([, key]) => (line.open && key === "voltage" ? "" : line[key]))),
          ...settingsColumns.map(([, key]) => state.config[key]), model.CITY_SIZES[exportedCity.network.size].label,
          ...buildings.flatMap((building) => {
            const load = row.buildingLoads[building.id];
            return [building.name, model.BUILDINGS[building.type].name, assetName(building.district), building.power, load.demand, load.supplied];
          })
        ]);
      }
    }
    function cell(value) {
      if (typeof value === "boolean") return value ? "1" : "0";
      if (typeof value === "number") return String(Number(value.toFixed(6))).replace(".", ",");
      const escaped = /^[=+\-@\t\r\n]/u.test(value.trimStart()) ? "'" + value : value;
      return '"' + escaped.replaceAll('"', '""') + '"';
    }
    const csv = "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
    download(csv, "csv", `gridlab-${filename(exportedCity.name)}-${state.scenario}`, "text/csv;charset=utf-8");
    status("CSV exporté · 48 créneaux-stratégies.");
  }

  $$("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
  const desktop = globalThis.gridlabDesktop;
  if (desktop) {
    document.documentElement.dataset.host = "desktop";
    $("#window-controls").hidden = false;
    $$("[data-window]").forEach((button) => button.addEventListener("click", () => desktop.control(button.dataset.window)));
    desktop.onMaximized((maximized) => {
      const button = $("[data-window=maximize]");
      const label = maximized ? "Restaurer" : "Agrandir";
      button.title = label;
      button.setAttribute("aria-label", label);
      button.querySelector("i").innerHTML = icon(maximized ? "restore" : "maximize");
    });
  }
  function showSchematic() {
    city = null;
    $("#city-canvas").hidden = true;
    $("#city-labels").hidden = true;
    $("#map-controls").hidden = true;
    $("#city-selection").hidden = true;
    $("#city-fallback").hidden = false;
    $("#city-bubble").hidden = true;
    $("#city-bubble").classList.add("schematic-bubble");
    put("city-title", "Schéma de la ville");
  }
  try {
    city = createCity({
      canvas: $("#city-canvas"), labels: $("#city-labels"), bubble: $("#city-bubble"),
      select: selectAsset,
      edit(target) {
        hideAssetBubble();
        editMap(target);
      },
      unavailable: showSchematic
    });
  } catch (error) {
    console.warn("La vue 3D est indisponible.", error);
  }
  if (!city) showSchematic();
  applyTheme(initialTheme());
  $("#theme-toggle").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    try { storage?.setItem(themeKey, theme); } catch { /* Le thème reste appliqué à la session. */ }
  });
  $("#city-bubble").addEventListener("click", openAssetDetails);
  $("#open-object").addEventListener("click", openAssetDetails);
  $$("[data-dismiss]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.dismiss).close());
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("dialog[open]")) hideAssetBubble();
  });
  $$("[data-camera]").forEach((button) => button.addEventListener("click", () => city?.changeCamera(button.dataset.camera)));
  $$("#city-fallback [data-asset]").forEach((button) => {
    button.addEventListener("click", () => selectAsset(button.dataset.asset, true));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      hideAssetBubble();
      editMap({ key: button.dataset.asset });
    });
  });
  $("#scenario").replaceChildren(...Object.entries(model.PRESETS).map(([key, preset]) => new Option(preset.name, key)));
  $("#scenario").addEventListener("change", (event) => {
    stopPlayback();
    state.scenario = event.target.value;
    state.config = readSettings(state.scenario);
    state.hour = state.scenario === "outage" ? 19 : 12;
    run();
  });
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => selectView(button.dataset.view)));
  $$("[data-strategy]").forEach((button) => button.addEventListener("click", () => {
    state.strategy = button.dataset.strategy;
    for (const candidate of $$("[data-strategy]")) candidate.setAttribute("aria-pressed", candidate === button);
    renderDashboard();
    region?.refresh();
  }));
  $("#hour").addEventListener("input", (event) => setHour(Number(event.target.value)));
  $("#night-toggle").addEventListener("change", (event) => {
    stopPlayback();
    state.config.nightEnabled = event.target.checked;
    saveSettings();
    run();
  });
  $("#play").addEventListener("click", togglePlayback);
  $("#export").addEventListener("click", () => state.sceneMode === "region" ? region.exportRegion() : exportCsv());
  $("#power-chart").addEventListener("click", (event) => {
    if (!chartGeometry) return;
    const { left, right } = chartGeometry;
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
    setHour(Math.round(23 * (x - left) / (right - left)));
  });
  new ResizeObserver(drawChart).observe($(".plot"));
  initSettings();
  editObject = initObjectEditor();
  editMap = initMapEditor();
  refreshBuildings = initBuildings();
  region = globalThis.GridLabRegionUI.create({
    workspace, hour: () => state.hour, save: saveWorkspace, status, stop: stopPlayback, fieldInput, number, download,
    localRows(city) {
      const result = city.id === workspace.activeId
        ? state.result : model.simulate(state.scenario, readSettings(state.scenario, city), city.network);
      return result[state.strategy].rows;
    },
    openCity(id) {
      selectView("dashboard");
      $("#active-city").value = id;
      $("#active-city").dispatchEvent(new Event("change"));
    },
    newCity(position) {
      newCityPosition = position;
      $("#new-city").click();
    }
  });
  initProjects();
})();
