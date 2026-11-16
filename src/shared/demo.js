// Gera telemetria falsa no mesmo formato do iRacing, pra testar e posicionar os overlays sem o jogo aberto.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OverlayDemo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NAMES = [
    'Lucas Almeida', 'Rafael Souza', 'Max Verhagen', 'Tom Becker', 'Diego Ramos', 'Player iRacing',
    'Pedro Lima', 'Jonas Weber', 'Mateo Garcia', 'Bruno Costa', 'Felipe Rocha', 'Andre Silva',
    'Luca Rossi', 'Kenji Sato', 'Oliver Hart', 'Nico Brandt', 'Henrique Dias', 'Sam Turner',
    'Ivan Petrov', 'Leo Martins', 'Arthur Nunes', 'Gabriel Moura',
  ];
  const GT3 = ['Porsche 911 GT3 R (992)', 'BMW M4 GT3', 'Ferrari 296 GT3', 'Mercedes-AMG GT3 2020', 'Audi R8 LMS EVO II GT3', 'Lamborghini Huracan GT3 EVO', 'McLaren 720S GT3 EVO', 'Ford Mustang GT3', 'Aston Martin Vantage GT3 EVO', 'Chevrolet Corvette Z06 GT3.R'];
  const GTP = ['Porsche 963 GTP', 'BMW M Hybrid V8', 'Cadillac V-Series.R GTP', 'Acura ARX-06 GTP'];
  const LICS = ['A 3.41', 'B 2.87', 'A 4.12', 'C 3.05', 'B 4.20', 'A 2.80', 'B 3.33', 'A 1.95', 'C 2.10', 'D 3.70', 'Pro 4.99'];

  class Demo {
    constructor() {
      this.t0 = 0;
      this.time = 1800;
      this.trackLen = 5263;
      this.cars = [];
      const n = NAMES.length;
      for (let i = 0; i < n; i++) {
        const gtp = i >= n - 6;
        const base = gtp ? 98 : 106.5;
        this.cars.push({
          idx: i,
          name: NAMES[i],
          gtp,
          car: gtp ? GTP[i % GTP.length] : GT3[i % GT3.length],
          lapTime: base + (i % 9) * 0.35 + (gtp ? 0 : 0.2),
          dist: 12 - i * 0.03 - (gtp ? 0.02 : 0) + (i === 5 ? 0.004 : 0),
          best: -1, last: -1, ir: 1400 + ((i * 397) % 2600), lic: LICS[i % LICS.length],
          pit: i === 11,
        });
      }
      this.player = 5;
      this.incidents = 4;
      this.lapsLog = [];
      this.playerLastShown = -1; // simula o atraso do iRacing pra publicar o tempo da volta
      this.playerLastAt = 0;
    }

    step(dt) {
      this.time += dt;
      for (const c of this.cars) {
        const wobble = 1 + Math.sin(this.time / 7 + c.idx) * 0.01;
        const before = Math.floor(c.dist);
        if (!c.pit) c.dist += dt / (c.lapTime * wobble);
        if (Math.floor(c.dist) > before) {
          c.last = c.lapTime * (1 + Math.sin(c.idx * 3 + this.time) * 0.004);
          if (c.best < 0 || c.last < c.best) c.best = c.last;
        }
      }
      // mantém um carro grudado do lado do jogador pra mostrar o radar
      const p = this.cars[this.player];
      if (p.last !== this.playerLastReal) { this.playerLastReal = p.last; this.playerLastAt = this.time; }
      if (this.time - this.playerLastAt > 0.8) this.playerLastShown = p.last;
      const side = this.cars[4];
      const phase = (this.time % 20) / 20;
      side.dist = p.dist + (phase < 0.5 ? (Math.sin(this.time) * 3) / this.trackLen : 30 / this.trackLen);
      const behind = this.cars[6];
      behind.dist = p.dist - (8 + Math.sin(this.time / 2) * 3) / this.trackLen;
    }

    telemetry() {
      const n = 64;
      const pct = new Array(n).fill(-1); const lap = new Array(n).fill(-1); const lapc = new Array(n).fill(-1);
      const pos = new Array(n).fill(0); const cpos = new Array(n).fill(0); const last = new Array(n).fill(-1);
      const best = new Array(n).fill(-1); const pit = new Array(n).fill(false); const surf = new Array(n).fill(-1);
      const sorted = this.cars.slice().sort((a, b) => b.dist - a.dist);
      const classCount = { 0: 0, 1: 0 };
      sorted.forEach((c, i) => {
        pos[c.idx] = i + 1;
        const k = c.gtp ? 1 : 0; classCount[k] += 1; cpos[c.idx] = classCount[k];
      });
      for (const c of this.cars) {
        pct[c.idx] = c.dist - Math.floor(c.dist);
        lap[c.idx] = Math.floor(c.dist) + 1;
        lapc[c.idx] = Math.floor(c.dist);
        last[c.idx] = c.last; best[c.idx] = c.best; pit[c.idx] = c.pit; surf[c.idx] = c.pit ? 1 : 3;
      }
      const p = this.cars[this.player];
      const rel = this.cars[4].dist - p.dist;
      const sideNow = Math.abs(rel * this.trackLen) < 5;
      const cyc = (this.time % 40);
      let flags = 0x4;
      if (cyc > 10 && cyc < 18) flags = 0x8;
      if (cyc > 25 && cyc < 32) flags = 0x20;
      if (cyc > 32 && cyc < 38) flags |= 0x10000;
      const rpmPhase = (this.time % 6) / 6;
      const rpm = 4200 + rpmPhase * 4300;
      return {
        SessionNum: 2, SessionTime: this.time, SessionTimeRemain: Math.max(0, 2700 - this.time),
        SessionLapsRemainEx: 32767, SessionFlags: flags, PlayerCarIdx: this.player,
        CarIdxLapDistPct: pct, CarIdxLap: lap, CarIdxLapCompleted: lapc, CarIdxPosition: pos,
        CarIdxClassPosition: cpos, CarIdxLastLapTime: last, CarIdxBestLapTime: best,
        CarIdxOnPitRoad: pit, CarIdxTrackSurface: surf,
        CarLeftRight: sideNow ? (rel >= 0 ? 3 : 3) : 1,
        Lap: lap[this.player], LapCompleted: lapc[this.player], LapLastLapTime: this.playerLastShown, LapBestLapTime: p.best,
        LapCurrentLapTime: (p.dist - Math.floor(p.dist)) * p.lapTime * (1 + Math.sin(this.time / 9) * 0.006), SessionState: 4,
        LapDeltaToBestLap: Math.sin(this.time / 3) * 0.6, LapDeltaToBestLap_OK: true,
        PlayerCarMyIncidentCount: this.incidents, PlayerTrackSurface: 3,
        Gear: 3 + Math.floor(rpmPhase * 3), RPM: rpm, Speed: (150 + rpmPhase * 90) / 3.6,
        EngineWarnings: cyc > 18 && cyc < 24 ? 0x10 : 0,
        FuelLevel: Math.max(2, 58 - (p.dist - 11.8) * 2.46), IsOnTrack: true,
        TrackTempCrew: 31.4,
        LFtempCL: 84, LFtempCM: 88, LFtempCR: 91, RFtempCL: 99, RFtempCM: 103, RFtempCR: 106,
        LRtempCL: 72, LRtempCM: 75, LRtempCR: 77, RRtempCL: 52, RRtempCM: 55, RRtempCR: 57, AirTemp: 24.2, FrameRate: 142 + Math.round(Math.sin(this.time) * 6),
      };
    }

    session() {
      const drivers = this.cars.map((c) => ({
        CarIdx: c.idx, UserName: c.name, AbbrevName: c.name, CarNumber: String(10 + c.idx * 3),
        CarClassID: c.gtp ? 4029 : 2708, CarClassShortName: c.gtp ? 'GTP' : 'GT3',
        CarClassColor: c.gtp ? '0xffda59' : '0x33ceff', CarClassRelSpeed: c.gtp ? 100 : 82,
        CarClassEstLapTime: c.gtp ? 98.5 : 107.1, CarScreenName: c.car, CarPath: c.car.toLowerCase().replace(/\W+/g, ''),
        IRating: c.ir, LicString: c.lic, IsSpectator: 0, CarIsPaceCar: 0,
      }));
      return {
        WeekendInfo: { TrackName: 'virginia', TrackDisplayName: 'Virginia International Raceway', TrackLength: '5.26 km', TrackID: 236, TrackPitSpeedLimit: '72.00 kph', WeekendOptions: { IncidentLimit: '25' } },
        SessionInfo: { Sessions: [
          { SessionNum: 0, SessionType: 'Practice', SessionName: 'PRACTICE', SessionLaps: 'unlimited', SessionTime: '1800.0000 sec' },
          { SessionNum: 1, SessionType: 'Lone Qualify', SessionName: 'QUALIFY', SessionLaps: '2', SessionTime: '600.0000 sec' },
          { SessionNum: 2, SessionType: 'Race', SessionName: 'RACE', SessionLaps: 'unlimited', SessionTime: '2700.0000 sec' },
        ] },
        SplitTimeInfo: { Sectors: [{ SectorNum: 0, SectorStartPct: 0 }, { SectorNum: 1, SectorStartPct: 0.33 }, { SectorNum: 2, SectorStartPct: 0.67 }] },
        DriverInfo: {
          DriverCarIdx: this.player, DriverCarRedLine: 8800, DriverCarSLFirstRPM: 6500,
          DriverCarSLShiftRPM: 8000, DriverCarSLLastRPM: 8300, DriverCarSLBlinkRPM: 8500, DriverCarFuelMaxLtr: 100, DriverCarMaxFuelPct: 1, Drivers: drivers,
        },
      };
    }
  }

  return { Demo };
}));
