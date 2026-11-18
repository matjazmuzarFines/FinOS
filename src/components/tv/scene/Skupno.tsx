"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform, type TargetAndTransition } from "motion/react";
import { TONI, celo, ure, type Razpolozenje, type Utrip } from "@/lib/tvScene";
import { FinesekGlava } from "./FinesekGlava";

/** Skupni gradniki animiranih scen (vsi sveti): glava z odzivom, podatek utripa, vrednost, konfeti. */

export const KRIVULJA = [0.22, 1, 0.36, 1] as const;
export const vzmet = (mirno: boolean | undefined, zamik = 0) => (mirno ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 18, delay: zamik });

/** Odziv glave na začetku utripa. */
const ODZIV: Record<Razpolozenje, TargetAndTransition> = {
  navdusen: { y: [0, -110, 0, -55, 0, -20, 0], scaleY: [1, 1.06, 0.88, 1.04, 0.94, 1, 1], rotate: [0, -5, 5, -3, 3, 0, 0], transition: { duration: 1.8, delay: 0.7, ease: "easeOut" } },
  vesel: { y: [0, -60, 0, -22, 0], scaleY: [1, 1.04, 0.92, 1.02, 1], transition: { duration: 1.3, delay: 0.7, ease: "easeOut" } },
  zadovoljen: { y: [0, 12, 0, 8, 0], rotate: [0, 3, 0, -2, 0], transition: { duration: 1.4, delay: 0.7, ease: "easeInOut" } },
  zaskrbljen: { x: [0, -22, 22, -18, 18, -10, 10, 0], rotate: [0, -4, 4, -3, 3, -1, 1, 0], scale: [1, 0.97, 0.97, 0.97, 0.97, 0.98, 0.99, 1], transition: { duration: 1, delay: 0.8 } },
  ponosen: { scale: [1, 1.12, 1.06], rotate: [0, -6, 6, -3, 0], y: [0, -20, -10], transition: { duration: 1.8, delay: 0.7, ease: "easeInOut" } },
};

