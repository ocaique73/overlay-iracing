'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  getConfig: (id) => ipcRenderer.invoke('overlay:get-config', id),
  onConfig: (cb) => ipcRenderer.on('config', (e, c) => cb(c)),
  onState: (cb) => ipcRenderer.on('state', (e, s) => cb(s)),
  setGeometry: (g) => ipcRenderer.send('overlay:set-geometry', g),
  nudge: (id, dx, dy) => ipcRenderer.send('overlay:nudge', { id, dx, dy }),
  anchor: (id, anchor) => ipcRenderer.send('overlay:anchor', { id, anchor }),
  dragStart: (id, mode) => ipcRenderer.send('overlay:drag-start', { id, mode }),
  dragEnd: (id) => ipcRenderer.send('overlay:drag-end', { id }),
  logosDir: () => ipcRenderer.invoke('app:logos-dir'),
});

contextBridge.exposeInMainWorld('panelAPI', {
  get: () => ipcRenderer.invoke('panel:get'),
  onConfig: (cb) => ipcRenderer.on('panel:config', (e, c) => cb(c)),
  onStatus: (cb) => ipcRenderer.on('panel:status', (e, s) => cb(s)),
  setEnabled: (id, enabled) => ipcRenderer.send('panel:set-enabled', { id, enabled }),
  setOption: (id, key, value) => ipcRenderer.send('panel:set-option', { id, key, value }),
  setScale: (id, scale) => ipcRenderer.send('panel:set-scale', { id, scale }),
  reset: (id) => ipcRenderer.send('panel:reset-overlay', { id }),
  setLocked: (v) => ipcRenderer.send('panel:set-locked', v),
  setLanguage: (v) => ipcRenderer.send('panel:set-language', v),
  setDemo: (v) => ipcRenderer.send('panel:set-demo', v),
  setMargin: (v) => ipcRenderer.send('panel:set-margin', v),
  setOnlyInCar: (v) => ipcRenderer.send('panel:set-only-in-car', v),
  anchor: (id, anchor) => ipcRenderer.send('overlay:anchor', { id, anchor }),
  nudge: (id, dx, dy) => ipcRenderer.send('overlay:nudge', { id, dx, dy }),
  openLogos: () => ipcRenderer.send('panel:open-logos'),
  setEditProfile: (k) => ipcRenderer.send('panel:set-edit-profile', k),
  deleteProfile: (k) => ipcRenderer.send('panel:delete-profile', k),
  copyProfile: (from, to) => ipcRenderer.send('panel:copy-profile', { from, to }),
  copyOverlay: (id, to) => ipcRenderer.send('panel:copy-overlay', { id, to }),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  onUpdate: (cb) => ipcRenderer.on('update:state', (e, u) => cb(u)),
  checkUpdate: () => ipcRenderer.send('update:check'),
  installUpdate: () => ipcRenderer.send('update:install'),
});

