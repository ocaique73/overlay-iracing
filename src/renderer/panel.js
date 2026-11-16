// Painel de controle: liga/desliga overlays, trava, idioma, encaixe, setas, escala e opções.
(function () {
  'use strict';
  const api = window.panelAPI;
  const L = {
    pt: {
      language: 'Idioma', demo: 'Modo demonstração', margin: 'Margem do encaixe', logos: 'Abrir pasta de logos das marcas', upd: { version: 'Versão', check: 'Verificar atualização', checking: 'Verificando…', uptodate: 'Você está na versão mais nova', available: 'Atualizar para', downloading: 'Baixando', ready: 'Instalando…', error: 'Não deu pra atualizar agora' },
      locked: '🔒 Travado', unlocked: '🔓 Destravado (editando)', editBtn: 'Editar posições', lockBtn: 'Travar overlays', overlaysLbl: 'Overlays', preview: 'Prévia', previewOff: 'Este overlay está desligado', position: 'Posição',
      hint: 'Destravado: arraste os overlays, use os cantos pra mudar o tamanho e as laterais pra mais linhas ou colunas. Atalho pra travar/destravar: Ctrl+Shift+L.',
      status: { connected: 'iRacing conectado', waiting: 'Aguardando o iRacing', demo: 'Demonstração' },
      anchor: 'Encaixe', nudge: 'Ajuste fino', scale: 'Tamanho', reset: 'Restaurar', options: 'Opções',
      choice: { band: 'Faixa colorida', side: 'Bandeira ao lado', circle: 'Círculo', bar: 'Barra', left: 'Esquerdo', right: 'Direito', best: 'Melhores', last: 'Última volta', full: 'Completo (tempos e setores)', single: 'Só o setor', auto: 'Automático', gt: 'GT (GT3/GT4/Cup)', proto: 'Protótipo (GTP/LMP)', formula: 'Fórmula (F1/SF/Indy/F3)', formulaLow: 'Fórmula base (F4/FF/Vee)', touring: 'Turismo (TCR/Supercars)', street: 'Rua (MX-5/GR86)', stock: 'Stock/Oval' },
      onlyInCar: 'Mostrar só dentro do carro, com o jogo na frente',
      names: { standings: 'Classificação', relative: 'Relative', radar: 'Radar', flags: 'Bandeiras e punições', incidents: 'Incidentes', pitlimiter: 'Limitador do pit', sectors: 'Setores', fuel: 'Combustível', tires: 'Pneus (separado)', session: 'Sessão', delta: 'Delta', panel: 'Painel avançado', laplog: 'Log de voltas', fps: 'FPS' },
      layout: 'Layout', prof: { default: 'Padrão', practice: 'Treino', qualify: 'Quali', race: 'Corrida' },
      profHint: 'Sem layout próprio, a sessão usa o Padrão. Clique num layout pra editar (cria uma cópia do Padrão).',
      inUse: 'Em uso agora', delProfile: 'Apagar este layout',
      copyFrom: 'Copiar tudo de', copyBtn: 'Copiar', copyTo: 'Copiar este overlay pro layout', copied: 'Copiado!',
      opt: {
        outOfCar: 'Mostrar fora do carro (box/garagem)', warnings: 'Aviso de volta inválida (treino/quali)', incWarnings: 'Aviso rápido de incidente (5 s)', flagStyle: 'Visual', flagSide: 'Lado da bandeira', license: 'Licença (A 3.2)', irating: 'iRating (2.8k)', brand: 'Marca do carro', gap: 'Gap até o líder (sua classe)', irGain: 'Previsão de iRating (+/−)', sectorsMode: 'Setores mostrados', style: 'Formato', incidentsSide: 'Incidentes do lado',
        hideWhenClear: 'Sumir quando não tiver carro perto', hideInQualify: 'Não mostrar no quali', opacity: 'Visibilidade', incidents: 'Mostrar incidentes',
        name: 'Nome da sessão', time: 'Tempo restante', laps: 'Voltas',
        sessionOptimal: 'Melhor otimizada da sessão', sessionBest: 'Melhor volta da sessão', predicted: 'Volta prevista', personalBest: 'Recorde pessoal',
        temps: 'Temperaturas', bestLap: 'Melhor volta', position: 'Posição', pitLimiter: 'Aviso do limitador do pit', tires: 'Temperatura dos pneus', trackTemp: 'Temperatura da pista', tireNumbers: 'Números nos pneus',
        tireProfile: 'Tipo de carro (faixa de temperatura)', limit: 'Mostrar limite', speed: 'Velocidade e limite do pit', diff: 'Diferença pro seu melhor setor (só o setor)', secStyle: 'Formato',
      },
    },
    en: {
      language: 'Language', demo: 'Demo mode', margin: 'Snap margin', logos: 'Open brand logos folder', upd: { version: 'Version', check: 'Check for update', checking: 'Checking…', uptodate: 'You are on the latest version', available: 'Update to', downloading: 'Downloading', ready: 'Installing…', error: 'Could not update right now' },
      locked: '🔒 Locked', unlocked: '🔓 Unlocked (editing)', editBtn: 'Edit positions', lockBtn: 'Lock overlays', overlaysLbl: 'Overlays', preview: 'Preview', previewOff: 'This overlay is off', position: 'Position',
      hint: 'Unlocked: drag overlays, use corners to resize and sides for more rows or columns. Lock/unlock shortcut: Ctrl+Shift+L.',
      status: { connected: 'iRacing connected', waiting: 'Waiting for iRacing', demo: 'Demo' },
      anchor: 'Snap', nudge: 'Fine tune', scale: 'Size', reset: 'Reset', options: 'Options',
      choice: { band: 'Color band', side: 'Flag beside text', circle: 'Circle', bar: 'Bar', left: 'Left', right: 'Right', best: 'Best', last: 'Last lap', full: 'Full (times and sectors)', single: 'Sector only', auto: 'Automatic', gt: 'GT (GT3/GT4/Cup)', proto: 'Prototype (GTP/LMP)', formula: 'Formula (F1/SF/Indy/F3)', formulaLow: 'Junior formula (F4/FF/Vee)', touring: 'Touring (TCR/Supercars)', street: 'Street (MX-5/GR86)', stock: 'Stock/Oval' },
      onlyInCar: 'Show only in the car, with the game in front',
      names: { standings: 'Standings', relative: 'Relative', radar: 'Radar', flags: 'Flags & penalties', incidents: 'Incidents', pitlimiter: 'Pit limiter', sectors: 'Sectors', fuel: 'Fuel', tires: 'Tires (separate)', session: 'Session', delta: 'Delta', panel: 'Advanced panel', laplog: 'Lap log', fps: 'FPS' },
      layout: 'Layout', prof: { default: 'Default', practice: 'Practice', qualify: 'Qualify', race: 'Race' },
      profHint: 'Without its own layout a session uses Default. Click a layout to edit it (creates a copy of Default).',
      inUse: 'In use now', delProfile: 'Delete this layout',
      copyFrom: 'Copy everything from', copyBtn: 'Copy', copyTo: 'Copy this overlay to layout', copied: 'Copied!',
      opt: {
        outOfCar: 'Show outside the car (pits/garage)', warnings: 'Invalid lap warning (practice/qualifying)', incWarnings: 'Quick incident warning (5 s)', flagStyle: 'Look', flagSide: 'Flag side', license: 'License (A 3.2)', irating: 'iRating (2.8k)', brand: 'Car brand', gap: 'Gap to leader (your class)', irGain: 'iRating prediction (+/−)', sectorsMode: 'Sectors shown', style: 'Style', incidentsSide: 'Incidents side',
        hideWhenClear: 'Hide when no car is near', hideInQualify: 'Hide in qualifying', opacity: 'Opacity', incidents: 'Show incidents',
        name: 'Session name', time: 'Time remaining', laps: 'Laps',
        sessionOptimal: 'Session optimal', sessionBest: 'Session best', predicted: 'Predicted lap', personalBest: 'Personal best',
        temps: 'Temperatures', bestLap: 'Best lap', position: 'Position', pitLimiter: 'Pit limiter warning', tires: 'Tire temperatures', trackTemp: 'Track temperature', tireNumbers: 'Numbers on tires',
        tireProfile: 'Car type (temperature range)', limit: 'Show limit', speed: 'Speed and pit limit', diff: 'Difference to your best sector (sector only)', secStyle: 'Style',
      },
    },
    es: {
      language: 'Idioma', demo: 'Modo demostración', margin: 'Margen de ajuste', logos: 'Abrir carpeta de logos de marcas', upd: { version: 'Versión', check: 'Buscar actualización', checking: 'Buscando…', uptodate: 'Tienes la versión más nueva', available: 'Actualizar a', downloading: 'Descargando', ready: 'Instalando…', error: 'No se pudo actualizar ahora' },
      editBtn: 'Editar posiciones', lockBtn: 'Bloquear overlays', overlaysLbl: 'Overlays', preview: 'Vista previa', previewOff: 'Este overlay está apagado', position: 'Posición',
      locked: '🔒 Bloqueado', unlocked: '🔓 Desbloqueado (editando)',
      hint: 'Desbloqueado: arrastra los overlays, usa las esquinas para el tamaño y los lados para más filas o columnas. Atajo para bloquear: Ctrl+Shift+L.',
      status: { connected: 'iRacing conectado', waiting: 'Esperando iRacing', demo: 'Demostración' },
      anchor: 'Ajuste', nudge: 'Ajuste fino', scale: 'Tamaño', reset: 'Restaurar', options: 'Opciones',
      choice: { band: 'Faixa colorida', side: 'Bandeira ao lado', circle: 'Círculo', bar: 'Barra', left: 'Izquierdo', right: 'Derecho', best: 'Mejores', last: 'Última vuelta', full: 'Completo (tiempos y sectores)', single: 'Solo el sector', auto: 'Automático', gt: 'GT (GT3/GT4/Cup)', proto: 'Prototipo (GTP/LMP)', formula: 'Fórmula (F1/SF/Indy/F3)', formulaLow: 'Fórmula base (F4/FF/Vee)', touring: 'Turismo (TCR/Supercars)', street: 'Calle (MX-5/GR86)', stock: 'Stock/Óvalo' },
      onlyInCar: 'Mostrar solo dentro del coche, con el juego al frente',
      names: { standings: 'Clasificación', relative: 'Relativo', radar: 'Radar', flags: 'Banderas y sanciones', incidents: 'Incidentes', pitlimiter: 'Limitador de boxes', sectors: 'Sectores', fuel: 'Combustible', tires: 'Neumáticos (separado)', session: 'Sesión', delta: 'Delta', panel: 'Panel avanzado', laplog: 'Registro de vueltas', fps: 'FPS' },
      layout: 'Diseño', prof: { default: 'Predeterminado', practice: 'Práctica', qualify: 'Clasif.', race: 'Carrera' },
      profHint: 'Sin diseño propio, la sesión usa el Predeterminado. Haz clic en un diseño para editarlo (crea una copia del Predeterminado).',
      inUse: 'En uso ahora', delProfile: 'Borrar este diseño',
      copyFrom: 'Copiar todo de', copyBtn: 'Copiar', copyTo: 'Copiar este overlay al diseño', copied: '¡Copiado!',
      opt: {
        outOfCar: 'Mostrar fuera del coche (boxes/garaje)', warnings: 'Aviso de vuelta inválida (práctica/clasificación)', incWarnings: 'Aviso rápido de incidente (5 s)', flagStyle: 'Estilo', flagSide: 'Lado de la bandera', license: 'Licencia (A 3.2)', irating: 'iRating (2.8k)', brand: 'Marca del coche', gap: 'Gap al líder (tu clase)', irGain: 'Previsión de iRating (+/−)', sectorsMode: 'Sectores mostrados', style: 'Formato', incidentsSide: 'Incidentes del lado',
        hideWhenClear: 'Ocultar sin coches cerca', hideInQualify: 'Ocultar en clasificación', opacity: 'Opacidad', incidents: 'Mostrar incidentes',
        name: 'Nombre de la sesión', time: 'Tiempo restante', laps: 'Vueltas',
        sessionOptimal: 'Óptima de la sesión', sessionBest: 'Mejor vuelta de la sesión', predicted: 'Vuelta prevista', personalBest: 'Récord personal',
        temps: 'Temperaturas', bestLap: 'Mejor vuelta', position: 'Posición', pitLimiter: 'Aviso del limitador', tires: 'Temperatura de neumáticos', trackTemp: 'Temperatura de pista', tireNumbers: 'Números en neumáticos',
        tireProfile: 'Tipo de coche (rango de temperatura)', limit: 'Mostrar límite', speed: 'Velocidad y límite de boxes', diff: 'Diferencia con tu mejor sector (solo el sector)', secStyle: 'Formato',
      },
    },
  };
  const CHOICES = { flagStyle: ['band', 'side'], flagSide: ['left', 'right'], style: ['circle', 'bar'], secStyle: ['full', 'single'], sectorsMode: ['best', 'last'], tireProfile: ['auto', 'gt', 'proto', 'formula', 'formulaLow', 'touring', 'street', 'stock'] };
  const ORDER = ['standings', 'relative', 'radar', 'flags', 'incidents', 'session', 'delta', 'sectors', 'panel', 'pitlimiter', 'tires', 'fuel', 'laplog', 'fps'];
  const PROFILES = ['default', 'practice', 'qualify', 'race'];
  const ANCHORS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  let cfg = null; let status = '';
  let sel = 'standings';
  try { sel = localStorage.getItem('sel') || sel; } catch (e) { /* sem storage */ }
  const $ = (q) => document.querySelector(q);

  function tr() { return L[cfg.language] || L.pt; }

  function render() {
    const t = tr();
    document.documentElement.lang = cfg.language;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t[el.dataset.t]; });
    $('#lang').value = cfg.language;
    $('#demo').checked = !!cfg.demo;
    $('#margin').value = cfg.margin;
    $('#onlyInCar').checked = cfg.onlyInCar !== false;
    $('#onlyInCarLbl').textContent = t.onlyInCar;
    const lock = $('#lock');
    lock.textContent = cfg.locked ? t.editBtn : t.lockBtn;
    lock.classList.toggle('editing', !cfg.locked);
    $('#hint').textContent = t.hint;
    $('#hint').classList.toggle('hidden', !!cfg.locked);
    renderStatus();
    renderProfiles(t);
    try { renderUpdate(); } catch (e) { /* ainda não iniciou */ }
    if (!ORDER.includes(sel)) sel = 'standings';
    $('#list').innerHTML = ORDER.map((id) => {
      const o = cfg.overlays[id];
      return `<div class="row ${id === sel ? 'sel' : ''} ${o.enabled ? '' : 'off'}">
        <button class="pick" data-pick="${id}">${t.names[id]}</button>
        <label class="switch"><input type="checkbox" data-enable="${id}" ${o.enabled ? 'checked' : ''}><i></i></label></div>`;
    }).join('');
    renderDetail(t);
  }

  function renderProfiles(t) {
    const ed = cfg.editProfile || 'default';
    const srcs = PROFILES.filter((k) => k !== ed && (k === 'default' || (cfg.profiles && cfg.profiles[k])));
    const tabs = PROFILES.map((k) => {
      const exists = k === 'default' || (cfg.profiles && cfg.profiles[k]);
      return `<button class="${k === ed ? 'sel' : ''} ${exists ? '' : 'empty'}" data-prof="${k}" title="${t.profHint}">${exists ? '' : '+ '}${t.prof[k]}${k === cfg.activeProfile ? '<span class="dot"></span>' : ''}</button>`;
    }).join('');
    $('#profiles').innerHTML = `<div class="tabs">${tabs}</div>
      <div class="profrow">${srcs.length ? `${t.copyFrom} <select id="copyFrom">${srcs.map((k) => `<option value="${k}">${t.prof[k]}</option>`).join('')}</select>
        <button data-copyprof="1">${t.copyBtn}</button>` : ''}
        ${ed !== 'default' ? `<button class="del" data-delprof="${ed}">${t.delProfile}</button>` : ''}</div>`;
  }

  function renderStatus() {
    const el = $('#status'); const t = tr();
    el.textContent = t.status[status] || t.status.waiting;
    el.className = `status ${status}`;
  }

  function optRow(id, k, v, t) {
    if (CHOICES[k]) {
      return `<div class="opt"><span class="on">${t.opt[k] || k}</span><div class="seg">${CHOICES[k].map((c) =>
        `<button class="${c === v ? 'sel' : ''}" data-choice="${k}" data-val="${c}" data-id="${id}">${t.choice[c] || c}</button>`).join('')}</div></div>`;
    }
    if (typeof v === 'number') {
      return `<div class="opt"><span class="on">${t.opt[k] || k}</span><input type="range" min="10" max="100" step="5" value="${v}" data-num="${k}" data-id="${id}"><span>${v}%</span></div>`;
    }
    return `<label class="opt check"><span class="on">${t.opt[k] || k}</span>
      <span class="switch"><input type="checkbox" data-opt="${k}" data-id="${id}" ${v !== false ? 'checked' : ''}><i></i></span></label>`;
  }

  // a prévia fica num iframe que usa o mesmo desenho dos overlays de verdade
  let frame = null; let frameReady = false; let lastPreview = null;
  function renderDetail(t) {
    const id = sel; const o = cfg.overlays[id];
    const scale = Math.round(o.scale * 100);
    const opts = Object.entries(o.options || {}).map(([k, v]) => optRow(id, k, v, t)).join('');
    const d = $('#detail');
    // mantém o iframe (não recarrega a cada clique)
    if (!frame) { frame = document.createElement('iframe'); frame.src = 'preview.html'; frame.addEventListener('load', () => { frameReady = true; sendPreview(); }); }
    d.innerHTML = `<div class="dhead"><h1>${t.names[id]}</h1><span class="spacer"></span><button class="ghost small" data-reset="${id}">${t.reset}</button></div>
      <div class="preview" id="pv"><span class="plbl">${t.preview.toUpperCase()}</span>${o.enabled ? '' : `<div class="poff">${t.previewOff}</div>`}</div>
      <div class="cards3">
        <div class="box"><span class="lbl">${t.position}</span><div class="grid9">${ANCHORS.map((a) => `<button data-anchor="${a}" data-id="${id}" title="${a}"></button>`).join('')}</div></div>
        <div class="box"><span class="lbl">${t.scale}</span><div class="big"><b id="scaleTxt">${scale}</b><span>%</span></div>
          <input type="range" min="40" max="300" step="5" value="${scale}" data-scale="${id}"></div>
        <div class="box"><span class="lbl">${t.nudge}</span><div class="arrows">
          <button class="u" data-nudge="0,-5" data-id="${id}">▲</button><button class="l" data-nudge="-5,0" data-id="${id}">◀</button>
          <button class="d" data-nudge="0,5" data-id="${id}">▼</button><button class="r" data-nudge="5,0" data-id="${id}">▶</button></div></div>
      </div>
      ${opts ? `<div class="opts">${opts}</div>` : ''}
      <div class="copyov"><span>${t.copyTo}</span>
        <select data-copyto="${id}"><option value="">—</option>${PROFILES.filter((k) => k !== (cfg.editProfile || 'default')).map((k) => `<option value="${k}">${t.prof[k]}</option>`).join('')}</select></div>`;
    $('#pv').prepend(frame);
    sendPreview();
  }

  function sendPreview() {
    if (!frame || !frameReady || !cfg || !frame.contentWindow) return;
    const o = cfg.overlays[sel];
    frame.contentWindow.postMessage({ id: sel, overlay: o, lang: cfg.language, state: lastPreview }, '*');
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'lock') api.setLocked(!cfg.locked);
    else if (b.id === 'updBtn') api.installUpdate();
    else if (b.id === 'checkUpd') api.checkUpdate();
    else if (b.id === 'logos') api.openLogos();
    else if (b.dataset.pick) { sel = b.dataset.pick; try { localStorage.setItem('sel', sel); } catch (err) { /* ok */ } render(); }
    else if (b.dataset.choice) api.setOption(b.dataset.id, b.dataset.choice, b.dataset.val);
    else if (b.dataset.anchor) api.anchor(b.dataset.id, b.dataset.anchor);
    else if (b.dataset.nudge) { const [dx, dy] = b.dataset.nudge.split(',').map(Number); api.nudge(b.dataset.id, dx, dy); }
    else if (b.dataset.reset) api.reset(b.dataset.reset);
    else if (b.dataset.prof) api.setEditProfile(b.dataset.prof);
    else if (b.dataset.delprof) api.deleteProfile(b.dataset.delprof);
    else if (b.dataset.copyprof) { const from = $('#copyFrom').value; if (from) { api.copyProfile(from, cfg.editProfile || 'default'); b.textContent = tr().copied; } }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'lang') api.setLanguage(el.value);
    else if (el.id === 'demo') api.setDemo(el.checked);
    else if (el.id === 'margin') api.setMargin(el.value);
    else if (el.dataset.enable) api.setEnabled(el.dataset.enable, el.checked);
    else if (el.dataset.opt) api.setOption(el.dataset.id, el.dataset.opt, el.checked);
    else if (el.id === 'onlyInCar') api.setOnlyInCar(el.checked);
    else if (el.dataset.scale) api.setScale(el.dataset.scale, Number(el.value) / 100);
    else if (el.dataset.num) api.setOption(el.dataset.id, el.dataset.num, Number(el.value));
    else if (el.dataset.copyto && el.value) { api.copyOverlay(el.dataset.copyto, el.value); el.options[0].textContent = tr().copied; el.value = ''; }
  });
  document.addEventListener('input', (e) => {
    if (e.target.dataset.scale) $('#scaleTxt').textContent = e.target.value;
    if (e.target.dataset.num) e.target.nextElementSibling.textContent = `${e.target.value}%`;
  });

  // ---------- atualização ----------
  let upd = { state: 'idle' };
  function renderUpdate() {
    const t = tr().upd; const b = $('#updBtn');
    if (!b) return;
    const show = ['available', 'downloading', 'ready'].includes(upd.state);
    b.classList.toggle('hidden', !show);
    if (upd.state === 'available') b.textContent = `⬇ ${t.available} ${upd.latest}`;
    else if (upd.state === 'downloading') b.textContent = `${t.downloading} ${upd.percent || 0}%`;
    else if (upd.state === 'ready') b.textContent = t.ready;
    $('#verTxt').textContent = `${t.version} ${upd.version || ''}${upd.state === 'uptodate' ? ' · ' + t.uptodate : upd.state === 'checking' ? ' · ' + t.checking : upd.state === 'error' ? ' · ' + t.error : ''}`;
    const c = $('#checkUpd'); c.textContent = t.check; c.classList.toggle('hidden', upd.state === 'dev');
  }
  if (api.getUpdate) {
    api.getUpdate().then((u) => { upd = u; if (cfg) renderUpdate(); });
    api.onUpdate((u) => { upd = u; if (cfg) renderUpdate(); });
  }
  if (api.onPreview) api.onPreview((st) => { lastPreview = st; sendPreview(); });

  api.get().then((c) => { cfg = c; status = c.status; render(); });
  api.onConfig((c) => { cfg = { ...c, status }; render(); });
  api.onStatus((s) => { status = s; if (cfg) renderStatus(); });
}());
