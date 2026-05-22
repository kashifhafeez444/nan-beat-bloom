import { useState } from "react";
import { motion } from "framer-motion";
import { Background } from "./Background";
import nanLogo from "@/assets/nan-logo.png";

export function Intro({ onStart }: { onStart: (name: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const canStart = name.trim().length > 1;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Background intensity={0.4} />
      <div className="relative z-10 flex h-full flex-col items-center justify-between px-24 py-12">
        <div className="flex w-full items-start justify-between">
          <img src={nanLogo} alt="NAN" className="h-24 w-auto drop-shadow-[0_0_20px_rgba(125,227,255,0.6)]" />
          <div className="text-right font-display text-xs tracking-[0.5em] text-[color:var(--neon-cyan)]/70">
            INTERACTIVE WELLNESS RHYTHM<br /><span className="text-white/50">EVENT EDITION · 2026</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="flex flex-col items-center gap-8"
        >
          <div className="text-center">
            <div className="font-display text-xs tracking-[0.6em] text-[color:var(--neon-cyan)]">♪  PRESS START TO BEGIN  ♪</div>
            <h1 className="font-display mt-4 text-[140px] font-black leading-none">
              <span className="neon-text-cyan">NAN</span>{" "}
              <span className="neon-text-white">BEAT</span>{" "}
              <span className="neon-text-pink">WALL</span>
            </h1>
            <p className="mt-2 text-2xl font-light text-white/80">
              Tap the beats. Build the health. Create a brighter future.
            </p>
          </div>

          <div className="glass-strong flex w-[640px] flex-col gap-5 rounded-3xl p-10">
            <Field label="YOUR NAME" value={name} onChange={setName} placeholder="Dr. Priya" />
            <Field label="EMAIL" value={email} onChange={setEmail} placeholder="you@hospital.com" />

            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              disabled={!canStart}
              onClick={() => onStart(name.trim(), email.trim())}
              className="group relative mt-2 h-20 overflow-hidden rounded-2xl font-display text-3xl font-black tracking-[0.4em] text-[color:var(--deep-blue-2)] transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "linear-gradient(120deg, var(--neon-cyan), var(--neon-pink), var(--neon-gold))",
                boxShadow: "0 0 40px color-mix(in oklch, var(--neon-cyan) 60%, transparent), inset 0 0 30px rgba(255,255,255,0.4)",
              }}
            >
              <span className="relative z-10">▶  START</span>
              <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-700 group-hover:translate-x-full" />
            </motion.button>
          </div>
        </motion.div>

        <div className="font-display text-sm tracking-[0.4em] text-white/60">
          CREATE YOUR OWN NAN WELLNESS RHYTHM
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="font-display mb-2 text-xs tracking-[0.4em] text-[color:var(--neon-cyan)]/80">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-xl border border-[color:var(--neon-cyan)]/30 bg-white/5 px-5 text-lg text-white outline-none transition focus:border-[color:var(--neon-cyan)] focus:bg-white/10 focus:shadow-[0_0_30px_color-mix(in_oklch,var(--neon-cyan)_40%,transparent)]"
      />
    </label>
  );
}