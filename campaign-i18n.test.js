"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { translate } = require("./campaign-i18n.js");
const campaign = require("./campaign-model.js");
const terrain = require("./terrain-model.js");

test("Le catalogue et les diagnostics existent en anglais", () => {
  const messages = [
    ...campaign.slots.flatMap(({ name, note }) => note ? [name, note] : [name]),
    ...Object.values(campaign.storageModes),
    ...Object.values(terrain.catalog).map(({ label }) => label),
    ...Object.values(terrain.diagnostics).flatMap(({ title, detail, tip }) => [title, detail, tip])
  ];
  for (const message of messages) {
    assert.notEqual(translate("en", message), message, `Traduction anglaise manquante : ${message}`);
    assert.equal(translate("fr", message), message);
  }
});

test("Les messages traduits réutilisent les valeurs de la partie", () => {
  assert.equal(translate("en", "Départ {name}", { name: "Watermill" }), "Feeder to Watermill");
  assert.equal(translate("en", "J{day} · {time}", { day: 2, time: "08:00" }), "D2 · 08:00");
  assert.equal(translate("fr", "J{day} · {time}", { day: 2, time: "08:00" }), "J2 · 08:00");
  assert.equal(translate("en", "Nouvelle vallée personnalisée"), "Nouvelle vallée personnalisée");
});
