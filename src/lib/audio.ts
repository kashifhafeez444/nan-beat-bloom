// ============================================================================
// NAN BEAT WALL — Stem-based dynamic music engine
// All instruments share BPM=100 and the C-minor pentatonic scale so any
// combination of player taps blends harmonically. The engine schedules an
// ambient bed + layered drums whose intensity scales with combo, and renders
// the final personalized soundtrack offline using OfflineAudioContext.
// ============================================================================

const BPM = 100;
const BEAT = 60 / BPM;            // quarter note seconds
const STEP = BEAT / 4;            // 16th note grid

// C minor pentatonic (C, Eb, F, G, Bb) across multiple octaves
const C_MINOR_PENT = [
  65.41, 77.78, 87.31, 98.00, 116.54,           // C2 Eb2 F2 G2 Bb2
  130.81, 155.56, 174.61, 196.00, 233.08,       // C3 Eb3 F3 G3 Bb3
  261.63, 311.13, 349.23, 392.00, 466.16,       // C4 Eb4 F4 G4 Bb4
  523.25, 622.25, 698.46, 783.99, 932.33,       // C5 Eb5 F5 G5 Bb5
  1046.50, 1244.51, 1396.91, 1567.98, 1864.66,  // C6 Eb6 F6 G6 Bb6
];
const N = (i: number) => C_MINOR_PENT[Math.max(0, Math.min(C_MINOR_PENT.length - 1, i))];

export type Formula = {
  id: string; label: string; sub: string; color: string; hex: string;
  // Variation indices into the pentatonic table (3-5 per formula)
  variations: number[];
};

export const FORMULAS: Formula[] = [
  { id: "DHA",        label: "DHA",        sub: "Brain Growth",   color: "var(--neon-cyan)",   hex: "#7DE3FF", variations: [20, 22, 18, 17] },     // bright bell C6/F6/G5
  { id: "HMO",        label: "HMO",        sub: "Immune Support", color: "var(--neon-pink)",   hex: "#FF6BD0", variations: [0, 3, 5, 2] },         // deep bass C2/G2
  { id: "PROBIOTICS", label: "Probiotics", sub: "Good Bacteria",  color: "var(--neon-green)",  hex: "#5BE6A4", variations: [13, 15, 17, 18] },     // bubbly pluck G4..G5
  { id: "IRON",       label: "Iron",       sub: "Vital Energy",   color: "var(--neon-orange)", hex: "#FFA45B", variations: [8, 6, 10, 13] },       // metallic mid
  { id: "CALCIUM",    label: "Calcium",    sub: "Strong Bones",   color: "#B8F1FF",            hex: "#B8F1FF", variations: [15, 17, 20, 22] },     // crystal bell hi
  { id: "PROTEIN",    label: "Protein",    sub: "Build Muscle",   color: "var(--neon-gold)",   hex: "#FFD66B", variations: [10, 12, 13, 15] },     // synth pop mid
  { id: "VITD",       label: "Vitamin D",  sub: "Sunshine",       color: "#FFE27A",            hex: "#FFE27A", variations: [17, 19, 22, 20] },     // bright pluck
  { id: "OMEGA",      label: "Omega 3",    sub: "Smart Mind",     color: "#7DD3FC",            hex: "#7DD3FC", variations: [12, 14, 15, 17] },     // smooth wave
  { id: "IMMUNITY",   label: "Immunity",   sub: "Protection",     color: "var(--neon-purple)", hex: "#C77DFF", variations: [9, 11, 14, 12] },      // shield tone
  { id: "GROWTH",     label: "Growth",     sub: "Stronger Daily", color: "var(--neon-gold)",   hex: "#FFD66B", variations: [3, 5, 8, 10] },        // uplifting kick layer
  { id: "DIGESTION",  label: "Digestion",  sub: "Happy Tummy",    color: "#A78BFA",            hex: "#A78BFA", variations: [11, 13, 8, 10] },      // rhythmic bounce
];

