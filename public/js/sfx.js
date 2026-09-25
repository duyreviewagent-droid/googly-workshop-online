// Every sound and every note of music is synthesised live with WebAudio — nothing to download.
let ctx = null, master = null, sfxBus = null, musicBus = null, comp = null, verb = null;
let musicOn = true, sfxOn = true;
const MUSIC_VOL = 0.38;
try { musicOn = localStorage.getItem('gw.music') !== '0'; sfxOn = localStorage.getItem('gw.sfx') !== '0'; } catch { }

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? MUSIC_VOL : 0; musicBus.connect(master);
  // a small shop-sized room reverb from a noise impulse
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.22; verb.connect(vg); vg.connect(master);
  music.tick();
}
export function setMusic(on) { musicOn = on; try { localStorage.setItem('gw.music', on ? '1' : '0'); } catch { } if (musicBus) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, ctx.currentTime, 0.1); }
export function setSfx(on) { sfxOn = on; try { localStorage.setItem('gw.sfx', on ? '1' : '0'); } catch { } if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05); }
export const audioState = () => ({ music: musicOn, sfx: sfxOn });
const now = () => ctx ? ctx.currentTime : 0;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ building blocks
let noiseBuf = null;
function nb() { if (!noiseBuf) { const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function tone(f, t0, dur, { type = 'sine', vol = 0.3, attack = 0.004, slide = 0, out = sfxBus, send = 0 } = {}) {
  if (!ctx || !out) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  o.connect(g); g.connect(out); if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); }
  o.start(t0); o.stop(t0 + dur + 0.05);
  return o;
}
function noise(t0, dur, { vol = 0.3, f = 2000, q = 1, type = 'bandpass', slide = 0, out = sfxBus, attack = 0.002, send = 0 } = {}) {
  if (!ctx || !out) return;
  const s = ctx.createBufferSource(); s.buffer = nb(); s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(out); if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verb); }
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
// a googly voice: sawtooth through two formant filters, with a pitch contour
function voice(t0, dur, f0, f1, { vol = 0.12, out = sfxBus, formants = [700, 1200] } = {}) {
  if (!ctx || !out) return;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.03); g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  for (const fr of formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 5; o.connect(bp); bp.connect(g); }
  g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
// positional: returns an output node panned/attenuated for a world position relative to the listener
let listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
export function setListener(x, y, z, yaw) { listener = { x, y, z, rx: Math.cos(yaw), rz: -Math.sin(yaw) }; }
function at(pos, base = 1) {
  if (!ctx) return null;
  if (!pos) { if (base === 1) return sfxBus; const g = ctx.createGain(); g.gain.value = base; g.connect(sfxBus); setTimeout(() => { try { g.disconnect(); } catch { } }, 4000); return g; }
  const dx = pos[0] - listener.x, dy = pos[1] - listener.y, dz = pos[2] - listener.z, d = Math.hypot(dx, dy, dz);
  const g = ctx.createGain(); g.gain.value = base / (1 + d / 7);
  const p = ctx.createStereoPanner(); p.pan.value = d > 0.1 ? Math.max(-1, Math.min(1, (dx * listener.rx + dz * listener.rz) / d)) * 0.85 : 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 / (1 + d / 12);
  g.connect(lp); lp.connect(p); p.connect(sfxBus);
  setTimeout(() => { try { g.disconnect(); lp.disconnect(); p.disconnect(); } catch { } }, 4000);
  return g;
}
const coinAt = (t, o, vol = 0.12) => { const f = rnd(3200, 4400); tone(f, t, 0.18, { vol, out: o, send: 0.15 }); tone(f * 1.51, t, 0.12, { vol: vol * 0.6, out: o }); };

