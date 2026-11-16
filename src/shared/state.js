// Transforma a telemetria crua + YAML da sessão no estado que os overlays desenham.
// Roda no processo principal do Electron e também no preview do navegador (sem APIs do Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OverlayState = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FLAG = {
    checkered: 0x1, white: 0x2, green: 0x4, yellow: 0x8, red: 0x10, blue: 0x20, debris: 0x40,
    crossed: 0x80, yellowWaving: 0x100, oneLapToGreen: 0x200, greenHeld: 0x400,
    caution: 0x4000, cautionWaving: 0x8000, black: 0x10000, disqualify: 0x20000,
    furled: 0x80000, repair: 0x100000,
  };
  const ENGINE_PIT_LIMITER = 0x10;
  const RADAR_RANGE_M = 20;

  function num(v, d = 0) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  function parseTrackLengthM(str) {
    if (!str) return 4000;
    const m = String(str).match(/([\d.]+)\s*(km|mi)/i);
    if (!m) return 4000;
    const v = parseFloat(m[1]);
    return m[2].toLowerCase() === 'mi' ? v * 1609.34 : v * 1000;
  }

  function parseSeconds(str) {
    const m = String(str || '').match(/([\d.]+)\s*sec/);
    return m ? parseFloat(m[1]) : 0;
  }

  function shortLicense(lic) {
    const m = String(lic || '').match(/^([A-Za-z]+)\s*([\d.]+)/);
    if (!m) return { cls: '', sr: '' };
    return { cls: m[1].toUpperCase(), sr: (Math.floor(parseFloat(m[2]) * 10) / 10).toFixed(1) };
  }

  // tempo da referência numa fração da pista (interpolação linear)
  function interpRef(pts, pct, total) {
    let lo = 0; let hi = pts.length - 1;
    if (pct <= pts[0][0]) return pts[0][1] * (pct / Math.max(1e-6, pts[0][0]));
    if (pct >= pts[hi][0]) {
      const [p0, t0] = pts[hi];
      return t0 + (total - t0) * ((pct - p0) / Math.max(1e-6, 1 - p0));
    }
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= pct) lo = m; else hi = m; }
    const [p0, t0] = pts[lo]; const [p1, t1] = pts[hi];
    return t0 + (t1 - t0) * ((pct - p0) / Math.max(1e-9, p1 - p0));
  }

  function parsePitLimit(str) {
    const m = String(str || '').match(/([\d.]+)\s*(kph|km\/h|mph)/i);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    return /mph/i.test(m[2]) ? v * 1.609344 : v;
  }

  // layout por tipo de sessão
  function profileKeyOf(type) {
    const s = String(type || '').toLowerCase();
    if (s.includes('race')) return 'race';
    if (s.includes('qual')) return 'qualify';
    return 'practice';
  }

  // tipo de carro pra escolher a faixa de temperatura dos pneus
  function tireProfileOf(d) {
    if (!d) return 'gt';
    const s = `${d.carPath} ${d.carName} ${d.className}`.toLowerCase();
    if (/stockcar|nascar|truck|arca|late ?model|latemodel|modified|legends|street ?stock|sprint ?car|midget|dirt/.test(s)) return 'stock';
    if (/formula ?vee|ff1600|formula ?4|\bf4\b|fiaf4|skip ?barber|skippy|usf ?2000|usf2000|pro ?mazda|pm18|ray ?ff|formula ?mazda|formula ?renault ?2/.test(s)) return 'formulaLow';
    if (/mercedes ?w1\d|\bw1[0-9]\b|formula ?1|\bf1\b|mclaren ?mp4|williams|lotus ?(49|79)|super ?formula|sf23|sf19|dallara ?(ir|dw12|f3|il15)|ir18|ir-18|indy|\bf3\b|fr ?3\.5|formula ?renault ?3|super ?formula ?lights|formula ?a|formula ?ir/.test(s)) return 'formula';
    if (/gtp|lmdh|lmp\d?|hpd|ligier|p217|radical|m ?hybrid|arx-?0|v-?series\.r|963|\bdp\b|daytona ?prototype/.test(s)) return 'proto';
    if (/tcr|supercar|elantra|civic ?type ?r|rs ?3 ?lms|v8 ?supercar|touring|btcc/.test(s)) return 'touring';
    if (/mx-?5|miata|gr ?86|toyota ?86|brz|solstice|spec ?racer|jetta|mini ?cooper|kia ?optima|street|global ?mx/.test(s)) return 'street';
    return 'gt';
  }

  function sofOf(irs) {
    const list = irs.filter((x) => x > 0);
    if (!list.length) return 0;
    const k = 1600 / Math.LN2;
    const sum = list.reduce((s, ir) => s + Math.pow(2, -ir / 1600), 0);
    return Math.round(k * Math.log(list.length / sum));
  }

  function normalizeColor(c, fallback) {
    if (c == null || c === '') return fallback;
    let s = String(c).replace(/^0x/i, '').replace(/^#/, '');
    if (!/^[0-9a-f]+$/i.test(s)) return fallback;
    s = s.padStart(6, '0').slice(-6);
    return '#' + s;
  }

  class StateBuilder {
    constructor(opts = {}) {
      this.store = opts.store || null; // { getPB(key), setPB(key, t) }
      this.reset();
    }

    reset() {
      this.cars = {}; // por carIdx: rastreio de setores e volta
      this.sessionNum = -1;
      this.laps = [];
      this.playerLapsDone = -1;
      this.lapIncidentStart = 0;
      this.lapOffTrack = false;
      this.sessionBestSectors = {}; // por classe: [s1, s2, ...]
      this.pendingLap = null; // volta completada esperando o iRacing publicar o tempo
      this.prevTickLast = -1;
      this.fuelLaps = []; // consumo das últimas voltas limpas
      this.fuelLapStart = null;
      this.fuelLapDirty = false; // passou no pit ou reabasteceu nessa volta
      this.prevFuel = null;
      this.trace = null; // volta atual: [[fração, tempo], ...]
      this.refPending = null;
      this.deltaStale = null;
      this.candidate = null; // volta que acabou, esperando o tempo oficial pra virar referência
      this.ref = null; // melhor volta válida: { pts, time }
      this.prevPct = -1;
      this.warn = { offAt: -99, incPrev: null, incAt: -99, incDelta: 0 };
      this.pen = { last: null, reason: null, pitOverAt: -99, offTrackAt: -99, raceStartAt: -99, prevState: -1 };
    }

    build(raw, sessionYaml, extra = {}) {
      const t = raw || {};
      const s = sessionYaml || {};
      const nowMs = extra.nowMs || Date.now();
      const sessionNum = num(t.SessionNum, 0);
      const weekend = s.WeekendInfo || {};
      // zera tudo (log de voltas, setores, consumo) quando muda a sessão, a pista ou o evento.
      // Só o número da sessão não basta: sair do Teste e entrar numa online pode repetir o número.
      const sessionKey = [sessionNum, num(t.SessionUniqueID, 0), weekend.SessionID, weekend.SubSessionID,
        weekend.TrackID, weekend.TrackName, weekend.EventType, (s.DriverInfo || {}).DriverCarIdx].join('|');
      if (sessionKey !== this.sessionKey) { this.reset(); this.sessionKey = sessionKey; this.sessionNum = sessionNum; }

      const driverInfo = s.DriverInfo || {};
      const sessions = arr((s.SessionInfo || {}).Sessions);
      const cur = sessions.find((x) => x.SessionNum === sessionNum) || sessions[sessions.length - 1] || {};
      const sectors = arr((s.SplitTimeInfo || {}).Sectors).map((x) => num(x.SectorStartPct)).sort((a, b) => a - b);
      if (!sectors.length || sectors[0] !== 0) sectors.unshift(0);
      const trackLen = parseTrackLengthM(weekend.TrackLength);
      const playerIdx = num(t.PlayerCarIdx, num(driverInfo.DriverCarIdx, 0));
      const sessionTime = num(t.SessionTime);
      const sessionType = String(cur.SessionType || '');
      const isRace = /race/i.test(sessionType);

      const lapPct = arr(t.CarIdxLapDistPct);
      const lapNum = arr(t.CarIdxLap);
      const lapsDone = arr(t.CarIdxLapCompleted);
      const pos = arr(t.CarIdxPosition);
      const classPos = arr(t.CarIdxClassPosition);
      const lastLaps = arr(t.CarIdxLastLapTime);
      const bestLaps = arr(t.CarIdxBestLapTime);
      const onPit = arr(t.CarIdxOnPitRoad);
      const surface = arr(t.CarIdxTrackSurface);

      // ---------- pilotos ----------
      const drivers = [];
      for (const d of arr(driverInfo.Drivers)) {
        const idx = d.CarIdx;
        if (d.CarIsPaceCar || d.IsSpectator) continue;
        if (/pace car/i.test(d.UserName || '')) continue;
        const lic = shortLicense(d.LicString);
        const car = this.trackCar(idx, num(lapPct[idx], -1), num(lapsDone[idx], -1), sessionTime,
          sectors, !!onPit[idx], num(lastLaps[idx], -1), nowMs);
        drivers.push({
          idx,
          name: d.UserName || '',
          abbrev: d.AbbrevName || '',
          number: d.CarNumber || '',
          classId: num(d.CarClassID, 0),
          className: d.CarClassShortName || (d.CarClassID ? `Classe ${d.CarClassID}` : ''),
          classColor: normalizeColor(d.CarClassColor, '#e10600'),
          classSpeed: num(d.CarClassRelSpeed, 0),
          classEstLap: num(d.CarClassEstLapTime, 0),
          carName: d.CarScreenName || '',
          carPath: d.CarPath || '',
          irating: num(d.IRating, 0),
          licClass: lic.cls,
          licSr: lic.sr,
          pos: num(pos[idx], 0),
          classPos: num(classPos[idx], 0),
          best: num(bestLaps[idx], -1),
          last: num(lastLaps[idx], -1),
          lastLapAt: car.lastLapAt,
          sectorsLast: car.sectorsLast,
          sectorsBest: car.sectorsBest,
          lapsDone: num(lapsDone[idx], 0),
          progress: car.prog || 0,
          lap: num(lapNum[idx], 0),
          pct: num(lapPct[idx], -1),
          onPit: !!onPit[idx],
          inWorld: num(surface[idx], -1) !== -1,
          isPlayer: idx === playerIdx,
        });
      }
      const byIdx = {};
      for (const d of drivers) byIdx[d.idx] = d;
      const player = byIdx[playerIdx] || null;

      // cor de cada setor do jogador, estilo LMU: roxo = melhor da classe, verde = seu melhor, amarelo = mais lento
      const pcar = this.cars[playerIdx];
      if (pcar && player) {
        const cb = this.sessionBestSectors[player.classId] || [];
        // setores da sua melhor volta válida (pra diferença acumulada em cada parcial)
        let refLap = null;
        for (const l of this.laps) {
          if (l.invalid || !l.sectors || l.sectors.length !== sectors.length || !l.sectors.every((v) => v > 0)) continue;
          if (!refLap || l.time < refLap.time) refLap = l;
        }
        for (const list of [pcar.secInfo, pcar.secLast]) {
          (list || []).forEach((x, k) => {
            if (!x || x.status) return;
            if (refLap) {
              let cur = 0; let ref = 0; let ok = true;
              for (let i = 0; i <= k; i++) { if (!(list[i] && list[i].v > 0)) { ok = false; break; } cur += list[i].v; ref += refLap.sectors[i]; }
              x.split = ok ? cur - ref : null;
            } else x.split = null;
            if (!(cb[k] > 0) || x.v <= cb[k] + 0.0005) x.status = 'purple';
            else if (!(x.prevBest > 0) || x.v <= x.prevBest + 0.0005) x.status = 'green';
            else x.status = 'yellow';
            x.diff = x.prevBest > 0 ? x.v - x.prevBest : null;
          });
        }
      }

      // melhores setores da sessão por classe
      for (const d of drivers) {
        const sb = this.sessionBestSectors[d.classId] || (this.sessionBestSectors[d.classId] = []);
        d.sectorsBest.forEach((v, i) => { if (v > 0 && (!(sb[i] > 0) || v < sb[i])) sb[i] = v; });
      }

      // ---------- classificação ----------
      const liveRace = isRace && num(t.SessionState, 0) === 4; // 4 = corrida em andamento
      const classesMap = {};
      for (const d of drivers) {
        const c = classesMap[d.classId] || (classesMap[d.classId] = {
          id: d.classId, name: d.className, color: d.classColor, speed: d.classSpeed, drivers: [],
        });
        c.drivers.push(d);
      }
      const classes = Object.values(classesMap).map((c) => {
        const list = c.drivers.slice();
        const official = (a, b) => {
          const ap = a.classPos > 0 ? a.classPos : 999; const bp = b.classPos > 0 ? b.classPos : 999;
          return ap - bp;
        };
        const byBest = (a, b) => {
          const ab = a.best > 0 ? a.best : 1e9; const bb = b.best > 0 ? b.best : 1e9;
          return ab - bb;
        };
        if (liveRace) {
          // o iRacing só atualiza a posição oficial na linha de chegada: em corrida usamos a distância ao vivo
          list.sort((a, b) => (b.progress - a.progress) || official(a, b));
        } else if (isRace) {
          list.sort((a, b) => official(a, b) || byBest(a, b));
        } else {
          list.sort((a, b) => byBest(a, b) || official(a, b) || (b.progress - a.progress));
        }
        list.forEach((d, i) => { d.displayPos = i + 1; });
        const bestLap = Math.min(...list.map((d) => (d.best > 0 ? d.best : Infinity)));
        // gap até o líder da classe: corrida = segundos na pista (ou voltas atrás); treino/quali = diferença de melhor volta
        const leader = list[0];
        for (const d of list) {
          d.gap = null; d.gapLaps = 0;
          if (!leader || d === leader) continue;
          if (liveRace) {
            const lapsBehind = Math.floor(leader.progress - d.progress);
            if (lapsBehind >= 1) { d.gapLaps = lapsBehind; continue; }
            const lc = this.cars[leader.idx]; const dc = this.cars[d.idx];
            if (lc && dc && lc.cpt && dc.cpt && dc.cpIdx !== undefined) {
              const tl = lc.cpt.get(dc.cpIdx); const td = dc.cpt.get(dc.cpIdx);
              if (tl !== undefined && td !== undefined && td >= tl) d.gap = td - tl;
            }
          } else if (!isRace && d.best > 0 && leader.best > 0) d.gap = d.best - leader.best;
        }
        // previsão de iRating se a corrida acabasse agora (só corrida)
        const ird = isRace ? iratingDeltas(list) : list.map(() => null);
        list.forEach((d, i) => { d.irDelta = ird[i]; });
        return {
          id: c.id, name: c.name, color: c.color, speed: c.speed,
          sof: sofOf(list.map((d) => d.irating)),
          sessionBest: isFinite(bestLap) ? bestLap : -1,
          sessionBestSectors: (this.sessionBestSectors[c.id] || []).slice(),
          drivers: list.map(slimDriver),
        };
      });
      classes.sort((a, b) => (b.speed - a.speed) || (a.id - b.id));

      // ---------- relativo ----------
      const relative = [];
      if (player && player.pct >= 0) {
        const estLap = player.classEstLap > 0 ? player.classEstLap : (player.best > 0 ? player.best : 100);
        for (const d of drivers) {
          if (d.pct < 0 || !d.inWorld) continue;
          let rel = d.pct - player.pct;
          if (rel > 0.5) rel -= 1; if (rel < -0.5) rel += 1;
          const lapDiff = (d.lap + d.pct) - (player.lap + player.pct);
          let lapState = 0;
          if (isRace && !d.isPlayer) {
            if (lapDiff > 0.5) lapState = 1; // vai te dar volta / está à frente em voltas
            else if (lapDiff < -0.5) lapState = -1; // você está dando volta nele
          }
          relative.push({
            idx: d.idx, name: d.name, number: d.number, classColor: d.classColor, carName: d.carName,
            licClass: d.licClass, licSr: d.licSr, pos: d.displayPos, onPit: d.onPit,
            isPlayer: d.isPlayer, gap: rel * estLap, rel, lapState,
          });
        }
        relative.sort((a, b) => b.rel - a.rel);
      }

      // ---------- radar ----------
      const clr = num(t.CarLeftRight, 0);
      const radar = { left: 0, right: 0, ahead: null, behind: null, sideOffset: 0 };
      if (clr === 2) radar.left = 1; else if (clr === 3) radar.right = 1;
      else if (clr === 4) { radar.left = 1; radar.right = 1; } else if (clr === 5) radar.left = 2; else if (clr === 6) radar.right = 2;
      // quali solo (Lone Qualify): os outros carros são fantasmas, não existem na pista
      const ghosts = /lone/i.test(sessionType);
      if (player && player.pct >= 0 && !player.onPit && !ghosts) {
        let nearestSide = null;
        for (const d of drivers) {
          if (d.isPlayer || d.pct < 0 || d.onPit || !d.inWorld) continue;
          let rel = d.pct - player.pct;
          if (rel > 0.5) rel -= 1; if (rel < -0.5) rel += 1;
          const m = rel * trackLen;
          if (Math.abs(m) > RADAR_RANGE_M) continue;
          if (m >= 4.5 && (radar.ahead === null || m < radar.ahead)) radar.ahead = m;
          if (m <= -4.5 && (radar.behind === null || m > radar.behind)) radar.behind = m;
          if (Math.abs(m) < 6 && (nearestSide === null || Math.abs(m) < Math.abs(nearestSide))) nearestSide = m;
        }
        if (nearestSide !== null) radar.sideOffset = nearestSide;
      }
      radar.near = !!(radar.left || radar.right || radar.ahead !== null || radar.behind !== null);
      radar.qualify = /qual/i.test(sessionType);

      // ---------- bandeiras ----------
      const sf = num(t.SessionFlags, 0);
      const flagList = [];
      for (const k of ['checkered', 'white', 'red', 'black', 'disqualify', 'repair', 'furled', 'yellowWaving', 'yellow', 'caution', 'cautionWaving', 'debris', 'blue', 'green']) {
        if (sf & FLAG[k]) flagList.push(k);
      }
      let penalty = null;
      if (sf & FLAG.disqualify) penalty = 'disqualify';
      else if (sf & FLAG.black) penalty = 'black';
      else if (sf & FLAG.repair) penalty = 'repair';
      else if (sf & FLAG.furled) penalty = 'furled';
      // motivo provável da punição: o iRacing não informa o motivo na telemetria,
      // então deduzimos pelo que aconteceu logo antes (pit acima do limite, saída de pista, largada, limite de incidentes)
      const pen = this.pen;
      const sState = num(t.SessionState, 0);
      if (sState === 4 && pen.prevState !== 4 && pen.prevState !== -1) pen.raceStartAt = sessionTime;
      pen.prevState = sState;
      const pitLim = parsePitLimit(weekend.TrackPitSpeedLimit);
      const spdKmh = num(t.Speed, 0) * 3.6;
      if ((t.OnPitRoad || (player && player.onPit)) && pitLim > 0 && spdKmh > pitLim + 1.5) pen.pitOverAt = sessionTime;
      if (num(t.PlayerTrackSurface, 3) === 0) pen.offTrackAt = sessionTime;
      if (penalty && penalty !== pen.last && penalty !== 'repair') {
        const incNow = num(t.PlayerCarMyIncidentCount, num(t.PlayerCarDriverIncidentCount, 0));
        const limRaw = (weekend.WeekendOptions && weekend.WeekendOptions.IncidentLimit) || '';
        const lim = /^\d+$/.test(String(limRaw)) ? parseInt(limRaw, 10) : 0;
        let reason = null;
        if (sessionTime - pen.pitOverAt < 6) reason = 'pitSpeeding';
        else if (isRace && sessionTime - pen.raceStartAt < 25) reason = 'jumpStart';
        else if (lim > 0 && incNow >= lim) reason = 'incidentLimit';
        else if (sessionTime - pen.offTrackAt < 6) reason = 'cutting';
        pen.reason = reason;
      }
      if (!penalty) pen.reason = null;
      pen.last = penalty;

      const primaryOrder = ['checkered', 'red', 'white', 'yellowWaving', 'cautionWaving', 'caution', 'yellow', 'debris', 'blue', 'green'];
      const primary = primaryOrder.find((k) => flagList.includes(k)) || null;

      // ---------- volta do jogador / log ----------
      const incidents = num(t.PlayerCarMyIncidentCount, num(t.PlayerCarDriverIncidentCount, 0));
      const limitRaw = (s.WeekendInfo && s.WeekendInfo.WeekendOptions && s.WeekendInfo.WeekendOptions.IncidentLimit) || '';
      const incidentLimit = /^\d+$/.test(String(limitRaw)) ? parseInt(limitRaw, 10) : 0;
      const trackTemp = num(t.TrackTempCrew, num(t.TrackTemp, 0));
      const playerLapsDone = num(t.LapCompleted, player ? player.lapsDone : 0);
      const lastNow = num(t.LapLastLapTime, -1);
      const fuel = num(t.FuelLevel, -1);
      const onPitRoad = !!t.OnPitRoad || !!(player && player.onPit);
      const own = this.deltaTick(player, num(t.LapCurrentLapTime, -1), sessionTime, onPitRoad);
      if (num(t.PlayerTrackSurface, 3) === 0) this.lapOffTrack = true;
      if (onPitRoad) this.fuelLapDirty = true;
      if (fuel >= 0 && this.prevFuel !== null && fuel > this.prevFuel + 0.05) this.fuelLapDirty = true; // reabasteceu
      if (this.playerLapsDone === -1) { this.playerLapsDone = playerLapsDone; this.lapIncidentStart = incidents; }
      if (playerLapsDone > this.playerLapsDone) {
        // o iRacing marca a volta como completa antes de atualizar LapLastLapTime: guarda e espera o tempo novo
        this.pendingLap = {
          lap: playerLapsDone, prevLast: this.prevTickLast, at: sessionTime, trackTemp,
          invalid: this.lapOffTrack || incidents > this.lapIncidentStart,
        };
        // consumo da volta (só voltas limpas, sem pit nem reabastecimento)
        if (fuel >= 0) {
          if (this.fuelLapStart !== null && !this.fuelLapDirty) {
            const used = this.fuelLapStart - fuel;
            if (used > 0.01) { this.fuelLaps.push(used); if (this.fuelLaps.length > 5) this.fuelLaps.shift(); }
          }
          this.fuelLapStart = fuel;
          this.fuelLapDirty = onPitRoad;
        }
        this.playerLapsDone = playerLapsDone;
        this.lapIncidentStart = incidents;
        this.lapOffTrack = false;
      }
      if (this.pendingLap) {
        const p = this.pendingLap;
        if (lastNow > 0 && lastNow !== p.prevLast) {
          this.laps.push({ lap: p.lap, time: lastNow, trackTemp: p.trackTemp, invalid: p.invalid, sectors: null, at: p.at });
          this.adoptReference(lastNow, p.invalid, sessionTime);
          if (this.laps.length > 60) this.laps.shift();
          this.pendingLap = null;
        } else if (sessionTime - p.at > 6) {
          this.pendingLap = null; // volta sem tempo (ex.: reset): não entra no log
        }
      }
      this.prevTickLast = lastNow;
      if (fuel >= 0) this.prevFuel = fuel;
      // setores da volta: chegam junto com a passagem pela linha (pode ser um tick antes ou depois)
      const pc = this.cars[playerIdx];
      for (const l of this.laps) {
        if (l.sectors || !pc || !pc.sectorsLastAt) continue;
        if (Math.abs(pc.sectorsLastAt - l.at) < 1.5) l.sectors = pc.sectorsLast.slice();
        else if (sessionTime - l.at > 3) l.sectors = [];
      }
      const validTimes = this.laps.filter((l) => !l.invalid).map((l) => l.time);
      const logBest = validTimes.length ? Math.min(...validTimes) : -1;

      // ---------- delta ----------
      const bestLap = num(t.LapBestLapTime, -1);
      const playerClass = player ? classes.find((c) => c.id === player.classId) : null;
      const sessionBest = playerClass ? playerClass.sessionBest : -1;
      const sbs = playerClass ? playerClass.sessionBestSectors : [];
      const sessionOptimal = (sbs.length && sbs.length === sectors.length && sbs.every((x) => x > 0))
        ? sbs.reduce((a, b) => a + b, 0) : -1;
      let pbKey = null; let personalBest = -1;
      if (this.store && player) {
        pbKey = `${player.carPath}|${weekend.TrackID || weekend.TrackName || ''}`;
        personalBest = num(this.store.getPB(pbKey), -1);
        if (bestLap > 0 && (personalBest <= 0 || bestLap < personalBest)) {
          this.store.setPB(pbKey, bestLap); personalBest = bestLap;
        }
      }
      // delta calculado pelo próprio app contra a sua melhor volta válida da sessão (não para quando sai da pista);
      // enquanto não tem volta de referência, usa o do iRacing se ele tiver
      let deltaVal = null; let refTime = -1;
      if (own !== null) { deltaVal = own; refTime = this.ref.time; }
      else if (t.LapDeltaToBestLap_OK !== false && bestLap > 0 && !onPitRoad) { deltaVal = num(t.LapDeltaToBestLap, 0); refTime = bestLap; }
      // travou (mesmo valor por mais de 1,5 s): esconde em vez de mostrar um número parado
      if (deltaVal !== null) {
        const ds = this.deltaStale;
        if (ds && Math.abs(deltaVal - ds.v) < 0.0001) { if (sessionTime - ds.at > 1.5) deltaVal = null; }
        else this.deltaStale = { v: deltaVal, at: sessionTime };
      }
      const delta = {
        value: deltaVal,
        sessionOptimal,
        sessionBest,
        predicted: deltaVal !== null && refTime > 0 ? refTime + deltaVal : -1,
        personalBest,
        currentLap: num(t.LapCurrentLapTime, -1),
      };

      // ---------- sessão ----------
      const timeTotal = parseSeconds(cur.SessionTime);
      const session = {
        type: sessionType,
        name: cur.SessionName || sessionType,
        timeRemain: num(t.SessionTimeRemain, -1),
        timeTotal,
        lapsTotal: /^\d+$/.test(String(cur.SessionLaps)) ? parseInt(cur.SessionLaps, 10) : 0,
        lapsRemain: num(t.SessionLapsRemainEx, -1),
        lap: num(t.Lap, 0),
        trackName: weekend.TrackDisplayName || weekend.TrackName || '',
        trackTemp,
        airTemp: num(t.AirTemp, 0),
        fps: num(t.FrameRate, 0),
        isRace,
      };

      // ---------- painel ----------
      // temperatura de cada pneu: média da carcaça (esquerda/meio/direita), atualizada ao vivo
      const tireAvg = (k) => {
        const v = [t[k + 'tempCL'], t[k + 'tempCM'], t[k + 'tempCR']].filter((x) => typeof x === 'number' && isFinite(x) && x > 0);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      const panel = {
        tires: [tireAvg('LF'), tireAvg('RF'), tireAvg('LR'), tireAvg('RR')],
        gear: num(t.Gear, 0),
        rpm: num(t.RPM, 0),
        speedKmh: num(t.Speed, 0) * 3.6,
        pitLimiter: !!(num(t.EngineWarnings, 0) & ENGINE_PIT_LIMITER),
        position: player ? (player.displayPos || player.classPos || 0) : 0,
        bestLap: bestLap > 0 ? bestLap : (player ? player.best : -1),
        shift: {
          first: num(driverInfo.DriverCarSLFirstRPM, 0),
          shift: num(driverInfo.DriverCarSLShiftRPM, 0),
          last: num(driverInfo.DriverCarSLLastRPM, 0),
          blink: num(driverInfo.DriverCarSLBlinkRPM, 0),
          redline: num(driverInfo.DriverCarRedLine, 0),
        },
      };

      // ---------- combustível ----------
      const fuelPerLap = this.fuelLaps.length ? this.fuelLaps.reduce((a, b) => a + b, 0) / this.fuelLaps.length : -1;
      const timedSession = timeTotal > 0 && session.timeRemain >= 0 && session.timeRemain < 360000 && !session.lapsTotal;
      const refLap = (bestLap > 0 ? bestLap : (player && player.best > 0 ? player.best : (player ? player.classEstLap : 0))) || 0;
      const myPct = player && player.pct >= 0 ? player.pct : 0;
      let lapsToGo = -1;
      if (session.lapsTotal > 0 && player) lapsToGo = Math.max(0, session.lapsTotal - (player.lapsDone + myPct));
      else if (timedSession && refLap > 0) lapsToGo = Math.max(0, Math.ceil(session.timeRemain / refLap + myPct) - myPct);
      const maxFuel = num(driverInfo.DriverCarFuelMaxLtr, 0) * (num(driverInfo.DriverCarMaxFuelPct, 1) || 1);
      const fuelState = {
        level: fuel, max: maxFuel, perLap: fuelPerLap,
        lapsLeft: fuelPerLap > 0 && fuel >= 0 ? fuel / fuelPerLap : -1,
        lapsToGo,
        toFinish: fuelPerLap > 0 && lapsToGo >= 0 && fuel >= 0 ? fuel - lapsToGo * fuelPerLap : null, // + sobra / − falta
      };

      // ---------- pit ----------
      const pitLimitKmh = parsePitLimit(weekend.TrackPitSpeedLimit);
      const pit = { limiter: panel.pitLimiter, onPitRoad, speedKmh: panel.speedKmh, limitKmh: pitLimitKmh };

      // ---------- setores ao vivo do jogador ----------
      const live = pcar ? (pcar.secInfo || []).slice() : [];
      const lastSecs = pcar ? (pcar.secLast || []).slice() : [];
      const sinceLast = pcar && pcar.secLastAt >= 0 ? sessionTime - pcar.secLastAt : 1e9;
      const sectorState = {
        count: sectors.length,
        list: (!live.some(Boolean) && sinceLast < 6) ? lastSecs : live, // mostra a volta que acabou por 6 s
        best: pcar ? pcar.sectorsBest.slice() : [],
        currentLap: num(t.LapCurrentLapTime, -1),
        latest: null, // último setor completado (aparece por alguns segundos e some)
        now: sessionTime,
      };

      {
        let latest = null;
        for (const list of [live, lastSecs]) {
          list.forEach((x, k) => { if (x && x.at !== undefined && (!latest || x.at > latest.at)) latest = { ...x, k }; });
        }
        sectorState.latest = latest;
      }
      panel.tireProfile = tireProfileOf(player);

      return {
        connected: true,
        nowMs,
        profileKey: profileKeyOf(sessionType),
        fuel: fuelState,
        pit,
        sectors: sectorState,
        playerIdx,
        playerClassId: player ? player.classId : null,
        multiclass: classes.length > 1,
        sectorsCount: sectors.length,
        classes,
        relative,
        radar,
        flags: { list: flagList, primary, penalty, reason: this.pen.reason },
        incidents: { count: incidents, limit: incidentLimit },
        warning: this.warningOf(t, incidents, sessionTime, !isRace && (this.lapOffTrack || incidents > this.lapIncidentStart)),
        laps: { list: this.laps.slice(), best: logBest },
        delta,
        session,
        panel,
      };
    }

    // Avisos que o iRacing só manda no chat: saída de pista e incidente novo
    warningOf(t, incidents, now, lapInvalid) {
      const w = this.warn;
      const surf = num(t.PlayerTrackSurface, 3);
      const off = surf === 0 && !!t.IsOnTrack;
      if (off) w.offAt = now;
      if (w.incPrev === null || incidents < w.incPrev) w.incPrev = incidents;
      if (incidents > w.incPrev) { w.incDelta = incidents - w.incPrev; w.incAt = now; w.incPrev = incidents; }
      // só o aviso de volta inválida vai pra tela (incidentes já têm o overlay deles)
      if (lapInvalid && t.IsOnTrack) return { kind: 'lapInvalid', inc: 0, sticky: true };
      if (now - w.incAt < 5) {
        const k = { 1: 'offTrack', 2: 'lostControl', 4: 'contact' }[w.incDelta] || 'incident';
        return { kind: k, inc: w.incDelta };
      }
      if (off || now - w.offAt < 2) return { kind: 'offTrackNow', inc: 0 };
      // treino/quali: a volta não vale mais — fica avisando até cruzar a linha
      if (lapInvalid && t.IsOnTrack) return { kind: 'lapInvalid', inc: 0, sticky: true };
      return null;
    }

    // Grava a volta atual (fração da pista x tempo) e devolve o delta contra a referência.
    deltaTick(player, curTime, sessionTime, onPit) {
      if (!player || player.pct < 0) { this.trace = null; this.prevPct = -1; return null; }
      const pct = player.pct;
      if (this.prevPct >= 0 && pct < this.prevPct - 0.5) {
        // cruzou a linha: a volta gravada vira candidata a referência
        if (this.trace && this.trace.ok && this.trace.pts.length > 50 && this.trace.pts[0][0] < 0.03) this.candidate = this.trace;
        this.trace = { pts: [], ok: !onPit };
        // o tempo oficial pode ter chegado antes da fração zerar
        const rp = this.refPending; this.refPending = null;
        if (rp && sessionTime - rp.at < 5) this.adoptReference(rp.time, rp.invalid, sessionTime);
      } else if (this.trace && (pct - this.prevPct > 0.05 || pct < this.prevPct - 0.002)) {
        this.trace.ok = false; // pulou (reset, reboque) ou andou pra trás
      }
      if (onPit && this.trace) this.trace.ok = false;
      if (this.trace && curTime >= 0) {
        const pts = this.trace.pts;
        if (!pts.length || pct > pts[pts.length - 1][0]) pts.push([pct, curTime]);
      }
      this.prevPct = pct;
      // o relógio da volta parou de andar: trata como travado
      if (curTime !== this.lastCur) { this.lastCur = curTime; this.lastCurAt = sessionTime; }
      if (sessionTime - (this.lastCurAt || 0) > 1) return null;
      // volta "quebrada" (pit, reboque, rodou pra trás): não mostra delta até a próxima volta
      if (!this.ref || curTime < 0 || !this.trace || !this.trace.pts.length || !this.trace.ok || onPit) return null;
      return curTime - interpRef(this.ref.pts, pct, this.ref.time);
    }

    adoptReference(lapTime, invalid, now) {
      const c = this.candidate; this.candidate = null;
      if (!c) { this.refPending = { time: lapTime, invalid, at: now }; return; }
      if (invalid || !(lapTime > 0)) return;
      if (this.ref && lapTime >= this.ref.time) return;
      const last = c.pts[c.pts.length - 1];
      if (!last || last[0] < 0.97) return;
      this.ref = { pts: c.pts, time: lapTime };
    }

    // Rastreia a passagem de cada carro pelos pontos de setor pra calcular os tempos de setor de todos.
    trackCar(idx, pct, lapsDone, time, sectors, inPit, lastLap, nowMs) {
      let c = this.cars[idx];
      if (!c) {
        c = this.cars[idx] = {
          prevPct: pct, prevTime: time, prevLaps: lapsDone, prevLast: lastLap, crossTimes: [], valid: false,
          sectorsCur: [], sectorsLast: [], sectorsBest: [], lastLapAt: 0, secInfo: [], secLast: [], secLastAt: -1,
        };
        return c;
      }
      // o iRacing conta a volta um instante antes de publicar o tempo dela: só pisca quando o tempo novo chega
      if (lastLap > 0 && lastLap !== c.prevLast) c.lastLapAt = nowMs;
      // distância total percorrida (voltas + fração), sem pulos na linha de chegada
      if (pct >= 0 && lapsDone >= 0) {
        let prog = lapsDone + pct;
        if (c.prog !== undefined) {
          if (prog < c.prog - 0.5) prog += 1; // a fração zerou antes da contagem de voltas
          else if (prog > c.prog + 0.5) prog -= 1; // a contagem subiu antes da fração zerar
        }
        // tempo em que o carro passou por cada um dos 100 pontos da volta (pra calcular gap em segundos)
        const idx = Math.floor(prog * GAP_CP);
        if (c.cpIdx === undefined || idx < c.cpIdx - GAP_CP / 2 || idx > c.cpIdx + GAP_CP) {
          c.cpIdx = idx; c.cpt = new Map();
        } else if (idx > c.cpIdx && c.cpProg !== undefined) {
          for (let k = c.cpIdx + 1; k <= idx; k++) {
            const f = Math.min(1, Math.max(0, (k / GAP_CP - c.cpProg) / Math.max(1e-9, prog - c.cpProg)));
            c.cpt.set(k, c.prevTime + (time - c.prevTime) * f);
          }
          c.cpIdx = idx;
          if (c.cpt.size > GAP_CP * 3) for (const key of c.cpt.keys()) { if (key < idx - GAP_CP * 2.5) c.cpt.delete(key); else break; }
        }
        c.cpProg = prog;
        c.prog = prog;
      }
      c.prevLast = lastLap;
      c.prevLaps = lapsDone;
      if (pct < 0 || inPit) { c.valid = false; c.crossTimes = []; c.secInfo = []; c.prevPct = pct; c.prevTime = time; return c; }
      const prev = c.prevPct;
      const dt = time - c.prevTime;
      if (prev < 0 || dt <= 0 || dt > 2) { c.prevPct = pct; c.prevTime = time; c.valid = false; c.secInfo = []; return c; }
      let moved = pct - prev;
      const wrapped = moved < -0.5;
      if (wrapped) moved += 1;
      // online a posição dos carros "treme" um pouquinho pra trás: ignora a amostra em vez de perder a volta
      if (moved <= 0 && moved > -0.003) return c;
      if (moved < 0 || moved > 0.08) { c.prevPct = pct; c.prevTime = time; c.valid = false; c.secInfo = []; return c; }

      // fronteiras cruzadas nesse tick
      const crossings = [];
      for (let i = 0; i < sectors.length; i++) {
        const b = sectors[i];
        let hit = false; let frac = 0;
        if (!wrapped) { if (prev < b && pct >= b) { hit = true; frac = (b - prev) / moved; } }
        else {
          const b2 = b === 0 ? 1 : b;
          if (prev < b2 || pct >= b) {
            const target = (prev < b2) ? b2 : b + 1;
            if (target - prev <= moved + 1e-9) { hit = true; frac = (target - prev) / moved; }
          }
        }
        if (hit) crossings.push({ i, at: c.prevTime + dt * frac });
      }
      crossings.sort((a, b) => a.at - b.at);
      for (const x of crossings) {
        if (x.i === 0) {
          // linha de chegada: fecha a volta
          if (c.valid && c.lastCross && c.lastCross.i === sectors.length - 1) {
            const n = sectors.length - 1; const v = x.at - c.lastCross.at;
            c.sectorsCur[n] = v;
            c.secInfo[n] = { v, prevBest: c.sectorsBest[n] > 0 ? c.sectorsBest[n] : -1, at: x.at };
          }
          if (c.valid && c.sectorsCur.length === sectors.length && c.sectorsCur.every((v) => v > 0)) {
            c.sectorsLast = c.sectorsCur.slice();
            c.sectorsLastAt = x.at;
            c.secLast = c.secInfo.slice();
            c.secLastAt = x.at;
          }
          c.sectorsCur = [];
          c.secInfo = [];
          c.valid = true;
        } else if (c.lastCross && c.lastCross.i === x.i - 1 && c.valid) {
          const v = x.at - c.lastCross.at;
          c.sectorsCur[x.i - 1] = v;
          c.secInfo[x.i - 1] = { v, prevBest: c.sectorsBest[x.i - 1] > 0 ? c.sectorsBest[x.i - 1] : -1, at: x.at };
        }
        if (c.valid && x.i > 0 && c.sectorsCur[x.i - 1] > 0) {
          const v = c.sectorsCur[x.i - 1];
          if (!(c.sectorsBest[x.i - 1] > 0) || v < c.sectorsBest[x.i - 1]) c.sectorsBest[x.i - 1] = v;
        }
        if (x.i === 0 && c.sectorsLast.length) {
          const n = sectors.length - 1; const v = c.sectorsLast[n];
          if (v > 0 && (!(c.sectorsBest[n] > 0) || v < c.sectorsBest[n])) c.sectorsBest[n] = v;
        }
        c.lastCross = x;
      }
      // setores da volta atual aparecem assim que completados
      c.sectorsLive = c.sectorsCur.slice();
      c.prevPct = pct; c.prevTime = time;
      return c;
    }
  }

  const GAP_CP = 100;

  // estimativa de iRating (fórmula usada pela comunidade); positions = posição na classe (1 = primeiro)
  function iratingDeltas(list) {
    const n = list.length;
    if (n < 2) return list.map(() => null);
    const BR1 = 1600 / Math.LN2;
    const ir = list.map((d) => (d.irating > 0 ? d.irating : 1350));
    const e = ir.map((r) => Math.exp(-r / BR1));
    const chance = (a, b) => ((1 - e[a]) * e[b]) / ((1 - e[b]) * e[a] + (1 - e[a]) * e[b]);
    return list.map((d, i) => {
      let expected = -0.5;
      for (let j = 0; j < n; j++) expected += chance(i, j);
      const p = i + 1;
      const fudge = (n / 2 - p) / 100;
      return Math.round(((n - p - expected - fudge) * 200) / n);
    });
  }

  function slimDriver(d) {
    return {
      idx: d.idx, name: d.name, number: d.number, carName: d.carName, classColor: d.classColor,
      irating: d.irating, licClass: d.licClass, licSr: d.licSr, pos: d.displayPos,
      best: d.best, last: d.last, lastLapAt: d.lastLapAt,
      sectorsLast: d.sectorsLast.slice(), sectorsBest: d.sectorsBest.slice(),
      onPit: d.onPit, isPlayer: d.isPlayer, lapsDone: d.lapsDone,
      gap: d.gap === undefined ? null : d.gap, gapLaps: d.gapLaps || 0, irDelta: d.irDelta === undefined ? null : d.irDelta,
    };
  }

  return { StateBuilder, FLAG, parseTrackLengthM, shortLicense, sofOf, profileKeyOf, tireProfileOf };
}));