// Per-formula synthesis spec — voice character + envelope
type Voice = "bell" | "bass" | "pluck" | "metallic" | "pad" | "pop" | "kick" | "perc" | "wave";
const VOICE: Record<string, { voice: Voice; dur: number; gain: number }> = {
  DHA:        { voice: "bell",     dur: 1.2,  gain: 0.32 },
  HMO:        { voice: "bass",     dur: 0.55, gain: 0.55 },
  PROBIOTICS: { voice: "pluck",    dur: 0.35, gain: 0.34 },
  IRON:       { voice: "metallic", dur: 0.30, gain: 0.30 },
  CALCIUM:    { voice: "bell",     dur: 1.4,  gain: 0.26 },
  PROTEIN:    { voice: "pop",      dur: 0.40, gain: 0.36 },
  VITD:       { voice: "pluck",    dur: 0.55, gain: 0.32 },
  OMEGA:      { voice: "wave",     dur: 1.6,  gain: 0.28 },
  IMMUNITY:   { voice: "pad",      dur: 1.8,  gain: 0.30 },
  GROWTH:     { voice: "kick",     dur: 0.30, gain: 0.55 },
  DIGESTION:  { voice: "perc",     dur: 0.30, gain: 0.40 },
};

// Render one formula voice into a destination at time `when` on context `ctx`.
function renderVoice(
  ctx: BaseAudioContext, dest: AudioNode, id: string, when: number, variationIndex?: number
) {
  const f = FORMULAS.find((x) => x.id === id);
  if (!f) return;
  const v = VOICE[id];
  const pickIdx = variationIndex ?? Math.floor(Math.random() * f.variations.length);
  const noteIdx = f.variations[pickIdx % f.variations.length];
  const freq = N(noteIdx);

  const t = when;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.connect(dest);

  const adsr = (peak: number, a: number, d: number, s: number, r: number, dur: number) => {
    env.gain.linearRampToValueAtTime(peak, t + a);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    env.gain.setValueAtTime(Math.max(0.0001, peak * s), t + dur - r);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };

  const osc = (type: OscillatorType, f0: number, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = f0; o.detune.value = detune;
    return o;
  };

  switch (v.voice) {
    case "bell": {
      const o1 = osc("sine", freq);
      const o2 = osc("sine", freq * 2.01);
      const o3 = osc("sine", freq * 3.02);
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      const g3 = ctx.createGain(); g3.gain.value = 0.15;
      o1.connect(env); o2.connect(g2); g2.connect(env); o3.connect(g3); g3.connect(env);
      adsr(v.gain, 0.005, 0.15, 0.3, 0.6, v.dur);
      o1.start(t); o2.start(t); o3.start(t);
      o1.stop(t + v.dur + 0.05); o2.stop(t + v.dur + 0.05); o3.stop(t + v.dur + 0.05);
      break;
    }
    case "bass": {
      const o1 = osc("sawtooth", freq);
      const o2 = osc("sine", freq / 2);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600; lp.Q.value = 6;
      o1.connect(lp); o2.connect(lp); lp.connect(env);
      adsr(v.gain, 0.01, 0.12, 0.5, 0.2, v.dur);
      o1.start(t); o2.start(t);
      o1.stop(t + v.dur + 0.05); o2.stop(t + v.dur + 0.05);
      break;
    }
    case "pluck": {
      const o = osc("triangle", freq);
      const o2 = osc("sine", freq * 2);
      const g2 = ctx.createGain(); g2.gain.value = 0.3;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3500;
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(env);
      adsr(v.gain, 0.003, 0.08, 0.1, 0.15, v.dur);
      o.start(t); o2.start(t);
      o.stop(t + v.dur + 0.05); o2.stop(t + v.dur + 0.05);
      break;
    }
    case "metallic": {
      const o1 = osc("square", freq);
      const o2 = osc("square", freq * 1.49);
      const hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = freq * 2; hp.Q.value = 6;
      o1.connect(hp); o2.connect(hp); hp.connect(env);
      adsr(v.gain, 0.002, 0.05, 0.05, 0.1, v.dur);
      o1.start(t); o2.start(t);
      o1.stop(t + v.dur + 0.05); o2.stop(t + v.dur + 0.05);
      break;
    }
    case "pop": {
      const o = osc("square", freq);
      o.frequency.setValueAtTime(freq * 1.5, t);
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2500;
      o.connect(lp); lp.connect(env);
      adsr(v.gain, 0.003, 0.08, 0.1, 0.15, v.dur);
      o.start(t); o.stop(t + v.dur + 0.05);
      break;
    }
    case "wave": {
      const o1 = osc("sine", freq);
      const o2 = osc("sine", freq * 1.5);
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      o1.connect(env); o2.connect(g2); g2.connect(env);
      adsr(v.gain, 0.15, 0.3, 0.6, 0.5, v.dur);
      o1.start(t); o2.start(t);
      o1.stop(t + v.dur + 0.05); o2.stop(t + v.dur + 0.05);
      break;
    }
    case "pad": {
      const o1 = osc("sawtooth", freq, -6);
      const o2 = osc("sawtooth", freq, +6);
      const o3 = osc("sine", freq * 0.5);
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
      o1.connect(lp); o2.connect(lp); o3.connect(lp); lp.connect(env);
      adsr(v.gain, 0.2, 0.4, 0.6, 0.6, v.dur);
      o1.start(t); o2.start(t); o3.start(t);
      o1.stop(t + v.dur + 0.05); o2.stop(t + v.dur + 0.05); o3.stop(t + v.dur + 0.05);
      break;
    }
    case "kick": {
      const o = osc("sine", 120);
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      o.connect(env);
      adsr(v.gain, 0.001, 0.05, 0.1, 0.15, v.dur);
      o.start(t); o.stop(t + v.dur + 0.05);
      break;
    }
    case "perc": {
      // noise burst through bandpass
      const buffer = ctx.createBuffer(1, ctx.sampleRate * v.dur, ctx.sampleRate);
      const ch = buffer.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      const src = ctx.createBufferSource(); src.buffer = buffer;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq * 2; bp.Q.value = 5;
      src.connect(bp); bp.connect(env);
      adsr(v.gain, 0.001, 0.05, 0.05, 0.1, v.dur);
      src.start(t); src.stop(t + v.dur + 0.05);
      break;
    }
  }
}

