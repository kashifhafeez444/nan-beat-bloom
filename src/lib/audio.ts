// ============================================================================
// NAN BEAT WALL — Simple piano + seeded result-track generator
// Each formula component plays one clean piano key on tap. The result screen
// gets one of 10 deterministic pre-composed soundtracks (rendered offline).
// ============================================================================

export type Formula = {
  id: string; label: string; sub: string; color: string; hex: string;
  note: number; // piano frequency in Hz
};

// Diatonic mapping: one piano key per formula (C major scale across 2 octaves)
export const FORMULAS: Formula[] = [
  { id: "DHA",        label: "DHA",        sub: "Brain Growth",   color: "var(--neon-cyan)",   hex: "#7DE3FF", note: 261.63 }, // C4
  { id: "HMO",        label: "HMO",        sub: "Immune Support", color: "var(--neon-pink)",   hex: "#FF6BD0", note: 293.66 }, // D4
  { id: "PROBIOTICS", label: "Probiotics", sub: "Good Bacteria",  color: "var(--neon-green)",  hex: "#5BE6A4", note: 329.63 }, // E4
  { id: "IRON",       label: "Iron",       sub: "Vital Energy",   color: "var(--neon-orange)", hex: "#FFA45B", note: 349.23 }, // F4
  { id: "CALCIUM",    label: "Calcium",    sub: "Strong Bones",   color: "#B8F1FF",            hex: "#B8F1FF", note: 392.00 }, // G4
  { id: "PROTEIN",    label: "Protein",    sub: "Build Muscle",   color: "var(--neon-gold)",   hex: "#FFD66B", note: 440.00 }, // A4
  { id: "VITD",       label: "Vitamin D",  sub: "Sunshine",       color: "#FFE27A",            hex: "#FFE27A", note: 493.88 }, // B4
  { id: "OMEGA",      label: "Omega 3",    sub: "Smart Mind",     color: "#7DD3FC",            hex: "#7DD3FC", note: 523.25 }, // C5
  { id: "GROWTH",     label: "Growth",     sub: "Stronger Daily", color: "var(--neon-gold)",   hex: "#FFD66B", note: 587.33 }, // D5
  { id: "IMMUNITY",   label: "Immunity",   sub: "Protection",     color: "var(--neon-purple)", hex: "#C77DFF", note: 659.25 }, // E5
  { id: "DIGESTION",  label: "Digestion",  sub: "Happy Tummy",    color: "#A78BFA",            hex: "#A78BFA", note: 698.46 }, // F5
];

// ============================================================================
// Live audio context
// ============================================================================

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.8;
}
export function isMuted() { return muted; }

// ----------------------------------------------------------------------------
// Piano voice — additive sine harmonics with exponential decay
// ----------------------------------------------------------------------------
function renderPiano(c: BaseAudioContext, dest: AudioNode, freq: number, when: number, gain = 0.5, dur = 1.6) {
  const t = when;
  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.005);
  env.gain.exponentialRampToValueAtTime(gain * 0.4, t + 0.15);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  env.connect(dest);

  // Fundamental + 3 harmonics with decreasing amplitude
  const harmonics: Array<[number, number]> = [
    [1, 1.0], [2, 0.42], [3, 0.18], [4, 0.10], [5, 0.05],
  ];
  for (const [mult, amp] of harmonics) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * mult;
    const g = c.createGain();
    g.gain.value = amp;
    o.connect(g); g.connect(env);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export function playFormula(id: string) {
  const c = ensure(); if (!c || !master) return;
  const f = FORMULAS.find((x) => x.id === id); if (!f) return;
  renderPiano(c, master, f.note, c.currentTime + 0.001);
}

// ============================================================================
// Result track generator — 10 deterministic seeded compositions
// ============================================================================