/** Glava Fineseka: prihod, lebdenje, odziv na vsak utrip (ključ `i`). */
export function GlavaOdziv({ u, i, mirno, pogledX = 8, className = "" }: { u: Utrip; i: number; mirno?: boolean; pogledX?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={mirno ? false : { opacity: 0, scale: 0.5, y: 80 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 14 }}
    >
      <motion.div animate={mirno ? undefined : { y: [0, -12, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}>
        <motion.div key={mirno ? "mirno" : `odziv${i}`} animate={mirno ? undefined : ODZIV[u.razpolozenje]} style={{ transformOrigin: "50% 85%" }}>
          <FinesekGlava razpolozenje={u.razpolozenje} pogledX={pogledX} mirno={mirno} className="w-full" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** Število, ki šteje navzgor (7,6 / 112 / 3). */
export function Stevec({ v, mirno, zamik = 1.3 }: { v: Utrip["vrednost"]; mirno?: boolean; zamik?: number }) {
  const cilj = v.st ?? 0;
  const st = useMotionValue(mirno ? cilj : 0);
  const besedilo = useTransform(st, (x) => (v.cela ? celo(x) : ure(x)));
  useEffect(() => {
    if (mirno || v.st == null) return;
    const a = animate(st, cilj, { duration: 1.4, delay: zamik, ease: KRIVULJA });
    return () => a.stop();
  }, [st, cilj, v.st, mirno, zamik]);
  return <motion.span>{besedilo}</motion.span>;
}

/** Vrednost (7,6 / 28 h, 112 %) ali besedilo (Vse v hiši). */
export function Vrednost({ v, barva, mirno, velikost = 150 }: { v: Utrip["vrednost"]; barva: string; mirno?: boolean; velikost?: number }) {
  return (
    <div className="flex flex-wrap items-baseline font-display font-bold leading-none tracking-[-0.03em]" style={{ color: barva, textShadow: `0 0 60px ${barva}66` }}>
      {v.besedilo != null ? (
        <span style={{ fontSize: velikost * 0.8 }}>{v.besedilo}</span>
      ) : (
        <>
          <span style={{ fontSize: velikost }}>
            {v.predpona}
            <Stevec v={v} mirno={mirno} />
          </span>
          {v.pripona && (
            <span className="ml-3 opacity-80" style={{ fontSize: velikost * 0.48 }}>
              {v.pripona.trim()}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** Čip oznake v barvi tona. */
export function Oznaka({ u, mirno, velikost = 44 }: { u: Utrip; mirno?: boolean; velikost?: number }) {
  const barva = TONI[u.ton];
  return (
    <motion.span
      className="w-fit rounded-full px-9 py-3 font-bold uppercase tracking-[0.08em] text-white"
      style={{ fontSize: velikost, background: `linear-gradient(135deg, ${barva}, color-mix(in srgb, ${barva} 60%, black))`, boxShadow: `0 20px 60px -15px ${barva}, inset 0 2px 0 rgb(255 255 255 / 0.3)` }}
      initial={mirno ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={vzmet(mirno, 1.1)}
    >
      {u.oznaka}
    </motion.span>
  );
}

/** Podatek utripa desno: oznaka, krovni, družine, (vrednost, trak), stavek. */
export function PodatekUtripa({ u, mirno, brezVrednosti, brezTraku }: { u: Utrip; mirno?: boolean; brezVrednosti?: boolean; brezTraku?: boolean }) {
  const barva = TONI[u.ton];
  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-center gap-8"
      initial={mirno ? false : { opacity: 0, x: 160 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -80, transition: { duration: 0.5 } }}
      transition={vzmet(mirno, 0.9)}
    >
      <Oznaka u={u} mirno={mirno} />
      <div>
        <div className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text pb-2 font-display text-[170px] font-bold leading-[0.95] tracking-[-0.04em] text-transparent">{u.glava}</div>
        {u.pod && <div className="mt-2 line-clamp-2 text-[44px] font-semibold text-[#b5b5bb]">{u.pod}</div>}
      </div>
      {!brezVrednosti && <Vrednost v={u.vrednost} barva={barva} mirno={mirno} />}
      {!brezTraku && u.trak != null && (
        <div className="h-7 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${barva} 55%, black), ${barva})`, boxShadow: `0 0 30px ${barva}` }}
            initial={mirno ? false : { width: "0%" }}
            animate={{ width: `${Math.min(1, u.trak) * 100}%` }}
            transition={mirno ? { duration: 0 } : { duration: 1.4, delay: 1.3, ease: KRIVULJA }}
          />
        </div>
      )}
      <motion.p className="text-[52px] font-semibold leading-tight text-[#dcdcdf]" initial={mirno ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={vzmet(mirno, 2.2)}>
        {u.stavek}
      </motion.p>
    </motion.div>
  );
}

const BARVE_KONFETOV = ["#22c55e", "#eab308", "#ee7a3a", "#3b82f6", "#f43f5e", "#a855f7", "#ffffff"];
/** Konfeti čez območje (ob uspehu). Deterministični (isti na povezanih zaslonih). */
export function Konfeti({ n = 46, zamik = 1.2 }: { n?: number; zamik?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: n }, (_, j) => {
        const x = (j * 137.5) % 100;
        const s = 10 + ((j * 7) % 14);
        return (
          <motion.span
            key={j}
            className="absolute top-0 block rounded-[3px]"
            style={{ left: `${x}%`, width: s, height: s * 0.55, background: BARVE_KONFETOV[j % BARVE_KONFETOV.length] }}
            initial={{ y: -60, rotate: 0, opacity: 0 }}
            animate={{ y: [-60, 1140], rotate: [0, 540 + ((j * 53) % 360)], opacity: [0, 1, 1, 0.8], x: [0, ((j % 5) - 2) * 40] }}
            transition={{ duration: 3 + ((j * 13) % 10) / 10, delay: zamik + ((j * 31) % 100) / 120, ease: "easeIn" }}
          />
        );
      })}
    </div>
  );
}