// ============================================================================
// Live (real-time) playback engine
// ============================================================================

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let musicLevel = 0; // 0..1 driven by combo
let schedTimer: number | null = null;
let schedStep = 0;
let nextStepTime = 0;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.7;
}
export function isMuted() { return muted; }

export function setMusicIntensity(level0to1: number) {
  musicLevel = Math.max(0, Math.min(1, level0to1));
}

// Ambient pad chord (C minor: C3 Eb3 G3) — quiet drone played in real-time
let ambientNodes: { o: OscillatorNode; g: GainNode; lp: BiquadFilterNode }[] = [];
function startAmbient() {
  const c = ensure(); if (!c || !master) return;
  stopAmbient();
  const chord = [N(5), N(6), N(8), N(10)]; // C3 Eb3 G3 Bb3
  for (const f of chord) {
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    const g = c.createGain(); g.gain.value = 0.0001;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 2.5);
    ambientNodes.push({ o, g, lp });
  }
}
function stopAmbient() {
  const c = ctx; if (!c) return;
  for (const n of ambientNodes) {
    n.g.gain.cancelScheduledValues(c.currentTime);
    n.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.3);
    n.o.stop(c.currentTime + 1.0);
  }
  ambientNodes = [];
}

// Scheduled drums/bass — layered by musicLevel
function scheduler() {
  const c = ctx; if (!c || !master) return;
  while (nextStepTime < c.currentTime + 0.15) {
    const step16 = schedStep % 16;        // 1 bar of 16ths
    const t = nextStepTime;
    // Soft kick on every quarter (always)
    if (step16 % 4 === 0) {
      const o = c.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.35 * (0.4 + musicLevel * 0.6), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
    }
    // Hat on 8ths when level > 0.25
    if (musicLevel > 0.25 && step16 % 2 === 0) {
      const dur = 0.05;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      const s = c.createBufferSource(); s.buffer = buf;
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
      const g = c.createGain(); g.gain.value = 0.08 * musicLevel;
      s.connect(hp); hp.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur);
    }
    // Snare/clap on 2 and 4 when level > 0.45
    if (musicLevel > 0.45 && (step16 === 4 || step16 === 12)) {
      const dur = 0.18;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      const s = c.createBufferSource(); s.buffer = buf;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 1.5;
      const g = c.createGain(); g.gain.value = 0.18 * musicLevel;
      s.connect(bp); bp.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur);
    }
    // Sub bass groove when level > 0.6 — root on 1, fifth on 3.5
    if (musicLevel > 0.6) {
      const pattern = [0, -1, 0, -1, 3, -1, 0, -1, 0, -1, 0, -1, 5, -1, 3, -1];
      const n = pattern[step16];
      if (n >= 0) {
        const f = N(n);
        const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.18 * musicLevel, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 1.5);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + STEP * 1.6);
      }
    }

    schedStep++;
    nextStepTime += STEP;
  }
  schedTimer = window.setTimeout(scheduler, 25);
}

