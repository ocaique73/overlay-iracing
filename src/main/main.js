'use strict';
const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require('electron');
const path = require('path');
const { Config, OVERLAYS, PROFILE_KEYS } = require('./config');
const { setupUpdater } = require('./updater');

// O Windows "pausa" janelas que acha que estão cobertas (o jogo em tela cheia por baixo),
// e isso atrasava o radar. Desliga essas otimizações pras janelas do overlay.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const { IRacingReader, foregroundTitle } = require('./irsdk');
const { StateBuilder } = require('../shared/state');
const { Demo } = require('../shared/demo');

const ANCHORS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const TICK_MS = 16; // ~60 Hz, mesma taxa da telemetria do iRacing

let config;
let panelWin = null;
const windows = {}; // id -> BrowserWindow
const reader = new IRacingReader();
let builder;
let demoBuilder;
const demo = new Demo();
let lastState = { connected: false };
let lastStatus = '';

function pbStore() {
  return {
    getPB: (k) => config.data.personalBests[k],
    setPB: (k, v) => { config.data.personalBests[k] = v; config.save(); },
  };
}

// ---------------- posição e tamanho ----------------

function windowSize(o) {
  return { width: Math.max(20, Math.round(o.w * o.scale)), height: Math.max(20, Math.round(o.h * o.scale)) };
}

function anchorPosition(anchor, area, size, margin) {
  const [v, hz] = anchor === 'center' ? ['center', 'center'] : anchor.split('-');
  let x; let y;
  if (hz === 'left') x = area.x + margin;
  else if (hz === 'right') x = area.x + area.width - size.width - margin;
  else x = area.x + Math.round((area.width - size.width) / 2);
  if (v === 'top') y = area.y + margin;
  else if (v === 'bottom') y = area.y + area.height - size.height - margin;
  else y = area.y + Math.round((area.height - size.height) / 2);
  return { x, y };
}

function defaultPosition(id, ov) {
  const o = ov || config.overlay(id);
  const def = OVERLAYS[id].pos || {};
  const area = screen.getPrimaryDisplay().bounds;
  const size = windowSize(o);
  let p;
  if (def.anchor) p = anchorPosition(def.anchor, area, size, config.data.margin);
  else p = { x: area.x + Math.round(area.width * def.cx - size.width / 2), y: area.y + Math.round(area.height * def.cy - size.height / 2) };
  return { x: p.x + (def.dx || 0), y: p.y + (def.dy || 0) };
}

function applyBounds(id) {
  const win = windows[id]; const o = config.overlay(id);
  if (!win || win.isDestroyed()) return;
  const size = windowSize(o);
  win.setBounds({ x: Math.round(o.x), y: Math.round(o.y), ...size });
  win.webContents.setZoomFactor(o.scale);
}

let drag = null;
function stopDrag() { if (drag) { clearInterval(drag.timer); drag = null; } }

// Cantos mudam a escala (proporcional, canto oposto parado); laterais mudam largura/altura (colunas/linhas).
function geometryFor(mode, g, dx, dy) {
  const wpx = g.w * g.scale; const hpx = g.h * g.scale;
  if (mode === 'move') return { x: g.x + dx, y: g.y + dy };
  if (mode.length === 2) {
    const sx = mode.includes('e') ? dx : -dx; const sy = mode.includes('s') ? dy : -dy;
    const grow = Math.abs(sx) > Math.abs(sy) ? sx / wpx : sy / hpx;
    const scale = Math.min(3, Math.max(0.4, g.scale * (1 + grow)));
    const nw = g.w * scale; const nh = g.h * scale;
    return { scale, x: mode.includes('w') ? g.x + (wpx - nw) : g.x, y: mode.includes('n') ? g.y + (hpx - nh) : g.y };
  }
  if (mode === 'e') return { w: g.w + dx / g.scale };
  if (mode === 'w') { const w = Math.max(40, g.w - dx / g.scale); return { w, x: g.x + (g.w - w) * g.scale }; }
  if (mode === 's') return { h: g.h + dy / g.scale };
  if (mode === 'n') { const h = Math.max(24, g.h - dy / g.scale); return { h, y: g.y + (g.h - h) * g.scale }; }
  return {};
}

// ---------------- janelas ----------------

