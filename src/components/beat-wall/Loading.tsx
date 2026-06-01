import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Background } from "./Background";
import nanLogo from "@/assets/nan-logo.png";

const MESSAGES = [
  "Analyzing your musical interactions…",
  "Combining NAN formula rhythms…",
  "Building your personalized soundtrack…",
  "Synchronizing musical elements…",
  "Enhancing rhythm composition…",
  "Finalizing your NAN Beat Mix…",
  "Preparing your music experience…",
];

const DURATION_MS = 5000;

export function Loading({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / DURATION_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Background intensity={0.85} />
      <div className="relative z-20 flex h-full flex-col items-center justify-center px-10">
        <img src={nanLogo} alt="NAN" className="absolute top-10 left-10 h-14 w-auto drop-shadow-[0_0_15px_rgba(125,227,255,0.6)]" />

        {/* Holographic core */}
        <div className="relative mb-12 h-64 w-64">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ rotate: 360 }}
              transition={{ duration: 6 + i * 2, repeat: Infinity, ease: "linear", repeatType: "loop" }}
              className="absolute inset-0 rounded-full border"
              style={{
                borderColor: ["#7DE3FF", "#FF6BD0", "#FFD66B", "#C77DFF"][i],
                borderStyle: i % 2 === 0 ? "solid" : "dashed",
                margin: i * 14,
                boxShadow: `0 0 30px ${["#7DE3FF", "#FF6BD0", "#FFD66B", "#C77DFF"][i]}`,
              }}
            />
          ))}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle, var(--neon-cyan), color-mix(in oklch, var(--neon-pink) 50%, transparent), transparent)",
              boxShadow: "0 0 80px var(--neon-cyan), 0 0 140px color-mix(in oklch, var(--neon-pink) 40%, transparent)",
            }}
          />
          {/* Particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={`p-${i}`}
              animate={{
                x: [0, Math.cos(i) * 120, 0],
                y: [0, Math.sin(i) * 120, 0],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 2 + (i % 4) * 0.4, repeat: Infinity, delay: i * 0.15 }}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
              style={{
                background: ["#7DE3FF", "#FF6BD0", "#FFD66B", "#C77DFF"][i % 4],
                boxShadow: `0 0 12px ${["#7DE3FF", "#FF6BD0", "#FFD66B", "#C77DFF"][i % 4]}`,
              }}
            />
          ))}
        </div>

        <div className="font-display text-xs tracking-[0.6em] text-[color:var(--neon-cyan)]">AI MUSIC GENERATION</div>
        <h2 className="font-display mt-3 text-5xl font-black neon-text-white">CREATING YOUR NAN BEAT MIX</h2>

        <div className="mt-10 h-10 w-full max-w-2xl text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIdx}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="font-display text-base tracking-[0.25em] text-white/80"
            >
              {MESSAGES[msgIdx]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="mt-8 h-2 w-full max-w-2xl overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-pink), var(--neon-gold))",
              boxShadow: "0 0 20px var(--neon-cyan)",
            }}
          />
        </div>
        <div className="font-display mt-3 text-xs tabular-nums tracking-[0.4em] text-white/60">
          {Math.round(progress * 100)}%
        </div>
      </div>
    </div>
  );
}