export function startMusic() {
  const c = ensure(); if (!c) return;
  stopMusic();
  startAmbient();
  schedStep = 0;
  nextStepTime = c.currentTime + 0.1;
  scheduler();
}
export function stopMusic() {
  if (schedTimer) { clearTimeout(schedTimer); schedTimer = null; }
  stopAmbient();
}

export function playFormula(id: string) {
  const c = ensure(); if (!c || !master) return;
  // Quantize to next 16th step for tight musical feel
  const now = c.currentTime;
  const quantized = Math.max(now, nextStepTime - STEP);
  renderVoice(c, master, id, quantized + 0.005);
}

export function playError() {
  const c = ensure(); if (!c || !master) return;
  const now = c.currentTime;
  const o = c.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(180, now);
  o.frequency.exponentialRampToValueAtTime(60, now + 0.25);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 800;
  const g = c.createGain();
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  o.connect(lp); lp.connect(g); g.connect(master);
  o.start(now); o.stop(now + 0.3);
}

// ============================================================================
// Timing-only recording + offline reconstruction
// ============================================================================

export type RecordedHit = { id: string; t: number; variation: number };
const recording: RecordedHit[] = [];
let recordStart = 0;

export function startRecording() { recording.length = 0; recordStart = performance.now(); }
export function recordHit(id: string) {
  const f = FORMULAS.find((x) => x.id === id); if (!f) return;
  recording.push({
    id,
    t: (performance.now() - recordStart) / 1000,
    variation: Math.floor(Math.random() * f.variations.length),
  });
}
export function getRecording() { return [...recording]; }

// Quantize a time (seconds) to nearest 16th step
function quantize(t: number) { return Math.round(t / STEP) * STEP; }

/**
 * Render the personalized mix from recorded hits into an AudioBuffer using
 * OfflineAudioContext. Includes the ambient bed + scheduled drums (scaled by
 * how dense the player's hits get) + each tapped formula voice.
 */