function createOverlay(id) {
  if (windows[id] && !windows[id].isDestroyed()) return;
  const o = config.overlay(id);
  if (o.x === undefined || o.y === undefined) Object.assign(o, defaultPosition(id));
  const size = windowSize(o);
  const locked = config.data.locked;
  const win = new BrowserWindow({
    x: Math.round(o.x), y: Math.round(o.y), ...size,
    transparent: true, frame: false, resizable: false, movable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, focusable: !locked, fullscreenable: false, show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(locked);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'), { query: { id } });
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(o.scale);
    sendConfig(id);
    win.showInactive();
  });
  windows[id] = win;
  win.on('closed', () => { delete windows[id]; });
}

function destroyOverlay(id) {
  const win = windows[id];
  if (win && !win.isDestroyed()) win.close();
  delete windows[id];
}

function overlayConfigPayload(id) {
  return {
    id, overlay: config.overlay(id), language: config.data.language,
    locked: config.data.locked, demo: config.data.demo,
    dragMode: drag && drag.id === id ? drag.mode : null,
  };
}

function sendConfig(id) {
  const win = windows[id];
  if (win && !win.isDestroyed()) win.webContents.send('config', overlayConfigPayload(id));
}

function broadcastConfig() {
  for (const id of Object.keys(windows)) sendConfig(id);
  if (panelWin && !panelWin.isDestroyed()) panelWin.webContents.send('panel:config', panelPayload());
}

// ---------------- layouts por sessão ----------------

function editOverlay(id) { return config.set(config.data.editProfile)[id]; }

// destravado: mostra o layout escolhido no painel; travado: o da sessão atual (ou o padrão)
function desiredProfile() {
  if (!config.data.locked) return config.data.editProfile;
  const k = lastState && lastState.connected && !lastState.sample ? lastState.profileKey : null;
  if (k && config.data.profiles[k]) return k;
  return 'default';
}

function syncWindows() {
  const set = config.set(config.active);
  for (const id of Object.keys(OVERLAYS)) {
    if (set[id].enabled) {
      if (!windows[id] || windows[id].isDestroyed()) createOverlay(id);
      else { applyBounds(id); sendConfig(id); }
    } else destroyOverlay(id);
  }
}

function updateProfile() {
  const want = desiredProfile();
  if (want === config.active) return;
  config.active = want;
  syncWindows();
  if (panelWin && !panelWin.isDestroyed()) panelWin.webContents.send('panel:config', panelPayload());
}

function setLocked(locked) {
  config.data.locked = locked;
  // destravou no meio de uma sessão: já abre pra editar o layout dessa sessão (se existir)
  if (!locked && config.active !== 'default' && config.data.profiles[config.active]) config.data.editProfile = config.active;
  for (const win of Object.values(windows)) {
    if (win.isDestroyed()) continue;
    win.setIgnoreMouseEvents(locked);
    win.setFocusable(!locked);
  }
  config.save();
  updateProfile();
  broadcastConfig();
}

