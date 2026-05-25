import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Background } from "./Background";
import {
  FORMULAS, playFormula, playError,
  startMusic, stopMusic, setMusicIntensity,
  startRecording, recordHit, getRecording, setMuted,
  type RecordedHit,
} from "@/lib/audio";
import nanLogo from "@/assets/nan-logo.png";
import babyImg from "@/assets/baby.png";
import { Home, Volume2, VolumeX, Pause, Play } from "lucide-react";

const DURATION = 60;

type ActiveBeat = {
  uid: string;
  id: string;
  x: number;        // % horizontal column
  sway: number;     // horizontal drift amplitude (%)
  spawn: number;    // performance.now() ms
  lifetime: number; // ms total travel
};

export type GameResult = {
  score: number;
  bestCombo: number;
  accuracy: number;
  hits: RecordedHit[];
  formulaCounts: Record<string, number>;
  totalTaps: number;
  correctTaps: number;
  duration: number;
};

export function Gameplay({ playerName, onEnd }: { playerName: string; onEnd: (r: GameResult) => void }) {
  const [phase, setPhase] = useState<"countdown" | "play" | "ended">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [time, setTime] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [coach, setCoach] = useState("Get ready!");
  const [warning, setWarning] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [perfect, setPerfect] = useState<{ uid: string; pts: number } | null>(null);

  const [energy, setEnergy] = useState({ growth: 12, immunity: 18, digestion: 10 });
  const [accuracy, setAccuracy] = useState({ sync: 0, react: 0 });

  const [queue, setQueue] = useState<string[]>(() => makeQueue(8));
  const [beats, setBeats] = useState<ActiveBeat[]>([]);
  const beatsRef = useRef(beats);
  beatsRef.current = beats;
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const tapStats = useRef({ total: 0, correct: 0, formulaCounts: {} as Record<string, number> });
  const speedRef = useRef<"CALM" | "NORMAL" | "FAST" | "EXTREME">("CALM");
  const [speedLabel, setSpeedLabel] = useState<"CALM" | "NORMAL" | "FAST" | "EXTREME">("CALM");

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("play");
      startMusic();
      setMusicIntensity(0.1);
      startRecording();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  // Game timer
  useEffect(() => {
    if (phase !== "play" || paused) return;
    const id = setInterval(() => setTime((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  // Difficulty + warnings (4 tiers: CALM 0-20s, NORMAL 20-40s, FAST 40-50s, EXTREME 50-60s)
  useEffect(() => {
    if (phase !== "play") return;
    const elapsed = DURATION - time;
    if (elapsed === 20) { setWarning("BEATS ARE RISING FASTER"); speedRef.current = "NORMAL"; setSpeedLabel("NORMAL"); }
    if (elapsed === 40) { setWarning("CHALLENGE MODE ACTIVATED"); speedRef.current = "FAST"; setSpeedLabel("FAST"); }
    if (elapsed === 50) { setWarning("FINAL RHYTHM RUSH!"); speedRef.current = "EXTREME"; setSpeedLabel("EXTREME"); }
    if (warning) {
      const t = setTimeout(() => setWarning(null), 2200);
      return () => clearTimeout(t);
    }
  }, [time, phase, warning]);

  // End game
  useEffect(() => {
    if (phase === "play" && time === 0) {
      stopMusic();
      setPhase("ended");
      const s = tapStats.current;
      onEnd({
        score, bestCombo, accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
        hits: getRecording(), formulaCounts: s.formulaCounts, totalTaps: s.total, correctTaps: s.correct,
        duration: DURATION,
      });
    }
  }, [time, phase, score, bestCombo, onEnd]);

  // Floating beat spawner — notes rise from bottom to top
  useEffect(() => {
    if (phase !== "play" || paused) return;
    const spawn = () => {
      const speed = speedRef.current;
      const cfg = SPEED_CFG[speed];
      if (beatsRef.current.length >= cfg.maxOnScreen) return;
      // 75% chance the next note matches the current queue head
      const id = Math.random() < 0.75 ? queueRef.current[0] : pick(FORMULAS).id;
      // distribute across columns (avoid edges)
      const x = 12 + Math.random() * 76;
      const sway = 3 + Math.random() * 5;
      const beat: ActiveBeat = {
        uid: `${Date.now()}-${Math.random()}`,
        id, x, sway,
        spawn: performance.now(),
        lifetime: cfg.lifetime,
      };
      setBeats((b) => [...b, beat]);
      window.setTimeout(() => {
        setBeats((b) => b.filter((x) => x.uid !== beat.uid));
      }, cfg.lifetime + 100);
    };
    const cfg = SPEED_CFG[speedRef.current];
    const id = setInterval(spawn, cfg.interval);
    // burst extra notes in EXTREME for high-density feel
    let burst: number | null = null;
    if (speedRef.current === "EXTREME") {
      burst = window.setInterval(spawn, cfg.interval * 0.6);
    }
    return () => { clearInterval(id); if (burst) clearInterval(burst); };
  }, [phase, paused, speedLabel]);

  // Drive dynamic music intensity from combo
  useEffect(() => {
    setMusicIntensity(Math.min(1, combo / 22));
  }, [combo]);

  // Coach messages
  useEffect(() => {
    if (combo >= 20) setCoach("ULTRA COMBO!");
    else if (combo >= 10) setCoach("Amazing rhythm!");
    else if (combo >= 5) setCoach("Perfect timing!");
    else if (combo === 0 && tapStats.current.total > 0) setCoach("Stay focused!");
  }, [combo]);

  const handleTap = useCallback((beat: ActiveBeat) => {
    tapStats.current.total++;
    const target = queueRef.current[0];
    if (beat.id === target) {
      tapStats.current.correct++;
      tapStats.current.formulaCounts[beat.id] = (tapStats.current.formulaCounts[beat.id] || 0) + 1;
      playFormula(beat.id);
      recordHit(beat.id);
      const newCombo = combo + 1;
      setCombo(newCombo);
      setBestCombo((b) => Math.max(b, newCombo));
      const elapsed = performance.now() - beat.spawn;
      const timingBonus = Math.max(0, 1 - elapsed / beat.lifetime);
      const points = Math.round((100 + newCombo * 10) * (0.6 + timingBonus * 0.8));
      setScore((s) => s + points);
      setPerfect({ uid: beat.uid, pts: points });
      setTimeout(() => setPerfect((p) => (p?.uid === beat.uid ? null : p)), 700);
      // energy
      setEnergy((e) => ({
        growth: Math.min(100, e.growth + (["GROWTH", "PROTEIN", "CALCIUM", "VITD", "IRON"].includes(beat.id) ? 6 : 2)),
        immunity: Math.min(100, e.immunity + (["IMMUNITY", "HMO", "VITD"].includes(beat.id) ? 7 : 2)),
        digestion: Math.min(100, e.digestion + (["DIGESTION", "PROBIOTICS", "HMO"].includes(beat.id) ? 7 : 2)),
      }));
      setAccuracy((a) => ({
        sync: Math.min(100, a.sync + 3 + timingBonus * 4),
        react: Math.min(100, a.react + 2 + timingBonus * 5),
      }));
      setQueue((q) => [...q.slice(1), pick(FORMULAS).id]);
      setBeats((bs) => bs.filter((b) => b.uid !== beat.uid));
    } else {
      playError();
      setCombo(0);
      setScore((s) => Math.max(0, s - 25));
      setShake(true);
      setTimeout(() => setShake(false), 350);
      setAccuracy((a) => ({ sync: Math.max(0, a.sync - 5), react: Math.max(0, a.react - 3) }));
    }
  }, [combo]);

  const intensity = useMemo(() => Math.min(1, 0.35 + combo / 30), [combo]);

  const toggleMute = () => {
    const n = !muted;
    setMutedState(n);
    setMuted(n);
  };

  // baby reactions
  const babyState = combo > 8 ? "happy" : combo > 2 ? "neutral" : "idle";

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${shake ? "animate-[shake_0.35s]" : ""}`}>
      <Background intensity={intensity} />
      {/* Red glitch */}
      <AnimatePresence>
        {shake && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-50 bg-red-500/30 mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* Top Nav */}
      <div className="relative z-30 flex items-start justify-between px-10 py-6">
        <img src={nanLogo} alt="NAN" className="h-16 w-auto drop-shadow-[0_0_15px_rgba(125,227,255,0.6)]" />
        <div className="text-center">
          <h1 className="font-display text-5xl font-black leading-none">
            <span className="neon-text-cyan">NAN</span> <span className="neon-text-white">BEAT</span> <span className="neon-text-pink">WALL</span>
          </h1>
          <p className="mt-1 text-sm font-light text-white/70">Tap the beats. Build the health. Create a brighter future.</p>
        </div>
        <div className="flex gap-3">
          <IconBtn onClick={() => location.reload()}><Home className="h-6 w-6" /></IconBtn>
          <IconBtn onClick={toggleMute}>{muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</IconBtn>
          <IconBtn onClick={() => setPaused((p) => !p)}>{paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}</IconBtn>
        </div>
      </div>

      {/* Main 3-column */}
      <div className="relative z-20 grid h-[calc(100vh-220px)] grid-cols-[280px_1fr_280px] gap-6 px-8">
        {/* LEFT */}
        <div className="flex flex-col gap-4">
          <Panel title="HOW TO PLAY">
            <p className="text-sm leading-relaxed text-white/80">Floating notes rise from below. Tap the one matching the <span className="neon-text-cyan">NEXT</span> beat in the sequence panel.</p>
          </Panel>
          <Panel title="COMBO">
            <div className="font-display text-6xl font-black neon-text-gold">x{combo}</div>
            <div className="font-display mt-1 text-xs tracking-[0.3em] text-[color:var(--neon-cyan)]/80">{coachWord(combo)}</div>
          </Panel>
          <Panel title="SCORE">
            <div className="font-display text-4xl font-black tabular-nums neon-text-white">{score.toLocaleString()}</div>
          </Panel>
          <Panel title="TIMER">
            <div className="flex items-center gap-4">
              <TimerRing seconds={time} total={DURATION} />
              <div>
                <div className="font-display text-3xl font-black tabular-nums text-white">{time}<span className="ml-1 text-xs text-white/60">SEC</span></div>
                <div className="font-display mt-1 text-[10px] tracking-[0.3em] text-[color:var(--neon-pink)]">SPEED · {speedLabel}</div>
              </div>
            </div>
          </Panel>
        </div>

        {/* CENTER */}
        <div className="relative">
          {/* Hit zone line — visual cue for sweet spot */}
          <div className="pointer-events-none absolute left-0 right-0 top-[28%] z-10">
            <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, color-mix(in oklch, var(--neon-cyan) 60%, transparent), transparent)" }} />
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 font-display text-[9px] tracking-[0.5em] text-[color:var(--neon-cyan)]/70">◆ HIT ZONE ◆</div>
          </div>

          {/* Holographic floor */}
          <div className="absolute left-1/2 top-[72%] -translate-x-1/2 -translate-y-1/2">
            {[1, 2, 3].map((i) => (
              <div key={i}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{
                  width: 280 + i * 120,
                  height: (280 + i * 120) * 0.45,
                  borderColor: `color-mix(in oklch, var(--neon-cyan) ${30 - i * 7}%, transparent)`,
                  boxShadow: `0 0 40px color-mix(in oklch, var(--neon-cyan) ${15 - i * 3}%, transparent)`,
                }}
              />
            ))}
          </div>

          {/* Baby — pushed to background so floating notes are the focus */}
          <motion.div
            animate={babyState === "happy" ? { y: [0, -10, 0], rotate: [-2, 2, -2] } : babyState === "neutral" ? { y: [0, -5, 0] } : { y: 0 }}
            transition={{ duration: babyState === "happy" ? 0.5 : 1.2, repeat: Infinity }}
            className="pointer-events-none absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 opacity-70"
          >
            <div className="relative">
              <div className="absolute inset-0 -m-12 rounded-full animate-pulse"
                style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--neon-cyan) 35%, transparent), transparent 70%)" }} />
              <img src={babyImg} alt="Baby" className="relative h-[260px] w-auto" draggable={false} />
            </div>
          </motion.div>

          {/* AMAZING overlay */}
          <AnimatePresence>
            {combo >= 5 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute left-1/2 top-8 -translate-x-1/2 text-center"
              >
                <div className="font-display text-5xl font-black neon-text-cyan">{combo >= 20 ? "ULTRA!" : combo >= 10 ? "AMAZING!" : "GREAT!"}</div>
                <div className="font-display mt-1 text-sm tracking-[0.3em] neon-text-pink">KEEP IT UP</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating beats — bottom-to-top */}
          {beats.map((b) => (
            <FloatingBeat key={b.uid} beat={b} onTap={() => handleTap(b)} isTarget={queue[0] === b.id} />
          ))}

          {/* Perfect combo float */}
          <AnimatePresence>
            {perfect && (
              <motion.div
                key={perfect.uid}
                initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -60 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="pointer-events-none absolute left-1/2 top-[88%] -translate-x-1/2 text-center"
              >
                <div className="font-display text-3xl font-black neon-text-gold">+{perfect.pts}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-4">
          <Panel title="PERFORMANCE">
            <Stat label="Accuracy" value={Math.round((tapStats.current.correct / Math.max(1, tapStats.current.total)) * 100)} suffix="%" color="var(--neon-cyan)" />
            <Stat label="Rhythm Sync" value={Math.round(accuracy.sync)} suffix="%" color="var(--neon-pink)" />
            <Stat label="Reaction" value={Math.round(accuracy.react)} suffix="%" color="var(--neon-gold)" />
          </Panel>
          <Panel title="FORMULA ENERGY">
            <EnergyBar label="Growth"    value={energy.growth}    color="var(--neon-gold)" />
            <EnergyBar label="Immunity"  value={energy.immunity}  color="var(--neon-green)" />
            <EnergyBar label="Digestion" value={energy.digestion} color="var(--neon-purple)" />
          </Panel>
          <Panel title="AI COACH">
            <motion.div key={coach} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="font-display text-xl font-bold neon-text-cyan">
              {coach}
            </motion.div>
          </Panel>
        </div>
      </div>

      {/* Bottom queue */}
      <div className="absolute bottom-6 left-1/2 z-30 w-[1200px] -translate-x-1/2">
        <div className="font-display mb-2 text-center text-xs tracking-[0.5em] text-[color:var(--neon-cyan)]/80">▾ UPCOMING BEATS ▾</div>
        <div className="glass-strong flex items-center justify-center gap-4 rounded-2xl px-6 py-4">
          {queue.slice(0, 7).map((id, i) => {
            const f = FORMULAS.find((x) => x.id === id)!;
            const active = i === 0;
            return (
              <motion.div
                key={`${id}-${i}`}
                layout
                animate={{ scale: active ? 1.15 : 1 - i * 0.04, opacity: 1 - i * 0.1 }}
                className="flex flex-col items-center"
              >
                <div
                  className="flex h-16 w-28 items-center justify-center rounded-xl border font-display text-sm font-bold"
                  style={{
                    color: f.hex,
                    borderColor: f.hex,
                    background: `linear-gradient(135deg, color-mix(in oklch, ${f.hex} ${active ? 25 : 12}%, transparent), transparent)`,
                    boxShadow: active ? `0 0 30px ${f.hex}, inset 0 0 20px color-mix(in oklch, ${f.hex} 30%, transparent)` : "none",
                  }}
                >
                  {f.label}
                </div>
                {active && <div className="font-display mt-1 text-[10px] tracking-[0.3em] neon-text-pink">NEXT</div>}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      <AnimatePresence>
        {warning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 text-center"
          >
            <div className="font-display text-7xl font-black neon-text-pink">{warning}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown overlay */}
      <AnimatePresence>
        {phase === "countdown" && (
          <motion.div
            initial={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <div className="font-display text-sm tracking-[0.5em] text-[color:var(--neon-cyan)]">{playerName ? `${playerName.toUpperCase()} · GET READY` : "GET READY"}</div>
            <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display mt-4 text-[240px] font-black neon-text-white">
              {countdown > 0 ? countdown : "GO!"}
            </motion.div>
          </motion.div>
        )}
        {paused && phase === "play" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="font-display text-9xl font-black neon-text-cyan">PAUSED</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SPEED_CFG = {
  CALM:    { lifetime: 4200, interval: 900,  maxOnScreen: 4, travelVH: 90 },
  NORMAL:  { lifetime: 3400, interval: 750,  maxOnScreen: 5, travelVH: 90 },
  FAST:    { lifetime: 2400, interval: 550,  maxOnScreen: 6, travelVH: 90 },
  EXTREME: { lifetime: 1700, interval: 380,  maxOnScreen: 8, travelVH: 90 },
} as const;

function FloatingBeat({ beat, onTap, isTarget }: { beat: ActiveBeat; onTap: () => void; isTarget: boolean }) {
  const f = FORMULAS.find((x) => x.id === beat.id)!;
  // Travel from y:100% → y:-10% (off top) over `lifetime`
  return (
    <motion.button
      onClick={onTap}
      initial={{ y: "110%", x: 0, scale: 0.8, opacity: 0 }}
      animate={{
        y: "-15%",
        x: [0, beat.sway, -beat.sway, 0],
        scale: 1,
        opacity: 1,
      }}
      transition={{
        y: { duration: beat.lifetime / 1000, ease: "linear" },
        x: { duration: beat.lifetime / 1000, ease: "easeInOut", times: [0, 0.33, 0.66, 1] },
        scale: { duration: 0.35, ease: "backOut" },
        opacity: { duration: 0.3 },
      }}
      className="absolute -translate-x-1/2 cursor-pointer focus:outline-none"
      style={{ left: `${beat.x}%`, bottom: 0 }}
    >
      <div className="relative">
        {/* particle trail */}
        <div
          className="absolute left-1/2 top-full h-32 w-1.5 -translate-x-1/2 opacity-80"
          style={{
            background: `linear-gradient(180deg, ${f.hex}, transparent)`,
            filter: "blur(2px)",
          }}
        />
        {/* outer pulse ring */}
        <div
          className="absolute inset-0 animate-pulse-ring rounded-full"
          style={{ boxShadow: `0 0 0 2px ${f.hex}` }}
        />
        {/* holographic disc */}
        <div
          className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 font-display text-xs font-bold backdrop-blur-md"
          style={{
            color: "white",
            borderColor: f.hex,
            background: `radial-gradient(circle, color-mix(in oklch, ${f.hex} 38%, transparent), color-mix(in oklch, ${f.hex} 5%, transparent))`,
            boxShadow: `0 0 50px ${f.hex}, inset 0 0 30px color-mix(in oklch, ${f.hex} 40%, transparent)`,
          }}
        >
          <FormulaIcon id={f.id} hex={f.hex} />
          <div className="mt-1 text-[11px] tracking-wide" style={{ textShadow: `0 0 10px ${f.hex}` }}>{f.label.toUpperCase()}</div>
        </div>
        {isTarget && (
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.3em]"
            style={{ color: f.hex }}
          >
            ● TAP
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

function FormulaIcon({ id, hex }: { id: string; hex: string }) {
  // Simple inline SVG glyphs per formula
  const common = { width: 22, height: 22, fill: "none", stroke: hex, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "DHA":        return <svg {...common}><path d="M11 2c4 3 4 7 0 10-4 3-4 7 0 10" /><circle cx="11" cy="11" r="2" /></svg>;
    case "HMO":        return <svg {...common}><circle cx="7" cy="11" r="3" /><circle cx="15" cy="7" r="2.5" /><circle cx="15" cy="15" r="2.5" /><path d="M9 10l4-2M9 12l4 2" /></svg>;
    case "PROBIOTICS": return <svg {...common}><ellipse cx="11" cy="11" rx="6" ry="3" /><circle cx="8" cy="11" r="1" /><circle cx="14" cy="11" r="1" /></svg>;
    case "IRON":       return <svg {...common}><path d="M5 3h12l-2 8a4 4 0 0 1-8 0z" /></svg>;
    case "CALCIUM":    return <svg {...common}><path d="M11 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>;
    case "PROTEIN":    return <svg {...common}><path d="M4 10c2-4 4-4 7 0s5 4 7 0" /><path d="M4 14c2-4 4-4 7 0s5 4 7 0" /></svg>;
    case "VITD":       return <svg {...common}><circle cx="11" cy="11" r="3.5" /><path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.5 4.5l1.5 1.5M16 16l1.5 1.5M4.5 17.5L6 16M16 6l1.5-1.5" /></svg>;
    case "OMEGA":      return <svg {...common}><path d="M3 14c4 4 8-6 12-2M3 10c4-4 8 6 12 2" /></svg>;
    case "IMMUNITY":   return <svg {...common}><path d="M11 2l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V5z" /></svg>;
    case "GROWTH":     return <svg {...common}><path d="M11 18V6M6 11l5-5 5 5" /></svg>;
    case "DIGESTION":  return <svg {...common}><path d="M5 7c4 0 4 8 8 8s4-8 8-8" /></svg>;
    default:           return null;
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="font-display mb-3 text-[10px] tracking-[0.4em] text-[color:var(--neon-cyan)]/80">{title}</div>
      {children}
    </div>
  );
}

function IconBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="glass flex h-14 w-14 items-center justify-center rounded-xl text-white transition hover:scale-105 hover:bg-white/10">
      {children}
    </button>
  );
}

function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 28; const c = 2 * Math.PI * r;
  const pct = seconds / total;
  const stroke = pct > 0.5 ? "var(--neon-cyan)" : pct > 0.25 ? "var(--neon-gold)" : "var(--neon-pink)";
  return (
    <svg width={70} height={70} className="-rotate-90">
      <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={5} />
      <circle cx={35} cy={35} r={r} fill="none" stroke={stroke} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ filter: `drop-shadow(0 0 8px ${stroke})`, transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
}

function EnergyBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-display tracking-[0.2em] text-white/90">{label}</span>
        <span className="font-display tabular-nums" style={{ color }}>{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div animate={{ width: `${value}%` }} className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, color-mix(in oklch, ${color} 50%, white))`, boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color: string }) {
  return (
    <div className="mb-2 flex items-center justify-between last:mb-0">
      <span className="text-xs text-white/80">{label}</span>
      <span className="font-display text-lg font-bold tabular-nums" style={{ color, textShadow: `0 0 8px ${color}` }}>{value}{suffix}</span>
    </div>
  );
}

function makeQueue(n: number) {
  return Array.from({ length: n }, () => pick(FORMULAS).id);
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function coachWord(combo: number) {
  if (combo >= 20) return "ULTRA";
  if (combo >= 10) return "GREAT";
  if (combo >= 5) return "GOOD";
  return "READY";
}