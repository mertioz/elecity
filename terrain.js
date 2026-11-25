(() => {
  "use strict";

  const grid = globalThis.GridLabTerrain;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const icons = {
    plus: '<path d="M12 5v14m-7-7h14"/>', minus: '<path d="M5 12h14"/>',
    left: '<path d="m11 5-7 7 7 7m-7-7h16"/>', right: '<path d="m13 5 7 7-7 7M4 12h16"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
    focus: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/><circle cx="12" cy="12" r="2"/>',
    dots: '<path d="M4 12h1m6 0h1m6 0h1" stroke-width="3"/>',
    play: '<path d="m8 5 12 7-12 7z"/>', pause: '<path d="M8 5h2v14H8zm7 0h2v14h-2z"/>',
    maximize: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    restore: '<path d="M9 6h9v9"/><rect x="5" y="9" width="10" height="10" rx="1"/>',
    tower: '<path d="M12 3v18M6 8h12m-10 8 4-13 4 13M7 8v4m10-4v4"/>',
    bolt: '<path d="m13 2-8 12h6l-1 8 9-12h-6z"/>',
    atom: '<circle cx="12" cy="12" r="1"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    battery: '<rect x="2" y="6" width="17" height="12" rx="2"/><path d="M22 10v4M6 12h4m-2-2v4"/>',
    home: '<path d="m3 11 9-8 9 8v9H3zm7 9v-6h4v6"/>',
    building: '<path d="M5 21V3h11v18M3 21h18m-5-13h3v13M9 7h3m-3 4h3m-3 4h3"/>',
    factory: '<path d="M3 20V10l6 3V9l5 4V9l4 3 1-8h2v16zm4-3h1m4 0h1m4 0h1"/>',
    water: '<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13zM8 15a4 4 0 0 0 4 4"/>',
    pump: '<circle cx="11" cy="13" r="6"/><path d="M3 13h2m12 0h4v-7h-4m-6 2a1 1 0 1 1 0 10m-2 3h6"/>',
    cable: '<path d="M5 17h2a3 3 0 0 0 3-3v-4a3 3 0 0 1 3-3h6"/><circle cx="4" cy="17" r="2"/><circle cx="20" cy="7" r="2"/>',
    edit: '<path d="m15 5 4 4m-14 7 11-11a2.8 2.8 0 0 1 4 4L9 20H4z"/>',
    move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
    trash: '<path d="M3 6h18m-12 0V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const locale = new Map();
  function format(value, digits = 1) {
    if (!locale.has(digits)) locale.set(digits, new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }));
    return locale.get(digits).format(value);
  }
  const unit = (value, suffix, digits) => format(value, digits) + " " + suffix;
  const kw = (value) => unit(value, "kW");
  const money = (value) => unit(value, grid.credit, 2);
  const time = (hour) => String(hour).padStart(2, "0") + ":00";
  const clockOf = (minute) => String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
  const minuteOf = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
  const storage = (() => { try { return localStorage; } catch { return null; } })();
  const workspace = grid.load(storage);
  const active = () => workspace.worlds.find(({ id }) => id === workspace.active);
  const identify = (id) => active().nodes.find((node) => node.id === id);
  const identifyCable = (id) => active().cables.find((line) => line.id === id);
  const uuid = () => crypto.randomUUID();
  let scene;
  let result = grid.forecast(active());
  let offset = 0;
  let timer;
  let action;
  let selection;
  let notification;
  let menuHandlers = [];
  let dialogApply;
  let labelsVisible = true;
  const eventLabels = {
    complaints: "Plaintes des habitants", departures: "Habitants partis", arrivals: "Nouveaux habitants",
    deaths: "Patients décédés", treated: "Patients soignés"
  };
  const editor = $("#editor");
  const form = $("#editor-form");
  const editorContent = $("#editor-content");
  const submit = $("#editor-apply");
  const menu = $("#context-menu");
  const input = (name) => form.elements.namedItem(name);
  const row = () => result.rows[offset];
  const dayOf = (tick) => Math.floor(tick / 24) + 1;
  const linkName = (line) => line.medium === "water" ? "Canalisation" : "Câble MT";
  const desktop = globalThis.gridlabDesktop;

  function persist() {
    try {
      if (!storage) return false;
      storage.setItem(grid.storageKey, JSON.stringify(workspace));
      return true;
    } catch { return false; }
  }

  function alertUser(message) {
    const notice = $("#notice");
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(notification);
    notification = setTimeout(() => { notice.hidden = true; }, 2900);
  }

  function safe(work) {
    try { work(); } catch (error) { alertUser(error.message); }
  }

  function commit(draft, message) {
    const checked = grid.normalize(draft);
    const simulated = grid.forecast(checked);
    workspace.worlds = workspace.worlds.map((world) => world.id === checked.id ? checked : world);
    result = simulated;
    if (selection && !(selection.kind === "node" ? identify(selection.id) : identifyCable(selection.id))) selection = undefined;
    scene?.setWorld(checked);
    const saved = persist();
    refresh();
    if (message) alertUser(saved ? message : "Modification disponible pendant cette session.");
  }

  function switchWorld(id) {
    stop();
    cancelAction();
    workspace.active = id;
    selection = undefined;
    offset = 0;
    result = grid.forecast(active());
    scene?.setWorld(active(), true);
    persist();
    refresh();
  }

  function appendWorld(world) {
    if (workspace.worlds.length >= 30) throw new Error("La bibliothèque contient déjà 30 cartes.");
    const checked = grid.normalize(world);
    workspace.worlds.push(checked);
    switchWorld(checked.id);
  }

  function metricHtml(entries) {
    return entries.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("");
  }

  function cableMetrics(line) {
    const value = row().cables[line.id];
    const direction = value.direction < 0 ? [line.to, line.from] : [line.from, line.to];
    const from = row().nodes[direction[0]];
    const to = row().nodes[direction[1]];
    const sense = value.open ? "Ouvert" : value.direction ? identify(direction[0]).name + " → " + identify(direction[1]).name : "Sans transfert";
    if (line.medium === "water") return [
      ["Sens", sense], ["Débit", unit(value.sent, "m³/h", 2)], ["Longueur", unit(value.length, "km", 3)]
    ];
    return [
      ["Sens", sense],
      ["Puissance envoyée", kw(value.sent)], ["Puissance reçue", kw(value.received)],
      ["Courant par phase", unit(value.current, "A", 2)], ["Pertes", unit(value.loss, "kW", 3)],
      ["Tension départ", value.open ? "—" : unit(from.voltage, "kV", 3)], ["Tension arrivée", value.open ? "—" : unit(to.voltage, "kV", 3)],
      ["Longueur", unit(value.length, "km", 3)], ["Courant admissible", unit(line.amperage, "A", 1)],
      ["Pertes sur 24 h", unit(result.rows.reduce((sum, reading) => sum + reading.cables[line.id].loss, 0), "kWh", 3)]
    ];
  }

  function nodeMetrics(node) {
    const kind = grid.catalog[node.type].kind;
    const reading = row().nodes[node.id];
    const city = active().game.city;
    const home = offset ? reading.community : city.homes[node.id];
    if (home) return [
      ["Habitants", home.people + "/" + node.inhabitants], ["Reçue", kw(reading.received)], ["Demande", kw(reading.demand)],
      ["Tension", unit(reading.voltage, "kV", 3)], ["Plaintes cumulées", format(home.complaints, 0)],
      ["Départs cumulés", format(home.departures, 0)], ["Service insuffisant", unit(home.badHours, "h", 0)]
    ];
    const hospital = offset ? reading.care : city.hospitals[node.id];
    if (hospital) return [
      ["Patients", hospital.patients + "/" + node.beds], ["Secours", unit(hospital.backup, "h", 2)], ["Reçue", kw(reading.received)],
      ["Demande", kw(reading.demand)], ["Tension", unit(reading.voltage, "kV", 3)],
      ["Patients soignés", format(hospital.treated, 0)], ["Décès cumulés", format(hospital.deaths, 0)]
    ];
    if (kind === "water") return [
      ["Stock au début", unit(reading.startWater, "m³", 2)], ["Eau prélevée", unit(reading.waterFlow, "m³", 2)],
      ["Stock en fin de créneau", unit(reading.water, "m³", 2)]
    ];
    if (kind === "pump") return [
      ["Débit", unit(reading.waterFlow, "m³/h", 2)], ["Puissance reçue", kw(reading.received)],
      ["Puissance demandée", kw(reading.demand)], ["Tension", unit(reading.voltage, "kV", 3)]
    ];
    const values = [["Tension", unit(reading.voltage, "kV", 3)]];
    if (kind === "load") {
      values.push(["Reçue", kw(reading.received)], ["Demande", kw(reading.demand)]);
    } else if (kind === "relay") {
      values.push(["Entrée", kw(reading.inbound)], ["Sortie", kw(reading.outbound)]);
    } else {
      values.push(["Production nette vers les câbles", kw(reading.generated)]);
      if (kind === "battery") values.push(["Charge", kw(reading.charge)], ["Énergie stockée", unit(reading.soc, "kWh")]);
      if (kind === "plant") values.push(
        ["Eau au début", unit(reading.startWater, "m³", 2)], ["Eau reçue", unit(reading.waterFlow, "m³", 2)],
        ["Eau en fin de créneau", unit(reading.water, "m³", 2)],
        ["Combustible au début", unit(reading.startFuel, "MWh", 2)], ["Combustible en fin de créneau", unit(reading.fuel, "MWh", 2)]
      );
      if (kind === "grid") values.push(["Tarif du créneau", unit(row().tariff.price, grid.credit + "/kWh", 4)]);
    }
    return values;
  }

  function refresh() {
    const selectedNode = selection?.kind === "node" ? identify(selection.id) : null;
    const selectedCable = selection?.kind === "cable" ? identifyCable(selection.id) : null;
    const value = row();
    scene?.update(value);
    scene?.pick(selectedNode);
    $("#clock").textContent = "J" + dayOf(value.tick) + " · " + time(value.hour);
    $("#clock").title = offset ? "Prévision à +" + offset + " h" : "Heure de la partie";
    $("#clock").classList.toggle("preview", offset > 0);
    $("#hour").value = offset;
    $("#hour").setAttribute("aria-valuetext", offset ? "Prévision à +" + offset + " h" : "Maintenant · " + time(value.hour));
    $("#detail-button").hidden = !selectedNode && !selectedCable;
    $("#selection-title").textContent = selectedNode?.name ?? selectedCable?.name ?? kw(value.served);
    $("#selection-type").textContent = selectedNode ? grid.catalog[selectedNode.type].label : selectedCable ? linkName(selectedCable) : "Puissance fournie";
    const metrics = selectedNode ? nodeMetrics(selectedNode).slice(0, 3)
      : selectedCable ? cableMetrics(selectedCable).slice(1, 5)
        : [["Demande", kw(value.demand)], ["Pertes des câbles", unit(value.losses, "kW", 3)]];
    $("#quick-metrics").innerHTML = metricHtml(metrics);
    const game = active().game;
    $("#balance").textContent = money(game.budget);
    $("#balance").classList.toggle("low", game.budget < 100);
    const people = Object.values(game.city.homes).reduce((total, home) => total + home.people, 0);
    $("#city-life").textContent = "Ville · " + format(people, 0) + " hab.";
    $("#mission").textContent = game.best >= grid.missionHours ? "Mission réussie" : "Mission · " + game.continuity + "/" + grid.missionHours + " h";
    $("#mission").classList.toggle("won", game.best >= grid.missionHours);
  }

  function choose(target) {
    closeMenu();
    if (action?.kind === "place" && target.position) {
      safe(() => {
        place(action.type, target.position);
        cancelAction();
      });
      return;
    }
    if (action?.kind === "move" && target.position) {
      safe(() => {
        const draft = { ...active(), nodes: active().nodes.map((node) =>
          node.id === action.id ? { ...node, ...target.position } : node) };
        commit(draft, "Modèle déplacé.");
        cancelAction();
      });
      return;
    }
    if (action?.kind === "link") {
      if (target.kind === "node") safe(() => {
        const from = action.id;
        const medium = action.medium || grid.connectionMedium(active(), from, target.id);
        const issue = grid.connectionIssue(active(), from, target.id, medium);
        if (issue) {
          scene?.flagLink(identify(from), identify(target.id), issue, medium);
          alertUser("Liaison refusée. Clique sur l’icône d’alerte.");
        } else {
          connect(from, target.id, { medium });
        }
        cancelAction();
      });
      else alertUser("Sélectionne le modèle à l’autre extrémité.");
      return;
    }
    selection = target.kind === "ground" ? undefined : target;
    refresh();
  }

  function place(type, position) {
    const node = grid.device(uuid(), type, position.x, position.z);
    const used = new Set(active().nodes.map(({ name }) => name));
    const label = node.name;
    let index = 2;
    while (used.has(node.name)) node.name = label + " " + index++;
    const price = grid.prices[type];
    const draft = grid.spend(active(), price);
    commit({ ...draft, nodes: [...draft.nodes, { ...node, paid: price }] }, node.name + " placé · −" + money(price));
    selection = { kind: "node", id: node.id };
    refresh();
  }

  function connect(from, to, options = {}) {
    const medium = options.medium || grid.connectionMedium(active(), from, to);
    const issue = grid.connectionIssue(active(), from, to, medium);
    if (issue) throw new Error(grid.diagnostics[issue].detail + " Indice. " + grid.diagnostics[issue].tip);
    const price = grid.cablePrice(active(), from, to, medium);
    const draft = grid.spend(active(), price);
    const line = { ...grid.cableDefaults, id: uuid(), medium,
      name: (medium === "water" ? "Canalisation " : "Câble MT ") + (active().cables.length + 1), from, to, ...options, paid: price };
    const message = medium === "water" ? "Canalisation raccordée" : "Câble connecté";
    commit({ ...draft, cables: [...draft.cables, line] }, message + " · −" + money(price));
    selection = { kind: "cable", id: line.id };
    refresh();
  }

  function setAction(next) {
    action = next;
    if (next) scene?.clearFault();
    $("#action-banner").hidden = !next;
    scene?.setPreview(next?.kind === "place" ? next.type : next?.kind === "move" ? identify(next.id)?.type : undefined);
    scene?.previewLink(next?.kind === "link" ? identify(next.id) : undefined, next?.medium);
    for (const button of $$(".model-choice")) button.setAttribute("aria-pressed", String(next?.type === button.dataset.model));
    if (next) {
      $("#action-text").textContent = next.kind === "place" ? "Placer " + grid.catalog[next.type].label + " · " + money(grid.prices[next.type])
        : next.kind === "move" ? "Choisis le nouvel emplacement"
          : "Depuis " + identify(next.id).name + " · clique sur le modèle à relier";
    }
  }

  function linkQuote(price) {
    if (action?.kind !== "link") return;
    const origin = "Depuis " + identify(action.id).name;
    $("#action-text").textContent = origin + (price == null ? " · clique sur le modèle à relier" : " · " + money(price));
  }

  function cancelAction() {
    setAction(undefined);
  }

  function remove(target) {
    const isNode = target.kind === "node";
    const data = isNode ? identify(target.id) : identifyCable(target.id);
    const tied = isNode ? active().cables.filter((line) => line.from === target.id || line.to === target.id) : [];
    const { world, amount } = grid.refund(active(), [data, ...tied]);
    const suffix = tied.length ? " et " + tied.length + (tied.length === 1 ? " liaison" : " liaisons") : "";
    if (!window.confirm("Supprimer « " + data.name + " »" + suffix + " ?" + (amount ? " Récupération de " + money(amount) + "." : ""))) return;
    const draft = { ...world, cables: world.cables.filter((line) =>
      isNode ? line.from !== target.id && line.to !== target.id : line.id !== target.id) };
    if (isNode) draft.nodes = draft.nodes.filter((node) => node.id !== target.id);
    commit(draft, amount ? "Élément retiré · +" + money(amount) : "Élément retiré.");
  }

  function menuItem(label, callback, symbol, extra = "", price) {
    const index = menuHandlers.push(callback) - 1;
    return `<button type="button" data-menu-order="${index}" class="${extra}">${symbol ? icon(symbol) : ""}${escape(label)}
      ${price === undefined ? "" : `<small class="model-price" aria-hidden="true">${money(price)}</small>`}</button>`;
  }

  function menuAt(x, y, build) {
    menuHandlers = [];
    menu.innerHTML = build();
    menu.hidden = false;
    menu.style.visibility = "hidden";
    menu.style.left = "0";
    menu.style.top = "0";
    const fit = () => {
      menu.style.left = Math.max(6, Math.min(x, innerWidth - menu.offsetWidth - 6)) + "px";
      menu.style.top = Math.max(6, Math.min(y, innerHeight - menu.offsetHeight - 6)) + "px";
    };
    fit();
    menu.style.visibility = "visible";
    menu.querySelector("button, summary")?.focus({ preventScroll: true });
    for (const details of menu.querySelectorAll("details")) details.addEventListener("toggle", fit);
  }

  function closeMenu() {
    menu.hidden = true;
  }

  function openContext(target, x, y) {
    cancelAction();
    if (target.kind === "node") {
      selection = target;
      refresh();
      const node = identify(target.id);
      const kind = grid.catalog[node.type].kind;
      menuAt(x, y, () => `<h3>${escape(node.name)}</h3>
        ${menuItem("Modifier", () => editNode(node), "edit")}
        ${menuItem("Déplacer", () => scene ? setAction({ kind: "move", id: node.id }) : placeDialog(node.type, node), "move")}
        ${menuItem("Relier", () => scene ? setAction({ kind: "link", id: node.id }) : connectDialog(node.id), "cable")}
        ${["plant", "pump"].includes(kind) ? menuItem("Relier électriquement", () =>
          scene ? setAction({ kind: "link", id: node.id, medium: "electric" }) : connectDialog(node.id, "electric"), "bolt") : ""}
        ${["plant", "pump", "water"].includes(kind) ? menuItem("Relier en eau", () =>
          scene ? setAction({ kind: "link", id: node.id, medium: "water" }) : connectDialog(node.id, "water"), "water") : ""}
        ${kind === "plant" ? menuItem("Ravitailler en combustible", () => fuelDialog(node), "plus") : ""}
        <hr>${menuItem("Supprimer", () => remove(target), "trash", "danger")}`);
    } else if (target.kind === "cable") {
      selection = target;
      refresh();
      const line = identifyCable(target.id);
      menuAt(x, y, () => `<h3>${escape(line.name)}</h3>
        ${menuItem("Mesures et réglages", () => editCable(line), "cable")}
        <hr>${menuItem("Supprimer", () => remove(target), "trash", "danger")}`);
    } else {
      menuAt(x, y, () => `<h3>Terrain</h3>
        ${menuItem("Placer un poteau MT", () => target.position ? place("pole", target.position) : placeDialog("pole"), "tower", "", grid.prices.pole)}
        <details><summary>Placer un modèle</summary>${Object.entries(grid.groups).map(([group, title]) =>
          `<h3>${title}</h3>${Object.entries(grid.catalog).filter(([, spec]) => spec.group === group)
            .map(([type, spec]) => menuItem(spec.label, () => target.position ? place(type, target.position) : placeDialog(type),
              spec.icon, "", grid.prices[type])).join("")}`
        ).join("")}</details>
        ${menuItem("Relier deux modèles…", () => connectDialog(), "cable")}
        ${menuItem("Inventaire", inventory, "dots")}${menuItem("Paramètres de la carte", editWorld, "edit")}`);
    }
  }

  function openTopMenu() {
    const bound = $("#world-add").getBoundingClientRect();
    const prior = savedOldCities();
    menuAt(bound.left, bound.bottom + 5, () => `
      ${menuItem("Nouvelle ville…", newWorld, "plus")}
      <details><summary>Ouvrir une carte</summary>${workspace.worlds.map((world) =>
        menuItem(world.name, () => switchWorld(world.id), world.id === workspace.active ? "focus" : undefined)).join("")}</details>
      ${prior.length ? `<details><summary>Importer une ancienne ville</summary>${prior.map((city) =>
        menuItem(city.name, () => importOld(city), "building")).join("")}</details>` : ""}
      ${menuItem("Importer un fichier…", () => $("#map-file").click())}
      ${menuItem("Exporter la carte", () => saveFile(JSON.stringify({ format: "gridlab-terrain", version: 1, world: active() }, null, 2), "gridlab-carte.json", "application/json"))}
      ${menuItem("Exporter les mesures CSV", exportCsv)}
      <hr>${menuItem("Inventaire", inventory, "dots")}
      ${menuItem("Paramètres de la carte", editWorld, "edit")}
      ${menuItem("Recommencer la partie…", restartGame)}
      ${menuItem(labelsVisible ? "Masquer les noms" : "Afficher les noms", () => { labelsVisible = !labelsVisible; scene?.showNames(labelsVisible); })}
      ${menuItem(document.documentElement.dataset.theme === "dark" ? "Thème clair" : "Thème sombre", toggleTheme)}`);
  }

  menu.addEventListener("click", (event) => {
    const clicked = event.target.closest("[data-menu-order]");
    if (!clicked) return;
    const callback = menuHandlers[Number(clicked.dataset.menuOrder)];
    closeMenu();
    safe(callback);
  });

  function option(value, label, isSelected = false) {
    return `<option value="${escape(value)}"${isSelected ? " selected" : ""}>${escape(label)}</option>`;
  }

  function numberField(key, value, descriptor = grid.fields[key]) {
    const [label, suffix, min, max, step] = descriptor;
    return `<label>${escape(label)}${suffix ? " (" + escape(suffix) + ")" : ""}<input type="number" name="${key}" min="${min}" max="${max}" step="${step}" value="${value}" required></label>`;
  }

  function nameField(value) {
    return `<label>Nom<input type="text" name="name" required minlength="2" maxlength="48" value="${escape(value)}"></label>`;
  }

  function openEditor(title, content, apply, label = "Enregistrer") {
    stop();
    closeMenu();
    $("#editor-title").textContent = title;
    editorContent.innerHTML = content;
    $("#editor-error").textContent = "";
    dialogApply = apply;
    submit.hidden = !apply;
    submit.textContent = label;
    editor.scrollTop = 0;
    if (!editor.open) editor.showModal();
  }

  function editNode(node) {
    const kind = grid.catalog[node.type].kind;
    const custom = kind === "load";
    const point = custom ? grid.profileOf(node) : [];
    const reading = nodeMetrics(node);
    const connected = active().cables.filter((line) => line.from === node.id || line.to === node.id);
    const parameters = grid.deviceParameters(node.type);
    const lineButtons = connected.map((line) => `<button type="button" class="button" data-inspect-line="${line.id}">${escape(line.name)}</button>`).join(" ");
    openEditor(node.name, `<dl class="meter">${metricHtml(reading)}</dl>
      ${nameField(node.name)}
      <label class="check"><input name="enabled" type="checkbox" ${node.enabled ? "checked" : ""}> En service</label>
      <div class="grid-fields">${parameters.map((key) => numberField(key, node[key])).join("")}</div>
      ${custom ? `<label class="check"><input name="custom" type="checkbox" ${node.profile ? "checked" : ""}> Consommation différente selon l’heure</label>
        <div id="custom-hours" class="hourly-fields" ${node.profile ? "" : "hidden"}>
          ${point.map((power, index) => numberField("h" + index, Number(power.toFixed(1)), [time(index), "kW", 0, 100000, 0.1])).join("")}</div>` : ""}
      ${lineButtons ? `<details><summary>Câbles raccordés</summary><div class="cable-actions">${lineButtons}</div></details>` : ""}`, () => {
      const nextNode = {
        ...node, name: input("name").value, enabled: input("enabled").checked,
        ...Object.fromEntries(parameters.map((key) => [key, input(key).valueAsNumber]))
      };
      if (custom) {
        nextNode.profile = input("custom").checked
          ? point.map((_, hour) => input("h" + hour).valueAsNumber) : null;
        if (input("custom").checked) nextNode.power = node.power;
      }
      commit({ ...active(), nodes: active().nodes.map((item) => item.id === node.id ? nextNode : item) }, "Modèle mis à jour.");
    });
    if (custom) {
      const toggle = () => {
        const enabled = input("custom").checked;
        $("#custom-hours").hidden = !enabled;
        input("power").disabled = enabled;
        for (let index = 0; index < 24; index++) input("h" + index).disabled = !enabled;
      };
      input("custom").addEventListener("change", toggle);
      toggle();
    }
  }

  function editCable(line) {
    const issues = row().cables[line.id].issues;
    const diagnose = issues.length ? `<button type="button" class="button diagnostic-link" data-inspect-issue="${line.id}">Afficher les alertes</button>` : "";
    const keys = line.medium === "water" ? [] : grid.cableKeys;
    openEditor(line.name, `<dl class="meter">${metricHtml(cableMetrics(line))}</dl>${diagnose}
      ${nameField(line.name)}
      <label class="check"><input name="enabled" type="checkbox" ${line.enabled ? "checked" : ""}> Liaison en service</label>
      <div class="grid-fields">${keys.map((key) => numberField(key, line[key])).join("")}</div>`, () => {
        const updated = { ...line, name: input("name").value, enabled: input("enabled").checked,
          ...Object.fromEntries(keys.map((key) => [key, input(key).valueAsNumber])) };
        commit({ ...active(), cables: active().cables.map((item) => item.id === line.id ? updated : item) }, "Liaison mise à jour.");
      });
  }

  function editSelection() {
    if (selection?.kind === "node") editNode(identify(selection.id));
    if (selection?.kind === "cable") editCable(identifyCable(selection.id));
  }

  function inspectIssue(target) {
    const line = target.kind === "cable" ? identifyCable(target.id) : null;
    const node = target.kind === "node" ? identify(target.id) : null;
    const issues = target.code ? [target.code] : line ? row().cables[line.id].issues : node ? row().nodes[node.id].issues : [];
    if (!issues.length) return;
    const diagnosis = issues.map((issue) => {
      const { title, detail, tip } = grid.diagnostics[issue];
      return `<article class="diagnostic-note"><h3>${title}</h3><p>${detail}</p>
        <p class="diagnostic-tip"><strong>Indice</strong> ${tip}</p></article>`;
    }).join("");
    openEditor(line?.name ?? node?.name ?? "Connexion refusée", diagnosis);
  }

  function connectDialog(origin, medium = "") {
    const nodes = active().nodes;
    if (nodes.length < 2) {
      openEditor("Relier deux modèles", "<p>Place deux modèles sur le terrain pour les relier.</p>");
      return;
    }
    const from = origin ?? nodes[0].id;
    const to = nodes.find(({ id }) => id !== from).id;
    const choices = (id) => nodes.map((node) => option(node.id, node.name, node.id === id)).join("");
    openEditor("Relier deux modèles", `<div class="grid-fields"><label>Départ<select name="from">${choices(from)}</select></label><label>Arrivée<select name="to">${choices(to)}</select></label></div>
      <label>Type de liaison<select name="medium">${option("", "Automatique", !medium)}${option("electric", "Électricité", medium === "electric")}${option("water", "Eau", medium === "water")}</select></label>
      <p id="link-cost"></p>
      <div id="link-fields" class="grid-fields">${grid.cableKeys.map((key) => numberField(key, grid.cableDefaults[key])).join("")}</div>`, () => {
      const keys = grid.cableKeys.filter((key) => !input(key).disabled);
      connect(input("from").value, input("to").value, {
        ...Object.fromEntries(keys.map((key) => [key, input(key).valueAsNumber])),
        ...(input("medium").value ? { medium: input("medium").value } : {})
      });
    }, "Relier");
    const update = () => {
      const selected = input("medium").value || grid.connectionMedium(active(), input("from").value, input("to").value);
      $("#link-fields").hidden = selected === "water";
      $("#link-cost").textContent = "Coût de la liaison · " + money(grid.cablePrice(active(), input("from").value, input("to").value, selected));
      for (const key of grid.cableKeys) input(key).disabled = selected === "water";
    };
    for (const key of ["from", "to", "medium"]) input(key).addEventListener("change", update);
    update();
  }

  function fuelDialog(node) {
    const remaining = node.fuel - active().game.stocks[node.id].fuel;
    const balance = money(active().game.budget);
    if (remaining < 0.001) {
      openEditor("Ravitailler · " + node.name, "<p>Le stock est plein.</p>");
      return;
    }
    const amount = Math.max(0.1, Math.min(5, Math.floor(remaining * 10) / 10));
    openEditor("Ravitailler · " + node.name,
      `<p>Budget disponible ${balance}. Prix du combustible ${unit(grid.fuelPrice, grid.credit + "/MWh")}.</p>
        <p>Place disponible ${unit(remaining, "MWh", 2)}.</p>
        ${numberField("amount", amount, ["Quantité", "MWh", 0.1, node.fuel, 0.1])}`, () => {
      const { world, amount: bought, cost } = grid.refuel(active(), node.id, input("amount").valueAsNumber);
      commit(world, unit(bought, "MWh", 2) + " ajoutés · −" + money(cost));
    }, "Ravitailler");
  }

  function restartGame() {
    if (window.confirm("Repartir à midi avec les stocks et le budget de départ ? La carte et ses liaisons seront conservées.")) {
      stop();
      offset = 0;
      commit(grid.resetGame(active()), "Partie recommencée.");
    }
  }

  function placeDialog(type, node) {
    const coordinate = (axis, value) => numberField(axis, value,
      [axis === "x" ? "Position est / ouest" : "Position sud / nord", "m", -grid.land, grid.land, 1]);
    openEditor(node ? "Déplacer " + node.name : "Placer " + grid.catalog[type].label,
      `${node ? "" : `<p>Coût du modèle · ${money(grid.prices[type])}</p>`}
      <div class="grid-fields">${coordinate("x", node?.x ?? 0)}${coordinate("z", node?.z ?? 0)}</div>`, () => {
        const position = { x: input("x").valueAsNumber, z: input("z").valueAsNumber };
        if (node) commit({ ...active(), nodes: active().nodes.map((item) => item.id === node.id ? { ...item, ...position } : item) }, "Modèle déplacé.");
        else place(type, position);
      }, node ? "Déplacer" : "Placer");
  }

  function newWorld() {
    openEditor("Nouvelle ville", nameField("Nouvelle ville " + (workspace.worlds.length + 1)),
      () => appendWorld(grid.blank(uuid(), input("name").value)), "Créer");
  }

  function editWorld() {
    const world = active();
    const choices = Object.entries(globalThis.GridLab.PRESETS).map(([key, preset]) => option(key, preset.name, world.scenario === key)).join("");
    openEditor("Paramètres de la carte", `${nameField(world.name)}
      <div class="grid-fields">${numberField("voltage", world.voltage)}<label>Scénario<select name="scenario">${choices}</select></label></div>
      <details><summary>Tarifs et heures creuses</summary><div class="grid-fields tariff-settings">
      ${Object.entries(grid.tariffFields).map(([key, field]) => numberField(key, world.tariffs[key], field)).join("")}
      <label class="check"><input name="nightEnabled" type="checkbox" ${world.tariffs.nightEnabled ? "checked" : ""}> Heures creuses</label>
      <label>Début<input name="nightStart" type="time" step="60" value="${clockOf(world.tariffs.nightStartMinute)}" required></label>
      <label>Fin<input name="nightEnd" type="time" step="60" value="${clockOf(world.tariffs.nightEndMinute)}" required></label>
      </div></details>`, () => {
      const tariff = {
        ...Object.fromEntries(Object.keys(grid.tariffFields).map((key) => [key, input(key).valueAsNumber])),
        nightEnabled: input("nightEnabled").checked,
        nightStartMinute: minuteOf(input("nightStart").value), nightEndMinute: minuteOf(input("nightEnd").value)
      };
      if (tariff.nightEnabled && tariff.nightStartMinute === tariff.nightEndMinute) throw new Error("Choisis deux horaires différents.");
      commit({ ...world, name: input("name").value, voltage: input("voltage").valueAsNumber, scenario: input("scenario").value,
        tariffs: tariff }, "Carte recalculée.");
    });
  }

  function inventory() {
    const world = active();
    const item = (name, id, attr) => `<div class="inventory-item"><span>${escape(name)}</span><button class="button" type="button" ${attr}="${id}">Détails</button></div>`;
    const devices = world.nodes.map(({ name, id }) => item(name, id, "data-inspect-node")).join("");
    const cables = world.cables.map(({ name, id }) => item(name, id, "data-inspect-line")).join("");
    openEditor("Inventaire", `<h3>Modèles</h3>${devices || "<p>Le terrain est vide.</p>"}
      <h3>Câbles</h3>${cables || "<p>Aucun câble connecté.</p>"}
      <button class="button" id="inventory-connect" type="button">Relier deux modèles</button>`);
  }

  function cityReport() {
    const { city, budget } = active().game;
    const inhabitants = Object.values(city.homes).reduce((sum, home) => sum + home.people, 0);
    const patients = Object.values(city.hospitals).reduce((sum, ward) => sum + ward.patients, 0);
    const journal = city.journal.slice(-10).reverse().map((entry) =>
      `<li><span>J${dayOf(entry.tick)} · ${time(entry.tick % 24)}</span><strong>${eventLabels[entry.kind]} · ${format(entry.count, 0)}</strong></li>`).join("");
    openEditor("Vie de la ville", `<dl class="meter">${metricHtml([
      ["Habitants", format(inhabitants, 0)], ["Crédits", money(budget)],
      ["Plaintes", format(city.complaints, 0)], ["Départs", format(city.departures, 0)],
      ["Arrivées", format(city.arrivals, 0)], ["Patients hospitalisés", format(patients, 0)],
      ["Patients soignés", format(city.treated, 0)], ["Décès", format(city.deaths, 0)]
    ])}</dl>
    <h3>Journal de la partie</h3>${journal ? `<ol class="city-journal">${journal}</ol>` : "<p>Aucun événement enregistré.</p>"}
    <p>Les plaintes et les départs suivent les heures de service insuffisant. Les secours de chaque hôpital protègent ses patients pendant leur autonomie disponible.</p>`);
  }

  function information() {
    const day = result.daily;
    const { game } = active();
    openEditor("Informations", `<h3>Partie</h3>
      <p>Mission. Sers au moins 95 % de la demande des bâtiments pendant ${grid.missionHours} heures consécutives.</p>
      <dl class="meter">${metricHtml([
        ["Série actuelle", unit(game.continuity, "h")], ["Record", unit(game.best, "h")],
        ["Heures jouées", unit(game.elapsed, "h")], ["Crédits", money(game.budget)]
      ])}</dl>
      <p>La frise prévoit les 24 prochaines heures. Le bouton +1 h et la lecture font avancer la partie et enregistrent la consommation réelle. La vente aux bâtiments rapporte ${unit(grid.servicePrice, grid.credit + "/kWh", 2)}. La construction, l’achat sur le réseau extérieur et le ravitaillement consomment des crédits.</p>
      <h3>Construire</h3>
      <p>Choisis un modèle à gauche, puis clique sur l’herbe. Maintiens l’appui sur un modèle pour partir avec un câble, puis glisse jusqu’au modèle suivant ou clique dessus. Pour une ligne sur poteaux, relie chaque tronçon. Le clic droit ouvre les actions de modification, de déplacement, de raccordement et de suppression.</p>
      <p>Glisser à gauche fait tourner la vue, glisser avec le bouton droit la déplace et la molette zoome.</p>
      <h3>Habitants et soins</h3>
      <p>Après trois heures de service insuffisant, des habitants commencent à partir et la demande du logement baisse. Les logements alimentés attirent des habitants. Les hôpitaux sont servis en priorité. Quand leur secours est épuisé, une coupure prolongée peut entraîner des décès dans la simulation.</p>
      <h3>Eau et refroidissement</h3>
      <p>Relie un point d’eau à une pompe, puis la pompe à une centrale. Les canalisations sont bleues. La pompe a besoin d’un raccordement électrique séparé. L’eau pompée remplit le stock en fin d’heure et peut servir au créneau suivant.</p>
      <h3>Prévision sur 24 h</h3><dl class="meter">${metricHtml([
        ["Énergie produite", unit(day.generated, "kWh")], ["Demande servie", unit(day.served, "kWh")],
        ["Énergie non servie", unit(day.demand - day.served, "kWh")], ["Pertes des câbles", unit(day.losses, "kWh", 3)],
        ["Achat extérieur", unit(day.purchased, "kWh")], ["Coût des achats", money(day.bill)],
        ["Eau livrée", unit(day.waterDelivered, "m³", 2)]
      ])}</dl>
      <h3>Calcul électrique</h3>
      <p>Chaque heure, le modèle répartit la puissance des sources sur les liaisons possibles. Le calcul suppose un réseau triphasé équilibré avec un facteur de puissance unitaire. La tension au modèle est estimée à partir des chutes de tension du chemin qui l’alimente. Les flèches indiquent le sens réel du transfert simulé.</p>
      <p>Un câble rouge signale une alerte. Son icône ouvre le diagnostic et un indice pour enquêter.</p>
      <a href="https://fr.electrical-installation.org/frwiki/Calcul_de_la_chute_de_tension_en_ligne_en_r%C3%A9gime_permanent" target="_blank" rel="noopener noreferrer">Référence de calcul des chutes de tension</a>`);
  }

  function savedOldCities() {
    try {
      if (!storage?.getItem(globalThis.GridLabProjects.storageKey)) return [];
      return globalThis.GridLabProjects.load(storage).cities;
    } catch { return []; }
  }

  function importOld(city) {
    const model = globalThis.GridLab;
    const config = { ...model.getSettings("sun"), ...city.scenarios?.sun };
    const network = city.network;
    const world = grid.blank(uuid(), city.name);
    world.voltage = network.voltage;
    world.tariffs = { ...world.tariffs, ...config };
    const make = (type, x, z, values = {}) => {
      const node = { ...grid.device(uuid(), type, x, z), ...values };
      world.nodes.push(node);
      return node;
    };
    const link = (a, b, settings) => {
      world.cables.push({ ...grid.cableDefaults, id: uuid(), name: "Câble MT " + (world.cables.length + 1), from: a.id, to: b.id, ...settings });
    };
    const bus = make("substation", 0, 0, { name: network.objectNames.bus ?? "Poste central" });
    const sources = [
      make("grid", -67, 34, { name: network.objectNames.grid ?? "Réseau extérieur", power: config.importLimit }),
      make("solar", -70, -37, { name: network.objectNames.solar ?? "Parc solaire", power: config.solar }),
      make("battery", -86, 1, { name: network.objectNames.battery ?? "Batterie", capacity: config.capacity, power: config.batteryPower, charge: 10 })
    ];
    for (const source of sources) link(source, bus, source.type === "grid" ? {
      resistance: Math.round(network.grid.resistance * 100) / 100 || 0.01, amperage: Math.min(1000, network.grid.limit), length: network.grid.length
    } : {});
    const all = model.allBuildings(network);
    network.districts.forEach((district, index) => {
      const z = (index - 1) * 82;
      const pole = make("pole", 38, z, { name: district.name });
      link(bus, pole, { resistance: Math.round(district.cable.resistance * 100) / 100 || 0.01,
        amperage: Math.min(1000, district.cable.limit), length: district.cable.length });
      all.filter((node) => node.district === district.id).forEach((node, i) => {
        const profile = model.buildingReferenceProfile(network, node).map((value) => Number((value * district.scale / 100).toFixed(1)));
        const converted = make(node.type, 61 + i % 6 * 19, z + Math.floor(i / 6) * 18, {
          name: node.name, power: Number(node.power.toFixed(1)), profile
        });
        link(pole, converted, {});
      });
    });
    appendWorld(world);
    alertUser("Ville importée sur le terrain.");
  }

  function saveFile(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv() {
    const headers = ["Jour", "Heure", "Type", "Nom", "Tension (kV)", "Demande (kW)", "Puissance envoyée (kW)",
      "Puissance reçue (kW)", "Courant (A)", "Pertes (kW)", "Débit d’eau (m³/h)"];
    const data = [headers];
    for (const period of result.rows) {
      for (const object of active().nodes) {
        const reading = period.nodes[object.id];
        data.push([dayOf(period.tick), time(period.hour), grid.catalog[object.type].label, object.name, reading.voltage, reading.demand,
          reading.outbound, reading.inbound, "", "", reading.waterFlow]);
      }
      for (const line of active().cables) {
        const meter = period.cables[line.id];
        data.push(line.medium === "water" ? [dayOf(period.tick), time(period.hour), linkName(line), line.name, "", "", "", "", "", "", meter.sent]
          : [dayOf(period.tick), time(period.hour), linkName(line), line.name, meter.voltage, "", meter.sent, meter.received, meter.current, meter.loss, ""]);
      }
    }
    const cell = (value) => {
      if (typeof value === "number") return String(Number(value.toFixed(6))).replace(".", ",");
      const clear = /^[=+\-@\t\r\n]/u.test(value.trimStart()) ? "'" + value : value;
      return '"' + clear.replaceAll('"', '""') + '"';
    };
    saveFile("\uFEFF" + data.map((record) => record.map(cell).join(";")).join("\r\n"), "gridlab-mesures.csv", "text/csv;charset=utf-8");
  }

  function setTheme(value) {
    document.documentElement.dataset.theme = value;
    scene?.theme(value === "dark");
  }

  function toggleTheme() {
    const value = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(value);
    try { storage?.setItem("gridlab-theme", value); } catch { /* Préférence de session. */ }
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
    $("#play").innerHTML = icon("play");
    $("#play").setAttribute("aria-label", "Lire la simulation");
  }

  function play() {
    if (timer) { stop(); return; }
    offset = 0;
    refresh();
    $("#play").innerHTML = icon("pause");
    $("#play").setAttribute("aria-label", "Mettre en pause");
    timer = setInterval(nextHour, 850);
  }

  function nextHour() {
    const previous = active();
    const { world, row: completed } = grid.advance(previous);
    workspace.worlds = workspace.worlds.map((entry) => entry.id === world.id ? world : entry);
    result = grid.forecast(world);
    offset = 0;
    const saved = persist();
    refresh();
    if (!saved) {
      stop();
      alertUser("Partie temporaire. Exporte la carte pour garder la progression.");
    } else if (previous.game.best < grid.missionHours && world.game.best >= grid.missionHours) {
      stop();
      alertUser("Mission réussie. Réseau stable pendant 24 heures !");
    } else if (completed.events.deaths) {
      alertUser("L’hôpital signale des décès · consulte Vie de la ville.");
    } else if (completed.events.departures) {
      alertUser(unit(completed.events.departures, "hab.", 0) + " ont quitté la ville.");
    } else if (completed.events.complaints && !previous.game.city.journal.some(({ tick, kind }) => tick === completed.tick - 1 && kind === "complaints")) {
      alertUser("Des habitants signalent des coupures.");
    }
  }

  $$("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
  if (desktop) {
    document.documentElement.dataset.host = "desktop";
    $("#window-controls").hidden = false;
    $$("[data-window]").forEach((button) => button.addEventListener("click", () => desktop.control(button.dataset.window)));
    desktop.onMaximized((maximized) => {
      const button = $('[data-window="maximize"]');
      button.innerHTML = icon(maximized ? "restore" : "maximize");
      button.setAttribute("aria-label", maximized ? "Restaurer" : "Agrandir");
    });
  }
  const canvas = $("#terrain-canvas");
  try {
    scene = globalThis.GridLabGroundScene.create({
      canvas, labels: $("#terrain-labels"), select: choose, context: openContext, inspectIssue, quote: linkQuote,
      holdStart(id) {
        if (action || editor.open || !identify(id)) return false;
        closeMenu();
        selection = { kind: "node", id };
        refresh();
        setAction({ kind: "link", id });
        return true;
      },
      holdCancel: cancelAction
    });
  }
  catch (error) { console.error(error); }
  function fallback() {
    scene = null;
    canvas.hidden = true;
    $("#terrain-labels").replaceChildren();
    $("#canvas-fallback").hidden = false;
    $(".world-controls").hidden = true;
  }
  if (!scene) fallback();
  canvas.addEventListener("terrain-unavailable", fallback);
  $("#catalog-body").innerHTML = Object.entries(grid.groups).map(([group, title]) => `<details open><summary>${title}</summary>${
    Object.entries(grid.catalog).filter(([, spec]) => spec.group === group).map(([type, spec]) =>
      `<button class="model-choice" type="button" data-model="${type}" aria-pressed="false">${icon(spec.icon)}<span>${spec.label}</span>
        <small class="model-price" aria-hidden="true">${money(grid.prices[type])}</small></button>`
    ).join("")}</details>`).join("");
  $("#catalog-body").addEventListener("click", (event) => {
    const button = event.target.closest("[data-model]");
    if (!button) return;
    closeMenu();
    if (scene) setAction({ kind: "place", type: button.dataset.model });
    else placeDialog(button.dataset.model);
  });
  $("#catalog-toggle").addEventListener("click", () => {
    const visible = $("#catalog-body").hidden;
    $("#catalog-body").hidden = !visible;
    $("#catalog-toggle").setAttribute("aria-expanded", String(visible));
  });
  $("#world-add").addEventListener("click", () => menu.hidden ? openTopMenu() : closeMenu());
  $("#information").addEventListener("click", information);
  $("#mission").addEventListener("click", information);
  $("#city-life").addEventListener("click", cityReport);
  $("#detail-button").addEventListener("click", editSelection);
  $("#play").addEventListener("click", play);
  $("#next-hour").addEventListener("click", () => { stop(); nextHour(); });
  $("#hour").addEventListener("input", (event) => { stop(); offset = Number(event.target.value); refresh(); });
  $("#cancel-action").addEventListener("click", cancelAction);
  $$("[data-camera]").forEach((button) => button.addEventListener("click", () => scene?.cameraAction(button.dataset.camera)));
  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !$("#world-add").contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !editor.open) { closeMenu(); cancelAction(); scene?.clearFault(); }
  });
  for (const id of ["#editor-close", "#editor-cancel"]) $(id).addEventListener("click", () => editor.close());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!dialogApply) return;
    try { dialogApply(); editor.close(); }
    catch (error) { $("#editor-error").textContent = error.message; }
  });
  editorContent.addEventListener("click", (event) => {
    const cable = event.target.closest("[data-inspect-line]");
    const node = event.target.closest("[data-inspect-node]");
    const issue = event.target.closest("[data-inspect-issue]");
    if (issue) inspectIssue({ kind: "cable", id: issue.dataset.inspectIssue });
    else if (cable) editCable(identifyCable(cable.dataset.inspectLine));
    else if (node) editNode(identify(node.dataset.inspectNode));
    else if (event.target.closest("#inventory-connect")) connectDialog();
  });
  $("#map-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("Ce fichier dépasse 2 Mo.");
      const body = await file.text();
      const data = JSON.parse(body);
      if (data?.format === "gridlab-terrain" && data.version === 1) {
        appendWorld({ ...data.world, id: uuid() });
        alertUser("Carte importée.");
      } else importOld(globalThis.GridLabProjects.decode(body));
    } catch (error) { alertUser(error instanceof SyntaxError ? "Fichier JSON illisible." : error.message); }
  });
  let theme = "dark";
  try { if (storage?.getItem("gridlab-theme") === "light") theme = "light"; } catch { /* Profil inaccessible. */ }
  setTheme(theme);
  scene?.setWorld(active(), true);
  refresh();
})();