// 10 chord progressions over the C major / A minor family (root note indexes 0..6 = C D E F G A B)
const PROGRESSIONS: number[][] = [
  [0, 5, 3, 4], // C Am F G
  [5, 3, 0, 4], // Am F C G
  [0, 4, 5, 3], // C G Am F
  [3, 0, 4, 5], // F C G Am
  [5, 4, 3, 0], // Am G F C
  [0, 3, 5, 4], // C F Am G
  [3, 4, 5, 0], // F G Am C
  [5, 0, 3, 4], // Am C F G
  [0, 5, 4, 3], // C Am G F
  [3, 5, 0, 4], // F Am C G
];

const SCALE = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99];

// Tiny seeded RNG
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chordNotes(root: number) {
  // Major triad if root is C/F/G, minor triad if A/D/E
  const minor = [1, 2, 5].includes(root);
  return [SCALE[root], SCALE[root + 2 - (minor ? 0 : 0)] * (minor ? 1.189 / 1.26 : 1), SCALE[root + 4]]
    .filter((x) => isFinite(x));
}

/** Render one of 10 result tracks. Returns blob URL + duration + track number (1..10). */
export async function renderResultTrack(trackNumber?: number): Promise<{ url: string; duration: number; trackNumber: number }> {
  const n = trackNumber ?? (1 + Math.floor(Math.random() * 10));
  const seed = n * 1337 + 7;
  const rand = mulberry32(seed);
  const prog = PROGRESSIONS[(n - 1) % PROGRESSIONS.length];

  const bpm = 88 + (n % 4) * 4;             // 88..100
  const beat = 60 / bpm;
  const barBeats = 4;
  const bars = 8;                            // 8 bars
  const dur = bars * barBeats * beat + 2;    // + tail
  const sr = 44100;
  const OAC = (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext);
  const oc: OfflineAudioContext = new OAC(2, Math.ceil(sr * dur), sr);
  const out = oc.createGain(); out.gain.value = 0.85; out.connect(oc.destination);

  // Pad bed
  const pad = oc.createGain(); pad.gain.setValueAtTime(0.0001, 0);
  pad.gain.linearRampToValueAtTime(0.06, 2);
  pad.gain.setValueAtTime(0.06, dur - 2);
  pad.gain.linearRampToValueAtTime(0.0001, dur);
  const lp = oc.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100;
  pad.connect(lp); lp.connect(out);
  for (const f of [130.81, 164.81, 196.00, 246.94]) {
    const o = oc.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    o.connect(pad); o.start(0); o.stop(dur);
  }

  // Piano arpeggio over the progression
  for (let b = 0; b < bars; b++) {
    const root = prog[b % prog.length];
    const chord = [SCALE[root], SCALE[root + 2], SCALE[root + 4], SCALE[root + 7] || SCALE[root + 4]];
    for (let s = 0; s < 8; s++) {
      const t = (b * barBeats + s * 0.5) * beat;
      const note = chord[s % chord.length] * (s >= 4 ? 1 : 1);
      const vel = 0.28 + rand() * 0.12;
      renderPiano(oc, out, note, t, vel, 0.9);
    }
    // Bass on beat 1 and 3
    for (const sb of [0, 2]) {
      const t = (b * barBeats + sb) * beat;
      const f = SCALE[root] / 2;
      const o = oc.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = oc.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.6);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + beat * 1.7);
    }
    // Soft kick on every beat
    for (let kb = 0; kb < barBeats; kb++) {
      const t = (b * barBeats + kb) * beat;
      const o = oc.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      const g = oc.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.32, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
    }
    // Hat on 8ths
    for (let h = 0; h < 8; h++) {
      const t = (b * barBeats + h * 0.5) * beat;
      const d = 0.04;
      const buf = oc.createBuffer(1, Math.floor(sr * d), sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
      const src = oc.createBufferSource(); src.buffer = buf;
      const hp = oc.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6500;
      const g = oc.createGain(); g.gain.value = 0.07;
      src.connect(hp); hp.connect(g); g.connect(out);
      src.start(t); src.stop(t + d);
    }
  }

  const rendered = await oc.startRendering();
  const blob = audioBufferToWav(rendered);
  return { url: URL.createObjectURL(blob), duration: rendered.duration, trackNumber: n };
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
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numCh; i++) channels.push(buffer.getChannelData(i));
  let off = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}