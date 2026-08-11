"use client";

import { PartyPopper } from "lucide-react";
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
    const particles = Array.from({ length: 150 }, () => ({
      x: width() / 2 + (Math.random() - 0.5) * width() * 0.5,
      y: height() * 0.3 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 9,
      vy: -7 - Math.random() * 8,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));

    let frame = 0;
    let animation = 0;
    function tick() {
      frame += 1;
      ctx.clearRect(0, 0, width(), height());
      let alive = 0;
      for (const particle of particles) {
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
      if (alive > 0 && frame < 220) animation = requestAnimationFrame(tick);
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
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center shadow-2xl">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
          <PartyPopper className="h-8 w-8" aria-hidden="true" />
        </span>
        <h2 id="celebration-title" className="mt-5 text-2xl font-black text-[var(--text-primary)]">{title}</h2>
        <p className="mt-2 leading-6 text-[var(--text-secondary)]">{message}</p>
        <button type="button" onClick={onClose} autoFocus className="primary-button mt-6 w-full justify-center">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
