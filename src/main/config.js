// Configuração salva em disco: overlays ligados, posição, tamanho, escala e opções de cada um.
'use strict';
const fs = require('fs');
const path = require('path');

// w/h são o tamanho "sem escala"; a janela real é w*scale x h*scale.
// pos: posição padrão relativa à tela principal (fração da largura/altura) usada na primeira vez.
const OVERLAYS = {
  standings: { w: 380, h: 330, enabled: true, pos: { anchor: 'top-left' },
    options: { outOfCar: true, license: true, irating: false, brand: true, gap: false, irGain: false, sectorsMode: 'best' } },
  relative: { w: 360, h: 250, enabled: true, pos: { anchor: 'bottom-left', dy: -260 },
    options: { outOfCar: false, license: true, brand: true } },
  radar: { w: 180, h: 200, enabled: true, pos: { cx: 0.5, cy: 0.25 },
    options: { outOfCar: false, hideWhenClear: true, hideInQualify: true, opacity: 50 } },
  flags: { w: 270, h: 196, enabled: true, pos: { cx: 0.5, cy: 0.25, dx: -250 }, options: { outOfCar: false, flagStyle: 'band', flagSide: 'left', warnings: true, incWarnings: true } },
  incidents: { w: 210, h: 160, enabled: true, pos: { cx: 0.5, cy: 0.25, dx: -430 }, options: { outOfCar: true, limit: true } },
  session: { w: 270, h: 70, enabled: true, pos: { anchor: 'top-right' },
    options: { outOfCar: true, name: true, time: true, laps: true } },
  delta: { w: 300, h: 185, enabled: true, pos: { cx: 0.5, cy: 0.25, dx: 250 },
    options: { outOfCar: false, style: 'circle', sessionOptimal: true, sessionBest: true, predicted: true, personalBest: true } },
  panel: { w: 460, h: 120, enabled: true, pos: { anchor: 'bottom-center', dy: -40 },
    options: { outOfCar: false, temps: true, bestLap: true, position: true, tires: true, tireNumbers: false, tireProfile: 'auto' } },
  pitlimiter: { w: 230, h: 46, enabled: true, pos: { anchor: 'bottom-center', dy: -170 }, options: { outOfCar: false, speed: true } },
  tires: { w: 130, h: 90, enabled: false, pos: { anchor: 'bottom-right', dy: -120 }, options: { outOfCar: false, tireNumbers: true, tireProfile: 'auto' } },
  sectors: { w: 230, h: 100, enabled: true, pos: { cx: 0.5, cy: 0.1 }, options: { outOfCar: false, secStyle: 'full', diff: true } },
  fuel: { w: 300, h: 64, enabled: false, pos: { anchor: 'bottom-right', dy: -230 }, options: { outOfCar: false } },
  laplog: { w: 280, h: 150, enabled: false, pos: { anchor: 'center-right' }, options: { outOfCar: true, trackTemp: true } },
  fps: { w: 90, h: 34, enabled: false, pos: { anchor: 'top-center' }, options: { outOfCar: true } },
};

const PROFILE_KEYS = ['practice', 'qualify', 'race'];

// completa um conjunto de overlays com os padrões e descarta opções que não existem mais
function normalizeSet(saved, migrate, migSec, migInc, migInc3) {
  const out = {};
  for (const [id, def] of Object.entries(OVERLAYS)) {
    const cur = saved[id] || {};
    // setores mudou de 4 quadros pra 1: ajusta quem ainda está no tamanho antigo, mantendo o centro
    // bandeiras ficaram mais altas: quem ainda está com a altura antiga ganha espaço pra 2 bandeiras
    if (migrate && id === 'flags' && cur.h && cur.h < 196) cur.h = 196;
    // setores ganhou o formato completo (tempos + barra): abre espaço pra ele, mantendo o centro
    if (migInc && id === 'incidents' && cur.options) cur.options.outOfCar = true;
    // incidentes ganharam o resumo embaixo: abre espaço (o número continua no mesmo lugar, em cima à esquerda)
    if (migInc3 && id === 'incidents' && (!cur.w || cur.w <= 120) && (!cur.h || cur.h <= 80)) { cur.w = 210; cur.h = 160; }
    if (migSec && id === 'sectors' && cur.w && cur.w <= 150 && cur.h && cur.h <= 58) {
      if (typeof cur.x === 'number') cur.x -= (230 - cur.w) / 2 * (cur.scale || 1);
      cur.w = 230; cur.h = 100;
    }
    if (id === 'sectors' && cur.w === 330) { if (typeof cur.x === 'number') cur.x += (330 - 150) / 2 * (cur.scale || 1); cur.w = 150; }
    const options = {};
    for (const k of Object.keys(def.options)) options[k] = (cur.options && cur.options[k] !== undefined) ? cur.options[k] : def.options[k];
    out[id] = {
      enabled: cur.enabled !== undefined ? cur.enabled : def.enabled,
      x: cur.x, y: cur.y,
      w: cur.w || def.w, h: cur.h || def.h,
      scale: cur.scale || 1,
      options,
    };
  }
  return out;
}

