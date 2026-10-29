"use client";

import type { CSSProperties } from "react";

/**
 * Finesek - maskota Fines, sestavljen iz delov (public/finesek/*.webp).
 * Vse mere so v "risarskih" enotah platna 640 × 750 (tla na y = 748); `s` je merilo v px na enoto.
 * Vsak ud = zunanji div (položaj + poza s prehodom) > slika (ponavljajoča animacija), oba z isto točko vrtenja.
 */
export type Pogled = "spredaj" | "stran";
export type Poza = "tek" | "stoji" | "seze" | "vlece" | "veselje" | "maha";

export const PLATNO = { w: 640, h: 750, teloDesno: 615 };

type Ud = {
  src: string;
  w: number;
  h: number;
  /** točka vrtenja v px slike */
  px: number;
  py: number;
};

const NOGA_L: Ud = { src: "/finesek/noga-leva.webp", w: 113, h: 170, px: 70, py: 14 };
const NOGA_D: Ud = { src: "/finesek/noga-desna.webp", w: 133, h: 170, px: 56, py: 13 };
const ROKA_L: Ud = { src: "/finesek/roka-leva.webp", w: 200, h: 133, px: 188, py: 100 };
const ROKA_D: Ud = { src: "/finesek/roka-desna.webp", w: 200, h: 109, px: 11, py: 75 };

// Poze rok spredaj (stopinje): + = v smeri urinega kazalca
const POZE: Record<Exclude<Poza, "tek">, { l: number; d: number }> = {
  stoji: { l: -60, d: 60 },
  seze: { l: -55, d: -38 },
  vlece: { l: -55, d: 42 },
  veselje: { l: 48, d: -48 },
  maha: { l: 42, d: 22 },
};

const TEK = 0.34; // s, pol koraka

function Del({ ud, x, y, rot = 0, anim, z, filter }: { ud: Ud; x: number; y: number; rot?: number; anim?: string; z: number; filter?: string }) {
  const izvor = `${ud.px}px ${ud.py}px`;
  const zunaj: CSSProperties = {
    position: "absolute",
    left: x - ud.px,
    top: y - ud.py,
    width: ud.w,
    height: ud.h,
    zIndex: z,
    transformOrigin: izvor,
    rotate: `${rot}deg`,
    transition: "rotate 0.32s cubic-bezier(0.3, 1.5, 0.5, 1)",
  };
  return (
    <div style={zunaj}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ud.src} alt="" draggable={false} width={ud.w} height={ud.h} style={{ transformOrigin: izvor, animation: anim ?? "none", filter, display: "block" }} />
    </div>
  );
}

export function Finesek({ s, pogled, poza }: { s: number; pogled: Pogled; poza: Poza }) {
  const tek = poza === "tek";
  const korak = `fz-korak ${TEK}s ease-in-out infinite alternate`;
  const poskok = tek ? `fz-poskok ${TEK / 2}s ease-in-out infinite alternate` : poza === "stoji" || poza === "maha" ? "fz-diha 2.4s ease-in-out infinite" : "none";
  const p = tek ? POZE.stoji : POZE[poza];

  return (
    <div style={{ width: PLATNO.w * s, height: PLATNO.h * s }} className="relative">
      <div className="absolute left-0 top-0" style={{ width: PLATNO.w, height: PLATNO.h, transform: `scale(${s})`, transformOrigin: "0 0" }}>
        {/* senca na tleh */}
        <div
          className="absolute rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.55),transparent)]"
          style={{ left: 90, top: 718, width: 460, height: 56, animation: tek ? `fz-senca ${TEK / 2}s ease-in-out infinite alternate` : "none" }}
        />
        <div className="absolute inset-0" style={{ animation: poskok, transformOrigin: "320px 748px" }}>
          {/* --- spredaj --- */}
          <div className="absolute inset-0 transition-opacity duration-100" style={{ opacity: pogled === "spredaj" ? 1 : 0 }}>
            <Del ud={NOGA_L} x={205} y={590} z={1} />
            <Del ud={NOGA_D} x={435} y={590} z={1} />
            <Del ud={ROKA_L} x={56} y={355} rot={p.l} z={2} anim={poza === "maha" ? "fz-mahaj 0.32s ease-in-out infinite alternate" : undefined} />
            <Del ud={ROKA_D} x={588} y={355} rot={p.d} z={2} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/finesek/telo-spredaj.webp" alt="" draggable={false} width={590} height={520} className="absolute" style={{ left: 25, top: 110, zIndex: 3 }} />
          </div>
          {/* --- s strani (gleda desno) --- */}
          <div className="absolute inset-0 transition-opacity duration-100" style={{ opacity: pogled === "stran" ? 1 : 0 }}>
            <Del ud={NOGA_D} x={300} y={592} z={1} anim={tek ? `fz-korak ${TEK}s ease-in-out -${TEK}s infinite alternate` : undefined} filter="brightness(0.7)" />
            <Del ud={NOGA_D} x={420} y={592} z={2} anim={tek ? korak : undefined} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/finesek/telo-stran.webp" alt="" draggable={false} width={475} height={520} className="absolute" style={{ left: 82, top: 110, zIndex: 3 }} />
            <Del ud={ROKA_D} x={214} y={308} rot={55} z={4} anim={tek ? `fz-roka-tek ${TEK}s ease-in-out infinite alternate` : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
