// Синтез фоновой музыки: «Happy Birthday to You» (мелодия — общественное достояние), вальс 3/4.
// Всё синтезируется кодом: музыкальная шкатулка, арфа (Karplus–Strong), мягкое пианино, целеста, глокеншпиль, пэд и реверберация.
// Сторонних записей и сэмплов нет.
//
// Как получить audio/music.mp3 (нужны Node.js и ffmpeg):
//   node tools/make-happy-birthday.mjs happy.wav
//   ffmpeg -i happy.wav -af "loudnorm=I=-29:TP=-1.5:LRA=9,afade=t=in:st=0:d=0.8,afade=t=out:st=122.4:d=3.6" -c:a libmp3lame -b:a 128k audio/music.mp3
// Темп, тональности, тембры и порядок «кругов» — в блоке «партитура» ниже (BPM, ROUNDS).
// MELODY_ONLY=1 — отрисовать только мелодию (для проверки высоты нот).
import fs from 'node:fs';

const SR = 44100, TAU = Math.PI * 2;
const OUT = process.argv[2] || 'happy-birthday.wav';
const MELODY_ONLY = process.env.MELODY_ONLY === '1';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let seed = 20260921;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };   // детерминированный ГСЧ

/* ───────── партитура ───────── */
const BPM = 108;
const INTRO = 3, CYCLE = 24, OUTRO = 10;                 // доли
const ROUNDS = [                                          // key — сдвиг тональности в полутонах
  { key: 0, mel: 'box',   oct: 12, dbl: null,                        acc: 'none',  pad: 0.10 },
  { key: 0, mel: 'box',   oct: 12, dbl: null,                        acc: 'waltz', pad: 0.14 },
  { key: 0, mel: 'piano', oct: 0,  dbl: null,                        acc: 'arp',   pad: 0.18 },
  { key: 2, mel: 'piano', oct: 0,  dbl: { i: 'glock', oct: 12 },     acc: 'waltz', pad: 0.22 },
  { key: 2, mel: 'box',   oct: 12, dbl: { i: 'celesta', oct: 0 },    acc: 'arp',   pad: 0.22 },
  { key: 4, mel: 'piano', oct: 0,  dbl: { i: 'glock', oct: 12 },     acc: 'waltz', pad: 0.26 },
  { key: 4, mel: 'piano', oct: 0,  dbl: { i: 'glock', oct: 12 },     acc: 'arp',   pad: 0.28 },
  { key: 0, mel: 'box',   oct: 12, dbl: { i: 'celesta', oct: 0 },    acc: 'arp',   pad: 0.24 }
];
const nR = ROUNDS.length;
const endBeat = INTRO + CYCLE * nR;
const totalBeats = endBeat + OUTRO;

// мелодия (до мажор): [доля от начала цикла, длительность в долях, нота MIDI]; G4=67, A4=69, B4=71, C5=72 ...
const MEL = [
  [0, 1, 69], [1, 1, 67], [2, 1, 72],
  [3, 2, 71], [5, .75, 67], [5.75, .25, 67],
  [6, 1, 69], [7, 1, 67], [8, 1, 74],
  [9, 2, 72], [11, .75, 67], [11.75, .25, 67],
  [12, 1, 79], [13, 1, 76], [14, 1, 72],
  [15, 1, 71], [16, 1, 69], [17, .75, 77], [17.75, .25, 77],
  [18, 1, 76], [19, 1, 72], [20, 1, 74],
  [21, 2, 72]
];
const PICKUP = [[-1, .75, 67], [-.25, .25, 67]];           // затакт следующего цикла (в тональности этого цикла)
const HARM = [['I', 'I'], ['V7', 'V7'], ['V7', 'V7'], ['I', 'I'], ['I', 'I'], ['V7', 'V7'], ['I', 'V7'], ['I', 'NEXT']];

/* ───────── темп: ритардандо в конце ───────── */
const STEP = 48;
const tempoAt = b => {
  const r0 = INTRO + CYCLE * (nR - 1);
  if (b < r0) return BPM;
  const x = clamp((b - r0) / (CYCLE + 3), 0, 1);
  return BPM - (BPM - 72) * x * x * (3 - 2 * x);
};
const table = new Float64Array(Math.ceil(totalBeats * STEP) + 3);
for (let i = 1; i < table.length; i++) table[i] = table[i - 1] + 60 / tempoAt((i - 0.5) / STEP) / STEP;
const T = beat => { const x = Math.max(0, beat) * STEP, i = Math.floor(x); return table[i] + (table[Math.min(i + 1, table.length - 1)] - table[i]) * (x - i); };