export async function renderMix(hits: RecordedHit[], totalDuration: number): Promise<AudioBuffer> {
  const dur = Math.max(8, totalDuration + 2);
  const sr = 44100;
  const OAC = (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext);
  const oc: OfflineAudioContext = new OAC(2, Math.ceil(sr * dur), sr);
  const out = oc.createGain(); out.gain.value = 0.85; out.connect(oc.destination);

  // Ambient pad bed — slow swell in/out
  const pad = oc.createGain(); pad.gain.setValueAtTime(0.0001, 0);
  pad.gain.linearRampToValueAtTime(0.05, 3);
  pad.gain.setValueAtTime(0.05, dur - 3);
  pad.gain.linearRampToValueAtTime(0.0001, dur);
  pad.connect(out);
  for (const f of [N(5), N(6), N(8), N(10)]) {
    const o = oc.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    const lp = oc.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    o.connect(lp); lp.connect(pad);
    o.start(0); o.stop(dur);
  }

  // Build density curve from hits to drive drum layers
  const densityAt = (t: number) => {
    let count = 0;
    for (const h of hits) if (h.t >= t - 4 && h.t <= t) count++;
    return Math.min(1, count / 8);
  };

  // Scheduled drums across the whole track
  const steps = Math.floor(dur / STEP);
  for (let i = 0; i < steps; i++) {
    const t = i * STEP;
    const step16 = i % 16;
    const lvl = densityAt(t);
    // Kick
    if (step16 % 4 === 0) {
      const o = oc.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.4 * (0.4 + lvl * 0.6), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
    }
    // Hat
    if (lvl > 0.2 && step16 % 2 === 0) {
      const d = 0.05;
      const buf = oc.createBuffer(1, Math.floor(sr * d), sr);
      const ch = buf.getChannelData(0);
      for (let j = 0; j < ch.length; j++) ch[j] = (Math.random() * 2 - 1) * (1 - j / ch.length);
      const s = oc.createBufferSource(); s.buffer = buf;
      const hp = oc.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
      const g = oc.createGain(); g.gain.value = 0.09 * lvl;
      s.connect(hp); hp.connect(g); g.connect(out);
      s.start(t); s.stop(t + d);
    }
    // Snare
    if (lvl > 0.4 && (step16 === 4 || step16 === 12)) {
      const d = 0.18;
      const buf = oc.createBuffer(1, Math.floor(sr * d), sr);
      const ch = buf.getChannelData(0);
      for (let j = 0; j < ch.length; j++) ch[j] = (Math.random() * 2 - 1) * (1 - j / ch.length);
      const s = oc.createBufferSource(); s.buffer = buf;
      const bp = oc.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 1.5;
      const g = oc.createGain(); g.gain.value = 0.2 * lvl;
      s.connect(bp); bp.connect(g); g.connect(out);
      s.start(t); s.stop(t + d);
    }
    // Sub bass
    if (lvl > 0.55) {
      const pattern = [0, -1, 0, -1, 3, -1, 0, -1, 0, -1, 0, -1, 5, -1, 3, -1];
      const n = pattern[step16];
      if (n >= 0) {
        const f = N(n);
        const o = oc.createOscillator(); o.type = "sine"; o.frequency.value = f;
        const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.2 * lvl, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 1.5);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + STEP * 1.6);
      }
    }
  }

  // Place each tapped formula at its quantized time
  for (const h of hits) {
    const t = quantize(h.t);
    renderVoice(oc, out, h.id, t, h.variation);
  }

  return await oc.startRendering();
}

// Encode AudioBuffer → WAV Blob (16-bit PCM)
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const samples = buffer.length;
  const blockAlign = numCh * 2;
  const byteRate = sr * blockAlign;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const ab = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // interleave
  const channels: Float32Array[] = [];
  for (let i = 0; i < numCh; i++) channels.push(buffer.getChannelData(i));
  let off = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

// Convenience: render → blob URL
export async function renderMixToUrl(hits: RecordedHit[], totalDuration: number): Promise<{ url: string; duration: number }> {
  const buf = await renderMix(hits, totalDuration);
  const blob = audioBufferToWav(buf);
  return { url: URL.createObjectURL(blob), duration: buf.duration };
}

// Legacy back-compat (Gameplay still calls startBeat/stopBeat/setBpm)
export function startBeat(_bpm?: number) { startMusic(); }
export function setBpm(_v: number) { /* fixed BPM stem system */ }
export function stopBeat() { stopMusic(); }