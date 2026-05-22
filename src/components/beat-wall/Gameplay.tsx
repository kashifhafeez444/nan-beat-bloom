import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Background } from "./Background";
import { FORMULAS, playFormula, playError, startBeat, stopBeat, setBpm, startRecording, recordHit, getRecording, isMuted, setMuted, type RecordedHit } from "@/lib/audio";
import nanLogo from "@/assets/nan-logo.png";
import babyImg from "@/assets/baby.png";
import { Home, Volume2, VolumeX, Pause, Play } from "lucide-react";

const DURATION = 60;

type ActiveBeat = {
  uid: string;
  id: string;
  x: number; // %
  y: number; // %
  spawn: number;
  lifetime: number; // ms
};

export type GameResult = {
  score: number;
  bestCombo: number;
  accuracy: number;
  hits: RecordedHit[];
  formulaCounts: Record<string, number>;
  totalTaps: number;
  correctTaps: number;
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
  const speedRef = useRef<"NORMAL" | "FAST" | "EXTREME">("NORMAL");
  const [speedLabel, setSpeedLabel] = useState<"NORMAL" | "FAST" | "EXTREME">("NORMAL");

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("play");
      startBeat(96);
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

  // Difficulty + warnings
  useEffect(() => {
    if (phase !== "play") return;
    const elapsed = DURATION - time;
    if (elapsed === 20) { setWarning("GET READY!  Beats are speeding up"); speedRef.current = "FAST"; setSpeedLabel("FAST"); setBpm(120); }
    if (elapsed === 40) { setWarning("CHALLENGE MODE ACTIVATED"); speedRef.current = "EXTREME"; setSpeedLabel("EXTREME"); setBpm(140); }
    if (elapsed === 55) { setWarning("FINAL RHYTHM RUSH!"); }
    if (warning) {
      const t = setTimeout(() => setWarning(null), 2200);
      return () => clearTimeout(t);
    }
  }, [time, phase, warning]);

  // End game
  useEffect(() => {
    if (phase === "play" && time === 0) {
      stopBeat();
      setPhase("ended");
      const s = tapStats.current;
      onEnd({
        score, bestCombo, accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
        hits: getRecording(), formulaCounts: s.formulaCounts, totalTaps: s.total, correctTaps: s.correct,
      });
    }
  }, [time, phase, score, bestCombo, onEnd]);

  // Beat spawner
  useEffect(() => {
    if (phase !== "play" || paused) return;
    const spawn = () => {
      const speed = speedRef.current;
      const lifetime = speed === "EXTREME" ? 1700 : speed === "FAST" ? 2200 : 2800;
      const maxOnScreen = speed === "EXTREME" ? 6 : speed === "FAST" ? 5 : 4;
      if (beatsRef.current.length >= maxOnScreen) return;
      // 70% chance to spawn from queue head, otherwise random for distractor
      const id = Math.random() < 0.7 ? queueRef.current[0] : pick(FORMULAS).id;
      const angle = Math.random() * Math.PI * 2;
      const radius = 22 + Math.random() * 14;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius * 0.75;
      const beat: ActiveBeat = {
        uid: `${Date.now()}-${Math.random()}`,
        id, x, y, spawn: performance.now(), lifetime,
      };
      setBeats((b) => [...b, beat]);
      window.setTimeout(() => {
        setBeats((b) => b.filter((x) => x.uid !== beat.uid));
      }, lifetime);
    };
    const speed = speedRef.current;
    const interval = speed === "EXTREME" ? 600 : speed === "FAST" ? 800 : 1100;
    const id = setInterval(spawn, interval);
    return () => clearInterval(id);
  }, [phase, paused, speedLabel]);

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
            <p className="text-sm leading-relaxed text-white/80">Tap the correct NAN formula beat shown in the queue before it disappears.</p>
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
          {/* Holographic floor */}
          <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2">
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

          {/* Baby */}
          <motion.div
            animate={babyState === "happy" ? { y: [0, -10, 0], rotate: [-2, 2, -2] } : babyState === "neutral" ? { y: [0, -5, 0] } : { y: 0 }}
            transition={{ duration: babyState === "happy" ? 0.5 : 1.2, repeat: Infinity }}
            className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative">
              <div className="absolute inset-0 -m-12 rounded-full animate-pulse"
                style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--neon-cyan) 35%, transparent), transparent 70%)" }} />
              <img src={babyImg} alt="Baby" className="relative h-[420px] w-auto" draggable={false} />
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

          {/* Beats */}
          <AnimatePresence>
            {beats.map((b) => (
              <BeatNode key={b.uid} beat={b} onTap={() => handleTap(b)} isTarget={queue[0] === b.id} />
            ))}
          </AnimatePresence>

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

function BeatNode({ beat, onTap, isTarget }: { beat: ActiveBeat; onTap: () => void; isTarget: boolean }) {
  const f = FORMULAS.find((x) => x.id === beat.id)!;
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ type: "spring", damping: 14 }}
      onClick={onTap}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
      style={{ left: `${beat.x}%`, top: `${beat.y}%` }}
    >
      <div className="relative">
        {/* energy beam to floor */}
        <div
          className="absolute left-1/2 top-full h-32 w-1 -translate-x-1/2 opacity-60"
          style={{ background: `linear-gradient(180deg, ${f.hex}, transparent)`, filter: "blur(1px)" }}
        />
        <div
          className="absolute inset-0 animate-pulse-ring rounded-full"
          style={{ boxShadow: `0 0 0 2px ${f.hex}` }}
        />
        <div
          className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border-2 font-display text-xs font-bold backdrop-blur-md"
          style={{
            color: "white",
            borderColor: f.hex,
            background: `radial-gradient(circle, color-mix(in oklch, ${f.hex} 35%, transparent), color-mix(in oklch, ${f.hex} 5%, transparent))`,
            boxShadow: `0 0 40px ${f.hex}, inset 0 0 30px color-mix(in oklch, ${f.hex} 40%, transparent)`,
          }}
        >
          <div className="text-[15px] tracking-wide" style={{ textShadow: `0 0 10px ${f.hex}` }}>{f.label.toUpperCase()}</div>
          <div className="mt-0.5 text-[9px] font-normal text-white/80">{f.sub}</div>
        </div>
        {isTarget && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[0.3em]" style={{ color: f.hex }}>● TAP</div>
        )}
      </div>
    </motion.button>
  );
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