const DEFAULTS = {
  version: 1,
  language: 'pt',
  locked: false,
  demo: false,
  margin: 16,
  onlyInCar: true,
  personalBests: {},
  overlays: {},
  profiles: {},
  editProfile: 'default',
};

class Config {
  constructor(dir) {
    this.file = path.join(dir, 'config.json');
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { /* primeira execução */ }
    this.data = { ...this.data, ...saved };
    // versões antigas: incidentes ficavam dentro das bandeiras
    const oldFlags = saved.overlays && saved.overlays.flags;
    if (oldFlags && oldFlags.options && 'incidents' in oldFlags.options && !saved.overlays.incidents) {
      const sc = oldFlags.scale || 1;
      const incOn = oldFlags.options.incidents !== false;
      const left = oldFlags.options.incidentsSide !== 'right';
      // incidentes viram um overlay próprio, no mesmo lugar onde estavam
      const inc = { enabled: incOn };
      if (typeof oldFlags.x === 'number') {
        const fw = (oldFlags.w || 330) * sc;
        inc.x = left ? oldFlags.x : oldFlags.x + fw - 92 * sc;
        inc.y = oldFlags.y; inc.scale = sc;
        if (incOn && left) oldFlags.x += 98 * sc;
      }
      if (incOn) oldFlags.w = Math.max(200, (oldFlags.w || 330) - 70);
      saved.overlays.incidents = inc;
    }
    const mig = !saved.flagsV2;
    const migSec = !saved.sectorsV3;
    const migInc = !saved.incidentsV2;
    const migInc3 = !saved.incidentsV3;
    this.data.overlays = normalizeSet(saved.overlays || {}, mig, migSec, migInc, migInc3);
    const profiles = {};
    for (const k of PROFILE_KEYS) profiles[k] = saved.profiles && saved.profiles[k] ? normalizeSet(saved.profiles[k], mig, migSec, migInc, migInc3) : null;
    this.data.flagsV2 = true;
    this.data.sectorsV3 = true;
    this.data.incidentsV2 = true;
    this.data.incidentsV3 = true;
    this.data.profiles = profiles;
    if (!['default', ...PROFILE_KEYS].includes(this.data.editProfile)) this.data.editProfile = 'default';
    this.active = 'default';
    this.saveTimer = null;
  }

  // layout usado agora (padrão, treino, quali ou corrida)
  set(profile) {
    if (profile !== 'default' && this.data.profiles[profile]) return this.data.profiles[profile];
    return this.data.overlays;
  }

  overlay(id) { return this.set(this.active)[id]; }

  createProfile(k) {
    if (!PROFILE_KEYS.includes(k)) return;
    if (!this.data.profiles[k]) this.data.profiles[k] = JSON.parse(JSON.stringify(this.data.overlays));
  }

  // copia um layout inteiro (from → to) ou só um overlay
  copyProfile(from, to) {
    if (from === to) return;
    const src = JSON.parse(JSON.stringify(this.set(from)));
    if (to === 'default') this.data.overlays = src;
    else if (PROFILE_KEYS.includes(to)) this.data.profiles[to] = src;
  }

  copyOverlay(id, from, to) {
    if (from === to || !OVERLAYS[id]) return;
    if (to !== 'default') this.createProfile(to);
    this.set(to)[id] = JSON.parse(JSON.stringify(this.set(from)[id]));
  }

  deleteProfile(k) { if (PROFILE_KEYS.includes(k)) this.data.profiles[k] = null; }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 300);
  }

  saveNow() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (e) { console.error('Falha ao salvar config:', e.message); }
  }
}

module.exports = { Config, OVERLAYS, PROFILE_KEYS };