const NS = Math.ceil((T(totalBeats) + 7) * SR);
const L = new Float32Array(NS), R = new Float32Array(NS);
function put(sig, t, gain, pan = 0.5) {
  const s = Math.max(0, Math.round(t * SR)), gl = gain * Math.cos(pan * Math.PI / 2), gr = gain * Math.sin(pan * Math.PI / 2);
  for (let i = 0; i < sig.length && s + i < NS; i++) { L[s + i] += sig[i] * gl; R[s + i] += sig[i] * gr; }
}
function putStereo(a, b, t, gain) {
  const s = Math.max(0, Math.round(t * SR));
  for (let i = 0; i < a.length && s + i < NS; i++) { L[s + i] += a[i] * gain; R[s + i] += b[i] * gain; }
}

/* ───────── тембры ───────── */
const fade = (i, n, a = 0.0015 * SR, r = 0.07 * SR) => Math.min(1, i / a) * Math.min(1, (n - i) / r);

// Музыкальная шкатулка, целеста, глокеншпиль: набор частичных [отношение частоты, амплитуда, время затухания, с]
const PARTS = {
  box:     [[1, 1, 1.4], [2, .34, .8], [3, .15, .5], [6.27, .10, .25], [4.07, .05, .3]],
  celesta: [[1, 1, 1.1], [2, .20, .6], [4, .11, .35], [8, .04, .2]],
  glock:   [[1, 1, 0.9], [2.76, .5, .5], [5.4, .25, .3], [8.93, .12, .2]]
};
function bell(kind, f, len, vel) {
  const P = PARTS[kind], ring = clamp(len * 1.5 + 0.5, 1.0, 3.4), n = Math.floor(ring * SR);
  const out = new Float32Array(n), k = Math.pow(440 / f, 0.3), norm = 1 / P.reduce((s, p) => s + p[1], 0);
  for (const [r, a, tau] of P) {
    if (f * r > 14000) continue;
    const w = TAU * f * r / SR, dec = Math.exp(-1 / (SR * tau * k));
    let d = a * norm * vel;
    for (let i = 0; i < n; i++) { out[i] += d * Math.sin(w * i); d *= dec; }
  }
  const dampAt = Math.floor(Math.max(len * 1.1, 0.25) * SR), dl = Math.floor(0.35 * SR), c = cal[kind] || 1;
  for (let i = 0; i < n; i++) out[i] *= fade(i, n) * (i > dampAt ? Math.max(0, 1 - (i - dampAt) / dl) : 1) * c;
  return out;
}

function piano(f, len, vel) {
  const tau0 = clamp(3.4 * Math.pow(261.6 / f, 0.55), 0.7, 5), ring = clamp(len * 1.25 + 0.5, 0.9, 3.6);
  const n = Math.floor(ring * SR), out = new Float32Array(n), B = 0.00035 * Math.pow(f / 261.6, 1.6);
  const amps = []; for (let h = 1; h <= 16; h++) amps.push((1 / Math.pow(h, 0.9)) * (0.35 + 0.65 * Math.abs(Math.sin(Math.PI * h * 0.125))));
  const norm = 1 / amps.reduce((s, a) => s + a, 0);
  for (let h = 1; h <= 16; h++) {
    const fr = f * h * Math.sqrt(1 + B * h * h);
    if (fr > 12000) break;
    const dec = Math.exp(-1 / (SR * tau0 / (1 + 0.5 * (h - 1))));
    const w1 = TAU * fr / SR, w2 = w1 * 1.0004;               // две «струны» чуть врозь — живее звук
    let d = amps[h - 1] * norm * vel * 0.5;
    for (let i = 0; i < n; i++) { out[i] += d * (Math.sin(w1 * i) + Math.sin(w2 * i + 0.7)); d *= dec; }
  }
  let lp = 0;                                                  // стук молоточка
  for (let i = 0; i < 0.02 * SR && i < n; i++) { lp += ((rnd() * 2 - 1) - lp) * 0.25; out[i] += lp * 0.10 * vel * Math.exp(-i / (0.004 * SR)); }
  const damp = Math.floor(clamp(len * 1.05, 0.15, ring - 0.3) * SR), dl = Math.floor(0.22 * SR);
  for (let i = 0; i < n; i++) {
    let e = Math.min(1, i / (0.0015 * SR));
    if (i > damp) e *= Math.max(0, 1 - (i - damp) / dl);
    out[i] *= e * (cal.piano || 1);
  }
  return out;
}

