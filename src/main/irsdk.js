// Leitura da memória compartilhada do iRacing (iRacing SDK) usando koffi.
// Só funciona no Windows. Em outros sistemas, isAvailable() retorna false.
'use strict';

const yaml = require('js-yaml');

const MEM_NAME = 'Local\\IRSDKMemMapFileName';
const FILE_MAP_READ = 0x0004;
const HEADER_SIZE = 112; // 12 ints + 4 varBuf de 16 bytes
const VAR_HEADER_SIZE = 144;
const ST_CONNECTED = 1;

const TYPE_SIZE = { 0: 1, 1: 1, 2: 4, 3: 4, 4: 4, 5: 8 };

let k32 = null;
let api = null;

function loadApi() {
  if (api !== null) return api;
  if (process.platform !== 'win32') { api = false; return api; }
  try {
    const koffi = require('koffi');
    k32 = koffi.load('kernel32.dll');
    api = {
      OpenFileMappingW: k32.func('uintptr_t __stdcall OpenFileMappingW(uint32_t access, bool inherit, const char16_t *name)'),
      MapViewOfFile: k32.func('uintptr_t __stdcall MapViewOfFile(uintptr_t h, uint32_t access, uint32_t hi, uint32_t lo, size_t bytes)'),
      UnmapViewOfFile: k32.func('bool __stdcall UnmapViewOfFile(uintptr_t addr)'),
      CloseHandle: k32.func('bool __stdcall CloseHandle(uintptr_t h)'),
      RtlMoveMemory: k32.func('void __stdcall RtlMoveMemory(_Out_ uint8_t *dst, uintptr_t src, size_t len)'),
    };
  } catch (e) {
    console.error('koffi indisponível:', e.message);
    api = false;
  }
  return api;
}

