"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#0071e3", "#34c759", "#ff9500", "#af52de", "#ff2d55"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
  ttl: number;
}

/**
 * A one-shot, tasteful confetti burst rendered on a full-screen canvas.
 * Fires when `active` flips to true; respects prefers-reduced-motion.
 */
export function Confetti({ active, count = 90 }: { active: boolean; count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    const W = canvas.width;
    const H = canvas.height;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const fromLeft = Math.random() < 0.5;
      particles.push({
        x: (fromLeft ? 0.12 : 0.88) * W + (Math.random() - 0.5) * 120 * dpr,
        y: -20 * dpr - Math.random() * 60 * dpr,
        vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 4) * dpr,
        vy: (2 + Math.random() * 3) * dpr,
        size: (6 + Math.random() * 6) * dpr,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        life: 0,
        ttl: 110 + Math.random() * 70,
      });
    }

    const gravity = 0.12 * dpr;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of particles) {
        p.life++;
        if (p.life > p.ttl || p.y > H + 40 * dpr) continue;
        alive = true;
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.ttl);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (alive) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [active, count]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" aria-hidden />;
}