function pluck(f, len, vel, bright = 0.55) {                  // арфа/гитара: Karplus–Strong с дробной задержкой
  const ring = clamp(len * 1.8 + 0.6, 0.9, 3.2), n = Math.floor(ring * SR), N = SR / f, y = new Float32Array(n);
  const m = Math.ceil(N) + 2; let prev = 0, mean = 0;
  for (let i = 0; i < m; i++) { prev += ((rnd() * 2 - 1) - prev) * bright; y[i] = prev; mean += prev; }
  mean /= m; let rms = 0; for (let i = 0; i < m; i++) { y[i] -= mean; rms += y[i] * y[i]; }
  const sc = 0.32 * vel / Math.sqrt(rms / m + 1e-9); for (let i = 0; i < m; i++) y[i] *= sc;
  const g = 0.9986 - 0.0006 * (f / 440);
  for (let i = m; i < n; i++) {
    const p = i - N, i0 = Math.floor(p), fr = p - i0;
    const a = y[i0] * (1 - fr) + y[i0 + 1] * fr, b = y[i0 - 1] * (1 - fr) + y[i0] * fr;
    y[i] = g * 0.5 * (a + b);
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = y[i] * fade(i, n, 0.001 * SR, 0.12 * SR) * (cal.pluck || 1);
  return out;
}

function bass(f, vel) {
  const n = Math.floor(1.1 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = Math.min(1, t / 0.006) * Math.exp(-t / 0.5);
    out[i] = vel * 0.55 * e * (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.22));
  }
  for (let i = 0; i < n; i++) out[i] *= fade(i, n, 1, 0.08 * SR) * (cal.bass || 1);
  return out;
}

function pad(freqs, len, vel) {                               // мягкий «струнный» пэд: гармоники + хорус слева/справа
  const a = 0.38 * SR, r = 0.7 * SR, n = Math.floor(len * SR + r), oL = new Float32Array(n), oR = new Float32Array(n);
  const H = 9, norm = 1 / (freqs.length * 2 * Math.pow(H, 0.3));
  freqs.forEach((f, fi) => [-1, 1].forEach((side, si) => {
    const det = Math.pow(2, side * 4 / 1200);
    for (let h = 1; h <= H; h++) {
      const fr = f * det * h; if (fr > 3200) break;
      const w = TAU * fr / SR, amp = norm * vel / Math.pow(h, 1.25), ph = fi * 1.3 + si;
      const out = si ? oR : oL, cross = si ? oL : oR;
      for (let i = 0; i < n; i++) { const s = amp * Math.sin(w * i + ph); out[i] += s * 0.75; cross[i] += s * 0.25; }
    }
  }));
  for (let i = 0; i < n; i++) {
    const e = Math.min(1, i / a), rel = Math.min(1, (n - i) / r), env = (0.5 - 0.5 * Math.cos(Math.PI * e)) * (0.5 - 0.5 * Math.cos(Math.PI * rel));
    oL[i] *= env * (cal.pad || 1); oR[i] *= env * (cal.pad || 1);
  }
  return [oL, oR];
}

/* ───────── калибровка: все тембры звучат одинаково громко при vel = 1 ───────── */
const cal = {};
{
  const rmsOf = (sig, a = 0, b = 0.3) => { let e = 0, c = 0; for (let i = Math.floor(a * SR); i < Math.min(sig.length, Math.floor(b * SR)); i++) { e += sig[i] * sig[i]; c++; } return Math.sqrt(e / c); };
  const REF = 0.1, probe = { box: () => bell('box', 660, 0.5, 1), celesta: () => bell('celesta', 660, 0.5, 1), glock: () => bell('glock', 1320, 0.5, 1),
    piano: () => piano(392, 0.5, 1), pluck: () => pluck(262, 0.5, 1), bass: () => bass(98, 1), pad: () => pad([196, 247, 294], 2, 1)[0] };
  for (const k of Object.keys(probe)) { const sig = probe[k](); cal[k] = REF / (k === 'pad' ? rmsOf(sig, 0.8, 1.6) : rmsOf(sig)); }
  console.log('калибровка:', Object.entries(cal).map(([k, v]) => k + '=' + v.toFixed(2)).join(' '));
}

