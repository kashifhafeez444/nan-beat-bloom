import { useEffect, useRef } from "react";

export function Background({ intensity = 0.5 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const resize = () => {
      cv.width = cv.clientWidth;
      cv.height = cv.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * cv.width,
      y: Math.random() * cv.height,
      r: Math.random() * 2 + 0.5,
      s: Math.random() * 0.5 + 0.1,
      h: Math.random() * 80 + 180,
    }));
    const bars = 64;
    const phase = Array.from({ length: bars }, () => Math.random() * Math.PI * 2);

    const draw = () => {
      const w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);

      // equalizer
      const bw = w / bars;
      const t = performance.now() / 250;
      for (let i = 0; i < bars; i++) {
        const v = (Math.sin(t + phase[i]) * 0.5 + 0.5) * (0.4 + intensity * 0.6);
        const bh = v * h * 0.35;
        const grad = ctx.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, `hsla(${280 + Math.sin(i) * 40}, 90%, 60%, 0.35)`);
        grad.addColorStop(1, `hsla(${200 + Math.cos(i) * 40}, 95%, 70%, 0.05)`);
        ctx.fillStyle = grad;
        ctx.fillRect(i * bw + 2, h - bh, bw - 4, bh);
      }

      // particles
      for (const p of particles) {
        p.y -= p.s * (0.5 + intensity);
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.h}, 100%, 75%, 0.7)`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `hsla(${p.h}, 100%, 70%, 0.8)`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [intensity]);

  return (
    <div className="absolute inset-0 scene-bg overflow-hidden">
      {/* holographic grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklch, var(--neon-cyan) 25%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklch, var(--neon-cyan) 25%, transparent) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* vignette */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)"
      }} />
    </div>
  );
}