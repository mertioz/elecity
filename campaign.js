(() => {
  "use strict";

  const game = globalThis.GridLabCampaign;
  const grid = globalThis.GridLabTerrain;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const drawIcon = {
    game: '<path d="M7 7h10a4 4 0 0 1 4 3l1 5a3 3 0 0 1-5 2l-2-2H9l-2 2a3 3 0 0 1-5-2l1-5A4 4 0 0 1 7 7zm1 2v5m-2-2h4m7-1h.1m1 2h.1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.3 15.3 5.2 5.2"/>',
    refresh: '<path d="M5 12a7 7 0 1 1 2 5m-2-5V6m0 6h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M10 3h4l.6 2.4 2 .9 2.2-1.2 2 3.5-1.8 1.7v2.4l1.8 1.7-2 3.5-2.2-1.1-2 .9L14 21h-4l-.6-2.3-2-.9-2.2 1.1-2-3.5 1.8-1.7v-2.4L3.2 8.6l2-3.5 2.2 1.2 2-.9z"/>',
    minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14m-7-7h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    maximize: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    restore: '<path d="M9 6h9v9"/><rect x="5" y="9" width="10" height="10" rx="1"/>',
    left: '<path d="m11 5-7 7 7 7m-7-7h16"/>', right: '<path d="m13 5 7 7-7 7M4 12h16"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    focus: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/><circle cx="12" cy="12" r="2"/>',
    village: '<path d="m3 11 9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/>',
    hills: '<path d="m3 19 7-12 5 8 2-4 4 8H3zm5-8 2-1 2 2"/>'
  };
  const icon = (key) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawIcon[key]}</svg>`;
  const escape = (value) => String(value).replace(/[&<>"']/g, (key) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[key]);
  const storage = (() => { try { return localStorage; } catch { return null; } })();
  const languageKey = "elecity-language";
  let language = "fr";
  try { if (storage?.getItem(languageKey) === "en") language = "en"; } catch {}
  const t = (message, values) => globalThis.ElecityI18n.translate(language, message, values);
  const tr = (message, values) => escape(t(message, values));
  const locale = () => language === "en" ? "en-GB" : "fr-FR";
  const format = (value, digits = 2) => Number(value).toLocaleString(locale(), { maximumFractionDigits: digits });
  const u = (value, unit, digits) => format(value, digits) + " " + t(unit);
  const lossLabel = (value, unit) => {
    if (value >= 1) return u(value, "k" + unit, 3);
    if (value >= .001 || value === 0) return u(value * 1000, unit, 3);
    return u(value * 1000000, "m" + unit, 3);
  };
  const credit = (value) => u(value, "CR");
  const stamp = (tick) => t("J{day} · {time}", { day: Math.floor(tick / 24) + 1, time: String(tick % 24).padStart(2, "0") + ":00" });
  const slotOf = (id) => game.slots.find((slot) => slot.id === id);
  const cableName = (wire) => wire.id.startsWith("liaison-") && slotOf(wire.to)
    ? t("Départ {name}", { name: t(slotOf(wire.to).name) }) : t(wire.name);
  const displayWorld = (world) => ({
    ...world, name: t(world.name), nodes: world.nodes.map(node => ({ ...node, name: t(node.name) })),
    cables: world.cables.map(wire => ({ ...wire, name: cableName(wire) }))
  });

  function localizedError(message) {
    const credits = /^(Il manque|Le bidon coûte) (\d+) CR\.$/.exec(message);
    if (credits) return t(credits[1] + " {credits} CR.", { credits: format(Number(credits[2]), 0) });
    const requirement = "Construction requise · ";
    if (message.startsWith(requirement)) return t("Construction requise · {name}", { name: t(message.slice(requirement.length)) });
    const range = " hors plage.";
    if (message.endsWith(range)) return t("{field} hors plage.", { field: t(message.slice(0, -range.length)) });
    return t(message);
  }

  const pageTitle = document.title;
  const desktop = globalThis.gridlabDesktop;
  const editor = $("#editor");
  const content = $("#editor-content");
  const hourMs = 20000;
  let state = game.load(storage);
  const clockKey = game.storageKey + "-horloge-fenetre";
  let nextHour = performance.now() + hourMs;
  try {
    const saved = JSON.parse(sessionStorage.getItem(clockKey));
    if (saved?.elapsed === state.game.elapsed && Number.isFinite(saved.deadline)) {
      nextHour = performance.now() + Math.min(hourMs, saved.deadline - Date.now());
    }
  } catch { /* La simulation avance aussi sans stockage de session. */ }
  function rememberClock() {
    try { sessionStorage.setItem(clockKey, JSON.stringify({elapsed:state.game.elapsed, deadline:Date.now()+nextHour-performance.now()})); }
    catch { /* La date monotone en mémoire reste disponible. */ }
  }
  rememberClock();
  let latest = game.advance(state);
  let visualSignature;
  let scene;
  let flash;
  let presses;
  let challengeHour;
  let equipment;
  let openFault;
  let openLine;
  let routeAction;
  let lab = "network";
  let dataset = "campaign";
  let offset = 0;
  let history = [];
  let readings;
  let maximized = false;
  const refreshCalculators = [];

  function save() {
    try {
      if (!storage) return false;
      storage.setItem(game.storageKey, JSON.stringify(state));
      return true;
    } catch { return false; }
  }

  function notice(text) {
    const box = $("#notice");
    box.textContent = t(text);
    box.hidden = false;
    clearTimeout(flash);
    flash = setTimeout(() => { box.hidden = true; }, 3000);
  }

  function meters(rows) {
    return rows.map(([name, value]) => `<div><dt>${tr(name)}</dt><dd>${escape(value)}</dd></div>`).join("");
  }

  const inhabitants = () => Object.values(state.game.city.homes).reduce((sum, node) => sum + node.people, 0);
  const weatherText = (weather) => `${t(weather.label)} · ${u(weather.temperature, "°C", 0)}`;

  function objective() {
    if (!state.built.includes("starter")) return ["Premier courant", "Installe le groupe d’appoint, puis prépare une heure de production.", "Voir le groupe d’appoint", "starter"];
    if (state.game.elapsed === 0 && !state.manual && !state.built.includes("mill") && latest.sources.fuelPerKwh * 2 <= state.fuel) {
      return ["Premier courant", "Le groupe d’appoint est déjà raccordé. Prépare sa première heure de production.", "Préparer le groupe", "sequence"];
    }
    if (!state.built.includes("mill") && state.game.budget + 1e-6 >= slotOf("mill").price) {
      return ["De l’eau au courant", "Le moulin peut alimenter le village à chaque heure, selon le débit du ruisseau.", "Construire le moulin", "mill"];
    }
    if (!state.built.includes("mill")) {
      if (state.fuel < latest.sources.fuelPerKwh * 2) {
        return ["Ravitailler le groupe", t("Il reste peu de combustible. Un bidon coûte {price}.", { price: credit(game.fuelPack.price) }), "Voir le réservoir", "starter"];
      }
      const missing = Math.ceil(slotOf("mill").price - state.game.budget);
      const prepared = state.manual?.at === state.game.elapsed;
      return ["Économiser pour le moulin", t("Il manque {missing}. Les abonnés paient {rate} par kWh reçu.", { missing: credit(missing), rate: credit(game.income) }),
        prepared ? "Voir le groupe" : "Préparer le groupe", prepared ? "starter" : "sequence"];
    }
    if (!state.built.includes("apartment-a")) return ["Accueillir des habitants", "Les logements alimentés attirent des habitants et augmentent les recettes.", "Voir Les Tilleuls", "apartment-a"];
    if (state.built.includes("ridge")) {
      if (!state.built.includes("freight")) return ["Desservir le plateau", "Le départ moyenne tension traverse la rivière. La halle propose deux contrats par jour.", "Voir la halle", "freight"];
      if (state.jobs.trains < game.trainGoal) return ["Contrats ferroviaires", t("{count} / {goal} trains prêts. Assure le chargement de 05 h à 08 h et de 17 h à 20 h.", { count: state.jobs.trains, goal: game.trainGoal }), "Suivre le quai", "freight"];
      if (state.game.best >= 24 && inhabitants() >= 30) return ["Vallée approvisionnée", t("{count} trains expédiés, 30 habitants accueillis et une journée complète de service fiable.", { count: state.jobs.trains }), "Consulter le réseau", "network"];
    }
    if (inhabitants() < 30) return ["Cap sur 30 habitants", "Développe les logements et adapte la production aux heures chargées.", "Voir Les Terrasses", "apartment-b"];
    if (state.game.best < 24) return ["Stabiliser le réseau", "Couvre au moins 95 % de la demande pendant 24 h consécutives.", "Voir la batterie", "battery"];
    return ["Franchir la rivière", "Le village peut étendre son réseau jusqu’aux crêtes et à la voie ferrée.", "Voir le poste des Hauts", "ridge"];
  }

  const groups = [
    ["Premières installations", ["starter","house","breeze","greenhouse","mill"]],
    ["Quartier du Pont", ["apartment-a","apartment-b","dispatch","battery","solar","hospital","plant","pump"]],
    ["Plateau des Hauts", ["ridge","windfarm","pumped","freight"]]
  ];
  function renderCatalog() {
    const current = $$("#slots details");
    const opened = new Set(current.filter((group)=>group.open).map((group)=>group.dataset.group));
    if (!current.length) opened.add("Premières installations");
    $("#slots").innerHTML = groups.map(([name,ids]) => {
      const rows = ids.map((id)=> {
        const slot=slotOf(id), built=state.built.includes(id), locked=slot.requires && !state.built.includes(slot.requires);
        return `<button class="slot-link${locked?" locked":""}" type="button" data-installation="${id}"${locked?` title="${escape(localizedError(game.requirement(slot)))}"`:""}><span>${tr(slot.name)}</span><span class="slot-price ${built?"slot-built":""}">${built?tr("En place"):credit(slot.price)}</span></button>`;
      }).join("");
      return `<details data-group="${name}" ${opened.has(name)?"open":""}><summary>${tr(name)}</summary>${rows}</details>`;
    }).join("");
  }

  function renderPlay(reset = false) {
    latest = game.advance(state);
    readings = undefined;
    const signature = language + "/" + state.built.join(",");
    if (signature !== visualSignature || reset) {
      visualSignature = signature;
      scene?.setWorld(displayWorld(latest.world), reset);
      renderCatalog();
    }
    scene?.update(latest.row,state.last);
    $("#money").textContent = credit(state.game.budget);
    $("#village-summary").innerHTML = meters([
      ["Habitants", format(inhabitants(), 0)],
      ["Bâtiments servis", format(latest.row.buildingServed, 1) + " / " + u(latest.row.buildingDemand, "kW", 1)]
    ]);
    $("#game-time").textContent = stamp(latest.row.tick);
    $("#game-weather").textContent = weatherText(latest.row.weather);
    const [title, detail, label, id] = objective();
    $("#route-title").textContent = t(title);
    $("#route-objective").textContent = t(detail);
    const action = `${id}/${t(label)}`;
    if (routeAction !== action) {
      routeAction = action;
      $("#route-action").innerHTML = `<button class="button primary" type="button" data-installation="${id}">${tr(label)}</button>`;
    }
  }

  function summaryMeters() {
    const event = state.last?.freight ? t("train expédié") : state.last?.crop ? t("récolte vendue") : "";
    return meters([
      ["Trésorerie", credit(state.game.budget)],
      ["Habitants", format(inhabitants(), 0)],
      ["Météo", weatherText(latest.row.weather)],
      ["Vent", u(latest.row.wind, "m/s", 1)],
      ["Service fiable", format(state.game.continuity, 0) + " / 24 h"],
      ["Recettes cumulées", credit(state.income)],
      ["Recettes du dernier créneau", state.last ? "+" + credit(state.last.credit) + (event ? " · " + event : "") : "—"],
      ...(state.built.includes("freight") ? [["Trains expédiés", format(state.jobs.trains, 0)]] : [])
    ]);
  }

  function change(next, message, reset) {
    state = next;
    const saved = save();
    renderPlay(reset);
    if (!saved && message) notice("Partie temporaire · stockage indisponible.");
    else if (message) notice(message);
  }

  function updateClock() {
    const now = performance.now();
    if (now >= nextHour) {
      let next = state;
      for (let i = 0; now >= nextHour && i < 48; i++, nextHour += hourMs) next = game.advance(next).state;
      change(next);
      rememberClock();
      const currentMeters = editor.open && $("#equipment-meters");
      if (currentMeters) currentMeters.innerHTML = meters(readingsFor(equipment));
      if (editor.open && $("#summary-meters")) $("#summary-meters").innerHTML = summaryMeters();
      if (editor.open && $("#build-budget")) refreshConstruction(slotOf(equipment));
      if (editor.open && openFault) drawFault(openFault);
      if (editor.open && openLine) drawLine(openLine);
      if (editor.open && $("#sequence-result")) $("#sequence-result").textContent = t("Créneau écoulé.");
      const prepare = editor.open && $('[data-action="sequence"]');
      if (prepare) {
        prepare.disabled = false;
        $("#starter-status").textContent = "";
      }
      if (!$("#research-view").hidden && lab === "network" && dataset === "campaign") renderNetwork(true);
    }
    if (editor.open) $("#editor-clock").textContent = stamp(latest.row.tick);
  }

  function openDialog(title, html) {
    presses = undefined;
    openFault = undefined;
    openLine = undefined;
    $("#editor-title").textContent = t(title);
    $("#editor-clock").textContent = stamp(latest.row.tick);
    $("#editor-error").textContent = "";
    content.innerHTML = html;
    editor.scrollTop = 0;
    if (!editor.open) editor.showModal();
  }

  function refreshConstruction(slot) {
    const required = slot.requires && !state.built.includes(slot.requires);
    const affordable = state.game.budget + 1e-6 >= slot.price;
    $("#build-budget").textContent = credit(state.game.budget);
    $('[data-action="buy"]').disabled = required || !affordable;
    $("#build-status").textContent = required ? localizedError(game.requirement(slot)) : affordable ? "" : t("La trésorerie n’est pas encore suffisante.");
  }

  function settingsHtml(id) {
    const setting = state.settings[id];
    const help = game.adjustable[id] === "vent" ? t("La consigne plafonne la puissance. Dépasser le régime nominal demande un vent plus soutenu.")
      : id === "pump" ? t("Le débit augmente avec la vitesse. La puissance demandée augmente avec le cube de la vitesse.")
        : t("Au-dessus de 100 %, chaque kWh produit demande davantage de {resource}.", { resource: t(game.adjustable[id]) });
    return `<div class="source-control">
      <label for="operating-rate"><span>${tr("Performance")}</span><strong id="rate-value">${setting} %</strong></label>
      <input id="operating-rate" type="range" min="0" max="150" step="5" value="${setting}">
      <p>${escape(help)}</p>
    </div>`;
  }

  function readingsFor(id) {
    const reading = latest.row.nodes[id];
    const source = latest.sources;
    if (id === "dispatch") return [
      ["Plafond programmé", u(latest.world.dispatch.base, "kW")],
      ["Plafond après météo", u(latest.world.dispatch.limit, "kW")],
      ["Puissance livrée par le poste", u(reading.outbound, "kW")],
      ["Météo", weatherText(latest.row.weather)]
    ];
    if (id === "breeze" || id === "windfarm") return [
      ["Vent du créneau",u(latest.row.wind,"m/s",1)], ["Puissance nominale",u(slotOf(id).power,"kW")],
      ["Disponible avec ce vent",u(reading.available,"kW")], ["Injectée sur le réseau",u(reading.generated,"kW")]
    ];
    if (id === "greenhouse") return [["Fonctionnement",t(reading.demand > 0 ? "En service" : "En veille programmée")],
      ["Reçue / demandée",u(reading.received,"kW")+" / "+u(reading.demand,"kW")],
      ["Temps de culture",state.jobs.cropHours+" / "+game.harvestHours+" h"],["Récoltes vendues",String(state.jobs.harvests)], ["Vente par récolte",credit(game.harvestPrice)]];
    if (id === "freight") return [["Quai",t(grid.freightLoading(latest.row.hour)?"Chargement en cours":"En attente du train")],
      ["Créneaux de chargement",t("05–08 h et 17–20 h")],["Heures assurées dans le créneau",state.jobs.loading+" / 3 h"],
      ["Reçue / demandée",u(reading.received,"kW")+" / "+u(reading.demand,"kW")],["Contrats honorés",String(state.jobs.trains)],
      ["Départs manqués",String(state.jobs.missed)],["Prime au départ",credit(game.trainPrice)]];
    if (id === "pumped") return [["Mode de ce créneau",t(game.storageModes[latest.world.nodes.find(node => node.id === "pumped").storageMode])],
      ["Énergie du bassin supérieur",u(state.game.stocks[id].soc,"kWh")+" / "+u(slotOf(id).capacity,"kWh")],
      ["Électricité de pompage prévue",u(reading.charge,"kWh")],["Énergie mise en réserve",u(reading.stored,"kWh")],
      ["Puissance turbinée",u(reading.generated,"kW")],["Rendement aller-retour",u(100*grid.catalog.pumped.chargeEfficiency*grid.catalog.pumped.dischargeEfficiency,"%")]];
    if (id === "intake") return [["Eau disponible",u(state.game.stocks.intake.water,"m³")],["Eau prélevée ce créneau",u(reading.waterFlow,"m³")]];
    if (["poste","ridge","west-pole","east-pole"].includes(id)) return [["Tension MT",u(reading.voltage,"kV",4)],
      ["Flux entrant",u(reading.inbound,"kW")],["Flux sortant",u(reading.outbound,"kW")]];
    if (id === "starter") return [
      ["Disponible ce créneau", u(source.starter, "kW")], ["Injectée", u(reading.generated, "kW")],
      ["Stock de combustible", u(state.fuel, "kWh éq.")], ["Combustible prévu", u(latest.last.fuel, "kWh éq.")],
      ["Combustible par kWh produit", u(source.fuelPerKwh, "kWh éq.")]
    ];
    if (id === "mill") return [
      ["Disponible ce créneau", u(source.mill, "kW")], ["Injectée", u(reading.generated, "kW")],
      ["Débit du ruisseau", u(source.flow, "m³/s", 3)], ["Débit turbinable au réglage actuel", u(source.used, "m³/s", 3)],
      ["Débit turbiné prévu", u(latest.last.water, "m³/s", 3)], ["Rendement au réglage actuel", u(100 * game.hydraulicEfficiency / source.millPenalty, "%", 1)]
    ];
    if (id === "plant") return [
      ["Disponible ce créneau", u(source.plantAvailable, "kW")], ["Injectée", u(reading.generated, "kW")],
      ["Stock de combustible", u(state.game.stocks.plant.fuel * 1000, "kWh éq.")],
      ["Réserve de refroidissement", u(state.game.stocks.plant.water, "m³")],
      ["Eau par MWh produit", u(source.plantWaterRate, "m³")],
      ["Combustible par kWh produit", u(source.plantPenalty, "kWh éq.")],
      ["Eau reçue ce créneau", u(reading.waterFlow, "m³")]
    ];
    if (id === "pump") return [
      ["Puissance au réglage actuel", u(source.pump, "kW")], ["Puissance reçue", u(reading.received, "kW")],
      ["Débit maximal au réglage actuel", u(source.pumpFlow, "m³/h")], ["Eau livrée ce créneau", u(reading.waterFlow, "m³")]
    ];
    const household = state.game.city.homes[id];
    const ward = state.game.city.hospitals[id];
    return [
      ["Puissance reçue", u(reading.received, "kW")], ["Demande", u(reading.demand, "kW")],
      ["Puissance injectée", u(reading.generated, "kW")], ["Tension", u(reading.voltage, "kV", 3)],
      ...(household ? [["Habitants", format(household.people, 0)], ["Plaintes", format(household.complaints, 0)]] : []),
      ...(ward ? [["Patients", format(ward.patients, 0)], ["Secours", u(ward.backup, "h")], ["Décès", format(ward.deaths, 0)]] : []),
      ...(id === "battery" ? [["Énergie en réserve",u(state.game.stocks[id].soc,"kWh")],["Électricité de charge prévue",u(reading.charge,"kWh")],["Énergie mise en réserve",u(reading.stored,"kWh")]] : [])
    ];
  }

  function options(entries, selected) {
    return Object.entries(entries).map(([key, label]) =>
      `<option value="${key}" ${String(selected) === key ? "selected" : ""}>${tr(label)}</option>`).join("");
  }

  function programForm(id) {
    const program = state.programs[id];
    if (!program) return "";
    const hours = Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hour, String(hour).padStart(2, "0") + ":00"]));
    const select = (name, label, entries) => `<label>${tr(label)}<select name="${name}">${options(entries, program[name])}</select></label>`;
    const number = (name, label, max) => `<label>${tr(label)}<input name="${name}" type="number" min="0" max="${max}" value="${program[name]}" required></label>`;
    const planned = id === "pumped" && state.storageMode !== "scheduled" ? "hidden" : "";
    const fields = id === "dispatch" ? `
      ${number("inside", "En plage (kW)", game.dispatchRating)}${number("outside", "Hors plage (kW)", game.dispatchRating)}
      ${select("response", "Réponse à la météo", game.weatherResponses)}${number("adjustment", "Amplitude météo (%)", 50)}`
      : id === "greenhouse" ? select("mode", "Fonctionnement", game.greenhouseModes) : "";
    const heading = id === "pumped" ? "Plage de turbinage" : id === "greenhouse" ? "Plage de culture" : "Programme du poste";
    return `<form class="program-form" data-program="${id}" ${planned}>
      <h3>${tr(heading)}</h3>
      <div class="program-grid">${select("start", "Début", hours)}${select("end", "Fin", hours)}${fields}</div>
      <p>${tr("Une plage peut traverser minuit. Début et fin identiques couvrent la journée.")}</p>
      ${id === "dispatch" ? `<p>${tr("Suivre hausse le plafond quand le vent ou le soleil est fort. Compenser le hausse quand les deux sont faibles.")}</p>` : ""}
      ${id === "pumped" ? `<p>${tr("Le bassin turbine sur la plage et pompe les surplus en dehors.")}</p>` : ""}
      <div class="dialog-footer"><button type="submit" class="button primary">${tr("Appliquer")}</button><span class="program-status" role="status"></span></div>
    </form>`;
  }

  function installation(id) {
    if (id === "network") { showView("research"); return; }
    if (id === "sequence") { sequenceView(); return; }
    if (["poste","intake","west-pole","east-pole"].includes(id)) {
      equipment=id;
      const node=latest.world.nodes.find((item)=>item.id===id);
      openDialog(node.name,`<dl class="meter" id="equipment-meters">${meters(readingsFor(id))}</dl>`);
      return;
    }
    const slot = slotOf(id);
    if (!slot) return;
    equipment = id;
    if (!state.built.includes(id)) {
      openDialog(slot.name, `<p>${tr(slot.note)}</p><dl class="meter">${meters([["Construction", credit(slot.price)]])}
        <div><dt>${tr("Trésorerie")}</dt><dd id="build-budget"></dd></div></dl>
        <button class="button primary" type="button" data-action="buy">${tr("Construire · {price}", { price: credit(slot.price) })}</button><p id="build-status"></p>`);
      refreshConstruction(slot);
      return;
    }
    const configured = Object.hasOwn(game.adjustable, id);
    openDialog(slot.name, `${slot.note?`<p>${tr(slot.note)}</p>`:""}<dl class="meter" id="equipment-meters">${meters(readingsFor(id))}</dl>
      ${configured ? settingsHtml(id) : ""}
      ${id === "pumped" ? `<label class="dialog-select">${tr("Consigne de la station")}<select id="storage-mode">${options(game.storageModes, state.storageMode)}</select></label>` : ""}
      ${id === "starter" ? `<div class="dialog-footer">
        <button type="button" data-action="sequence" class="button primary" ${state.manual?.at === state.game.elapsed ? "disabled" : ""}>${tr("Préparer le groupe")}</button>
        <button type="button" data-action="refuel" class="button">${tr("Acheter un bidon · {price}", { price: credit(game.fuelPack.price) })}</button></div>
        <p id="starter-status">${state.manual?.at === state.game.elapsed ? tr("Le groupe est prêt pour cette heure.") : ""}</p>` : ""}
      ${id === "plant" ? `<button type="button" data-action="refuel" class="button">${tr("Ravitailler jusqu’à 1 MWh · {price}/MWh", { price: credit(grid.fuelPrice) })}</button>` : ""}
      ${programForm(id)}`);
  }

  function drawFault(target) {
    const meter=target.kind === "node" ? latest.row.nodes[target.id] : latest.row.cables[target.id];
    const messages=(meter?.issues??[]).map((key)=>grid.diagnostics[key]).filter(Boolean);
    content.innerHTML=messages.length ? messages.map(({title,detail,tip})=>`<article class="diagnostic-note"><h3>${tr(title)}</h3><p>${tr(detail)}</p><p><strong>${tr("Indice")}</strong> ${tr(tip)}</p></article>`).join("") : `<p>${tr("Le service est rétabli sur ce créneau.")}</p>`;
  }

  function drawLine(id) {
    const wire=latest.world.cables.find((link)=>link.id===id);
    const meter=latest.row.cables[id];
    const names=new Map(latest.world.nodes.map((node)=>[node.id,t(node.name)]));
    const flow=meter.direction<0?[wire.to,wire.from]:[wire.from,wire.to];
    const water=wire.medium==="water";
    content.innerHTML=`<dl class="meter">${meters([
      ["Sens du flux",meter.direction?flow.map((node)=>names.get(node)).join(" → "):t("Au repos")],
      ["Longueur",u(meter.length*1000,"m",1)],
      ...(meter.powerLimit === undefined ? [] : [["Plafond après météo", u(meter.powerLimit, "kW")]]),
      ...(water?[["Débit",u(meter.sent,"m³/h")]]:[["Puissance au départ",u(meter.sent,"kW")],["Puissance à l’arrivée",u(meter.received,"kW")],
        ["Courant",u(meter.current,"A",4)],["Pertes dans le câble",lossLabel(meter.loss,"W")]])
    ])}</dl>`;
  }

  function sequenceView() {
    openDialog("Commandes du groupe", "");
    presses = [];
    challengeHour = state.game.elapsed;
    renderSequence();
  }

  function renderSequence() {
    const expected = game.sequence(state, challengeHour);
    content.innerHTML = `<p>${tr("Appuie sur les cinq commandes dans l’ordre. Chaque bonne commande prépare 2 kWh au réglage nominal. Une séquence parfaite ajoute 3 kWh.")}</p>
      <div class="sequence" aria-label="${tr("Séquence à reproduire")}">${expected.map((key, i) => {
        const status = i === presses.length ? "current" : presses[i] ? (presses[i] === key ? "correct" : "wrong") : "";
        return `<span class="${status}">${key}</span>`;
      }).join("")}</div>
      <div class="command-keypad">${["A", "B", "C", "D"].map((letter) =>
        `<button type="button" class="command" data-key="${letter}">${letter}</button>`).join("")}</div>`;
  }

  function command(key) {
    if (!presses) return;
    updateClock();
    presses.push(key);
    if (presses.length < 5) { renderSequence(); return; }
    change(game.manual(state, presses, challengeHour), "Groupe préparé.");
    const supply = game.production(state);
    openDialog("Groupe prêt", `<dl class="meter">${meters([
      ["Commandes correctes", state.manual.hits + " / 5"],
      ["Énergie préparée au réglage actuel", u(supply.starter, "kWh")],
      ["Puissance demandée par le village", u(latest.row.buildingDemand, "kW")]
    ])}</dl><p id="sequence-result">${tr("L’énergie sera livrée au changement d’heure.")}</p><button type="button" data-action="close" class="button primary">${tr("Retour à la carte")}</button>`);
  }

  function renderForm(kind, specs, convert) {
    const section = document.getElementById("lab-" + kind);
    const formId = "form-" + kind;
    section.innerHTML = `<div class="lab-columns"><form id="${formId}" class="grid-fields">${specs.map(([key, label, value, min, max]) =>
      `<label><span>${tr(label)}</span><input type="number" name="${key}" value="${value}" step="any" min="${min}" max="${max}" required></label>`
    ).join("")}</form><div><dl class="meter lab-output"></dl><p class="lab-reference"></p></div></div>`;
    const form = $("#" + formId);
    const recalc = () => {
      if (!form.checkValidity()) {
        section.querySelector(".lab-output").innerHTML = "";
        section.querySelector(".lab-reference").textContent = t("Renseigne des valeurs valides pour obtenir un résultat.");
        return;
      }
      const values = Object.fromEntries(specs.map(([key]) => [key, form.elements.namedItem(key).valueAsNumber]));
      const { results, note, reference } = convert(values);
      section.querySelector(".lab-output").innerHTML = meters(results);
      section.querySelector(".lab-reference").innerHTML = `${tr(note)} <a href="${escape(reference.url)}" target="_blank" rel="noopener">${tr(reference.label)}</a>.`;
    };
    form.addEventListener("submit", (event) => event.preventDefault());
    form.addEventListener("input", recalc);
    refreshCalculators.push(() => {
      const labels = form.querySelectorAll("label span");
      specs.forEach(([,label], i) => { labels[i].textContent = t(label); });
      recalc();
    });
    recalc();
  }

  renderForm("electric", [
    ["power", "Puissance active (kW)", 25, 0, 100000], ["voltage", "Tension entre phases (kV)", 20, .001, 765],
    ["pf", "Facteur de puissance", .9, .01, 1], ["length", "Longueur (km)", .65, 0, 2000],
    ["resistance", "Résistance (Ω/km)", .32, 0, 100], ["reactance", "Réactance (Ω/km)", .08, 0, 100],
    ["hours", "Durée (h)", 1, 0, 8760]
  ], (values) => {
    const reading = game.electrical(values);
    return { results: [
      ["Puissance apparente", u(reading.apparent, "kVA")], ["Puissance réactive", u(reading.reactive, "kvar")],
      ["Courant", u(reading.current, "A", 3)], ["Chute de tension", u(reading.drop, "V", 3)],
      ["Chute relative", u(reading.dropPercent, "%", 3)], ["Pertes Joule", lossLabel(reading.loss, "W")],
      ["Énergie active", u(reading.energy, "kWh")], ["Énergie perdue", lossLabel(reading.lostEnergy, "Wh")]
    ], note: "Triphasé équilibré. P = √3 × U × I × cos φ. Les pertes résistives sont estimées par 3 × R × I².", reference: {
      label: "Guide Schneider Electric",
      url: language === "en" ? "https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions"
        : "https://fr.electrical-installation.org/frwiki/Calcul_de_la_chute_de_tension_en_ligne_en_r%C3%A9gime_permanente"
    } };
  });
  renderForm("hydraulic", [
    ["flow", "Débit turbiné (m³/s)", .55, 0, 5000], ["head", "Chute nette (m)", game.hydraulicHead, 0, 2500],
    ["efficiency", "Rendement (%)", game.hydraulicEfficiency * 100, 0, 100], ["hours", "Durée (h)", 1, 0, 8760]
  ], ({ flow, head, efficiency, hours }) => {
    const reading = game.hydraulics(flow, head, efficiency / 100, hours);
    const gross = game.hydraulics(flow, head, 1, hours);
    return { results: [
      ["Puissance électrique", u(reading.power, "kW")], ["Énergie électrique", u(reading.energy, "kWh")],
      ["Puissance hydraulique brute", u(gross.power, "kW")], ["Volume turbiné", u(flow * hours * 3600, "m³", 1)]
    ], note: "P (kW) ≈ 9,81 × Q × H × η. Le volume turbiné est un passage d’eau dans la roue.", reference: {
      label: "Microhydropower Handbook, U.S. Department of Energy",
      url: "https://www1.eere.energy.gov/water/pdfs/doewater-10107-vol.1-pt1.pdf"
    } };
  });

  const terms = [
    ["Puissance (kW)", "Débit d’énergie instantané. Un équipement qui délivre 6 kW pendant une heure produit 6 kWh."],
    ["Énergie (kWh)", "Puissance cumulée sur une durée. Sert au bilan des productions, de la consommation et des pertes."],
    ["Tension (kV)", "Différence de potentiel entre les phases du réseau. Les sections éloignées peuvent subir une chute de tension."],
    ["Courant (A)", "Intensité qui traverse un conducteur. Les pertes par échauffement augmentent avec son carré à résistance donnée."],
    ["Facteur de puissance", "Rapport entre la puissance active en kW et la puissance apparente en kVA."],
    ["Puissance réactive (kvar)", "Composante de la puissance associée aux échanges d’énergie entre le réseau et certaines charges."],
    ["Débit hydraulique", "Le volume d’eau qui passe dans le moulin par seconde. Le débit, la hauteur et le rendement déterminent la puissance."],
    ["Rendement", "Rapport entre énergie utile et énergie reçue. Dans le jeu, le surcroît de performance détériore le rendement des sources réglables."],
    ["Production disponible", "Plafond à l’heure affichée. L’énergie réellement injectée dépend de la demande, du réseau et des réserves."],
    ["Stockage", "La batterie met de côté un surplus renouvelable, puis le restitue avec des pertes."],
    ["Énergie non servie", "Part de la consommation que le réseau n’a pas pu alimenter. Elle peut déclencher des plaintes ou des départs."],
    ["Prévision", "Simulation des heures à venir avec les réglages actuels. Le groupe manuel nécessite une nouvelle commande à chaque heure."]
  ];

  function glossary(query = "") {
    const plain = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matches = terms.map(([word, text]) => [t(word), t(text)]).filter(([word, text]) => plain(word + " " + text).includes(plain(query)));
    $("#term-results").innerHTML = matches.map(([word, text]) => `<article><h3>${escape(word)}</h3><p>${escape(text)}</p></article>`).join("")
      || `<p>${tr("Aucun terme trouvé.")}</p>`;
  }

  $("#lab-glossary").innerHTML = '<label><span data-localize>Rechercher un terme</span><input type="search" id="term-query" placeholder="Ex. tension ou rendement" data-localize-attrs="placeholder"></label><div class="lab-terms" id="term-results"></div>';
  $("#term-query").addEventListener("input", (event) => glossary(event.target.value));
  glossary();

  const localText = $$("[data-localize]").map(element => [element, element.textContent]);
  const localAttributes = $$("[data-localize-attrs]").flatMap(element =>
    element.dataset.localizeAttrs.split(" ").map(attribute => [element, attribute, element.getAttribute(attribute)]));

  function syncRouteLabel() {
    $("#route-toggle").setAttribute("aria-label", t($("#route-body").hidden ? "Déplier les installations" : "Replier les installations"));
  }

  function updateInterfaceText() {
    document.documentElement.lang = language;
    document.title = t(pageTitle);
    for (const [element, message] of localText) element.textContent = t(message);
    for (const [element, attribute, message] of localAttributes) element.setAttribute(attribute, t(message));
    $('[data-window="maximize"]').setAttribute("aria-label", t(maximized ? "Restaurer" : "Agrandir"));
    syncRouteLabel();
  }

  function openSettings() {
    openDialog("Paramètres", `<label class="dialog-select"><span id="language-label">${tr("Langue de l’interface")}</span>
      <select id="interface-language" autofocus>
        <option lang="fr" value="fr" ${language === "fr" ? "selected" : ""}>Français</option>
        <option lang="en" value="en" ${language === "en" ? "selected" : ""}>English</option>
      </select></label>`);
  }

  function changeLanguage(next) {
    if (next === language || !["en", "fr"].includes(next)) return;
    language = next;
    try { storage?.setItem(languageKey, next); } catch {}
    updateInterfaceText();
    $("#editor-title").textContent = t("Paramètres");
    $("#language-label").textContent = t("Langue de l’interface");
    $("#notice").hidden = true;
    renderPlay();
    if ($("#lab-readings")) renderNetwork();
    for (const refresh of refreshCalculators) refresh();
    glossary($("#term-query").value);
    updateClock();
  }

  function previousMaps() {
    try {
      if (!storage?.getItem(grid.storageKey)) return [];
      return grid.load(storage).worlds;
    } catch { return []; }
  }

  function series() {
    if (readings) return readings;
    const historical = history.find((world) => world.id === dataset);
    readings = historical ? grid.forecast(historical).rows.map((row) => ({ row, world: historical })) : game.forecast(state);
    return readings;
  }

  const htmlTable = (heads, rows) => `<div class="lab-table"><table><thead><tr>${heads.map((head) => "<th>" + tr(head) + "</th>").join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((value) => "<td>" + escape(value) + "</td>").join("")}</tr>`).join("")}</tbody></table></div>`;

  function renderNetwork(keepControls = false) {
    const forecast = series()[offset];
    const { row, sources, last } = forecast;
    const world = sources ? displayWorld(forecast.world) : forecast.world;
    const names = new Map(world.nodes.map((node) => [node.id, node.name]));
    const nodeRows = world.nodes.map((node) => {
      const reading = row.nodes[node.id];
      const stock = node.id === "starter" && sources ? u(forecast.state.fuel, "kWh de combustible")
        : reading.fuel !== undefined ? u(reading.fuel, "MWh éq.") + " · " + u(reading.water, "m³")
        : reading.soc !== undefined ? u(reading.soc, "kWh") : reading.community ? u(reading.community.people, "hab.", 0)
          : reading.care ? u(reading.care.patients, "patients", 0) : reading.water !== undefined ? u(reading.water, "m³") : "—";
      return [node.name, format(reading.voltage, 3), format(reading.demand), format(reading.received),
        format(reading.generated), stock, (reading.issues ?? []).map((key) => t(grid.diagnostics[key]?.title ?? key)).join(" · ") || "—"];
    });
    const wireRows = world.cables.map((link) => {
      const meter = row.cables[link.id];
      const a = meter.direction < 0 ? link.to : link.from;
      const b = meter.direction < 0 ? link.from : link.to;
      return [link.name, meter.open ? t("Ouvert") : meter.direction ? names.get(a) + " → " + names.get(b) : t("Au repos"),
        link.medium === "water" ? u(meter.sent, "m³/h") : u(meter.sent, "kW"),
        link.medium === "water" ? "—" : format(meter.current, 4),
        link.medium === "water" ? "—" : lossLabel(meter.loss, "W"), format(meter.length, 4)];
    });
    const selector = history.length ? `<label>${tr("Carte analysée")}<select id="dataset"><option value="campaign">${tr("Le Ruisseau")}</option>${history.map((item) =>
      `<option value="${escape(item.id)}" ${item.id === dataset ? "selected" : ""}>${escape(item.name)}</option>`).join("")}</select></label>` : "";
    if (!keepControls || !$("#lab-readings")) {
      $("#lab-network").innerHTML = `<div class="lab-columns">${selector}
        <label><span id="lab-hour-label"></span><input type="range" id="lab-hour" min="0" max="23" value="${offset}"></label></div>
        <div id="lab-readings"></div><p><button type="button" id="analyse-map" class="button">${tr("Analyser un JSON de carte")}</button></p>`;
      $("#lab-hour").addEventListener("input", (event) => { offset = Number(event.target.value); renderNetwork(true); });
      $("#dataset")?.addEventListener("change", (event) => { dataset = event.target.value; offset = 0; readings = undefined; renderNetwork(); });
      $("#analyse-map").addEventListener("click", () => $("#research-file").click());
    }
    $("#lab-hour-label").textContent = t("Créneau de prévision · {time}", { time: stamp(row.tick) });
    $("#lab-readings").innerHTML = `<p>${tr("Mesures du créneau sélectionné. Les puissances sont moyennes sur une heure.")}</p>
      <dl class="meter lab-meters">${meters([
        ["Produite", u(row.generated, "kW")], ["Demandée", u(row.demand, "kW")], ["Reçue", u(row.served, "kW")],
        ["Pertes dans les câbles", lossLabel(row.losses, "W")], ["Électricité envoyée au stockage", u(row.charged, "kWh")],
        ["Énergie mise en réserve", u(row.stored, "kWh")],["Vent",u(row.wind,"m/s",1)],["Eau livrée", u(row.waterDelivered, "m³")],
        ...(sources ? [["Météo", weatherText(row.weather)], ["Ventes d’électricité",credit(last.sales)],["Récoltes et contrats",credit(last.crop+last.freight)],["Recettes du créneau",credit(last.credit)]] : []),
        ...(world.dispatch ? [["Plafond du poste programmable", u(world.dispatch.limit, "kW")],
          ["Puissance livrée par le poste", u(row.nodes.dispatch.outbound, "kW")]] : [])
      ])}</dl>
      <h2>${tr("Installations")}</h2>${htmlTable(["Installation", "Tension (kV)", "Demande (kW)", "Reçue (kW)", "Injectée (kW)", "Stock / occupation", "Diagnostic"], nodeRows)}
      <h2>${tr("Liaisons")}</h2>${wireRows.length ? htmlTable(["Liaison", "Sens", "Débit ou puissance", "Courant (A)", "Pertes", "Longueur (km)"], wireRows) : `<p>${tr("Aucune liaison active.")}</p>`}
      ${sources && state.built.some((id) => Object.hasOwn(game.adjustable, id)) ? `<h2>${tr("Réglage des équipements")}</h2>
      <dl class="meter">${meters([
        ...(state.built.includes("starter") ? [["Réglage du groupe", u(state.settings.starter, "%", 0)], ["Groupe disponible", u(sources.starter, "kW")],
          ["Combustible par kWh produit", u(sources.fuelPerKwh, "kWh éq.")], ["Combustible utilisé", u(last.fuel, "kWh éq.")]] : []),
        ...(state.built.includes("mill") ? [["Réglage du moulin", u(state.settings.mill, "%", 0)], ["Moulin disponible", u(sources.mill, "kW")],
          ["Débit du ruisseau", u(sources.flow, "m³/s", 3)], ["Débit turbiné", u(last.water, "m³/s", 3)]] : []),
        ...(state.built.includes("plant") ? [["Réglage de la centrale", u(state.settings.plant, "%", 0)], ["Centrale disponible", u(sources.plantAvailable, "kW")],
          ["Eau par MWh produit", u(sources.plantWaterRate, "m³")], ["Combustible par kWh produit", u(sources.plantPenalty, "kWh éq.")]] : []),
        ...(state.built.includes("pump") ? [["Réglage de la pompe", u(state.settings.pump, "%", 0)], ["Puissance de pompage", u(sources.pump, "kW")],
          ["Débit maximal de pompage", u(sources.pumpFlow, "m³/h")]] : []),
        ...["breeze","windfarm"].filter((id)=>state.built.includes(id)).map((id)=>[slotOf(id).name,u(state.settings[id],"%",0)+" · "+u(row.nodes[id].available,"kW disponibles")]),
        ...(state.built.includes("pumped")?[["Mode de ce créneau",t(game.storageModes[world.nodes.find(node => node.id === "pumped").storageMode])]]:[])
      ])}</dl>` : ""}`;
  }

  function showView(name) {
    if (editor.open) editor.close();
    $("#play-view").hidden = name !== "play";
    $("#research-view").hidden = name !== "research";
    $("#new-run").hidden = name !== "play";
    for (const tab of $$("[data-view]")) {
      if (tab.dataset.view === name) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    if (name === "research") {
      const imports = history.filter((item) => item.id.startsWith("import-"));
      history = [...previousMaps(), ...imports];
      renderNetwork();
      showLab(lab);
    } else renderPlay();
  }

  function showLab(name) {
    lab = name;
    for (const tab of $$("[data-lab]")) {
      const active = tab.dataset.lab === name;
      tab.setAttribute("aria-pressed", String(active));
      document.getElementById("lab-" + tab.dataset.lab).hidden = !active;
    }
    if (name === "network") renderNetwork(true);
  }

  function csv() {
    const headers = ["Créneau", "Type", "Nom", "Tension (kV)", "Demande (kW)", "Reçue (kW)", "Injectée (kW)", "Courant (A)", "Pertes (kW)", "Débit (m³/h)", "Réserve électrique (kWh)", "Eau restante (m³)", "Habitants", "Patients", "Diagnostic", "Combustible restant (kWh éq.)", "Entrée stockage (kWh)", "Mise en réserve (kWh)", "Ventes électriques (CR)", "Récolte (CR)", "Train (CR)", "Vent (m/s)"];
    const data = [headers.map(label => t(label))];
    for (const { row, world: rawWorld, state: after, last } of series()) {
      const world = after ? displayWorld(rawWorld) : rawWorld;
      data.push([stamp(row.tick),t("Bilan"),world.name,"",row.demand,row.served,row.generated,"",row.losses,row.waterDelivered,"","","","","","",row.charged,row.stored,last?.sales??"",last?.crop??"",last?.freight??"",row.wind]);
      for (const node of world.nodes) {
        const m = row.nodes[node.id];
        data.push([stamp(row.tick), t(grid.catalog[node.type].label), node.name, m.voltage, m.demand, m.received, m.generated,
          "", "", m.waterFlow, m.soc ?? "", m.water ?? "", m.community?.people ?? "", m.care?.patients ?? "", (m.issues ?? []).join(", "),
          node.id==="starter" && after ? after.fuel : m.fuel===undefined?"":m.fuel*1000,m.charge,m.stored]);
      }
      for (const wire of world.cables) {
        const line = row.cables[wire.id];
        data.push(wire.medium === "water"
          ? [stamp(row.tick), t("Canalisation"), wire.name, "", "", "", "", "", "", line.sent, "", "", "", "", (line.issues ?? []).join(", ")]
          : [stamp(row.tick), t("Câble"), wire.name, line.voltage, "", line.received, line.sent, line.current, line.loss, "", "", "", "", "", (line.issues ?? []).join(", ")]);
      }
    }
    const delimiter = language === "en" ? "," : ";";
    const cell = (value) => typeof value === "number" ? String(Number(value.toFixed(6))).replace(".", language === "en" ? "." : ",")
      : '"' + (/^[=+\-@\t\r\n]/u.test(value.trimStart()) ? "'" : "") + value.replaceAll('"', '""') + '"';
    const url = URL.createObjectURL(new Blob(["\uFEFF" + data.map((row) => headers.map((_,i)=>cell(row[i]??"")).join(delimiter)).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = t("elecity-releve.csv");
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  updateInterfaceText();
  for (const element of $$("[data-icon]")) element.innerHTML = icon(element.dataset.icon);
  if (desktop) {
    document.documentElement.dataset.host = "desktop";
    $("#window-controls").hidden = false;
    for (const button of $$("[data-window]")) button.addEventListener("click", () => desktop.control(button.dataset.window));
    desktop.onMaximized((value) => {
      maximized = value;
      const button = $('[data-window="maximize"]');
      button.innerHTML = icon(value ? "restore" : "maximize");
      button.setAttribute("aria-label", t(value ? "Restaurer" : "Agrandir"));
    });
  }
  const canvas = $("#terrain-canvas");
  function fallback() {
    scene = null;
    canvas.hidden = true;
    $("#terrain-labels").replaceChildren();
    $("#canvas-fallback").hidden = false;
    $(".world-controls").hidden = true;
    $(".district-nav").hidden = true;
  }
  function inspectMap(pick) {
    if (pick.kind === "lot" || pick.kind === "node") { installation(pick.id); return; }
    if (pick.kind === "cable") {
      const wire=latest.world.cables.find((link)=>link.id===pick.id);
      openDialog(cableName(wire),""); openLine=wire.id; drawLine(wire.id);
    }
  }
  try {
    scene = globalThis.GridLabGroundScene.create({
      canvas, labels: $("#terrain-labels"), plots: game.slots, waterway: true,
      select: inspectMap, context: inspectMap, translate: t,
      holdStart: () => false, holdCancel() {}, quote() {},
      inspectIssue(target) {
        openDialog("Diagnostic", "");
        openFault=target; drawFault(target);
      }
    });
  } catch (error) { console.error(error); }
  if (!scene) fallback();
  canvas.addEventListener("terrain-unavailable", fallback);
  scene?.theme(true);
  renderPlay(true);
  for (const button of $$("[data-camera]")) button.addEventListener("click", () => scene?.cameraAction(button.dataset.camera));
  for (const tab of $$("[data-view]")) tab.addEventListener("click", () => showView(tab.dataset.view));
  for (const tab of $$("[data-lab]")) tab.addEventListener("click", () => showLab(tab.dataset.lab));
  document.querySelector(".route-panel").addEventListener("click", (event) => {
    const target = event.target.closest("[data-installation]");
    if (target) {
      const slot=slotOf(target.dataset.installation);
      if (slot && target.closest("#slots")) scene?.cameraAction("focus",slot);
      installation(target.dataset.installation);
    }
  });
  $("#route-toggle").addEventListener("click", () => {
    $("#route-body").hidden = !$("#route-body").hidden;
    $("#route-toggle").setAttribute("aria-expanded", String(!$("#route-body").hidden));
    syncRouteLabel();
  });
  $("#new-run").addEventListener("click", () => openDialog("Nouvelle partie", `<p>${tr("Repartir à midi avec {price}, une maison et un groupe d’appoint déjà raccordé ? La progression de cette campagne sera remplacée.", { price: credit(game.startingCredits) })}</p><button type="button" class="button primary" data-action="reset">${tr("Recommencer")}</button>`));
  $("#app-settings").addEventListener("click", openSettings);
  $("#village-details").addEventListener("click", () => openDialog("Bilan du village", `<dl class="meter" id="summary-meters">${summaryMeters()}</dl>`));
  content.addEventListener("change", (event) => {
    if (event.target.id === "interface-language") changeLanguage(event.target.value);
  });
  $("#editor-close").addEventListener("click", () => editor.close());
  editor.addEventListener("close", () => { presses = undefined; });
  content.addEventListener("input", (event) => {
    if (event.target.id === "storage-mode") {
      change(game.setStorageMode(state,event.target.value));
      $("#equipment-meters").innerHTML=meters(readingsFor("pumped"));
      $('[data-program="pumped"]').hidden = state.storageMode !== "scheduled";
      return;
    }
    if (event.target.id !== "operating-rate") return;
    try {
      change(game.tune(state, equipment, Number(event.target.value)));
      $("#rate-value").textContent = state.settings[equipment] + " %";
      $("#equipment-meters").innerHTML = meters(readingsFor(equipment));
      $("#editor-error").textContent = "";
    } catch (error) { $("#editor-error").textContent = localizedError(error.message); }
  });
  content.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-program]");
    if (!form) return;
    event.preventDefault();
    const id = form.dataset.program;
    const values = Object.fromEntries([...new FormData(form)].map(([key, value]) =>
      [key, key === "response" || key === "mode" ? value : Number(value)]));
    try {
      change(game.setProgram(state, id, values));
      $("#equipment-meters").innerHTML = meters(readingsFor(id));
      $("#editor-error").textContent = "";
      form.querySelector(".program-status").textContent = t("Programme enregistré.");
    } catch (error) {
      form.querySelector(".program-status").textContent = "";
      $("#editor-error").textContent = localizedError(error.message);
    }
  });
  content.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    try {
      if (target.dataset.key) { command(target.dataset.key); return; }
      switch (target.dataset.action) {
        case "buy": change(game.buy(state, equipment), "Installation raccordée."); installation(equipment); break;
        case "sequence": sequenceView(); break;
        case "refuel":
          change(game.refuel(state, equipment), "Combustible livré."); installation(equipment); break;
        case "close": editor.close(); break;
        case "reset":
          editor.close();
          nextHour = performance.now() + hourMs;
          change(game.newGame(), "Nouvelle partie.", true);
          rememberClock();
          showView("play");
          updateClock();
          break;
      }
    } catch (error) { $("#editor-error").textContent = localizedError(error.message); }
  });
  document.addEventListener("keydown", (event) => {
    const key = event.key.toUpperCase();
    if (editor.open && presses && !event.repeat && ["A", "B", "C", "D"].includes(key)) {
      event.preventDefault();
      command(key);
    }
  });
  $("#csv").addEventListener("click", csv);
  $("#research-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Ce fichier dépasse 2 Mo.");
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== "gridlab-terrain" || parsed.version !== 1) throw new Error("Sélectionne un JSON de carte Elecity ou GridLab.");
      const imported = grid.normalize({ ...parsed.world, id: "import-" + crypto.randomUUID() });
      history.push(imported);
      dataset = imported.id;
      offset = 0;
      readings = undefined;
      renderNetwork();
      notice("Carte chargée en lecture seule.");
    } catch (error) { notice(error instanceof SyntaxError ? "JSON illisible." : localizedError(error.message)); }
  });
  updateClock();
  setInterval(updateClock, 250);
  document.addEventListener("visibilitychange", updateClock);
})();
