"use client";

import { CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

// Cores institucionais (faixa SUS) — a celebração é festiva, mas na paleta da marca.
const CONFETTI_COLORS = ["#0b4f82", "#0b7a4b", "#e0a300", "#c2352c", "#1091c2"];

/**
 * Comemoração exibida quando a pessoa conclui uma avaliação.
 *
 * Mostra uma mensagem de parabéns e uma chuva de confete (canvas, leve e sem
 * dependência). Respeita `prefers-reduced-motion`: quando o usuário pediu menos
 * animação, a celebração aparece sem o confete. Fecha por botão, clique fora ou Esc.
 */
export function CompletionCelebration({
  open,
  onClose,
  title = "Parabéns, você concluiu!",
  message,
  actionLabel = "Continuar",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  actionLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const element = canvas;
    const ctx = context;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      element.width = window.innerWidth * dpr;
      element.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const width = () => window.innerWidth;
    const height = () => window.innerHeight;
    const confetti = Array.from({ length: 320 }, (_, index) => ({
      x: index % 2 === 0 ? Math.random() * width() * 0.24 : width() * (0.76 + Math.random() * 0.24),
      y: height() * (0.1 + Math.random() * 0.55),
      vx: index % 2 === 0 ? 3 + Math.random() * 9 : -3 - Math.random() * 9,
      vy: -4 - Math.random() * 10,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));

    const fireworks = Array.from({ length: 9 }, (_, burst) => {
      const launchAt = burst * 22;
      const centerX = width() * (0.12 + Math.random() * 0.76);
      const centerY = height() * (0.1 + Math.random() * 0.42);
      return Array.from({ length: 42 }, (_, ray) => {
        const angle = (Math.PI * 2 * ray) / 42 + Math.random() * 0.08;
        const speed = 2.4 + Math.random() * 4.8;
        return {
          launchAt,
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: CONFETTI_COLORS[(burst + ray) % CONFETTI_COLORS.length],
        };
      });
    }).flat();

    let frame = 0;
    let animation = 0;
    function tick() {
      frame += 1;
      ctx.clearRect(0, 0, width(), height());
      let alive = 0;
      for (const particle of confetti) {
        particle.vy += 0.22; // gravidade
        particle.vx *= 0.99;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rot += particle.vr;
        if (particle.y < height() + 20) alive += 1;
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.globalAlpha = Math.max(0, 1 - frame / 220);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
        ctx.restore();
      }
      for (const spark of fireworks) {
        const age = frame - spark.launchAt;
        if (age < 0 || age > 76) continue;
        alive += 1;
        const previousX = spark.x;
        const previousY = spark.y;
        spark.vy += 0.055;
        spark.vx *= 0.986;
        spark.vy *= 0.986;
        spark.x += spark.vx;
        spark.y += spark.vy;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(spark.x, spark.y);
        ctx.strokeStyle = spark.color;
        ctx.globalAlpha = Math.max(0, 1 - age / 76);
        ctx.lineWidth = age < 18 ? 3 : 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (alive > 0 && frame < 260) animation = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, width(), height());
    }
    animation = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, width(), height());
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
      <button type="button" aria-label="Fechar celebração" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-md" />
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />
      <div className="relative z-[2] w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--status-success-border)] bg-[var(--surface-card)] p-8 text-center shadow-[0_32px_100px_rgba(2,24,49,.45)] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[var(--brand-solid)] via-[var(--status-success-text)] to-[var(--brand-accent)]" aria-hidden="true" />
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)] ring-8 ring-[var(--status-success-bg)]/50">
          <PartyPopper className="h-10 w-10" aria-hidden="true" />
        </span>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[var(--status-success-text)]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ciclo concluído
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <h2 id="celebration-title" className="mt-3 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[var(--text-secondary)]">{message}</p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-2 text-sm font-bold text-[var(--status-success-text)]">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Envio confirmado com sucesso
        </p>
        <button type="button" onClick={onClose} autoFocus className="primary-button mt-7 w-full justify-center">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
