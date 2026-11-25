"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gridlabDesktop", {
  control(action) {
    if (["minimize", "maximize", "close"].includes(action)) ipcRenderer.send("gridlab:window", action);
  },
  onMaximized(listener) {
    ipcRenderer.on("gridlab:window-state", (_event, maximized) => listener(maximized));
  }
});
