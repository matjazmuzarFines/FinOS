"use client";

import { useEffect, useRef } from "react";
import { useAnimacije } from "@/lib/animacije";
import { useTema } from "@/lib/tema";

type Delec = { x: number; y: number; vx: number; vy: number; r: number; oranzen: boolean };

/**
 * Gibljivo ozadje: plavajoči oranžni / sivi prelivi, mreža, zrnatost
 * in mreža delcev (canvas), ki se povezujejo med seboj in z miško.
 * Poraba: delci se premikajo počasi, zato se rišejo 30× na sekundo (60× samo, dokler se premika miška - črte do
 * kazalca morajo biti gladke). Gibanje je vezano na ČAS, ne na sličice (ista hitrost na 60 / 120 / 144 Hz zaslonu).
 */
const KORAK_MS = 1000 / 60; // hitrosti delcev so podane na korak 1/60 s
const MIRNO_MS = 1000 / 30; // razmik med izrisi, ko miška miruje
const MIS_ZIVA_MS = 1200; // toliko po zadnjem premiku miške še riše s polno hitrostjo
export function Ozadje() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animacije = useAnimacije();
  const tema = useTema();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // brez dodatnih animacij se mreža delcev izriše enkrat in miruje
    const reduced = !animacije || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // sivi delci: svetli na temni temi, temni na svetli
    const siva = tema === "svetla" ? "77,77,83" : "220,220,223";
    const mis = { x: -9999, y: -9999, cas: -Infinity };
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
    const MAX2 = MAX * MAX;
    let zadnji = 0;
    const zanka = (zdaj: number) => {
      raf = requestAnimationFrame(zanka);
      // miška miruje -> 30 izrisov na sekundo (-2 ms: sličica zaslona ne pride vedno točno na razmik)
      if (zdaj - mis.cas > MIS_ZIVA_MS && zdaj - zadnji < MIRNO_MS - 2) return;
      // koliko korakov 1/60 s je minilo (največ 3 - po premoru delci ne skočijo)
      const k = zadnji ? Math.min(3, (zdaj - zadnji) / KORAK_MS) : 1;
      zadnji = zdaj;
      risi(k);
    };
    const risi = (k = 1) => {
      ctx.clearRect(0, 0, w, h);
      const trenje = Math.pow(0.995, k);
      for (const d of delci) {
        // rahel privlak k miški
        const mx = mis.x - d.x;
        const my = mis.y - d.y;
        const md = Math.hypot(mx, my);
        if (md < 200 && md > 1) {
          d.vx += (mx / md) * 0.012 * k;
          d.vy += (my / md) * 0.012 * k;
        }
        d.vx *= trenje;
        d.vy *= trenje;
        d.x += d.vx * k;
        d.y += d.vy * k;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
      }
      for (let i = 0; i < delci.length; i++) {
        const a = delci[i];
        for (let j = i + 1; j < delci.length; j++) {
          const b = delci[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MAX2) {
            const dist = Math.sqrt(d2);
            const alfa = (1 - dist / MAX) * 0.28;
            ctx.strokeStyle = a.oranzen || b.oranzen ? `rgba(238,122,58,${alfa})` : `rgba(${siva},${alfa * 0.6})`;
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
        ctx.fillStyle = d.oranzen ? "rgba(238,122,58,0.9)" : `rgba(${siva},0.55)`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (reduced) return;
      mis.x = e.clientX;
      mis.y = e.clientY;
      mis.cas = performance.now();
    };
    const onLeave = () => {
      mis.x = -9999;
      mis.y = -9999;
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      zadnji = 0;
      if (!document.hidden && !reduced) raf = requestAnimationFrame(zanka);
    };
    const onResize = () => {
      velikost();
      if (reduced) risi();
    };

    velikost();
    risi();
    if (!reduced) raf = requestAnimationFrame(zanka);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [animacije, tema]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden fos-ozadje">
      <div className="absolute -left-[15vw] -top-[20vh] h-[70vh] w-[70vh] animate-blob rounded-full bg-[radial-gradient(circle,rgb(202_80_16/0.55),transparent_65%)] blur-3xl" />
      <div className="absolute -right-[10vw] top-[25vh] h-[60vh] w-[60vh] animate-blob rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.35),transparent_65%)] blur-3xl [animation-delay:-8s]" />
      <div className="absolute -bottom-[25vh] left-[30vw] h-[65vh] w-[65vh] animate-blob rounded-full bg-[radial-gradient(circle,rgb(154_154_161/0.22),transparent_65%)] blur-3xl [animation-delay:-14s]" />
      <div className="fos-grid absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="fos-noise absolute inset-0" />
    </div>
  );
}
