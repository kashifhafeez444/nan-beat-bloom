import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Background } from "./Background";
import nanLogo from "@/assets/nan-logo.png";
import babyImg from "@/assets/baby.png";
import { FORMULAS, playRecording } from "@/lib/audio";
import type { GameResult } from "./Gameplay";
import { Play, Pause, RotateCcw } from "lucide-react";

export function Results({ result, playerName, onReplay }: { result: GameResult; playerName: string; onReplay: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const play = () => {
    if (playing) { stopRef.current?.(); setPlaying(false); return; }
    setPlaying(true); setProgress(0);
    stopRef.current = playRecording(result.hits, setProgress, () => setPlaying(false));
  };

  const topFormulas = Object.entries(result.formulaCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, n]) => ({ f: FORMULAS.find((x) => x.id === id)!, n }));

  const duration = result.hits.length ? result.hits[result.hits.length - 1].t + 0.5 : 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Background intensity={0.9} />

      {/* Floating celebration formulas */}
      {FORMULAS.slice(0, 8).map((f, i) => (
        <motion.div
          key={f.id}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [-20, 20, -20], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
          className="pointer-events-none absolute font-display text-2xl font-black"
          style={{
            left: `${10 + (i * 11) % 80}%`,
            top: `${15 + (i * 17) % 60}%`,
            color: f.hex,
            textShadow: `0 0 20px ${f.hex}`,
          }}
        >
          ♪ {f.label}
        </motion.div>
      ))}

      <div className="relative z-20 flex h-full flex-col p-10">
        <div className="flex items-start justify-between">
          <img src={nanLogo} alt="NAN" className="h-16 w-auto drop-shadow-[0_0_15px_rgba(125,227,255,0.6)]" />
          <div className="text-center">
            <div className="font-display text-xs tracking-[0.5em] text-[color:var(--neon-cyan)]">RHYTHM COMPLETE</div>
            <h1 className="font-display text-7xl font-black neon-text-white">PERFECT COMBO!</h1>
            <div className="font-display mt-1 text-sm tracking-[0.4em] text-[color:var(--neon-pink)]">{playerName ? `WELL DONE, ${playerName.toUpperCase()}` : "WELL DONE"}</div>
          </div>
          <button onClick={onReplay} className="glass flex h-14 items-center gap-2 rounded-xl px-5 text-white hover:scale-105">
            <RotateCcw className="h-5 w-5" /> <span className="font-display text-sm tracking-[0.3em]">REPLAY</span>
          </button>
        </div>

        <div className="mt-8 grid flex-1 grid-cols-3 gap-6">
          {/* Stats */}
          <div className="flex flex-col gap-4">
            <StatCard label="FINAL SCORE" value={result.score.toLocaleString()} color="var(--neon-gold)" big />
            <StatCard label="BEST COMBO" value={`x${result.bestCombo}`} color="var(--neon-pink)" />
            <StatCard label="ACCURACY" value={`${result.accuracy}%`} color="var(--neon-cyan)" />
            <StatCard label="TOTAL TAPS" value={`${result.correctTaps} / ${result.totalTaps}`} color="var(--neon-green)" />
          </div>

          {/* Center - baby with formula crown */}
          <div className="relative flex flex-col items-center justify-center">
            <motion.div
              animate={{ y: [-8, 8, -8], rotate: [-2, 2, -2] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="relative"
            >
              <div className="absolute inset-0 -m-20 animate-pulse rounded-full" style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--neon-cyan) 40%, transparent), transparent 70%)" }} />
              <img src={babyImg} alt="" className="relative h-[380px] w-auto" />
            </motion.div>
            <div className="mt-2 font-display text-xs tracking-[0.4em] text-[color:var(--neon-cyan)]">STRONG INSIDE · BRIGHT FUTURE</div>

            {/* Audio player */}
            <div className="glass-strong mt-6 w-full rounded-2xl p-5">
              <div className="font-display mb-3 text-[10px] tracking-[0.4em] text-[color:var(--neon-cyan)]">YOUR PERSONALIZED NAN BEAT MIX</div>
              <div className="flex items-center gap-4">
                <button onClick={play} className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-pink))", boxShadow: "0 0 30px color-mix(in oklch, var(--neon-cyan) 60%, transparent)" }}>
                  {playing ? <Pause className="h-6 w-6 text-[color:var(--deep-blue-2)]" /> : <Play className="ml-1 h-6 w-6 text-[color:var(--deep-blue-2)]" />}
                </button>
                <div className="flex-1">
                  <Waveform progress={progress} active={playing} />
                  <div className="mt-1 flex justify-between text-[10px] tabular-nums text-white/60">
                    <span>{fmt(progress * duration)}</span>
                    <span>{fmt(duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Formula mastery + QR */}
          <div className="flex flex-col gap-4">
            <div className="glass rounded-2xl p-5">
              <div className="font-display mb-3 text-[10px] tracking-[0.4em] text-[color:var(--neon-cyan)]">FORMULA MASTERY</div>
              {topFormulas.length === 0 && <p className="text-sm text-white/60">No beats recorded.</p>}
              {topFormulas.map(({ f, n }) => {
                const max = topFormulas[0].n;
                return (
                  <div key={f.id} className="mb-2 last:mb-0">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-display tracking-[0.2em]" style={{ color: f.hex }}>{f.label}</span>
                      <span className="tabular-nums text-white/80">x{n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: f.hex, boxShadow: `0 0 8px ${f.hex}` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="glass-strong flex flex-1 flex-col items-center justify-center rounded-2xl p-6">
              <div className="font-display mb-3 text-center text-[10px] tracking-[0.4em] text-[color:var(--neon-cyan)]">SCAN TO DOWNLOAD<br />YOUR PERSONALIZED MP3</div>
              <QRPlaceholder />
              <div className="mt-3 text-center text-xs text-white/70">Take your NAN wellness<br />rhythm home.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="font-display text-[10px] tracking-[0.4em]" style={{ color }}>{label}</div>
      <div className={`font-display ${big ? "text-6xl" : "text-4xl"} mt-1 font-black tabular-nums`} style={{ color, textShadow: `0 0 20px ${color}` }}>{value}</div>
    </div>
  );
}

function Waveform({ progress, active }: { progress: number; active: boolean }) {
  const bars = 60;
  return (
    <div className="flex h-10 items-center gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => {
        const played = i / bars < progress;
        const h = 20 + Math.sin(i * 0.7) * 18 + Math.cos(i * 1.3) * 10 + (active ? Math.sin(performance.now() / 200 + i) * 6 : 0);
        return (
          <div key={i} className="w-[3px] rounded-full transition"
            style={{
              height: `${Math.abs(h)}%`,
              background: played ? "linear-gradient(180deg, var(--neon-cyan), var(--neon-pink))" : "rgba(255,255,255,0.15)",
              boxShadow: played ? "0 0 6px var(--neon-cyan)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function QRPlaceholder() {
  // simple decorative QR-like grid
  return (
    <div className="relative grid h-44 w-44 grid-cols-12 grid-rows-12 gap-[2px] rounded-xl bg-white p-2">
      {Array.from({ length: 144 }).map((_, i) => {
        const x = i % 12, y = Math.floor(i / 12);
        const corner = (x < 3 && y < 3) || (x > 8 && y < 3) || (x < 3 && y > 8);
        const on = corner ? !(x > 0 && x < 2 && y > 0 && y < 2) : Math.random() > 0.55;
        return <div key={i} className={on ? "bg-[color:var(--deep-blue-2)]" : ""} />;
      })}
    </div>
  );
}

function fmt(s: number) {
  if (!isFinite(s)) s = 0;
  const m = Math.floor(s / 60).toString().padStart(1, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}