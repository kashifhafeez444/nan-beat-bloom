// Web Audio API synthesizer for NAN beat sounds
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
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.55;
}
export function isMuted() { return muted; }

type SoundSpec = { type: OscillatorType; freq: number; freq2?: number; dur: number; attack?: number; decay?: number; harmonic?: number; lp?: number };

export const FORMULAS = [
  { id: "DHA",        label: "DHA",        sub: "Brain Growth",     color: "var(--neon-cyan)",   hex: "#7DE3FF", spec: { type: "sine", freq: 660, dur: 0.5, harmonic: 2 } as SoundSpec },
  { id: "HMO",        label: "HMO",        sub: "Immune Support",   color: "var(--neon-pink)",   hex: "#FF6BD0", spec: { type: "sawtooth", freq: 80, dur: 0.45, lp: 700 } as SoundSpec },
  { id: "PROBIOTICS", label: "Probiotics", sub: "Good Bacteria",    color: "var(--neon-green)",  hex: "#5BE6A4", spec: { type: "triangle", freq: 520, freq2: 880, dur: 0.4 } as SoundSpec },
  { id: "IRON",       label: "Iron",       sub: "Vital Energy",     color: "var(--neon-orange)", hex: "#FFA45B", spec: { type: "square", freq: 220, dur: 0.18 } as SoundSpec },
  { id: "CALCIUM",    label: "Calcium",    sub: "Strong Bones",     color: "#B8F1FF",                  hex: "#B8F1FF", spec: { type: "sine", freq: 1320, dur: 0.6, harmonic: 3 } as SoundSpec },
  { id: "PROTEIN",    label: "Protein",    sub: "Build Muscle",     color: "var(--neon-gold)",   hex: "#FFD66B", spec: { type: "triangle", freq: 330, dur: 0.35 } as SoundSpec },
  { id: "VITD",       label: "Vitamin D",  sub: "Sunshine",         color: "#FFE27A",                  hex: "#FFE27A", spec: { type: "sine", freq: 990, dur: 0.32, harmonic: 2 } as SoundSpec },
  { id: "OMEGA",      label: "Omega 3",    sub: "Smart Mind",       color: "#7DD3FC",                  hex: "#7DD3FC", spec: { type: "sine", freq: 440, freq2: 660, dur: 0.7 } as SoundSpec },
  { id: "IMMUNITY",   label: "Immunity",   sub: "Protection",       color: "var(--neon-purple)", hex: "#C77DFF", spec: { type: "sawtooth", freq: 200, freq2: 400, dur: 0.5, lp: 1200 } as SoundSpec },
  { id: "GROWTH",     label: "Growth",     sub: "Stronger Daily",   color: "var(--neon-gold)",   hex: "#FFD66B", spec: { type: "square", freq: 110, dur: 0.25 } as SoundSpec },
  { id: "DIGESTION",  label: "Digestion",  sub: "Happy Tummy",      color: "#A78BFA",                  hex: "#A78BFA", spec: { type: "triangle", freq: 260, freq2: 520, dur: 0.45 } as SoundSpec },
];

export type Formula = (typeof FORMULAS)[number];

export function playFormula(id: string) {
  const c = ensure();
  if (!c || !master) return;
  const f = FORMULAS.find((x) => x.id === id);
  if (!f) return;
  const { spec } = f;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, now);
  if (spec.freq2) {
    osc.frequency.exponentialRampToValueAtTime(spec.freq2, now + spec.dur * 0.8);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.5, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + spec.dur);
  let node: AudioNode = osc;
  if (spec.lp) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = spec.lp;
    osc.connect(lp); lp.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(master);
  osc.start(now);
  osc.stop(now + spec.dur + 0.05);

  if (spec.harmonic) {
    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = spec.freq * spec.harmonic;
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.15, now + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.001, now + spec.dur);
    o2.connect(g2); g2.connect(master);
    o2.start(now); o2.stop(now + spec.dur + 0.05);
  }
  void node;
}

export function playError() {
  const c = ensure();
  if (!c || !master) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, now);
  o.frequency.exponentialRampToValueAtTime(60, now + 0.25);
  const g = c.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  o.connect(g); g.connect(master);
  o.start(now); o.stop(now + 0.3);
}

export function playKick(strength = 1) {
  const c = ensure();
  if (!c || !master) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(120, now);
  o.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  const g = c.createGain();
  g.gain.setValueAtTime(0.4 * strength, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  o.connect(g); g.connect(master);
  o.start(now); o.stop(now + 0.22);
}

let kickTimer: number | null = null;
let bpm = 90;
let beatStep = 0;

export function startBeat(initialBpm = 90) {
  stopBeat();
  bpm = initialBpm;
  const tick = () => {
    playKick(beatStep % 4 === 0 ? 1 : 0.5);
    beatStep++;
    kickTimer = window.setTimeout(tick, 60000 / bpm / 2);
  };
  tick();
}
export function setBpm(v: number) { bpm = v; }
export function stopBeat() {
  if (kickTimer) { clearTimeout(kickTimer); kickTimer = null; }
  beatStep = 0;
}

// Recording
export type RecordedHit = { id: string; t: number };
const recording: RecordedHit[] = [];
let recordStart = 0;
export function startRecording() { recording.length = 0; recordStart = performance.now(); }
export function recordHit(id: string) { recording.push({ id, t: (performance.now() - recordStart) / 1000 }); }
export function getRecording() { return [...recording]; }

export function playRecording(hits: RecordedHit[], onProgress?: (p: number) => void, onEnd?: () => void) {
  const start = performance.now();
  const total = hits.length ? hits[hits.length - 1].t + 0.5 : 1;
  const timers: number[] = [];
  hits.forEach((h) => {
    timers.push(window.setTimeout(() => playFormula(h.id), h.t * 1000));
  });
  const raf = () => {
    const elapsed = (performance.now() - start) / 1000;
    const p = Math.min(1, elapsed / total);
    onProgress?.(p);
    if (p < 1) requestAnimationFrame(raf);
    else onEnd?.();
  };
  requestAnimationFrame(raf);
  return () => timers.forEach(clearTimeout);
}