"use client";

import { useEffect, useRef } from "react";

type Delec = { x: number; y: number; vx: number; vy: number; r: number; oranzen: boolean };

/**
 * Gibljivo ozadje: plavajoči oranžni / sivi prelivi, mreža, zrnatost
 * in mreža delcev (canvas), ki se povezujejo med seboj in z miško.
 */
export function Ozadje() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mis = { x: -9999, y: -9999 };
    let delci: Delec[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    const velikost = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000));
      delci = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
        oranzen: Math.random() < 0.35,
      }));
    };

    const MAX = 130;
    const risi = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of delci) {
        // rahel privlak k miški
        const mx = mis.x - d.x;
        const my = mis.y - d.y;
        const md = Math.hypot(mx, my);
        if (md < 200 && md > 1) {
          d.vx += (mx / md) * 0.012;
          d.vy += (my / md) * 0.012;
        }
        d.vx *= 0.995;
        d.vy *= 0.995;
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
      }
      for (let i = 0; i < delci.length; i++) {
        const a = delci[i];
        for (let j = i + 1; j < delci.length; j++) {
          const b = delci[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < MAX) {
            const alfa = (1 - dist / MAX) * 0.28;
            ctx.strokeStyle = a.oranzen || b.oranzen ? `rgba(238,122,58,${alfa})` : `rgba(220,220,223,${alfa * 0.6})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const md = Math.hypot(a.x - mis.x, a.y - mis.y);
        if (md < 180) {
          ctx.strokeStyle = `rgba(238,122,58,${(1 - md / 180) * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mis.x, mis.y);
          ctx.stroke();
        }
      }
      for (const d of delci) {
        ctx.fillStyle = d.oranzen ? "rgba(238,122,58,0.9)" : "rgba(220,220,223,0.55)";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(risi);
    };

    const onMove = (e: PointerEvent) => {
      mis.x = e.clientX;
      mis.y = e.clientY;
    };
    const onLeave = () => {
      mis.x = -9999;
      mis.y = -9999;
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) risi();
    };

    velikost();
    risi();
    window.addEventListener("resize", velikost);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", velikost);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,#2b2b2f_0%,#1c1c1f_45%,#121214_100%)]">
      <div className="absolute -left-[15vw] -top-[20vh] h-[70vh] w-[70vh] animate-blob rounded-full bg-[radial-gradient(circle,rgb(202_80_16/0.55),transparent_65%)] blur-3xl" />
      <div className="absolute -right-[10vw] top-[25vh] h-[60vh] w-[60vh] animate-blob rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.35),transparent_65%)] blur-3xl [animation-delay:-8s]" />
      <div className="absolute -bottom-[25vh] left-[30vw] h-[65vh] w-[65vh] animate-blob rounded-full bg-[radial-gradient(circle,rgb(154_154_161/0.22),transparent_65%)] blur-3xl [animation-delay:-14s]" />
      <div className="fos-grid absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="fos-noise absolute inset-0" />
    </div>
  );
}
