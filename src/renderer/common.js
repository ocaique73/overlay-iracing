// Funções comuns: formatação de tempos, marcas dos carros e cores de licença.
(function (root) {
  'use strict';

  const BRANDS = [
    ['porsche', /porsche/i, 'POR'], ['bmw', /\bbmw\b/i, 'BMW'], ['ferrari', /ferrari/i, 'FER'],
    ['mercedes', /mercedes|\bamg\b/i, 'MB'], ['audi', /\baudi\b/i, 'AUDI'], ['lamborghini', /lamborghini/i, 'LAMBO'],
    ['mclaren', /mclaren/i, 'MCL'], ['ford', /\bford\b|mustang/i, 'FORD'], ['astonmartin', /aston/i, 'AM'],
    ['chevrolet', /chevrolet|corvette|camaro/i, 'CHEV'], ['cadillac', /cadillac/i, 'CAD'], ['acura', /acura/i, 'ACU'],
    ['toyota', /toyota|gr86|supra/i, 'TOY'], ['mazda', /mazda|mx-5/i, 'MAZ'], ['honda', /honda|civic/i, 'HON'],
    ['hyundai', /hyundai|elantra/i, 'HYU'], ['volkswagen', /volkswagen|\bvw\b|jetta|golf/i, 'VW'],
    ['renault', /renault|clio/i, 'REN'], ['nissan', /nissan/i, 'NIS'], ['subaru', /subaru|wrx/i, 'SUB'],
    ['dallara', /dallara|\bir-?18\b|\bir-?01\b|indy|f3\b/i, 'DAL'], ['ligier', /ligier/i, 'LIG'],
    ['lotus', /lotus/i, 'LOT'], ['williams', /williams/i, 'WIL'], ['mercedesf1', /w1[23]/i, 'MB'],
    ['radical', /radical/i, 'RAD'], ['riley', /riley/i, 'RIL'], ['kia', /\bkia\b/i, 'KIA'], ['mini', /\bmini\b/i, 'MINI'],
    ['pontiac', /pontiac/i, 'PON'], ['holden', /holden/i, 'HOL'], ['skipbarber', /skip barber/i, 'SKIP'],
    ['superformula', /super formula/i, 'SF'], ['ray', /\bray\b|ff1600/i, 'RAY'], ['vee', /vee/i, 'VEE'],
    ['caterham', /caterham/i, 'CAT'], ['alpine', /alpine/i, 'ALP'], ['lucasoil', /lucas oil/i, 'LO'],
  ];

  function brandOf(carName) {
    for (const [key, re, short] of BRANDS) if (re.test(carName || '')) return { key, short };
    const first = String(carName || '').split(/\s+/)[0] || '?';
    return { key: first.toLowerCase().replace(/\W/g, ''), short: first.slice(0, 4).toUpperCase() };
  }

  const LIC_COLORS = { R: '#e8313f', D: '#f07c1b', C: '#c4a20f', B: '#2fb04a', A: '#1f6fe5', P: '#111111', PRO: '#111111', WC: '#111111' };
  function licColor(cls) { return LIC_COLORS[String(cls || '').toUpperCase()] || '#555'; }

  function fmtLap(t) {
    if (!(t > 0)) return '-:--.---';
    const m = Math.floor(t / 60); const s = t - m * 60;
    return `${m}:${s.toFixed(3).padStart(6, '0')}`;
  }
  function fmtSector(t) { return t > 0 ? t.toFixed(2) : '--.--'; }
  function fmtDelta(t, dec = 3) {
    if (t === null || t === undefined || !isFinite(t)) return '-.---';
    return (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t).toFixed(dec);
  }
  function fmtClock(sec) {
    if (!(sec >= 0) || sec > 360000) return '--:--';
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = Math.floor(sec % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function shortName(name, max = 18) {
    const s = String(name || '');
    if (s.length <= max) return s;
    const parts = s.split(/\s+/);
    if (parts.length > 1) return `${parts[0][0]}. ${parts.slice(1).join(' ')}`.slice(0, max);
    return s.slice(0, max);
  }

  // Selo da marca: usa a imagem da pasta de logos se existir, senão mostra a sigla.
  let logosBase = null;
  const logoMissing = new Set();
  function setLogosBase(dir) { logosBase = dir ? 'file:///' + dir.replace(/\\/g, '/').replace(/^\/+/, '') : null; }
  // logos que já vêm dentro do programa (pasta renderer/logos)
  let bundledBase = 'logos';
  function setBundledBase(p) { bundledBase = p; }
  const BUNDLED = new Set(["acura", "alpine", "astonmartin", "audi", "bmw", "cadillac", "caterham", "chevrolet", "ferrari", "ford", "holden", "honda", "hyundai", "kia", "lamborghini", "ligier", "lotus", "mazda", "mclaren", "mercedes", "mercedesf1", "mini", "nissan", "pontiac", "porsche", "renault", "subaru", "toyota", "volkswagen"]);
  function brandBadge(carName) {
    const b = brandOf(carName);
    const userKey = 'user:' + b.key;
    if (logosBase && !logoMissing.has(userKey)) {
      return `<span class="brand img" title="${esc(carName)}"><img src="${logosBase}/${b.key}.png" data-brand="${userKey}"><i>${b.short}</i></span>`;
    }
    if (BUNDLED.has(b.key)) {
      return `<span class="brand img" title="${esc(carName)}"><img src="${bundledBase}/${b.key}.png"></span>`;
    }
    return `<span class="brand text" title="${esc(carName)}"><i>${b.short}</i></span>`;
  }
  // logo que não existe na pasta: some e passa a mostrar só a sigla
  if (root.document) {
    root.document.addEventListener('error', (e) => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && img.dataset.brand) { logoMissing.add(img.dataset.brand); img.remove(); }
    }, true);
  }

  function licBadge(cls, sr) {
    if (!cls) return '';
    return `<span class="lic" style="background:${licColor(cls)}">${esc(cls)} ${esc(sr)}</span>`;
  }

  root.Common = { brandOf, brandBadge, licBadge, licColor, fmtLap, fmtSector, fmtDelta, fmtClock, esc, shortName, setLogosBase, setBundledBase };
}(typeof self !== 'undefined' ? self : this));
