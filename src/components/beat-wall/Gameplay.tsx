import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Background } from "./Background";
import { FORMULAS, playFormula, setMuted } from "@/lib/audio";
import nanLogo from "@/assets/nan-logo.png";
import babyImg from "@/assets/baby.png";
import { Volume2, VolumeX } from "lucide-react";

const DURATION = 60;
const LIFETIME_MS = 6500;       // constant upward travel time
const SPAWN_INTERVAL_MS = 700;  // constant spawn rate
const MAX_ON_SCREEN = 8;

type ActiveBeat = {
  uid: string;
  id: string;
  x: number;       // % horizontal
  sway: number;    // horizontal drift amplitude
  spawn: number;
};

export type GameResult = {
  score: number;
  totalTaps: number;
  formulaCounts: Record<string, number>;
  duration: number;
};

export function Gameplay({ playerName, onEnd }: { playerName: string; onEnd: (r: GameResult) => void }) {
  const [phase, setPhase] = useState<"countdown" | "play" | "ended">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [time, setTime] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [taps, setTaps] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [pulse, setPulse] = useState(0);          // background glow trigger
  const [babyBeat, setBabyBeat] = useState(0);    // baby reaction trigger
  const [floatScore, setFloatScore] = useState<{ uid: string; pts: number; x: number; y: number } | null>(null);

  const [beats, setBeats] = useState<ActiveBeat[]>([]);
  const beatsRef = useRef(beats);
  beatsRef.current = beats;

  const formulaCounts = useRef<Record<string, number>>({});

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("play"); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  // Game timer
  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setTime((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // End game
  useEffect(() => {
    if (phase === "play" && time === 0) {
      setPhase("ended");
      onEnd({
        score,
        totalTaps: taps,
        formulaCounts: formulaCounts.current,
        duration: DURATION,
      });
    }
  }, [time, phase, score, taps, onEnd]);

  // Constant spawner — no difficulty scaling, no speed changes
  useEffect(() => {
    if (phase !== "play") return;
    const spawn = () => {
      if (beatsRef.current.length >= MAX_ON_SCREEN) return;
      const id = FORMULAS[Math.floor(Math.random() * FORMULAS.length)].id;
      const x = 15 + Math.random() * 70;
      const sway = 2 + Math.random() * 4;
      const beat: ActiveBeat = { uid: `${Date.now()}-${Math.random()}`, id, x, sway, spawn: performance.now() };
      setBeats((b) => [...b, beat]);
      window.setTimeout(() => {
        setBeats((b) => b.filter((x) => x.uid !== beat.uid));
      }, LIFETIME_MS + 200);
    };
    const id = setInterval(spawn, SPAWN_INTERVAL_MS);
    spawn();
    return () => clearInterval(id);
  }, [phase]);

  const handleTap = useCallback((beat: ActiveBeat, evt: React.MouseEvent) => {
    playFormula(beat.id);
    formulaCounts.current[beat.id] = (formulaCounts.current[beat.id] || 0) + 1;
    setTaps((n) => n + 1);
    const points = 100;
    setScore((s) => s + points);
    setPulse((p) => p + 1);
    setBabyBeat((b) => b + 1);
    const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
    const uid = beat.uid;
    setFloatScore({ uid, pts: points, x: rect.left + rect.width / 2, y: rect.top });
    setTimeout(() => setFloatScore((p) => (p?.uid === uid ? null : p)), 800);
    setBeats((bs) => bs.filter((b) => b.uid !== beat.uid));
  }, []);

  const toggleMute = () => {
    const n = !muted; setMutedState(n); setMuted(n);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Background intensity={0.6} />

      {/* Tap-driven background glow pulse */}
      <AnimatePresence>
        <motion.div
          key={pulse}
          initial={{ opacity: 0.35 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }}
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: "radial-gradient(ellipse at center, color-mix(in oklch, var(--neon-cyan) 25%, transparent), transparent 70%)" }}
        />
      </AnimatePresence>

      {/* Top Nav — Logo + title + mute only */}
      <div className="relative z-30 flex items-center justify-between px-10 py-6">
        <img src={nanLogo} alt="NAN" className="h-16 w-auto drop-shadow-[0_0_15px_rgba(125,227,255,0.6)]" />
        <div className="text-center">
          <h1 className="font-display text-5xl font-black leading-none">
            <span className="neon-text-cyan">NAN</span> <span className="neon-text-white">BEAT</span> <span className="neon-text-pink">WALL</span>
          </h1>
          <p className="mt-1 text-sm font-light tracking-[0.2em] text-white/70">Tap the floating formulas. Compose your music.</p>
        </div>
        <button onClick={toggleMute} className="glass flex h-14 w-14 items-center justify-center rounded-xl text-white transition hover:scale-105 hover:bg-white/10">
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </button>
      </div>

      {/* Floating field — full screen below the nav */}
      <div className="absolute inset-0 z-20">
        {beats.map((b) => (
          <FloatingBeat key={b.uid} beat={b} onTap={(e) => handleTap(b, e)} />
        ))}
      </div>

      {/* Center baby — sits behind the floating notes, reacts on tap */}
      <motion.div
        key={`baby-${babyBeat}`}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.06, 1], rotate: [0, -2, 2, 0] }}
        transition={{ duration: 0.6 }}
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative">
          <div className="absolute inset-0 -m-16 rounded-full animate-pulse"
            style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--neon-cyan) 30%, transparent), transparent 70%)" }} />
          <img src={babyImg} alt="" className="relative h-[300px] w-auto opacity-80" draggable={false} />
        </div>
      </motion.div>

      {/* HUD — minimal */}
      <div className="pointer-events-none absolute left-10 top-32 z-30 flex flex-col gap-3">
        <HudCard label="SCORE" value={score.toLocaleString()} color="var(--neon-gold)" />
        <HudCard label="BEATS PLAYED" value={taps.toString()} color="var(--neon-cyan)" />
      </div>
      <div className="pointer-events-none absolute right-10 top-32 z-30 flex flex-col items-end gap-3">
        <HudCard label={playerName ? `PLAYER · ${playerName.toUpperCase()}` : "PLAYER"} value={`${time}s`} color="var(--neon-pink)" />
      </div>

      {/* Bottom helper */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 text-center">
        <div className="font-display text-xs tracking-[0.5em] text-[color:var(--neon-cyan)]/80">▴ TAP ANY FLOATING FORMULA TO PLAY ITS NOTE ▴</div>
      </div>

      {/* Floating score popup */}
      <AnimatePresence>
        {floatScore && (
          <motion.div
            key={floatScore.uid}
            initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -50 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="pointer-events-none fixed z-40 font-display text-2xl font-black neon-text-gold"
            style={{ left: floatScore.x, top: floatScore.y, transform: "translate(-50%, -100%)" }}
          >
            +{floatScore.pts}
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
            <div className="font-display text-sm tracking-[0.5em] text-[color:var(--neon-cyan)]">
              {playerName ? `${playerName.toUpperCase()} · GET READY` : "GET READY"}
            </div>
            <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="font-display mt-4 text-[240px] font-black neon-text-white">
              {countdown > 0 ? countdown : "GO!"}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FloatingBeat({ beat, onTap }: { beat: ActiveBeat; onTap: (e: React.MouseEvent) => void }) {
  const f = FORMULAS.find((x) => x.id === beat.id)!;
  return (
    <motion.button
      onClick={onTap}
      initial={{ y: "0vh", x: 0, scale: 0.85, opacity: 0 }}
      animate={{
        y: "-120vh",
        x: [0, beat.sway * 8, -beat.sway * 8, beat.sway * 6, 0],
        scale: 1,
        opacity: 1,
      }}
      transition={{
        y: { duration: LIFETIME_MS / 1000, ease: "linear" },
        x: { duration: LIFETIME_MS / 1000, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] },
        scale: { duration: 0.4, ease: "backOut" },
        opacity: { duration: 0.35 },
      }}
      whileTap={{ scale: 1.4 }}
      className="absolute -translate-x-1/2 cursor-pointer focus:outline-none"
      style={{ left: `${beat.x}%`, top: "110vh" }}
    >
      <div className="relative">
        {/* trailing light beam */}
        <div className="absolute left-1/2 top-full h-40 w-1 -translate-x-1/2 opacity-70"
          style={{ background: `linear-gradient(180deg, ${f.hex}, transparent)`, filter: "blur(2px)" }} />
        {/* outer pulse */}
        <div className="absolute inset-0 animate-pulse-ring rounded-full"
          style={{ boxShadow: `0 0 0 2px ${f.hex}` }} />
        {/* disc */}
        <div
          className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 font-display text-xs font-bold backdrop-blur-md"
          style={{
            color: "white",
            borderColor: f.hex,
            background: `radial-gradient(circle, color-mix(in oklch, ${f.hex} 40%, transparent), color-mix(in oklch, ${f.hex} 5%, transparent))`,
            boxShadow: `0 0 50px ${f.hex}, inset 0 0 30px color-mix(in oklch, ${f.hex} 40%, transparent)`,
          }}
        >
          <FormulaIcon id={f.id} hex={f.hex} />
          <div className="mt-1 text-[11px] tracking-wide" style={{ textShadow: `0 0 10px ${f.hex}` }}>
            {f.label.toUpperCase()}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function FormulaIcon({ id, hex }: { id: string; hex: string }) {
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

function HudCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-2xl px-5 py-3">
      <div className="font-display text-[10px] tracking-[0.4em]" style={{ color }}>{label}</div>
      <div className="font-display mt-1 text-3xl font-black tabular-nums" style={{ color, textShadow: `0 0 14px ${color}` }}>
        {value}
      </div>
    </div>
  );
}