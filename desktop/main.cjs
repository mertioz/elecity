"use strict";

const { app, BrowserWindow, ipcMain, net, protocol, shell } = require("electron");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const entryUrl = "gridlab://app/index.html";
const resources = new Set(["/index.html", "/campaign.css", "/campaign.js", "/campaign-model.js", "/campaign-i18n.js", "/terrain.css", "/terrain-model.js", "/terrain-scene.js", "/terrain-landscape.js",
  "/valley.js", "/valley-scenery.js", "/valley-buildings.js", "/model.js", "/region-model.js", "/desktop/elecity.ico", "/vendor/three.js"]);
const references = new Set([
  "https://docs.nrel.gov/docs/fy14osti/62641.pdf",
  "https://fr.electrical-installation.org/frwiki/Calcul_de_la_chute_de_tension_en_ligne_en_r%C3%A9gime_permanente",
  "https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions",
  "https://fr.electrical-installation.org/frwiki/D%C3%A9finition_de_la_puissance_r%C3%A9active",
  "https://www1.eere.energy.gov/water/pdfs/doewater-10107-vol.1-pt1.pdf"
]);
let window;

protocol.registerSchemesAsPrivileged([{ scheme: "gridlab", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// Retrouve le profil du jeu sous son ancien nom au premier lancement.
if (!app.commandLine.hasSwitch("user-data-dir")) {
  const previousProfile = path.join(app.getPath("appData"), "GridLab");
  const currentStorage = path.join(app.getPath("userData"), "Local Storage");
  if (existsSync(path.join(previousProfile, "Local Storage")) && !existsSync(currentStorage)) {
    app.setPath("userData", previousProfile);
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});
app.setAppUserModelId("local.gridlab.desktop");

app.whenReady().then(() => {
  protocol.handle("gridlab", (request) => {
    const url = new URL(request.url);
    if (url.host !== "app" || !resources.has(url.pathname)) return new Response("Introuvable", { status: 404 });
    return net.fetch(pathToFileURL(path.join(app.getAppPath(), url.pathname.slice(1))).href);
  });

  window = new BrowserWindow({
    width: 1310,
    height: 870,
    minWidth: 660,
    minHeight: 560,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    icon: path.join(__dirname, "elecity.ico"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const contents = window.webContents;
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (references.has(url)) void shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
  window.once("ready-to-show", () => window?.show());
  window.on("closed", () => { window = undefined; });

  function notifyMaximized() {
    contents.send("gridlab:window-state", window.isMaximized());
  }
  window.on("maximize", notifyMaximized);
  window.on("unmaximize", notifyMaximized);

  ipcMain.on("gridlab:window", (event, action) => {
    if (event.sender !== contents || event.senderFrame?.url !== entryUrl || !window) return;
    switch (action) {
      case "minimize": window.minimize(); break;
      case "maximize": window.isMaximized() ? window.unmaximize() : window.maximize(); break;
      case "close": window.close(); break;
    }
  });
  return window.loadURL(entryUrl);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});

app.on("window-all-closed", () => app.quit());
