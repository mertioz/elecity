(() => {
  "use strict";

  const regional = globalThis.GridLabRegional;
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function create({ workspace, localRows, hour, save, status, stop, openCity, newCity, fieldInput, number, download }) {
    const modal = $("#regional-dialog");
    const form = $("#regional-form");
    const formFields = $("#regional-fields");
    const measures = $("#regional-measures");
    const error = $("#regional-error");
    const saveButton = $("#regional-save");
    const removeButton = $("#region-remove");
    let scene;
    let active = false;
    let view;
    let results;
    let nodes = [];
    const getRegion = () => workspace.region;
    const at = () => results.rows[hour()];
    const nodeOf = (key) => nodes.find((node) => node.key === key);
    const nameOf = (key) => nodeOf(key)?.name ?? key;
    const num = (value, unit, decimals = 1) => number(value, decimals) + (unit ? " " + unit : "");
    const kw = (value) => num(value, "kW");
    const kwh = (value) => num(value, "kWh");
    const time = () => String(hour()).padStart(2, "0") + ":00";
    const put = (id, text) => { document.getElementById(id).textContent = text; };

    function metrics(entries) {
      return entries.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("");
    }

    function hourChanged() {
      if (!active || !results) return;
      const now = at();
      put("region-hour", time() + " · puissance moyenne");
      $("#region-summary").innerHTML = metrics([
        ["Reçue entre sites", kw(now.delivered)],
        ["Production nucléaire", kw(now.nuclear)],
        ["Achat extérieur", kw(now.upstream)],
        ["Pertes interurbaines", kw(now.losses)],
        ["Pertes dans les villes", kw(now.localLosses)],
        ["Demande non servie", kw(now.unmet)]
      ]);
      $("#region-day").innerHTML = metrics([
        ["Transferts reçus", kwh(results.daily.delivered)],
        ["Production nucléaire", kwh(results.daily.nuclear)],
        ["Pertes interurbaines", kwh(results.daily.losses)]
      ]);
      scene?.update(now);
    }

    function refresh() {
      if (!active) return;
      nodes = regional.sites(getRegion(), workspace.cities);
      results = regional.simulate(getRegion(), workspace.cities, new Map(workspace.cities.map((city) => [city.id, localRows(city)])));
      scene?.setMap(nodes, getRegion().lines);
      hourChanged();
    }

    function heading(title, subtitle = "") {
      put("regional-dialog-title", title);
      put("regional-dialog-subtitle", subtitle);
      error.textContent = "";
      measures.innerHTML = "";
      formFields.innerHTML = "";
      saveButton.hidden = false;
      saveButton.textContent = "Enregistrer";
      removeButton.hidden = true;
      modal.scrollTop = 0;
    }

    function setMeasures(entries) {
      measures.innerHTML = `<dl class="regional-meters">${metrics(entries)}</dl>`;
    }

    function inputs(schema) {
      return Object.entries(schema).map(([key, descriptor]) => fieldInput([key, ...descriptor])).join("");
    }

    const control = (key) => form.elements.namedItem(key);

    function fill(values, keys) {
      for (const key of keys) control(key).value = values[key];
    }

    function read(schema) {
      return Object.fromEntries(Object.keys(schema).map((key) => [key, control(key).valueAsNumber]));
    }

    function nameInput() {
      return '<label>Nom<input type="text" name="name" maxlength="48" minlength="2" required></label>';
    }

    function action(kind, id, label, extra = "") {
      return `<button type="button" class="button button-quiet" data-region-action="${kind}" data-id="${escape(id)}" ${extra}>${escape(label)}</button>`;
    }

    function summarySection(title, body) {
      return `<section class="regional-section"><h3>${title}</h3><div class="config-actions">${body}</div></section>`;
    }

    function renderInventory() {
      heading("Inventaire régional", "Sites de production, villes et liaisons");
      saveButton.hidden = true;
      const now = at();
      formFields.innerHTML = summarySection("Sites",
        nodes.map((node) => {
          const amount = node.kind === "city" ? now.towns[node.key].served : now.plants[node.id].power;
          return action(node.kind, node.id, node.name + " · " + kw(amount));
        }).join(""))
        + summarySection("Liaisons",
          getRegion().lines.map((line) => action("line", line.id, line.name + " · " + kw(now.lines[line.id].sent))).join("")
            || "<p class='setting-hint'>Ajoute une liaison pour relier deux sites.</p>");
    }

    function renderGround(target) {
      heading("Nouveau site", "Ajoute une ville ou une centrale sur la carte.");
      saveButton.hidden = true;
      view.position = regional.nextPosition(nodes, target);
      formFields.innerHTML = summarySection("Implantation",
        action("newCity", "", "Nouvelle ville") + action("newPlant", "", "Centrale nucléaire"));
    }

    function renderCity(id) {
      const town = nodeOf(regional.cityKey(id));
      const readings = at().towns[town.key];
      heading(town.name, "Ville · " + time());
      setMeasures([
        ["Demande", kw(readings.demand)], ["Servie", kw(readings.served)],
        ["Reçue de la région", kw(readings.imported)], ["Envoyée vers la région", kw(readings.exported)],
        ["Achat extérieur", kw(readings.purchased)], ["Pertes locales", kw(readings.localLosses)]
      ]);
      formFields.innerHTML = `<div class="config-form regional-fields"><div class="editor-fields">${inputs(regional.positionFields)}</div></div>
        ${summarySection("Actions", action("openCity", id, "Ouvrir la ville") + action("newLine", town.key, "Relier cette ville"))}`;
      fill(town, Object.keys(regional.positionFields));
    }

    function renderPlant(target) {
      const plant = target.id ? getRegion().plants.find(({ id }) => id === target.id) : null;
      const position = plant ?? regional.nextPosition(nodes, target.position);
      const values = plant ?? { ...regional.plantDefaults, ...position, name: "Centrale nucléaire " + (getRegion().plants.length + 1) };
      const readings = plant && at().plants[plant.id];
      heading(plant ? plant.name : "Nouvelle centrale nucléaire", "Production et ressources · simulation sur 24 h");
      if (readings) setMeasures([
        ["Production", kw(readings.power)], ["Puissance disponible", kw(readings.available)],
        ["Combustible restant", num(readings.fuel, "MWh")], ["Eau restante", num(readings.water, "m³")],
        ["Eau utilisée sur ce créneau", num(readings.useWater, "m³")]
      ]);
      formFields.innerHTML = `<div class="config-form regional-fields">
        ${nameInput()}
        <label class="region-check"><input name="enabled" type="checkbox"> Centrale disponible</label>
        <div class="editor-fields">${inputs(regional.plantFields)}${inputs(regional.positionFields)}</div>
        <p class="setting-hint">Stocks initiaux à 00:00. Les valeurs de combustible sont exprimées en énergie électrique équivalente.</p>
        </div>${plant ? summarySection("Actions", action("newLine", regional.plantKey(plant.id), "Relier cette centrale")) : ""}`;
      fill(values, ["name", ...Object.keys(regional.plantFields), ...Object.keys(regional.positionFields)]);
      control("enabled").checked = values.enabled;
      saveButton.textContent = plant ? "Enregistrer" : "Créer la centrale";
      removeButton.hidden = !plant;
    }

    function lineMeasures(line, pole) {
      const meter = at().lines[line.id];
      const data = results.lines.get(line.id);
      const sign = meter.direction;
      const sender = sign < 0 ? line.to : line.from;
      const receiver = sign < 0 ? line.from : line.to;
      const dailyLoss = results.rows.reduce((sum, row) => sum + row.lines[line.id].losses, 0);
      const state = meter.open ? "Ouverte" : meter.sent > 0.001 ? nameOf(sender) + " → " + nameOf(receiver) : "Sans transfert";
      const values = [
        ["Sens · " + time(), state], ["Puissance envoyée", kw(meter.sent)], ["Puissance reçue", kw(meter.received)],
        ["Pertes", kw(meter.losses)], ["Courant par phase", num(meter.current, "A")], ["Charge de la liaison", num(meter.loading, "%")],
        ["Chute de tension", num(meter.drop, "kV", 3)], ["Longueur posée", num(data.length, "km")],
        ["Pertes sur 24 h", kwh(dailyLoss)]
      ];
      if (pole) {
        const fraction = pole / (line.poles + 1);
        const progress = sign < 0 ? 1 - fraction : fraction;
        values.unshift(["Puissance au pylône " + pole, kw(meter.sent - progress * meter.losses)]);
      }
      setMeasures(values);
    }

    function renderLine(target) {
      const line = target.id ? getRegion().lines.find(({ id }) => id === target.id) : null;
      heading(line ? line.name : "Relier deux sites", "Liaison triphasée · électricité active");
      if (nodes.length < 2) {
        saveButton.hidden = true;
        formFields.innerHTML = '<p class="setting-hint">Crée une deuxième ville ou une centrale pour tracer une liaison.</p>';
        return;
      }
      const from = nodeOf(target.from)?.key ?? nodes[0].key;
      const to = nodes.find((node) => node.key !== from).key;
      const values = line ?? { ...regional.lineDefaults, name: "Liaison " + (getRegion().lines.length + 1), from, to };
      const choices = nodes.map((node) => `<option value="${escape(node.key)}">${escape(node.name)}</option>`).join("");
      const poles = line ? Array.from({ length: line.poles }, (_, index) => `<option value="${index + 1}">Pylône ${index + 1}</option>`).join("") : "";
      formFields.innerHTML = `<div class="config-form regional-fields">
        ${line ? '<label>Point de mesure<select name="pole"><option value="0">Liaison entière</option>' + poles + '</select></label>' : ""}
        ${nameInput()}
        <div class="editor-fields"><label>Site A<select name="from">${choices}</select></label><label>Site B<select name="to">${choices}</select></label></div>
        <label class="region-check"><input name="enabled" type="checkbox"> Liaison en service</label>
        <div class="editor-fields">${inputs(regional.lineFields)}</div>
        </div>`;
      fill(values, ["name", "from", "to", ...Object.keys(regional.lineFields)]);
      control("enabled").checked = values.enabled;
      if (line) {
        control("pole").value = target.index || 0;
        lineMeasures(line, Number(control("pole").value));
        control("pole").addEventListener("change", () => lineMeasures(line, Number(control("pole").value)));
      }
      saveButton.textContent = line ? "Enregistrer la liaison" : "Relier les sites";
      removeButton.hidden = !line;
    }

    function edit(target) {
      if (!results) return;
      stop();
      view = target;
      switch (target.kind) {
        case "city": renderCity(target.id); break;
        case "plant": renderPlant(target); break;
        case "line":
        case "pole": renderLine(target); break;
        case "ground": renderGround(target); break;
        case "inventory": renderInventory(); break;
      }
      if (!modal.open) modal.showModal();
    }

    function commit(next, message) {
      workspace.region = regional.normalize(next, workspace.cities);
      const saved = save();
      refresh();
      modal.close();
      status(saved ? message : "Modification appliquée pour cette session.");
    }

    function replace(items, value) {
      return items.some(({ id }) => id === value.id)
        ? items.map((item) => item.id === value.id ? value : item) : [...items, value];
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const draft = structuredClone(getRegion());
        switch (view.kind) {
          case "city":
            draft.locations[view.id] = read(regional.positionFields);
            break;
          case "plant":
            draft.plants = replace(draft.plants, {
              id: view.id ?? crypto.randomUUID(), name: control("name").value, enabled: control("enabled").checked,
              ...read(regional.plantFields), ...read(regional.positionFields)
            });
            break;
          case "line":
          case "pole":
            draft.lines = replace(draft.lines, {
              id: view.id ?? crypto.randomUUID(), name: control("name").value, enabled: control("enabled").checked,
              from: control("from").value, to: control("to").value, ...read(regional.lineFields)
            });
            break;
          default: return;
        }
        commit(draft, "Région recalculée.");
      } catch (failure) {
        error.textContent = failure.message;
      }
    });

    removeButton.addEventListener("click", () => {
      if (!view.id) return;
      const plant = view.kind === "plant";
      if (!window.confirm(plant ? "Retirer cette centrale et ses liaisons ?" : "Retirer cette liaison ?")) return;
      const draft = structuredClone(getRegion());
      if (plant) draft.plants = draft.plants.filter(({ id }) => id !== view.id);
      draft.lines = draft.lines.filter((line) => plant
        ? ![line.from, line.to].includes(regional.plantKey(view.id)) : line.id !== view.id);
      commit(draft, plant ? "Centrale retirée." : "Liaison retirée.");
    });

    modal.addEventListener("click", (event) => {
      const button = event.target.closest("[data-region-action]");
      if (!button) return;
      const { regionAction: action, id } = button.dataset;
      if (action === "openCity" || action === "newCity") {
        modal.close();
        if (action === "openCity") openCity(id);
        else newCity(view.position);
        return;
      }
      if (action === "newLine") edit({ kind: "line", from: id });
      else if (action === "newPlant") edit({ kind: "plant", position: view.position });
      else edit({ kind: action, id });
    });
    for (const id of ["#close-regional", "#regional-cancel"]) $(id).addEventListener("click", () => modal.close());
    $("#region-link").addEventListener("click", () => edit({ kind: "line" }));
    $("#region-plant").addEventListener("click", () => edit({ kind: "plant" }));
    $("#region-inventory").addEventListener("click", () => edit({ kind: "inventory" }));
    document.querySelectorAll("[data-region-camera]").forEach((button) =>
      button.addEventListener("click", () => scene?.changeCamera(button.dataset.regionCamera)));

    function show(visible) {
      active = visible;
      if (visible && !scene && !$("#region-canvas").hidden) {
        try { scene = globalThis.GridLabRegionScene.create({ canvas: $("#region-canvas"), labels: $("#region-labels"), edit }); }
        catch { scene = null; }
        if (!scene) {
          $("#region-canvas").hidden = true;
          $("#region-fallback").hidden = false;
          $(".region-camera").hidden = true;
        }
      }
      scene?.show(visible);
      if (visible) refresh();
    }

    function exportRegion() {
      const records = [["Heure", "Type", "Nom", "Origine", "Destination", "Envoyé/produit (kW)", "Reçu (kW)", "Pertes (kW)", "Courant (A)", "Combustible (MWh)", "Eau (m³)"]];
      for (const row of results.rows) {
        for (const line of getRegion().lines) {
          const meter = row.lines[line.id];
          const from = meter.direction < 0 ? line.to : line.from;
          const to = meter.direction < 0 ? line.from : line.to;
          records.push([row.hour, "Liaison", line.name, nameOf(from), nameOf(to), meter.sent, meter.received, meter.losses, meter.current, "", ""]);
        }
        for (const plant of getRegion().plants) {
          const stock = row.plants[plant.id];
          records.push([row.hour, "Centrale", plant.name, "", "", stock.power, "", "", "", stock.fuel, stock.water]);
        }
        for (const node of nodes.filter(({ kind }) => kind === "city")) {
          const town = row.towns[node.key];
          records.push([row.hour, "Ville", node.name, "", "", town.exported, town.imported, town.localLosses, "", "", ""]);
        }
      }
      const cell = (value) => {
        if (typeof value === "number") return String(Number(value.toFixed(5))).replace(".", ",");
        const safe = /^[=+\-@\t\r\n]/u.test(value.trimStart()) ? "'" + value : value;
        return '"' + safe.replaceAll('"', '""') + '"';
      };
      download("\uFEFF" + records.map((row) => row.map(cell).join(";")).join("\r\n"), "csv", "gridlab-region", "text/csv;charset=utf-8");
      status("Mesures régionales exportées.");
    }

    return { show, refresh, hourChanged, exportRegion, play(value) { scene?.play(value); } };
  }

  globalThis.GridLabRegionUI = { create };
})();