/* ───────── гармония ───────── */
const chordFor = (r, bar, beat) => {
  const key = ROUNDS[r].key, next = r + 1 < nR ? ROUNDS[r + 1].key : null, name = HARM[bar][beat < 2 ? 0 : 1];
  if (name === 'V7') return { root: (key + 7) % 12, q: 'dom7' };
  if (name === 'NEXT' && next !== null) return { root: (next + 7) % 12, q: 'dom7' };
  return { root: key % 12, q: 'maj' };
};
const voicing = ch => {
  const pcs = [ch.root, (ch.root + 4) % 12, (ch.root + 7) % 12];
  if (ch.q === 'dom7') pcs.push((ch.root + 10) % 12);
  const up = ch.q === 'dom7' ? pcs.slice(1) : pcs;
  return up.map(pc => 55 + ((pc - 55) % 12 + 12) % 12).sort((a, b) => a - b);
};
const bassOf = ch => 40 + ((ch.root - 40) % 12 + 12) % 12;
const same = (a, b) => a.root === b.root && a.q === b.q;

/* ───────── исполнение ───────── */
const melodyLog = [];
const jit = s => (rnd() - 0.5) * 2 * s;
function melodyNote(inst, beat, len, midi, vel, r, gain, pan) {
  const t = T(beat) + jit(0.003), d = T(beat + len) - T(beat), f = hz(midi);
  const sig = inst === 'piano' ? piano(f, d, vel) : bell(inst, f, d, vel);
  put(sig, t, gain, pan);
}

for (let r = 0; r < nR; r++) {
  const cfg = ROUNDS[r], B = INTRO + CYCLE * r, last = r === nR - 1;
  const notes = PICKUP.concat(MEL.map(n => n.slice()));
  if (last) notes[notes.length - 1] = [21, 3, 72];
  for (const [o, l, m0] of notes) {
    const down = o >= 0 && (o % 3 === 0);
    const vel = (o < 0 ? 0.78 : down ? 1.0 : 0.88) * (1 + jit(0.05)), midi = m0 + cfg.key + cfg.oct;
    melodyLog.push({ t: T(B + o), d: T(B + o + l) - T(B + o), midi, r });
    melodyNote(cfg.mel, B + o, l * 0.97, midi, vel, r, 1.0, 0.5);
    if (!MELODY_ONLY && cfg.dbl) melodyNote(cfg.dbl.i, B + o, l * 0.9, m0 + cfg.key + cfg.dbl.oct, vel * 0.55, r, cfg.dbl.i === 'glock' ? 0.45 : 0.55, cfg.dbl.i === 'glock' ? 0.62 : 0.4);
  }
  if (MELODY_ONLY) continue;

  for (let bar = 0; bar < 8; bar++) {                        // сопровождение и пэд
    const b0 = B + bar * 3, c0 = chordFor(r, bar, 0), c2 = chordFor(r, bar, 2);
    if (cfg.acc === 'waltz') {
      put(bass(hz(bassOf(c0)), 0.9), T(b0) + jit(0.006), 0.55, 0.5);
      for (let beat = 1; beat <= 2; beat++) {
        const v = voicing(chordFor(r, bar, beat));
        v.forEach((m, k) => put(pluck(hz(m), 0.5, 0.55, 0.5), T(b0 + beat) + k * 0.011 + jit(0.006), 0.36, 0.38 + k * 0.06));
      }
    } else if (cfg.acc === 'arp') {
      for (let i = 0; i < 6; i++) {
        const ch = chordFor(r, bar, Math.floor(i / 2)), v = voicing(ch), t = T(b0 + i * 0.5) + jit(0.006);
        if (i === 0) put(pluck(hz(bassOf(ch)), 0.6, 0.75, 0.35), t, 0.42, 0.45);
        else put(pluck(hz(v[[0, 0, 1, 2, 1, 0][i]] + 12), 0.4, 0.5, 0.6), t, 0.45, 0.34 + 0.06 * (i % 3));
      }
    } else if (bar % 2 === 0) {
      put(bass(hz(bassOf(c0)), 0.55), T(b0) + jit(0.006), 0.45, 0.5);
    }
    const segs = same(c0, c2) ? [[0, 3, c0]] : [[0, 2, c0], [2, 1, c2]];
    for (const [s0, sl, ch] of segs) {
      const notesP = [bassOf(ch) + 12].concat(voicing(ch)).map(hz), len = T(b0 + s0 + sl) - T(b0 + s0) + 0.3;
      const [pl, pr] = pad(notesP, len, cfg.pad);
      putStereo(pl, pr, T(b0 + s0), 1.0);
    }
  }
}