function createPanel() {
  panelWin = new BrowserWindow({
    width: 980, height: 760, minWidth: 820, minHeight: 560, title: 'Overlay iRacing',
    backgroundColor: '#14161a', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  panelWin.loadFile(path.join(__dirname, '..', 'renderer', 'panel.html'));
  panelWin.on('closed', () => { panelWin = null; app.quit(); });
}

function panelPayload() {
  return {
    language: config.data.language, locked: config.data.locked, demo: config.data.demo,
    margin: config.data.margin, onlyInCar: config.data.onlyInCar !== false, status: lastStatus,
    overlays: config.set(config.data.editProfile), editProfile: config.data.editProfile,
    profiles: Object.fromEntries(PROFILE_KEYS.map((k) => [k, !!config.data.profiles[k]])),
    activeProfile: config.active,
  };
}

// ---------------- telemetria ----------------

let lastTick = Date.now();
let wasConnected = false;
let fgCheckedAt = 0; let gameInFront = true;
function isGameInFront() {
  const title = foregroundTitle();
  if (title === null) return true; // não deu pra checar: não esconde
  if (/iRacing\.com Simulator/i.test(title)) return true;
  return false;
}
function tick() {
  const now = Date.now();
  const dt = Math.min(0.2, (now - lastTick) / 1000);
  lastTick = now;
  let state = null;
  let status = 'waiting';
  if (config.data.demo) {
    demo.step(dt);
    state = demoBuilder.build(demo.telemetry(), demo.session(), { nowMs: now });
    status = 'demo';
  } else {
    let res = null;
    try { res = reader.poll(); } catch (e) { console.error(e); res = null; }
    if (!(res && res.connected)) wasConnected = false;
    if (res && res.connected) {
      if (!wasConnected) builder.reset(); // iRacing reaberto: começa do zero
      wasConnected = true;
      state = builder.build(res.telemetry, res.session, { nowMs: now });
      status = 'connected';
      // só aparece dentro do carro e com o jogo na frente (não no menu do iRacing nem com outro programa aberto)
      if (config.data.locked && config.data.onlyInCar !== false) {
        const inCar = !!res.telemetry.IsOnTrack;
        if (now - fgCheckedAt > 300) { fgCheckedAt = now; gameInFront = isGameInFront(); }
        // fora do jogo (menu do iRacing, outro programa): tudo some.
        // fora do carro (box, garagem): só aparecem os overlays com "Mostrar fora do carro" ligado
        state.hidden = !gameInFront;
        state.outOfCar = !inCar;
      }
    } else if (!config.data.locked) {
      // destravado e sem jogo: mostra dados de exemplo pra dar pra posicionar
      demo.step(dt);
      state = demoBuilder.build(demo.telemetry(), demo.session(), { nowMs: now });
      state.sample = true;
      status = 'waiting';
    } else {
      state = { connected: false };
    }
  }
  state.editMode = !config.data.locked;
  lastState = state;
  updateProfile();
  for (const win of Object.values(windows)) {
    if (!win.isDestroyed()) win.webContents.send('state', state);
  }
  if (status !== lastStatus) {
    lastStatus = status;
    if (panelWin && !panelWin.isDestroyed()) panelWin.webContents.send('panel:status', status);
  }
}

// ---------------- IPC ----------------

function registerIpc() {
  ipcMain.handle('overlay:get-config', (e, id) => overlayConfigPayload(id));

  ipcMain.on('overlay:set-geometry', (e, { id, x, y, w, h, scale }) => {
    const o = config.overlay(id); if (!o) return;
    if (typeof x === 'number') o.x = x;
    if (typeof y === 'number') o.y = y;
    if (typeof w === 'number') o.w = Math.max(40, w);
    if (typeof h === 'number') o.h = Math.max(24, h);
    if (typeof scale === 'number') o.scale = Math.min(3, Math.max(0.4, scale));
    applyBounds(id);
    config.save();
    sendConfig(id);
  });

  ipcMain.on('overlay:drag-start', (e, { id, mode }) => {
    const o = config.overlay(id); if (!o) return;
    stopDrag();
    const start = screen.getCursorScreenPoint();
    const g = { x: o.x, y: o.y, w: o.w, h: o.h, scale: o.scale };
    drag = { id, mode, timer: setInterval(() => {
      const p = screen.getCursorScreenPoint();
      const next = geometryFor(mode, g, p.x - start.x, p.y - start.y);
      Object.assign(o, next);
      o.w = Math.max(40, o.w); o.h = Math.max(24, o.h);
      applyBounds(id);
      sendConfig(id);
    }, 16) };
  });
  ipcMain.on('overlay:drag-end', (e, { id }) => { stopDrag(); config.save(); sendConfig(id); });

  ipcMain.on('overlay:nudge', (e, { id, dx, dy }) => {
    const o = config.overlay(id); if (!o) return;
    o.x += dx; o.y += dy;
    applyBounds(id); config.save();
  });

  ipcMain.on('overlay:anchor', (e, { id, anchor }) => {
    if (!ANCHORS.includes(anchor)) return;
    const o = config.overlay(id); const win = windows[id];
    if (!o || !win || win.isDestroyed()) return;
    // sempre na tela onde o overlay está agora
    const display = screen.getDisplayMatching(win.getBounds());
    const p = anchorPosition(anchor, display.bounds, windowSize(o), config.data.margin);
    o.x = p.x; o.y = p.y;
    applyBounds(id); config.save();
  });

  ipcMain.handle('panel:get', () => panelPayload());

  ipcMain.on('panel:set-enabled', (e, { id, enabled }) => {
    const o = editOverlay(id); if (!o) return;
    o.enabled = enabled;
    syncWindows(); config.save(); broadcastConfig();
  });

  ipcMain.on('panel:set-option', (e, { id, key, value }) => {
    const o = editOverlay(id); if (!o) return;
    o.options[key] = value;
    config.save(); broadcastConfig();
  });

  ipcMain.on('panel:set-scale', (e, { id, scale }) => {
    const o = editOverlay(id); if (!o) return;
    o.scale = Math.min(3, Math.max(0.4, scale));
    syncWindows(); config.save(); broadcastConfig();
  });

  ipcMain.on('panel:reset-overlay', (e, { id }) => {
    const o = editOverlay(id); if (!o) return;
    const def = OVERLAYS[id];
    o.w = def.w; o.h = def.h; o.scale = 1; o.options = { ...def.options };
    Object.assign(o, defaultPosition(id, o));
    syncWindows(); config.save(); broadcastConfig();
  });

  // escolher qual layout editar: cria a partir do padrão se ainda não existir
  ipcMain.on('panel:set-edit-profile', (e, k) => {
    if (k !== 'default' && !PROFILE_KEYS.includes(k)) return;
    if (k !== 'default') config.createProfile(k);
    config.data.editProfile = k;
    config.save(); updateProfile(); broadcastConfig();
  });
  ipcMain.on('panel:copy-profile', (e, { from, to }) => {
    const ok = (k) => k === 'default' || PROFILE_KEYS.includes(k);
    if (!ok(from) || !ok(to)) return;
    config.copyProfile(from, to);
    config.save(); syncWindows(); broadcastConfig();
  });
  ipcMain.on('panel:copy-overlay', (e, { id, to }) => {
    if (to !== 'default' && !PROFILE_KEYS.includes(to)) return;
    config.copyOverlay(id, config.data.editProfile, to);
    config.save(); syncWindows(); broadcastConfig();
  });
  ipcMain.on('panel:delete-profile', (e, k) => {
    if (!PROFILE_KEYS.includes(k)) return;
    config.deleteProfile(k);
    if (config.data.editProfile === k) config.data.editProfile = 'default';
    config.save(); updateProfile(); broadcastConfig();
  });

  ipcMain.on('panel:set-locked', (e, locked) => setLocked(!!locked));
  ipcMain.on('panel:set-language', (e, lang) => { config.data.language = lang; config.save(); broadcastConfig(); });
  ipcMain.on('panel:set-demo', (e, on) => { config.data.demo = !!on; config.save(); broadcastConfig(); });
  ipcMain.on('panel:set-only-in-car', (e, v) => { config.data.onlyInCar = !!v; config.save(); broadcastConfig(); });
  ipcMain.on('panel:set-margin', (e, m) => { config.data.margin = Math.max(0, Math.min(200, Number(m) || 0)); config.save(); broadcastConfig(); });
  ipcMain.on('panel:open-logos', () => {
    const dir = path.join(app.getPath('userData'), 'logos');
    require('fs').mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });
  ipcMain.handle('app:logos-dir', () => path.join(app.getPath('userData'), 'logos'));
}

// ---------------- início ----------------

app.whenReady().then(() => {
  config = new Config(app.getPath('userData'));
  builder = new StateBuilder({ store: pbStore() });
  demoBuilder = new StateBuilder({ store: null });
  registerIpc();
  createPanel();
  setupUpdater((u) => { if (panelWin && !panelWin.isDestroyed()) panelWin.webContents.send('update:state', u); });
  config.active = desiredProfile();
  syncWindows();
  globalShortcut.register('CommandOrControl+Shift+L', () => setLocked(!config.data.locked));
  setInterval(tick, TICK_MS);
  // Teste automático: OVERLAY_TEST_SHOT=<pasta> tira print de todas as janelas e fecha.
  if (process.env.OVERLAY_TEST_SHOT) {
    setTimeout(async () => {
      const fs = require('fs'); const dir = process.env.OVERLAY_TEST_SHOT;
      const all = { controle: panelWin, ...windows };
      for (const [name, w] of Object.entries(all)) {
        if (!w || w.isDestroyed()) continue;
        const img = await w.webContents.capturePage();
        fs.writeFileSync(path.join(dir, `${name}.png`), img.toPNG());
      }
      app.quit();
    }, Number(process.env.OVERLAY_TEST_DELAY || 5000));
  }
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); if (config) config.saveNow(); reader.disconnect(); });
app.on('window-all-closed', () => app.quit());