// ------------------------------------------------------------------ sound effects
export const sfx = {
  click() { if (!ctx) return; tone(2200, now(), 0.03, { vol: 0.08 }); },
  hover() { if (!ctx) return; tone(1500, now(), 0.02, { vol: 0.03 }); },
  error() { if (!ctx) return; const t = now(); tone(220, t, 0.12, { type: 'square', vol: 0.07 }); tone(185, t + 0.1, 0.18, { type: 'square', vol: 0.07 }); },
  scan(pos) { if (!ctx) return; const t = now(), o = at(pos, 0.9); tone(2400 + rnd(-40, 40), t, 0.09, { vol: 0.16, attack: 0.002, out: o }); tone(4800, t, 0.03, { vol: 0.03, out: o }); },
  chaching(pos, amount = 10) {
    if (!ctx) return; const t = now(), o = at(pos, 1.1);
    noise(t, 0.08, { f: 1500, q: 2, vol: 0.25, out: o });                      // drawer slides
    tone(2637, t + 0.06, 0.6, { vol: 0.13, out: o, send: 0.3 }); tone(3520, t + 0.06, 0.5, { vol: 0.07, out: o });   // bell
    const n = Math.min(14, 2 + Math.floor(Math.sqrt(Math.max(0, amount)) * 1.2));
    for (let i = 0; i < n; i++) coinAt(t + 0.12 + i * 0.035 + Math.random() * 0.02, o, 0.07);
    noise(t + 0.2 + n * 0.035, 0.05, { f: 900, q: 3, vol: 0.2, out: o });      // drawer shut
  },
  door(pos) {
    if (!ctx) return; const t = now(), o = at(pos, 1);
    noise(t, 0.6, { f: 600, q: 0.6, vol: 0.12, slide: 2.2, attack: 0.15, out: o });
    tone(midi(81), t + 0.1, 0.6, { vol: 0.1, out: o, send: 0.3 }); tone(midi(76), t + 0.38, 0.8, { vol: 0.1, out: o, send: 0.3 });
  },
  step(pos, v = 1) { if (!ctx) return; const t = now(), o = at(pos, 0.4 * v); noise(t, 0.045, { f: 1700, q: 1.5, vol: 0.18, out: o }); tone(110, t, 0.04, { vol: 0.06, out: o }); },
  boxUp(pos) { if (!ctx) return; const t = now(), o = at(pos, 1); noise(t, 0.12, { f: 450, q: 1, vol: 0.4, out: o }); tone(95, t, 0.1, { vol: 0.2, slide: 1.4, out: o }); noise(t + 0.05, 0.08, { f: 2200, q: 2, vol: 0.08, out: o }); },
  boxDown(pos) {
    if (!ctx) return; const t = now(), o = at(pos, 1);
    for (let i = 0; i < 9; i++) { const d = i * 0.035 + Math.random() * 0.03; noise(t + d, 0.03, { f: rnd(1200, 3500), q: 6, vol: 0.14, out: o }); if (i % 3 === 0) tone(rnd(500, 900), t + d, 0.05, { type: 'triangle', vol: 0.05, out: o }); }
    noise(t, 0.1, { f: 400, q: 1, vol: 0.2, out: o });
  },
  truck(pos) {
    if (!ctx) return; const t = now(), o = at(pos, 1.4);
    // diesel rumble
    const e = ctx.createOscillator(), eg = ctx.createGain(), lp = ctx.createBiquadFilter();
    e.type = 'sawtooth'; e.frequency.setValueAtTime(42, t); e.frequency.linearRampToValueAtTime(55, t + 1); e.frequency.linearRampToValueAtTime(38, t + 3);
    lp.type = 'lowpass'; lp.frequency.value = 260;
    eg.gain.setValueAtTime(0, t); eg.gain.linearRampToValueAtTime(0.28, t + 0.4); eg.gain.setValueAtTime(0.28, t + 2.4); eg.gain.exponentialRampToValueAtTime(0.001, t + 3.1);
    e.connect(lp); lp.connect(eg); eg.connect(o); e.start(t); e.stop(t + 3.2);
    noise(t, 3, { f: 180, q: 0.8, vol: 0.12, type: 'lowpass', attack: 0.3, out: o });
    for (let i = 0; i < 3; i++) tone(1050, t + 0.3 + i * 0.5, 0.28, { type: 'square', vol: 0.06, out: o });   // reverse beeps
    noise(t + 1.9, 0.25, { f: 3000, q: 1, vol: 0.12, out: o });                                             // air brakes
    for (let i = 0; i < 4; i++) { noise(t + 2.2 + i * 0.2, 0.1, { f: 380, q: 1, vol: 0.35, out: o }); tone(80, t + 2.2 + i * 0.2, 0.1, { vol: 0.15, out: o }); }
  },
  order() { if (!ctx) return; const t = now(); noise(t, 0.02, { f: 4000, q: 4, vol: 0.2 }); [72, 76, 79].forEach((m, i) => tone(midi(m), t + 0.04 + i * 0.06, 0.16, { type: 'triangle', vol: 0.1 })); },
  mop(pos) { if (!ctx) return; const t = now(), o = at(pos, 1); noise(t, 0.35, { f: 900, q: 1.5, vol: 0.2, slide: 1.8, attack: 0.08, out: o }); tone(rnd(1500, 1900), t + 0.1, 0.12, { vol: 0.05, slide: 1.3, out: o }); },
  spill(pos) {
    if (!ctx) return; const t = now(), o = at(pos, 1.2);
    for (let i = 0; i < 5; i++) tone(rnd(2500, 5000), t + i * 0.015, 0.12, { vol: 0.07, out: o });
    noise(t, 0.04, { f: 5000, q: 2, vol: 0.3, out: o }); noise(t + 0.02, 0.3, { f: 700, q: 0.8, vol: 0.35, slide: 0.4, out: o, send: 0.2 });
  },
  grumble(pos) { if (!ctx) return; const t = now(), o = at(pos, 1), f = rnd(170, 260); voice(t, 0.18, f, f * 0.9, { out: o, formants: [500, 900] }); voice(t + 0.2, 0.3, f * 1.05, f * 0.75, { out: o, formants: [400, 800] }); },
  angry(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.4), f = rnd(200, 280); noise(t, 0.15, { f: 1200, q: 1, vol: 0.12, out: o }); voice(t + 0.08, 0.35, f * 1.3, f * 0.7, { vol: 0.2, out: o, formants: [650, 1100] }); },
  happy(pos) { if (!ctx) return; const t = now(), o = at(pos, 1), f = rnd(330, 440); voice(t, 0.3, f, f * 1.7, { vol: 0.1, out: o, formants: [400, 2200] }); },
  coin() { if (!ctx) return; coinAt(now(), sfxBus, 0.14); },
  bell() { if (!ctx) return; const t = now(); for (const d of [0, 0.35]) { tone(midi(84), t + d, 1.2, { vol: 0.14, send: 0.4 }); tone(midi(84) * 2.76, t + d, 0.4, { vol: 0.04 }); } },
  closing() { if (!ctx) return; const t = now(); [79, 76, 72].forEach((m, i) => { tone(midi(m), t + i * 0.45, 1.4, { vol: 0.13, send: 0.4 }); tone(midi(m) * 2.76, t + i * 0.45, 0.3, { vol: 0.03 }); }); },
  news() { if (!ctx) return; const t = now(); [[72, 0], [79, 0.12], [77, 0.24], [84, 0.42]].forEach(([m, d]) => { tone(midi(m), t + d, 0.3, { type: 'square', vol: 0.05, send: 0.2 }); tone(midi(m - 12), t + d, 0.3, { type: 'triangle', vol: 0.08 }); }); noise(t + 0.42, 0.4, { f: 7000, q: 1, type: 'highpass', vol: 0.06 }); },
  warn() { if (!ctx) return; const t = now(); tone(1320, t, 0.08, { type: 'square', vol: 0.07 }); tone(1320, t + 0.13, 0.08, { type: 'square', vol: 0.07 }); },
  hire() { if (!ctx) return; const t = now(); [67, 72, 76].forEach((m, i) => tone(midi(m), t + i * 0.08, 0.3, { type: 'triangle', vol: 0.12, send: 0.2 })); sfx.happy(null); },
  upgrade() { if (!ctx) return; const t = now(); for (let i = 0; i < 10; i++) tone(midi(84 + [0, 4, 7, 12, 16][i % 5]), t + i * 0.045, 0.35, { vol: 0.06, send: 0.5 }); },
  win() { if (!ctx) return; const t = now(); [67, 72, 76, 79, 84, 88, 91].forEach((m, i) => { tone(midi(m), t + i * 0.1, 0.6, { type: 'triangle', vol: 0.16, send: 0.4 }); tone(midi(m - 12), t + i * 0.1, 0.4, { type: 'square', vol: 0.04 }); }); for (let i = 0; i < 20; i++) coinAt(t + 0.7 + Math.random() * 1.2, sfxBus, 0.06); },
  lose() { if (!ctx) return; const t = now(); [67, 63, 60, 55].forEach((m, i) => tone(midi(m), t + i * 0.2, 0.55, { type: 'triangle', vol: 0.14, send: 0.3 })); },
  dayEnd() { if (!ctx) return; const t = now(); for (let i = 0; i < 12; i++) noise(t + i * 0.05, 0.02, { f: 3000, q: 8, vol: 0.12 }); sfx.chaching(null, 60); },
  join() { if (!ctx) return; const t = now(); tone(660, t, 0.1, { vol: 0.08 }); tone(990, t + 0.08, 0.14, { vol: 0.08 }); },
  chat() { if (!ctx) return; tone(1200, now(), 0.06, { vol: 0.06 }); },
  tick() { if (!ctx) return; noise(now(), 0.015, { f: 5000, q: 6, vol: 0.18 }); },
};

