// Prévia do painel: desenha o overlay escolhido com o mesmo código dos overlays de verdade,
// usando dados de exemplo (ou os do jogo, se ele estiver aberto). Recebe tudo do painel por postMessage.
(function () {
  'use strict';
  const stage = document.getElementById('stage');
  const content = document.getElementById('content');
  let msg = null; let curId = null;

  function draw() {
    if (!msg || !msg.state || !window.Overlays[msg.id]) { content.innerHTML = ''; return; }
    const o = msg.overlay;
    if (curId !== msg.id) { content.innerHTML = ''; content.__html = null; curId = msg.id; }
    const w = o.w; const h = o.h;
    content.style.width = `${w}px`; content.style.height = `${h}px`;
    // cabe na área da prévia, sem passar de 1,6x
    const pad = 28;
    const s = Math.min(1.6, (window.innerWidth - pad * 2) / w, (window.innerHeight - pad * 2) / h);
    stage.style.transform = `translate(${(window.innerWidth - w * s) / 2}px, ${(window.innerHeight - h * s) / 2}px) scale(${s})`;
    const ctx = { t: I18N.get(msg.lang), opts: o.options || {}, w, h, edit: true, now: Date.now() };
    try { window.Overlays[msg.id].render(content, msg.state, ctx); } catch (e) { console.error(e); }
  }

  window.addEventListener('message', (e) => { msg = e.data; draw(); });
  window.addEventListener('resize', draw);
  // overlays com animação (piscar, bandeira balançando) continuam vivos na prévia
  setInterval(() => { if (msg && window.Overlays[msg.id] && window.Overlays[msg.id].animated) draw(); }, 100);
}());