if (!MELODY_ONLY) {
  // вступление: тихий арпеджио до мажор и пэд перед затактом
  put(bass(hz(48), 0.6), 0, 0.5, 0.5);
  [60, 64, 67].forEach((m, k) => put(pluck(hz(m), 0.5, 0.45, 0.55), T(0.5 + k * 0.5), 0.36, 0.4 + 0.1 * k));
  { const [pl, pr] = pad([48, 55, 60, 64].map(hz), T(3) + 0.5, 0.09); putStereo(pl, pr, 0, 1); }
  // финал: аккорд, глиссандо арфы и «мерцание» шкатулки
  const fb = endBeat - 3;
  put(bass(hz(48), 0.8), T(fb), 0.6, 0.5);
  [60, 64, 67, 72, 76, 79].forEach((m, k) => put(pluck(hz(m), 1.5, 0.5, 0.6), T(fb) + k * 0.075, 0.36, 0.3 + 0.08 * k));
  { const [pl, pr] = pad([48, 55, 60, 64, 67].map(hz), T(endBeat + 6) - T(fb), 0.28); putStereo(pl, pr, T(fb), 1); }
  [[0.6, 88, 0.42], [1.25, 91, 0.36], [2.0, 96, 0.30]].forEach(([o, m, v]) => put(bell('box', hz(m), 0.6, v), T(endBeat + o), 0.8, 0.5 + (m - 91) * 0.02));

  reverb(L, R, { room: 0.84, damp: 0.45, wet: 0.24 });
}

/* ───────── реверберация (Freeverb) ───────── */
function reverb(inL, inR, { room, damp, wet }) {
  const CT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AT = [556, 441, 341, 225], SP = 23;
  const mk = (sizes, add) => sizes.map(s => ({ b: new Float32Array(s + add), i: 0, s: 0 }));
  const cl = mk(CT, 0), cr = mk(CT, SP), al = mk(AT, 0), ar = mk(AT, SP);
  const fb = room * 0.28 + 0.7, d1 = damp * 0.4, d2 = 1 - d1, w1 = wet * 3 * 0.75, w2 = wet * 3 * 0.25;
  const comb = (c, x) => { const o = c.b[c.i]; c.s = o * d2 + c.s * d1; c.b[c.i] = x + c.s * fb; if (++c.i >= c.b.length) c.i = 0; return o; };
  const ap = (a, x) => { const bo = a.b[a.i], o = -x + bo; a.b[a.i] = x + bo * 0.5; if (++a.i >= a.b.length) a.i = 0; return o; };
  for (let n = 0; n < inL.length; n++) {
    const x = (inL[n] + inR[n]) * 0.015;
    let oL = 0, oR = 0;
    for (const c of cl) oL += comb(c, x);
    for (const c of cr) oR += comb(c, x);
    for (const a of al) oL = ap(a, oL);
    for (const a of ar) oR = ap(a, oR);
    inL[n] = inL[n] * 0.85 + oL * w1 + oR * w2;
    inR[n] = inR[n] * 0.85 + oR * w1 + oL * w2;
  }
}

/* ───────── запись WAV (float32) ───────── */
let peak = 0; for (let i = 0; i < NS; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const k = 0.85 / (peak || 1);
const data = Buffer.alloc(NS * 8);
for (let i = 0; i < NS; i++) { data.writeFloatLE(L[i] * k, i * 8); data.writeFloatLE(R[i] * k, i * 8 + 4); }
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
h.write('data', 36); h.writeUInt32LE(data.length, 40);
fs.writeFileSync(OUT, Buffer.concat([h, data]));
fs.writeFileSync(OUT.replace(/\.wav$/, '') + '.events.json', JSON.stringify(melodyLog));
console.log(`готово: ${OUT}  длительность ${(NS / SR).toFixed(1)} с, пик до нормализации ${peak.toFixed(3)}, нот мелодии ${melodyLog.length}`);
