// Moldura comum de todos os overlays: modo edição (mover, cantos = escala, laterais = linhas/colunas,
// encaixe automático, setas) e o laço de desenho.
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const api = window.overlayAPI;
  const root = document.getElementById('content');
  const frame = document.getElementById('frame');
  let cfg = null; let state = null; let dirty = true;
  document.body.dataset.overlay = id;

  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const ANCHORS = [['top-left', 'top-center', 'top-right'], ['center-left', 'center', 'center-right'], ['bottom-left', 'bottom-center', 'bottom-right']];

  function buildFrame() {
    frame.innerHTML = `
      <div class="frame-border"></div>
      <div class="frame-label"></div>
      <div class="rows-tip"></div>
      ${HANDLES.map((h) => `<div class="handle h-${h}" data-h="${h}"></div>`).join('')}
      <div class="anchor-grid">${ANCHORS.flat().map((a) => `<button data-a="${a}" title="${a}"></button>`).join('')}</div>`;
    frame.addEventListener('pointerdown', (e) => {
      if (!cfg || cfg.locked) return;
      const a = e.target.closest('[data-a]');
      if (a) { api.anchor(id, a.dataset.a); return; }
      const h = e.target.closest('[data-h]');
      startDrag(e, h ? h.dataset.h : 'move');
    });
  }

  // O arrasto é feito pelo processo principal lendo a posição real do cursor (funciona em qualquer escala).
  function startDrag(e, mode) {
    e.preventDefault();
    api.dragStart(id, mode);
    const up = () => { window.removeEventListener('pointerup', up); api.dragEnd(id); };
    try { frame.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    window.addEventListener('pointerup', up);
  }

  window.addEventListener('keydown', (e) => {
    if (!cfg || cfg.locked) return;
    const step = e.shiftKey ? 10 : 1;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = map[e.key];
    if (d) { e.preventDefault(); api.nudge(id, d[0], d[1]); }
  });

  function rowsTip(c) {
    const tip = frame.querySelector('.rows-tip');
    const mod = window.Overlays[id];
    const vertical = c.dragMode === 'n' || c.dragMode === 's';
    if (!vertical || !mod || !mod.rows) { tip.style.display = 'none'; return; }
    const n = mod.rows({ w: c.overlay.w, h: c.overlay.h, opts: c.overlay.options || {} });
    const t = I18N.get(c.language);
    tip.textContent = `${n} ${n === 1 ? t.row : t.rowsWord}`;
    tip.style.display = 'block';
  }

  function applyConfig(c) {
    cfg = c;
    rowsTip(c);
    document.body.classList.toggle('edit', !c.locked);
    document.documentElement.lang = c.language;
    const t = I18N.get(c.language);
    frame.querySelector('.frame-label').textContent = `${t.overlay[id] || id}  ·  ${t.edit}`;
    dirty = true;
  }

  function loop() {
    requestAnimationFrame(loop);
    draw();
  }

  // desenha na hora que o dado chega (não espera o próximo quadro da tela)
  function draw() {
    if (!cfg || !state || !dirty) return;
    dirty = false;
    const mod = window.Overlays[id];
    if (!mod) return;
    const t = I18N.get(cfg.language);
    const ctx = {
      t, opts: cfg.overlay.options || {}, w: cfg.overlay.w, h: cfg.overlay.h,
      edit: !cfg.locked, now: Date.now(),
    };
    const visible = (state.connected || state.sample) && !state.hidden && (!state.outOfCar || ctx.opts.outOfCar === true);
    root.classList.toggle('hidden', !visible && !ctx.edit);
    if (!visible) { root.innerHTML = ctx.edit ? `<div class="waiting">${t.waiting}</div>` : ''; return; }
    try { mod.render(root, state, ctx); } catch (err) { console.error(err); }
    // alguns overlays têm animação (piscar) e precisam redesenhar mesmo sem dados novos
    if (mod.animated) dirty = true;
  }

  buildFrame();
  if (api) {
    api.logosDir().then((d) => Common.setLogosBase(d)).catch(() => {});
    api.getConfig(id).then(applyConfig);
    api.onConfig(applyConfig);
    api.onState((s) => { state = s; dirty = true; draw(); });
  }
  window.__overlayTest = { applyConfig, setState: (s) => { state = s; dirty = true; } };
  requestAnimationFrame(loop);
}());