// ------------------------------------------------------------------ music
// chords: [root midi, ...intervals]. Each song = 16th-step sequencer; melodies are arrays of 16 per bar (scale degrees above chord root, null = rest).
const C = (r, ...iv) => [r, ...iv];
const MAJ7 = [0, 4, 7, 11], MIN7 = [0, 3, 7, 10], DOM7 = [0, 4, 7, 10], MIN9 = [0, 3, 10, 14], DOM9 = [0, 4, 10, 14], MAJ9 = [0, 4, 11, 14];
const SONGS = {
  menu: {
    bpm: 92, swing: 0.2, prog: [C(50, ...MIN9), C(55, ...DOM9), C(48, ...MAJ9), C(57, ...DOM7), C(50, ...MIN9), C(55, ...DOM9), C(52, ...MIN7), C(57, ...DOM7)],
    comp: [0, 6, 10], walk: true, brush: true, mel: [[null, null, null, null, 14, null, 12, null, 10, null, null, null, 7, null, null, null], [null, null, 7, null, 10, null, 14, null, null, null, 12, 10, null, null, null, null]], melWave: 'rhodes',
  },
  store: {
    bpm: 118, swing: 0, prog: [C(53, ...MAJ7), C(52, ...MIN7), C(50, ...MIN9), C(55, ...DOM9), C(48, ...MAJ9), C(57, ...MIN7), C(50, ...MIN7), C(55, ...DOM7), C(58, ...MAJ7), C(57, ...MIN7), C(56, ...DOM7), C(55, ...DOM9)],
    comp: [0, 3, 6, 10, 12], bossa: true, clave: 'x..x..x...x.x...', pad: true, melWave: 'vibe',
    mel: [
      [7, null, null, 4, null, null, 7, null, 11, null, null, null, 7, null, null, null],
      [null, null, 12, null, 11, null, 7, null, 4, null, null, 2, null, null, null, null],
      [4, null, 7, null, 12, null, null, null, 11, null, 9, null, 7, null, null, null],
      [null, null, null, null, null, null, null, null, 12, null, 14, null, 12, null, 7, null],
    ],
  },
  evening: {
    bpm: 104, swing: 0.1, prog: [C(48, ...MAJ9), C(45, ...MIN9), C(50, ...MIN9), C(43, ...DOM9), C(53, ...MAJ7), C(52, ...MIN7), C(50, ...MIN7), C(43, ...DOM7)],
    comp: [0, 6, 12], bossa: true, clave: 'x.....x.........', pad: true, slowHat: true, melWave: 'vibe', low: true,
    mel: [[7, null, null, null, 4, null, null, null, null, null, 2, null, 0, null, null, null], [null, null, null, null, 11, null, 7, null, null, null, null, null, 4, null, null, null]],
  },
  end: {
    bpm: 124, swing: 0, prog: [C(48, ...MAJ7), C(53, ...MAJ7), C(55, ...DOM7), C(48, ...MAJ7)],
    comp: [0, 4, 8, 12], party: true, pad: true, melWave: 'vibe',
    mel: [[12, null, 16, null, 19, null, 24, null, 19, null, 16, null, 19, null, null, null], [24, null, 23, null, 19, null, 16, null, 14, null, 16, null, 12, null, null, null]],
  },
};
function rhodes(f, t, dur, vol, out) { tone(f, t, dur, { vol, out, attack: 0.006, send: 0.2 }); tone(f * 2, t, dur * 0.35, { type: 'triangle', vol: vol * 0.35, out }); tone(f * 7.1, t, 0.08, { vol: vol * 0.08, out }); }
function vibe(f, t, dur, vol, out) {
  if (!ctx) return;
  const o = tone(f, t, dur, { vol, out, attack: 0.003, send: 0.4 }); tone(f * 4, t, 0.12, { vol: vol * 0.15, out });
  if (o) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * 0.004; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05); }
}
export const music = {
  song: 'menu', step: 0, next: 0, bar: 0, rush: 0, melIdx: 0,
  play(name) { if (!SONGS[name] || this.song === name) return; this.song = name; this.step = 0; this.bar = 0; },
  setRush(k) { this.rush = Math.max(0, Math.min(1, +k || 0)); },
  tick() {
    if (!ctx) return;
    const S = SONGS[this.song], spb = 60 / (S.bpm * (1 + this.rush * 0.04)) / 4, out = musicBus;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.15) {
      const s = this.step % 16, t = this.next, ch = S.prog[this.bar % S.prog.length], root = ch[0] + (S.low ? -12 : 0);
      const tt = t + (s % 2 && S.swing ? spb * S.swing : 0);
      const lap = Math.floor(this.bar / S.prog.length);
      // chords (comp hits)
      if (S.comp.includes(s)) {
        const len = S.bossa ? spb * 2.4 : spb * 3.5, v = S.comp[0] === s ? 0.035 : 0.025;
        for (const iv of ch.slice(1)) (this.song === 'menu' ? rhodes : (f, a, d, vv, o) => rhodes(f, a, d, vv * 0.8, o))(midi(root + 12 + iv), tt, len, v, out);
      }
      if (S.pad && s === 0) for (const iv of ch.slice(1)) tone(midi(root + 12 + iv), t, spb * 15, { vol: 0.012, attack: 0.4, out, send: 0.5 });
      // bass
      if (S.walk && s % 4 === 0) { const w = [0, 7, 12, 10][s / 4] + (lap % 2 && s === 12 ? -1 : 0); this.bassNote(midi(root - 12 + w), tt, spb * 3.4); }
      if (S.bossa && (s === 0 || s === 6 || s === 8 || s === 14)) this.bassNote(midi(root - 12 + (s === 6 || s === 14 ? 7 : 0)), tt, spb * 2.6);
      if (S.party && s % 2 === 0) this.bassNote(midi(root - 12 + (s % 4 ? 12 : 0)), tt, spb * 1.6);
      // drums
      if (S.brush) { noise(tt, s % 4 === 0 ? 0.22 : 0.08, { f: 4500, q: 0.6, vol: s % 4 === 0 ? 0.05 : 0.025, out }); if (s === 4 || s === 12) noise(tt, 0.16, { f: 2200, q: 0.7, vol: 0.06, out }); if (s === 0 || s === 10) tone(70, tt, 0.25, { vol: 0.2, slide: 0.6, out }); }
      if (S.clave && S.clave[s] === 'x') tone(2500, tt, 0.035, { type: 'triangle', vol: 0.06, out });
      if (S.bossa) {
        if (s % 8 === 0 || s === 11) tone(62, tt, 0.22, { vol: 0.18, slide: 0.7, out });
        if (!S.slowHat || s % 4 === 2) noise(tt, 0.03, { f: 9000, q: 1, type: 'highpass', vol: s % 4 === 2 ? 0.035 : 0.018, out });
      }
      if (S.party) { if (s % 4 === 0) tone(140, tt, 0.25, { vol: 0.35, slide: 0.3, out }); if (s % 8 === 4) noise(tt, 0.15, { f: 1800, q: 0.7, vol: 0.18, out, send: 0.3 }); if (s % 2 === 1) noise(tt, 0.03, { f: 9000, q: 1, type: 'highpass', vol: 0.05, out }); }
      if (this.rush > 0.05) noise(tt + spb * 0.1, 0.035, { f: 7000, q: 2, vol: 0.035 * this.rush, out });      // shaker for busy moments
      // melody: pick a phrase per 2 bars, rest every third lap so it breathes
      if (s === 0 && this.bar % 2 === 0) this.melIdx = (this.bar / 2 + lap * 3) % S.mel.length;
      const m = S.mel[this.melIdx][s];
      if (m !== null && lap % 3 !== 2) {
        const f = midi(root + 24 + m + (S.low ? 0 : 0));
        if (S.melWave === 'rhodes') rhodes(f, tt, spb * 3, 0.045, out); else vibe(f, tt, spb * 4, 0.05, out);
      }
      this.next += spb; this.step++;
      if (this.step % 16 === 0) this.bar++;
    }
    setTimeout(() => this.tick(), 40);
  },
  bassNote(f, t, dur) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    fl.type = 'lowpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(250, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  },
};
