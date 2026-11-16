'use strict';
// Atualização automática pelo GitHub Releases: o painel mostra "Atualizar" quando sai versão nova.
const { app, ipcMain } = require('electron');

let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (e) { autoUpdater = null; }

function setupUpdater(send) {
  const st = { state: 'idle', version: app.getVersion(), latest: null, percent: 0, error: null };
  const push = () => send({ ...st });
  ipcMain.handle('update:get', () => ({ ...st }));

  if (!autoUpdater || !app.isPackaged) {
    st.state = 'dev';
    ipcMain.on('update:check', () => {});
    ipcMain.on('update:install', () => {});
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => { if (st.state !== 'downloading') { st.state = 'checking'; push(); } });
  autoUpdater.on('update-available', (i) => { st.state = 'available'; st.latest = i.version; push(); });
  autoUpdater.on('update-not-available', () => { st.state = 'uptodate'; push(); });
  autoUpdater.on('download-progress', (p) => { st.state = 'downloading'; st.percent = Math.round(p.percent || 0); push(); });
  autoUpdater.on('update-downloaded', () => {
    st.state = 'ready'; push();
    // instala sem perguntar nada e abre o app de novo
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 1200);
  });
  autoUpdater.on('error', (e) => { st.state = 'error'; st.error = String((e && e.message) || e).slice(0, 160); push(); });

  const check = () => { if (st.state !== 'downloading' && st.state !== 'ready') autoUpdater.checkForUpdates().catch(() => {}); };
  ipcMain.on('update:check', check);
  ipcMain.on('update:install', () => {
    if (st.state !== 'available' && st.state !== 'error') return;
    st.state = 'downloading'; st.percent = 0; push();
    autoUpdater.downloadUpdate().catch((e) => { st.state = 'error'; st.error = String(e && e.message).slice(0, 160); push(); });
  });
  setTimeout(check, 5000);
  setInterval(check, 30 * 60 * 1000);
}

module.exports = { setupUpdater };