// iRacing manda YAML com alguns valores sem aspas que quebram o parser (ex.: nomes com ":").
function sanitizeYaml(text) {
  return text.split('\n').map((line) => {
    const m = line.match(/^(\s*(?:-\s+)?)([A-Za-z0-9_]+):\s(.+)$/);
    if (!m) return line;
    const value = m[3].trimEnd();
    if (/^['"]/.test(value)) return line;
    if (/[:#{}\[\]&*!|>%@`,]/.test(value) || /^[-?]/.test(value)) {
      return `${m[1]}${m[2]}: '${value.replace(/'/g, "''")}'`;
    }
    return line;
  }).join('\n');
}

function parseSessionYaml(text) {
  try {
    return yaml.load(sanitizeYaml(text), { json: true }) || {};
  } catch (e) {
    console.error('Falha ao ler YAML da sessão:', e.message);
    return {};
  }
}

class IRacingReader {
  constructor() {
    this.handle = 0;
    this.base = 0n;
    this.vars = null; // nome -> {type, offset, count}
    this.varHeaderSignature = '';
    this.lastSessionUpdate = -1;
    this.session = {};
    this.lastTick = -1;
  }

  static isAvailable() { return !!loadApi(); }

  read(offset, len) {
    const buf = Buffer.alloc(len);
    api.RtlMoveMemory(buf, this.base + BigInt(offset), len);
    return buf;
  }

  connect() {
    if (!loadApi()) return false;
    if (this.handle) return true;
    const h = api.OpenFileMappingW(FILE_MAP_READ, false, MEM_NAME);
    if (!h) return false;
    const base = api.MapViewOfFile(h, FILE_MAP_READ, 0, 0, 0);
    if (!base) { api.CloseHandle(h); return false; }
    this.handle = h;
    this.base = BigInt(base);
    this.vars = null;
    this.lastSessionUpdate = -1;
    return true;
  }

  disconnect() {
    if (!this.handle) return;
    try { api.UnmapViewOfFile(this.base); api.CloseHandle(this.handle); } catch (e) { /* ignora */ }
    this.handle = 0; this.base = 0n; this.vars = null;
  }

  // Retorna { connected, telemetry, session, sessionChanged } ou null se o iRacing não estiver aberto.
  poll() {
    if (!this.connect()) return null;
    const h = this.read(0, HEADER_SIZE);
    const status = h.readInt32LE(4);
    if (!(status & ST_CONNECTED)) {
      return { connected: false };
    }
    const sessionInfoUpdate = h.readInt32LE(12);
    const sessionInfoLen = h.readInt32LE(16);
    const sessionInfoOffset = h.readInt32LE(20);
    const numVars = h.readInt32LE(24);
    const varHeaderOffset = h.readInt32LE(28);
    const numBuf = h.readInt32LE(32);
    const bufLen = h.readInt32LE(36);

    const sig = `${numVars}:${varHeaderOffset}`;
    if (!this.vars || sig !== this.varHeaderSignature) {
      this.vars = {};
      const vh = this.read(varHeaderOffset, numVars * VAR_HEADER_SIZE);
      for (let i = 0; i < numVars; i++) {
        const o = i * VAR_HEADER_SIZE;
        const type = vh.readInt32LE(o);
        const offset = vh.readInt32LE(o + 4);
        const count = vh.readInt32LE(o + 8);
        const name = vh.toString('latin1', o + 16, o + 48).replace(/\0.*$/, '');
        this.vars[name] = { type, offset, count };
      }
      this.varHeaderSignature = sig;
    }

    let sessionChanged = false;
    if (sessionInfoUpdate !== this.lastSessionUpdate) {
      const raw = this.read(sessionInfoOffset, sessionInfoLen).toString('latin1').replace(/\0.*$/s, '');
      this.session = parseSessionYaml(raw);
      this.lastSessionUpdate = sessionInfoUpdate;
      sessionChanged = true;
    }

    // Escolhe o buffer com o maior tickCount (o mais recente).
    let best = 0; let bestTick = -1;
    for (let i = 0; i < numBuf; i++) {
      const tick = h.readInt32LE(48 + i * 16);
      if (tick > bestTick) { bestTick = tick; best = i; }
    }
    const bufOffset = h.readInt32LE(48 + best * 16 + 4);
    const data = this.read(bufOffset, bufLen);

    const telemetry = {};
    for (const [name, v] of Object.entries(this.vars)) {
      telemetry[name] = readVar(data, v);
    }
    return { connected: true, tick: bestTick, telemetry, session: this.session, sessionChanged };
  }
}

function readOne(buf, type, off) {
  switch (type) {
    case 0: return buf.readUInt8(off);
    case 1: return buf.readUInt8(off) !== 0;
    case 2: return buf.readInt32LE(off);
    case 3: return buf.readUInt32LE(off);
    case 4: return buf.readFloatLE(off);
    case 5: return buf.readDoubleLE(off);
    default: return null;
  }
}

function readVar(buf, v) {
  const size = TYPE_SIZE[v.type] || 4;
  if (v.count <= 1) return readOne(buf, v.type, v.offset);
  const arr = new Array(v.count);
  for (let i = 0; i < v.count; i++) arr[i] = readOne(buf, v.type, v.offset + i * size);
  return arr;
}

// Título da janela que está na frente (pra saber se o jogo está em primeiro plano).
let user32 = null;
function foregroundTitle() {
  if (process.platform !== 'win32') return null;
  try {
    if (!user32) {
      const koffi = require('koffi');
      const lib = koffi.load('user32.dll');
      user32 = {
        GetForegroundWindow: lib.func('uintptr_t __stdcall GetForegroundWindow()'),
        GetWindowTextW: lib.func('int __stdcall GetWindowTextW(uintptr_t hwnd, _Out_ uint8_t *buf, int max)'),
      };
    }
    const h = user32.GetForegroundWindow();
    if (!h) return '';
    const buf = Buffer.alloc(512);
    const n = user32.GetWindowTextW(h, buf, 256);
    return buf.toString('utf16le', 0, Math.max(0, n) * 2);
  } catch (e) { return null; }
}

module.exports = { IRacingReader, parseSessionYaml, sanitizeYaml, foregroundTitle };
