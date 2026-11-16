// Desenho de cada overlay. Cada um recebe (elemento, estado, ctx) e monta o HTML.
(function (root) {
  'use strict';
  const C = root.Common;
  const { esc, fmtLap, fmtSector, fmtDelta, fmtClock, brandBadge, licBadge, shortName } = C;
  const FLASH_MS = 5000;

  // ======================= CLASSIFICAÇÃO =======================
  function pickMine(list) {
    const me = list.findIndex((d) => d.isPlayer);
    if (me < 0) return list.slice(0, 6);
    const want = new Set([0, me - 2, me - 1, me, me + 1, me + 2].filter((i) => i >= 0 && i < list.length));
    // mínimo 4 linhas: completa com os próximos (ou anteriores) até ter 4
    let k = me + 3;
    while (want.size < 4 && k < list.length) want.add(k++);
    k = me - 3;
    while (want.size < 4 && k > 0) want.add(k--);
    return [...want].sort((a, b) => a - b).slice(0, 6).map((i) => list[i]);
  }

  function pickSingle(list, rows) {
    if (rows >= list.length) return list.slice();
    const me = list.findIndex((d) => d.isPlayer);
    if (me < 0 || me < rows) return list.slice(0, rows);
    const around = Math.min(5, rows - 1);
    const top = Math.max(1, rows - around);
    const start = Math.min(list.length - around, Math.max(top, me - Math.floor(around / 2)));
    return list.slice(0, top).concat(list.slice(start, start + around));
  }

  function timeCell(d, cls, now) {
    const flashing = d.last > 0 && d.lastLapAt && now - d.lastLapAt < FLASH_MS;
    if (flashing) {
      let color = '';
      if (cls.sessionBest > 0 && Math.abs(d.last - cls.sessionBest) < 0.0005) color = 'purple';
      else if (d.best > 0 && Math.abs(d.last - d.best) < 0.0005) color = 'green';
      return `<div class="time tnum flash ${color}">${fmtLap(d.last)}</div>`;
    }
    const purple = cls.sessionBest > 0 && d.best > 0 && Math.abs(d.best - cls.sessionBest) < 0.0005;
    return `<div class="time tnum ${purple ? 'purple' : ''}">${fmtLap(d.best)}</div>`;
  }

  function gapText(d, t) {
    if (d.pos === 1) return '';
    if (d.gapLaps > 0) return `+${d.gapLaps} ${t.lapShort}`;
    if (d.gap === null || d.gap === undefined) return '';
    return `+${d.gap < 100 ? d.gap.toFixed(1) : Math.round(d.gap)}`;
  }

  const standings = {
    animated: true,
    rows: (ctx) => Math.max(1, Math.floor((ctx.h - 22) / 25)),
    render(el, s, ctx) {
      const o = ctx.opts;
      const nSec = s.sectorsCount || 3;
      const cols = ['28px', '3px', 'minmax(90px,1fr)'];
      if (o.brand !== false) cols.push('28px');
      if (o.license) cols.push('46px');
      if (o.irating) cols.push('38px');
      if (o.irGain) cols.push('34px');
      if (o.gap) cols.push('54px');
      cols.push('72px');
      const base = 28 + 3 + 150 + (o.brand !== false ? 34 : 0) + (o.license ? 52 : 0) + (o.irating ? 44 : 0)
        + (o.irGain ? 40 : 0) + (o.gap ? 60 : 0) + 78 + 12;
      const showSectors = ctx.w >= base + nSec * 52;
      if (showSectors) for (let i = 0; i < nSec; i++) cols.push('46px');
      const grid = `grid-template-columns:${cols.join(' ')}`;

      const blocks = [];
      if (s.multiclass) {
        for (const cls of s.classes) {
          const mine = cls.id === s.playerClassId;
          blocks.push({ cls, rows: mine ? pickMine(cls.drivers) : cls.drivers.slice(0, 3) });
        }
      } else if (s.classes.length) {
        const rows = Math.max(1, Math.floor((ctx.h - 22) / 25));
        blocks.push({ cls: s.classes[0], rows: pickSingle(s.classes[0].drivers, rows) });
      }

      el.innerHTML = `<div class="st">${blocks.map(({ cls, rows }) => {
        const head = `<div class="st-chead"><span class="tag" style="background:${cls.color}">${esc(cls.name || '')}</span>
          <span class="sof">SoF ${cls.sof ? (cls.sof / 1000).toFixed(1) + 'k' : '-'}</span></div>`;
        let prevPos = 0;
        const body = rows.map((d) => {
          const sep = prevPos && d.pos !== prevPos + 1 ? ' gap-sep' : '';
          prevPos = d.pos;
          const secs = showSectors ? Array.from({ length: nSec }, (_, i) => {
            const v = o.sectorsMode === 'last' ? d.sectorsLast[i] : d.sectorsBest[i];
            const sb = cls.sessionBestSectors[i];
            const purple = v > 0 && sb > 0 && Math.abs(v - sb) < 0.0005;
            return `<div class="sec tnum ${purple ? 'purple' : ''}">${fmtSector(v)}</div>`;
          }).join('') : '';
          return `<div class="st-row${d.isPlayer ? ' me' : ''}${sep}" style="${grid}">
            <span class="pos">${d.pos}</span>
            <span class="stripe" style="background:${cls.color}"></span>
            <div class="name"><span class="n">${esc(shortName(d.name, 20))}</span>${d.onPit ? '<span class="pit">PIT</span>' : ''}</div>
            ${o.brand !== false ? `<div>${brandBadge(d.carName)}</div>` : ''}
            ${o.license ? `<div>${licBadge(d.licClass, d.licSr)}</div>` : ''}
            ${o.irating ? `<div><span class="ir">${d.irating ? (d.irating / 1000).toFixed(1) + 'k' : '-'}</span></div>` : ''}
            ${o.irGain ? `<span class="irg tnum ${d.irDelta > 0 ? 'up' : d.irDelta < 0 ? 'down' : ''}">${d.irDelta === null || d.irDelta === undefined ? '' : (d.irDelta > 0 ? '+' : '') + d.irDelta}</span>` : ''}
            ${o.gap ? `<span class="gapc tnum">${cls.id === s.playerClassId ? gapText(d, ctx.t) : ''}</span>` : ''}
            ${timeCell(d, cls, ctx.now)}
            ${secs}
          </div>`;
        }).join('');
        return `<div class="st-class">${head}${body}</div>`;
      }).join('')}</div>`;
    },
  };

  // ======================= RELATIVE =======================
  // no máximo 3 carros acima e 3 abaixo de você (7 linhas)
  function relativeRows(h) {
    let n = Math.max(3, Math.floor(h / 27));
    if (n % 2 === 0) n -= 1;
    return Math.min(7, n);
  }
  const relative = {
    rows: (ctx) => relativeRows(ctx.h),
    render(el, s, ctx) {
      const o = ctx.opts;
      const n = relativeRows(ctx.h);
      const list = s.relative || [];
      const me = list.findIndex((r) => r.isPlayer);
      if (me < 0) { el.innerHTML = ''; return; }
      const half = (n - 1) / 2;
      const rows = list.slice(Math.max(0, me - half), me + half + 1);
      const cols = `grid-template-columns:28px 1fr ${o.brand !== false ? '28px' : ''} ${o.license ? '46px' : ''} 52px`;
      el.innerHTML = `<div class="rel">${rows.map((r) => {
        const cls = [r.isPlayer ? 'me' : '', r.lapState > 0 ? 'ahead-lap' : '', r.lapState < 0 ? 'behind-lap' : '', r.onPit ? 'pit' : ''].join(' ');
        return `<div class="rel-row ${cls}" style="${cols}">
          <span class="pos">${r.pos || '-'}</span>
          <div class="name"><span class="n">${esc(shortName(r.name, 22))}</span></div>
          ${o.brand !== false ? `<div>${brandBadge(r.carName)}</div>` : ''}
          ${o.license ? `<div>${licBadge(r.licClass, r.licSr)}</div>` : ''}
          <div class="gap tnum">${r.isPlayer ? '0.0' : Math.abs(r.gap).toFixed(1)}</div>
        </div>`;
      }).join('')}</div>`;
    },
  };

  // ======================= RADAR =======================
  // Visual no estilo do RaceLab: cruz pontilhada fina, carro branco, faixas vermelhas borradas nas laterais
  // e brilho amarelo em meia-lua na frente/atrás. Transparência configurável (padrão 50%).
  const radar = {
    render(el, s, ctx) {
      const r = s.radar || {};
      const o = ctx.opts;
      const W = ctx.w; const H = ctx.h; const cx = W / 2; const cy = H / 2;
      const pxm = Math.min(W, H) / 46;
      const carW = Math.max(10, W * 0.07); const carH = carW * 2.3;
      // no quali o radar não aparece (opção, ligada por padrão)
      if (o.hideInQualify !== false && r.qualify && !ctx.edit) { el.innerHTML = ''; return; }
      const hide = o.hideWhenClear !== false && !r.near && !ctx.edit;
      const alpha = (typeof o.opacity === 'number' ? o.opacity : 50) / 100;
      const sample = ctx.edit && s.sample;
      const off = (sample && !r.left && !r.right) ? carH * 0.35 : Math.max(-6, Math.min(6, r.sideOffset || 0)) * pxm;
      const left = r.left || (sample ? 1 : 0); const right = r.right || (sample ? 1 : 0);
      const behind = r.behind !== null && r.behind !== undefined ? r.behind : (sample ? -8 : null);
      const ahead = r.ahead;
      const bar = (dir, count, yOff) => {
        if (!count) return '';
        const len = W * (count > 1 ? 0.32 : 0.25);
        const x = dir < 0 ? cx - carW / 2 - 3 - len : cx + carW / 2 + 3;
        const id = dir < 0 ? 'rl' : 'rr';
        return `<rect x="${x}" y="${cy - carH * 0.5 - yOff}" width="${len}" height="${carH}" rx="${carH * 0.14}" fill="url(#${id})" filter="url(#blurS)"/>`;
      };
      const half = (m, front) => {
        if (m === null || m === undefined) return '';
        const k = Math.max(0.35, 1 - Math.abs(m) / 20);
        const rx = W * 0.25; const ry = H * 0.2;
        const y0 = front ? cy - carH / 2 - 3 : cy + carH / 2 + 3;
        const sweep = front ? 1 : 0;
        const tip = front ? y0 - ry : y0 + ry;
        return `<path d="M ${cx - rx} ${y0} A ${rx} ${ry} 0 0 ${sweep} ${cx + rx} ${y0} Z" fill="url(#${front ? 'yf' : 'yb'})" opacity="${k}" filter="url(#blurL)" data-tip="${tip}"/>`;
      };
      el.innerHTML = `<svg class="radar ${hide ? 'off' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="opacity:${hide ? 0 : alpha}">
        <defs>
          <filter id="blurS" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${Math.max(1.2, carW * 0.13)}"/></filter>
          <filter id="blurL" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${Math.max(2.5, carW * 0.3)}"/></filter>
          <linearGradient id="rl" x1="1" x2="0"><stop offset="0" stop-color="#ff1e1e"/><stop offset="0.55" stop-color="#e60000" stop-opacity="0.85"/><stop offset="1" stop-color="#e60000" stop-opacity="0"/></linearGradient>
          <linearGradient id="rr" x1="0" x2="1"><stop offset="0" stop-color="#ff1e1e"/><stop offset="0.55" stop-color="#e60000" stop-opacity="0.85"/><stop offset="1" stop-color="#e60000" stop-opacity="0"/></linearGradient>
          <radialGradient id="yb" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#ffd400" stop-opacity="1"/><stop offset="0.6" stop-color="#f0b400" stop-opacity="0.7"/><stop offset="1" stop-color="#e0a800" stop-opacity="0"/></radialGradient>
          <radialGradient id="yf" cx="0.5" cy="1" r="1"><stop offset="0" stop-color="#ffd400" stop-opacity="1"/><stop offset="0.6" stop-color="#f0b400" stop-opacity="0.7"/><stop offset="1" stop-color="#e0a800" stop-opacity="0"/></radialGradient>
          <linearGradient id="fadeV" gradientUnits="userSpaceOnUse" x1="0" y1="${H * 0.14}" x2="0" y2="${H * 0.86}">
            <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.9"/>
            <stop offset="0.7" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <linearGradient id="fadeH" gradientUnits="userSpaceOnUse" x1="${W * 0.2}" y1="0" x2="${W * 0.8}" y2="0">
            <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.75"/>
            <stop offset="0.7" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        </defs>
        ${half(ahead, true)}${half(behind, false)}
        ${bar(-1, left, off)}${bar(1, right, -off)}
        <line x1="${cx}" y1="${H * 0.14}" x2="${cx}" y2="${H * 0.86}" stroke="url(#fadeV)" stroke-width="1" stroke-dasharray="2 3"/>
        <line x1="${W * 0.2}" y1="${cy}" x2="${W * 0.8}" y2="${cy}" stroke="url(#fadeH)" stroke-width="1" stroke-dasharray="2 3"/>
        <line x1="${W * 0.32}" y1="${cy - carH * 0.32}" x2="${W * 0.68}" y2="${cy - carH * 0.32}" stroke="#fff" stroke-width="1" stroke-dasharray="1 3" stroke-opacity="0.45"/>
        <line x1="${W * 0.32}" y1="${cy + carH * 0.32}" x2="${W * 0.68}" y2="${cy + carH * 0.32}" stroke="#fff" stroke-width="1" stroke-dasharray="1 3" stroke-opacity="0.45"/>
        <rect x="${cx - carW / 2}" y="${cy - carH / 2}" width="${carW}" height="${carH}" rx="${carW * 0.22}" fill="#fff" stroke="rgba(0,0,0,0.55)" stroke-width="1"/>
      </svg>`;
    },
  };

  // ======================= BANDEIRAS =======================
  const FLAG_COLORS = {
    green: ['#1fbf4a', '#1fbf4a'], yellow: ['#ffd200', '#ffd200'], yellowWaving: ['#ffd200', '#ffd200'],
    caution: ['#ffd200', '#ffd200'], cautionWaving: ['#ffd200', '#ffd200'], blue: ['#2d8cff', '#2d8cff'],
    white: ['#ffffff', '#ffffff'], checkered: ['#ffffff', 'repeating-conic-gradient(#fff 0 25%, #222 0 50%) 0 0/12px 12px'],
    red: ['#ff3b30', '#ff3b30'], debris: ['#ffd200', 'repeating-linear-gradient(90deg,#ffd200 0 12px,#e10600 12px 24px)'],
    black: ['#ffffff', '#000000'], repair: ['#ff7a00', '#ff7a00'], furled: ['#ffffff', 'linear-gradient(135deg,#000 50%,#fff 50%)'],
    disqualify: ['#ff3b30', '#000000'],
  };
  const FLAG_ICON = '<svg viewBox="0 0 24 16"><path d="M2 14 L11 3 M22 14 L13 3" stroke="currentColor" stroke-width="1.6"/><path d="M11 3 l-6 -1 l-2 5 l6 1z M13 3 l6 -1 l2 5 l-6 1z" fill="currentColor"/></svg>';
  let greenSince = 0; let lastPrimary = null;

  // ---------- bandeira desenhada (estilo "ao lado") ----------
  // SVG pequeno e leve: mastro + pano ondulado, com o desenho de cada bandeira
  let flagUid = 0;
  const CLOTH = 'M7 5 C17 1 27 9 37 5 S51 2 55 4 L55 29 C51 27 47 27 37 30 S17 25 7 29 Z';
  function flagArt(kind, id) {
    const solid = (c) => `<rect x="0" y="0" width="60" height="36" fill="${c}"/>`;
    switch (kind) {
      case 'green': return solid('#1fbf4a');
      case 'yellow': case 'yellowWaving': case 'caution': case 'cautionWaving': return solid('#ffd200');
      case 'blue': return solid('#1f6fe5') + '<path d="M2 34 L40 0 L50 0 L12 36 Z" fill="#ffd200"/>';
      case 'white': return solid('#f4f5f7');
      case 'red': return solid('#e10600');
      case 'black': return solid('#0b0b0c');
      // o X acompanha a ondulação do pano (senão parece que está na frente da bandeira)
      case 'disqualify': return solid('#0b0b0c') + '<path d="M14 9 C23 15 33 19 49 24 M49 7 C38 12 28 17 14 25" fill="none" stroke="#f4f5f7" stroke-width="3.6" stroke-linecap="round"/>';
      case 'repair': return solid('#0b0b0c') + '<circle cx="31" cy="17" r="8.5" fill="#ff7a00"/>';
      case 'furled': return '<path d="M0 0 H60 L0 36 Z" fill="#0b0b0c"/><path d="M60 0 V36 H0 Z" fill="#f4f5f7"/>';
      case 'debris': return Array.from({ length: 6 }, (_, i) => `<rect x="${i * 10}" y="0" width="10" height="36" fill="${i % 2 ? '#e10600' : '#ffd200'}"/>`).join('');
      case 'checkered': {
        let r = solid('#f4f5f7');
        for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) r += `<rect x="${x * 7.5}" y="${y * 7.2}" width="7.5" height="7.2" fill="#111"/>`;
        return r;
      }
      default: return solid('#888');
    }
  }
  function flagSvg(kind) {
    const id = `fc${++flagUid}`;
    return `<svg class="fsvg" viewBox="0 0 60 40" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${CLOTH}"/></clipPath>
        <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#000" stop-opacity=".12"/><stop offset=".65" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient></defs>
      <rect x="3" y="2" width="2.6" height="37" rx="1.3" fill="#c9ced6"/>
      <g clip-path="url(#${id})">${flagArt(kind, id)}<rect width="60" height="40" fill="url(#${id}g)"/></g>
      <path d="${CLOTH}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".8"/>
    </svg>`;
  }
  const FLAG_TITLE_SIDE = {
    yellow: '#ffd200', yellowWaving: '#ffd200', caution: '#ffd200', cautionWaving: '#ffd200', green: '#3ddc6e',
    blue: '#4c9dff', white: '#ffffff', checkered: '#ffffff', red: '#ff4d42', debris: '#ffd200',
    black: '#ffffff', repair: '#ff8c1a', furled: '#ffffff', disqualify: '#ff4d42',
  };
  // visual "bandeira ao lado": o cartão normal (título + faixa colorida) e, num quadrado
  // transparente separado à esquerda ou à direita, o desenho da bandeira
  function flagCardSide(kind, texts, reason, side) {
    return `<div class="fside ${side === 'right' ? 'right' : ''}">
      <div class="fbox">${flagSvg(kind)}</div><div class="fcard">${flagCard(kind, texts, reason)}</div></div>`;
  }

  // bandeiras com desenho (quadriculada, detritos, advertência) não ficam atrás do texto:
  // o desenho vai num quadradinho à esquerda e a faixa fica escura, com texto branco
  const PATTERNED = new Set(['checkered', 'debris', 'furled']);
  function flagCard(kind, texts, reason) {
    const [title, sub] = texts;
    const why = reason ? `<div class="reason">${esc(reason)}</div>` : '';
    const [tc, bg] = FLAG_COLORS[kind] || ['#fff', '#444'];
    // detritos e quadriculada: a faixa de baixo é só a bandeira (o título já diz o que é)
    if (kind === 'debris' || kind === 'checkered') {
      return `<div class="flag"><div class="title" style="color:${tc}">${esc(title)}</div>
        <div class="bar pattern" style="background:${bg}"></div>${why}</div>`;
    }
    if (PATTERNED.has(kind)) {
      return `<div class="flag"><div class="title" style="color:${tc}">${esc(title)}</div>
        <div class="bar" style="background:#0c0d10;color:#fff"><span class="swatch" style="background:${bg}"></span><span>${esc(sub)}</span></div>${why}</div>`;
    }
    const barText = (kind === 'black' || kind === 'disqualify') ? '#fff' : '#111';
    return `<div class="flag"><div class="title" style="color:${tc}">${esc(title)}</div>
      <div class="bar" style="background:${bg};color:${barText}">${FLAG_ICON}<span>${esc(sub)}</span></div>${why}</div>`;
  }

  const flags = {
    animated: true,
    render(el, s, ctx) {
      const t = ctx.t; const f = s.flags || {};
      let primary = f.primary;
      if (primary !== lastPrimary) { if (primary === 'green') greenSince = ctx.now; lastPrimary = primary; }
      if (primary === 'green' && ctx.now - greenSince > 5000 && !ctx.edit) primary = null; // verde só aparece por 5 s
      let penalty = f.penalty;
      // editando: sempre tem uma bandeira na tela pra dar pra posicionar
      let reason = f.reason;
      if (ctx.edit) { primary = primary || 'yellow'; if (s.sample && !penalty) { penalty = 'black'; reason = 'pitSpeeding'; } }
      const parts = [];
      const side = ctx.opts.flagStyle === 'side';
      const card = (k, tx, why, pen) => (side ? flagCardSide(k, tx, why, ctx.opts.flagSide, pen) : flagCard(k, tx, why));
      if (primary && t.flag[primary]) parts.push(card(primary, t.flag[primary]));
      if (penalty === 'repair') reason = null; // carro danificado não precisa de motivo
      if (penalty && t.penalty[penalty]) parts.push(card(penalty, t.penalty[penalty], reason && t.reason[reason] ? `${t.reasonLbl} ${t.reason[reason]}` : null, true));
      // aviso de saída de pista / incidente embaixo das bandeiras
      let w = s.warning;
      if (!w && ctx.edit && s.sample) w = { kind: 'lostControl', inc: 2 };
      if (w && ctx.opts.warnings !== false && t.warn[w.kind]) {
        const inc = w.inc ? `<b class="tnum">+${w.inc}x</b>` : '';
        parts.push(`<div class="warncard ${w.kind === 'offTrackNow' || w.kind === 'lapInvalid' ? 'off' : ''}">${inc}<span>${esc(t.warn[w.kind])}</span></div>`);
      }
      el.innerHTML = `<div class="flags">${parts.join('')}</div>`;
    },
  };

  // ======================= INCIDENTES =======================
  const incidents = {
    render(el, s, ctx) {
      const t = ctx.t; const inc = s.incidents || { count: 0, limit: 0 };
      const lim = ctx.opts.limit !== false && inc.limit ? `<span class="tnum lim">/ ${inc.limit}</span>` : '';
      const warn = inc.limit && inc.count >= inc.limit * 0.75 ? ' warn' : '';
      el.innerHTML = `<div class="inc${warn}"><span>${esc(t.incidents)}</span><div><b class="tnum">${inc.count}x</b>${lim}</div></div>`;
    },
  };

  // ======================= LIMITADOR DO PIT =======================
  // limitador ligado: azul com a velocidade e o limite; no pit sem limitador: vermelho piscando
  const pitlimiter = {
    animated: true,
    render(el, s, ctx) {
      const t = ctx.t; const p = s.pit || {};
      let mode = p.limiter ? 'on' : (p.onPitRoad ? 'off' : null);
      if (!mode && ctx.edit) mode = 'on';
      if (!mode) { el.innerHTML = ''; return; }
      const spd = Math.round(p.speedKmh || 0);
      const over = p.limitKmh > 0 && spd > p.limitKmh + 0.5;
      const sp = ctx.opts.speed !== false
        ? `<span class="spd tnum${over ? ' over' : ''}">${spd}${p.limitKmh ? ` / ${Math.round(p.limitKmh)}` : ''} <small>${t.panel.kmh}</small></span>` : '';
      el.innerHTML = `<div class="pitlim ${mode}"><span class="lbl">${esc(mode === 'on' ? t.pit.limiter : t.pit.turnOn)}</span>${sp}</div>`;
    },
  };

  // ======================= SETORES (estilo LMU) =======================
  // roxo = melhor setor da classe na sessão, verde = seu melhor, amarelo = mais lento que o seu melhor
  const SECTOR_SHOW_S = 5;
  const sectors = {
    render(el, s, ctx) {
      const o = ctx.opts; const t = ctx.t; const sec = s.sectors || {};
      let x = sec.latest && sec.now - sec.latest.at < SECTOR_SHOW_S ? sec.latest : null;

      if (o.secStyle !== 'single') {
        // completo: melhor volta, volta atual, barra com os setores coloridos e, embaixo,
        // a diferença pra sua melhor volta que aparece só quando fecha um setor
        const n = sec.count || 3;
        let list = sec.list || [];
        if (ctx.edit && s.sample && !list.some(Boolean)) list = [{ status: 'purple' }, { status: 'green' }];
        if (!x && ctx.edit) x = { k: 1, split: -0.003 };
        const segs = Array.from({ length: n }, (_, i) => `<i class="${(list[i] && list[i].status) || ''}"></i>`).join('');
        const sp = x && x.split !== null && x.split !== undefined
          ? `<div class="ssplit tnum ${x.split <= 0 ? 'neg' : 'pos'}">${fmtDelta(x.split)}</div>` : '<div class="ssplit"></div>';
        const best = (s.panel && s.panel.bestLap) || -1;
        el.innerHTML = `<div class="secfull">
          <div class="r"><span>${esc(t.sec.best)}</span><b class="tnum">${fmtLap(best)}</b></div>
          <div class="r"><span>${esc(t.sec.current)}</span><b class="tnum">${fmtLap(sec.currentLap)}</b></div>
          <div class="segs">${segs}</div>${sp}</div>`;
        return;
      }

      // só o setor: mostra o setor que acabou de completar (S1, depois S2...) por alguns segundos e some
      if (!x && ctx.edit) x = { k: 1, v: 36.981, status: 'green', diff: -0.164 };
      if (!x) { el.innerHTML = ''; return; }
      const d = o.diff !== false && x.diff !== null && x.diff !== undefined ? `<span class="sd tnum">${fmtDelta(x.diff)}</span>` : '';
      el.innerHTML = `<div class="sectors"><div class="sbox ${x.status || ''}"><span class="sl">S${x.k + 1}</span>
        <span class="sv tnum">${x.v >= 60 ? fmtLap(x.v) : x.v.toFixed(3)}</span>${d}</div></div>`;
    },
  };

  // ======================= COMBUSTÍVEL =======================
  const fuel = {
    render(el, s, ctx) {
      const t = ctx.t; const f = s.fuel || {};
      const v = (x, d = 1) => (x === null || x === undefined || x < 0 || !isFinite(x)) ? '-' : x.toFixed(d);
      let fin = '-'; let finCls = '';
      if (f.toFinish !== null && f.toFinish !== undefined) {
        fin = `${f.toFinish >= 0 ? '+' : '−'}${Math.abs(f.toFinish).toFixed(1)} L`;
        finCls = f.toFinish >= 0 ? 'ok' : 'bad';
      }
      el.innerHTML = `<div class="fuel">
        <div><span class="k">${esc(t.fuel.title)}</span><span class="v tnum">${v(f.level)} <small>L</small></span></div>
        <div><span class="k">${esc(t.fuel.perLap)}</span><span class="v tnum">${v(f.perLap, 2)}</span></div>
        <div><span class="k">${esc(t.fuel.laps)}</span><span class="v tnum">${v(f.lapsLeft)}</span></div>
        <div><span class="k">${esc(t.fuel.toFinish)}</span><span class="v tnum ${finCls}">${fin}</span></div>
      </div>`;
    },
  };

  // ======================= PNEUS (separado) =======================
  const tires = {
    render(el, s, ctx) {
      const p = s.panel || {};
      el.innerHTML = `<div class="tires-solo">${tiresHtml(p.tires, ctx.opts.tireNumbers, profileFor(ctx.opts, p))}</div>`;
    },
  };

  // ======================= SESSÃO =======================
  const session = {
    render(el, s, ctx) {
      const t = ctx.t; const o = ctx.opts; const ss = s.session || {};
      const typeName = t.sessionType[I18N.sessionTypeKey(ss.type)] || ss.name;
      const timed = ss.timeTotal > 0 && ss.timeRemain >= 0 && ss.timeRemain < 360000;
      const frac = timed ? Math.min(1, Math.max(0, 1 - ss.timeRemain / ss.timeTotal)) : (ss.lapsTotal ? Math.min(1, ss.lap / ss.lapsTotal) : 0);
      const lapsTxt = ss.lapsTotal ? `${t.lap} ${ss.lap} / ${ss.lapsTotal}` : `${t.lap} ${ss.lap}`;
      el.innerHTML = `<div class="session">
        <div class="row1">${o.name !== false ? `<span class="sname">${esc(typeName)}</span>` : '<span></span>'}
          ${o.time !== false ? `<span class="clock tnum">${timed ? fmtClock(ss.timeRemain) : ''}</span>` : ''}</div>
        <div class="bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
        ${o.laps !== false ? `<div class="laps tnum">${esc(lapsTxt)}</div>` : ''}
      </div>`;
    },
  };

  // ======================= DELTA =======================
  const DELTA_GRAPH = 4.99; // a barra/círculo enche em ±4,99 s
  const DELTA_MAX = 9.99; // o número vai até ±9,99 s; passou disso mostra +9+ / −9+
  function deltaText(v) {
    if (v === null || v === undefined || !isFinite(v)) return '-.---';
    if (Math.abs(v) > DELTA_MAX) return v > 0 ? '+9+' : '−9+';
    return fmtDelta(v);
  }
  const delta = {
    render(el, s, ctx) {
      const t = ctx.t; const o = ctx.opts; const d = s.delta || {};
      const raw = d.value;
      const has = raw !== null && raw !== undefined && isFinite(raw);
      // sem volta de referência ainda: o delta inteiro some (no modo edição continua visível pra posicionar)
      if (!has && !ctx.edit) { el.innerHTML = ''; return; }
      const v = has ? raw : null;
      const color = !has ? '#8f96a3' : v <= 0 ? '#22d36b' : '#ff3b30';
      const frac = !has ? 0 : Math.min(1, Math.abs(v) / DELTA_GRAPH);
      const items = [
        ['sessionOptimal', d.sessionOptimal, '#ffb020'], ['sessionBest', d.sessionBest, '#c04dff'],
        ['predicted', d.predicted, null], ['personalBest', d.personalBest, '#22d36b'],
      ].filter(([k]) => o[k] !== false);
      const predColor = d.predicted > 0 && d.personalBest > 0 ? (d.predicted <= d.personalBest ? '#22d36b' : '#ff3b30') : '#fff';
      const itemsHtml = (colsN) => items.length ? `<div class="items" style="grid-template-columns:repeat(${colsN},1fr)">${items.map(([k, val, top]) => `
          <div class="item" style="${top ? `border-top-color:${top}` : ''}">
            <div class="v tnum" style="${k === 'predicted' ? `color:${predColor}` : ''}">${fmtLap(val)}</div>
            <div class="k">${esc(t.delta[k])}</div></div>`).join('')}</div>` : '';

      if (o.style === 'bar') {
        // barra horizontal: cresce do centro; vermelho pra esquerda = acima do tempo (mais lento),
        // verde pra direita = abaixo do tempo (mais rápido)
        const half = frac > 0.004 ? 50 * frac : 0;
        const left = !has ? 50 : v > 0 ? 50 - half : 50;
        const colsN = Math.max(1, Math.min(items.length, Math.floor(ctx.w / 150)));
        el.innerHTML = `<div class="delta bar-mode">
          <div class="dbar"><div class="fill" style="left:${left}%;width:${half}%;background:${color}"></div>
            <div class="dval tnum" style="color:${has ? '#fff' : '#8f96a3'}">${deltaText(v)}</div></div>
          ${itemsHtml(colsN)}</div>`;
        return;
      }

      const size = Math.max(90, Math.min(ctx.h, 170));
      const R = size / 2 - 7; const cx = size / 2; const cy = size / 2;
      const a0 = -Math.PI / 2; const a1 = a0 + (v <= 0 ? -1 : 1) * frac * Math.PI * 2 * 0.999;
      const large = frac > 0.5 ? 1 : 0; const sweep = v <= 0 ? 0 : 1;
      const arc = frac > 0.004 ? `<path d="M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 ${large} ${sweep} ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round"/>` : '';
      const colsN = Math.max(1, Math.min(items.length, Math.floor((ctx.w - size - 8) / 150)));
      el.innerHTML = `<div class="delta">
        <div class="dial" style="width:${size}px;height:${size}px">
          <svg viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cy}" r="${R}" stroke="rgba(255,255,255,0.12)" stroke-width="7" fill="none"/>${arc}</svg>
          <div class="lbl">${t.delta.title}</div>
          <div class="val tnum" style="color:${color}">${deltaText(v)}</div>
        </div>
        ${itemsHtml(colsN)}
      </div>`;
    },
  };

  // ======================= PAINEL AVANÇADO =======================
  const panel = {
    render(el, s, ctx) {
      const t = ctx.t; const o = ctx.opts; const p = s.panel || {}; const ss = s.session || {};
      const sh = p.shift || {};
      const first = sh.first || (sh.redline ? sh.redline * 0.75 : 6000);
      const last = sh.blink || sh.last || sh.redline || 8000;
      const nLights = 15;
      const lit = Math.max(0, Math.min(nLights, Math.round(((p.rpm - first) / Math.max(1, last - first)) * nLights)));
      const blink = p.rpm >= last && Math.floor(ctx.now / 120) % 2 === 0;
      const lights = Array.from({ length: nLights }, (_, i) => {
        let c = '#444';
        if (i < lit) c = i < 5 ? '#22d36b' : i < 10 ? '#ffd200' : '#ff3b30';
        if (blink) c = '#2d8cff';
        return `<i style="background:${c}"></i>`;
      }).join('');
      const rpmFrac = Math.min(1, p.rpm / Math.max(1, sh.redline || last));
      const g = p.gear === -1 ? 'R' : p.gear === 0 ? 'N' : p.gear;
      const R = 27; const len = 2 * Math.PI * R;
      el.innerHTML = `<div class="panel">
        <div class="main">
          <div class="gear"><svg viewBox="0 0 62 62"><circle cx="31" cy="31" r="${R}" stroke="#2a2d33" stroke-width="5" fill="none"/>
            <circle cx="31" cy="31" r="${R}" stroke="#22d36b" stroke-width="5" fill="none" stroke-dasharray="${len * rpmFrac} ${len}" transform="rotate(-90 31 31)"/></svg>${g}</div>
          <div><div class="lights">${lights}</div>
            <div class="nums"><div><div class="k">${t.panel.kmh}</div><div class="v tnum">${Math.round(p.speedKmh || 0)}</div></div>
            <div><div class="k">${t.panel.rpm}</div><div class="v tnum">${Math.round(p.rpm || 0)}</div></div></div></div>
          ${o.position !== false ? `<div class="ppos">P${p.position || '-'}</div>` : ''}
          ${o.tires !== false ? tiresHtml(p.tires, o.tireNumbers, profileFor(o, p)) : ''}
        </div>
        ${(o.temps !== false || o.bestLap !== false) ? `<div class="sub tnum">
          ${o.temps !== false ? `<span>${t.panel.track} ${ss.trackTemp ? ss.trackTemp.toFixed(0) : '-'}°C</span><span>${t.panel.air} ${ss.airTemp ? ss.airTemp.toFixed(0) : '-'}°C</span>` : ''}
          ${o.bestLap !== false ? `<span>${t.panel.best} ${fmtLap(p.bestLap)}</span>` : ''}</div>` : ''}
      </div>`;
    },
  };

  // faixas de temperatura (carcaça, °C) por tipo de carro: [frio abaixo de, quente acima de, muito quente acima de]
  const TIRE_RANGES = {
    gt: [70, 100, 110], proto: [75, 105, 115], formula: [80, 110, 120], formulaLow: [55, 85, 95],
    touring: [65, 95, 105], street: [50, 85, 95], stock: [70, 110, 125],
  };
  function profileFor(o, p) {
    const k = o.tireProfile && o.tireProfile !== 'auto' ? o.tireProfile : (p.tireProfile || 'gt');
    return TIRE_RANGES[k] || TIRE_RANGES.gt;
  }
  // cor do pneu: azul frio, verde ok, laranja quente, vermelho muito quente
  function tireColor(c, r) {
    if (c === null || c === undefined) return '#3a3f48';
    if (c < r[0]) return '#2d8cff';
    if (c < r[1]) return '#22d36b';
    if (c < r[2]) return '#ff9f1a';
    return '#ff3b30';
  }
  function tiresHtml(tires, numbers, range) {
    const t = tires || []; const r = range || TIRE_RANGES.gt;
    // pneus sempre compridos na vertical; os números ficam do lado de fora de cada pneu
    const tire = (c) => `<div class="tire" style="background:${tireColor(c, r)}"></div>`;
    const num = (c, side) => numbers ? `<span class="tnum-${side}">${c ? Math.round(c) : '-'}</span>` : '';
    return `<div class="tires${numbers ? ' nums' : ''}">
      ${num(t[0], 'l')}${tire(t[0])}${tire(t[1])}${num(t[1], 'r')}
      ${num(t[2], 'l')}${tire(t[2])}${tire(t[3])}${num(t[3], 'r')}</div>`;
  }

  // ======================= LOG DE VOLTAS =======================
  // Esticar pro lado mostra os setores de cada volta logo depois do tempo da volta.
  const laplog = {
    rows: (ctx) => Math.max(1, Math.floor((ctx.h - 24) / 25)),
    render(el, s, ctx) {
      const t = ctx.t; const L = s.laps || { list: [], best: -1 };
      const n = Math.max(1, Math.floor((ctx.h - 24) / 25));
      const rows = L.list.slice(-n).reverse(); // a última volta fica em cima
      const nSec = s.sectorsCount || 3;
      const showSec = ctx.w >= (ctx.opts.trackTemp !== false ? 280 : 230) + nSec * 56;
      const bestSec = [];
      if (showSec) for (const l of L.list) (l.sectors || []).forEach((v, i) => { if (!l.invalid && v > 0 && (!(bestSec[i] > 0) || v < bestSec[i])) bestSec[i] = v; });
      const showTemp = ctx.opts.trackTemp !== false;
      const cols = `grid-template-columns:40px 78px ${showSec ? `repeat(${nSec}, 52px) ` : ''}1fr${showTemp ? ' 46px' : ''}`;
      const secHead = showSec ? Array.from({ length: nSec }, (_, i) => `<span>S${i + 1}</span>`).join('') : '';
      el.innerHTML = `<div class="log">
        <div class="head" style="${cols}"><span>${t.laplog.lap}</span><span>${t.laplog.time}</span>${secHead}<span>${t.laplog.toBest}</span>${showTemp ? `<span>${t.laplog.temp}</span>` : ''}</div>
        ${rows.map((l) => {
          const dlt = L.best > 0 ? l.time - L.best : null;
          const isBest = dlt !== null && Math.abs(dlt) < 0.0005 && !l.invalid;
          const secs = showSec ? Array.from({ length: nSec }, (_, i) => {
            const v = (l.sectors || [])[i];
            const best = v > 0 && bestSec[i] > 0 && Math.abs(v - bestSec[i]) < 0.0005;
            return `<span class="sec${best ? ' best' : ''}">${fmtSector(v)}</span>`;
          }).join('') : '';
          return `<div class="lrow tnum${l.invalid ? ' invalid' : ''}" style="${cols}"><span>${l.lap}</span><span${isBest ? ' class="best"' : ''}>${fmtLap(l.time)}</span>
            ${secs}<span class="dl">${isBest ? '—' : fmtDelta(dlt)}</span>${showTemp ? `<span class="tmp">${l.trackTemp ? l.trackTemp.toFixed(0) + '°C' : '-'}</span>` : ''}</div>`;
        }).join('')}
      </div>`;
    },
  };

  // ======================= FPS =======================
  const fps = {
    render(el, s) {
      const v = (s.session && s.session.fps) || 0;
      el.innerHTML = `<div class="fps tnum">${Math.round(v)} <small>FPS</small></div>`;
    },
  };

  root.Overlays = { standings, relative, radar, flags, incidents, pitlimiter, sectors, fuel, tires, session, delta, panel, laplog, fps, TIRE_RANGES };
}(typeof self !== 'undefined' ? self : this));
