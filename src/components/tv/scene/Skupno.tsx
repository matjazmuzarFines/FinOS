"use client";

import { useEffect } from "react";
import { motion, useAnimate, type AnimationOptions, type DOMKeyframesDefinition } from "motion/react";
import { TONI, celo, ure, type Razpolozenje, type Utrip } from "@/lib/tvScene";
import { FinesekGlava } from "./FinesekGlava";

/** Skupni gradniki animiranih scen (vsi sveti): glava z odzivom, podatek utripa, vrednost, konfeti. */

export const KRIVULJA = [0.22, 1, 0.36, 1] as const;

/**
 * MIRNA SCENA (2026-11-20, televizor ne zmore veliko gibanja): podatek je TAKOJ viden in miruje (brez štetja, drsenja,
 * vzmeti); v utripu se premakne največ en del sveta (kazalec, stolpci, paket, list koledarja) in nato kratek odziv glave.
 * Nič ne teče ves čas. `zamik` (s) = kdaj se sme začeti gibanje - prvi utrip šele po prehodu med okni.
 */

/** Odziv glave (enkrat na utrip, samo preoblikovanje = brez risanja). */
const ODZIV: Record<Razpolozenje, { kf: DOMKeyframesDefinition; t: AnimationOptions }> = {
  navdusen: { kf: { y: [0, -46, 0, -16, 0] }, t: { duration: 1.1, ease: "easeOut" } },
  vesel: { kf: { y: [0, -30, 0] }, t: { duration: 0.8, ease: "easeOut" } },
  zadovoljen: { kf: { rotate: [0, 3, -2, 0] }, t: { duration: 1, ease: "easeInOut" } },
  zaskrbljen: { kf: { x: [0, -14, 14, -10, 10, 0] }, t: { duration: 0.8, ease: "easeInOut" } },
  ponosen: { kf: { scale: [1, 1.06, 1], rotate: [0, -4, 0] }, t: { duration: 1.2, ease: "easeInOut" } },
};

/** Kdaj po začetku gibanja utripa se odzove glava (najprej se premakne svet). */
export const ODZIV_PO = 2;

/**
 * Glava Fineseka: miruje, ob vsakem utripu en kratek odziv (`zamik` + ODZIV_PO). Glava se ne vstavlja znova (brez ključa
 * na utrip) - obraz se zvezno preoblikuje med počutji.
 */
export function GlavaOdziv({ u, i, mirno, zamik = 0, pogledX = 8, className = "" }: { u: Utrip; i: number; mirno?: boolean; zamik?: number; pogledX?: number; className?: string }) {
  const [obseg, animiraj] = useAnimate<HTMLDivElement>();
  useEffect(() => {
    if (mirno || !obseg.current) return;
    const o = ODZIV[u.razpolozenje];
    const a = animiraj(obseg.current, o.kf, { ...o.t, delay: zamik + ODZIV_PO });
    return () => a.stop();
  }, [i, mirno]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`fos-tv-glava ${className}`}>
      <div ref={obseg} style={{ transformOrigin: "50% 85%" }}>
        <FinesekGlava razpolozenje={u.razpolozenje} pogledX={pogledX} mirno={mirno} className="w-full" />
      </div>
    </div>
  );
}

/** Besedilo vrednosti (7,6 / 112 / 3) - takoj končna vrednost. */
export const besediloVrednosti = (v: Utrip["vrednost"]) => (v.st == null ? "" : v.cela ? celo(v.st) : ure(v.st));

/** Vrednost (7,6 / 28 h, 112 %) ali besedilo (Vse v hiši). */
export function Vrednost({ v, barva, velikost = 150 }: { v: Utrip["vrednost"]; barva: string; mirno?: boolean; velikost?: number }) {
  return (
    <div className="flex flex-wrap items-baseline font-display font-bold leading-none tracking-[-0.03em]" style={{ color: barva, textShadow: `0 0 40px ${barva}55` }}>
      {v.besedilo != null ? (
        <span style={{ fontSize: velikost * 0.8 }}>{v.besedilo}</span>
      ) : (
        <>
          <span style={{ fontSize: velikost }}>
            {v.predpona}
            {besediloVrednosti(v)}
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
export function Oznaka({ u, velikost = 44 }: { u: Utrip; mirno?: boolean; velikost?: number }) {
  const barva = TONI[u.ton];
  return (
    <span
      className="w-fit rounded-full px-9 py-3 font-bold uppercase tracking-[0.08em] text-white"
      style={{ fontSize: velikost, background: `linear-gradient(135deg, ${barva}, ${temnejsa(barva, 0.6)})`, boxShadow: `0 20px 60px -15px ${barva}, inset 0 2px 0 rgb(255 255 255 / 0.3)` }}
    >
      {u.oznaka}
    </span>
  );
}

/** Menjava podatka ob utripu: samo preliv prosojnosti (s AnimatePresence mode="wait" v svetu). */
export const PRELIV = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.35 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
} as const;

/** Podatek utripa desno: oznaka, krovni, družine, (vrednost, trak), stavek - vse takoj, brez gibanja. */
export function PodatekUtripa({ u, mirno, brezVrednosti, brezTraku }: { u: Utrip; mirno?: boolean; brezVrednosti?: boolean; brezTraku?: boolean }) {
  const barva = TONI[u.ton];
  return (
    <motion.div className="absolute inset-0 flex flex-col justify-center gap-6" {...PRELIV} initial={mirno ? false : PRELIV.initial}>
      <Oznaka u={u} />
      <div>
        <div className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text pb-2 font-display text-[170px] font-bold leading-[0.95] tracking-[-0.04em] text-transparent">{u.glava}</div>
        {u.pod && <div className="mt-2 line-clamp-2 text-[44px] font-semibold text-[#b5b5bb]">{u.pod}</div>}
      </div>
      {!brezVrednosti && <Vrednost v={u.vrednost} barva={barva} />}
      {!brezTraku && u.trak != null && (
        <div className="h-7 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${Math.min(1, u.trak) * 100}%`, background: `linear-gradient(90deg, ${temnejsa(barva, 0.55)}, ${barva})` }} />
        </div>
      )}
      <p className="text-[52px] font-semibold leading-tight text-[#dcdcdf]">{u.stavek}</p>
    </motion.div>
  );
}

/**
 * Temnejša barva (namesto color-mix(), ki ga starejši brskalniki televizorjev ne poznajo): #rrggbb × delež.
 * Za barve, ki niso #rrggbb, vrne barvo nespremenjeno.
 */
export function temnejsa(barva: string, delez: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(barva);
  if (!m) return barva;
  const n = parseInt(m[1], 16);
  const k = (x: number) => Math.round(x * delez).toString(16).padStart(2, "0");
  return `#${k((n >> 16) & 255)}${k((n >> 8) & 255)}${k(n & 255)}`;
}
/** Svetlejša barva (mešanica z belo): delež barve 0-1. */
export function svetlejsa(barva: string, delez: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(barva);
  if (!m) return barva;
  const n = parseInt(m[1], 16);
  const k = (x: number) => Math.round(x * delez + 255 * (1 - delez)).toString(16).padStart(2, "0");
  return `#${k((n >> 16) & 255)}${k((n >> 8) & 255)}${k(n & 255)}`;
}

const BARVE_KONFETOV = ["#22c55e", "#eab308", "#ee7a3a", "#3b82f6", "#f43f5e", "#a855f7", "#ffffff"];
/**
 * Konfeti čez območje (ob uspehu). Deterministični (isti na povezanih zaslonih). CSS animacija (fos-tv-konfet):
 * koščki padajo na grafični kartici, glavna nit jih ne računa.
 */
export function Konfeti({ n = 14, zamik = 1.2 }: { n?: number; zamik?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: n }, (_, j) => {
        const x = (j * 137.5) % 100;
        const s = 10 + ((j * 7) % 14);
        return (
          <span
            key={j}
            className="fos-tv-konfet absolute top-0 block rounded-[3px]"
            style={
              {
                left: `${x}%`,
                width: s,
                height: s * 0.55,
                background: BARVE_KONFETOV[j % BARVE_KONFETOV.length],
                "--dx": `${((j % 5) - 2) * 40}px`,
                "--r": `${540 + ((j * 53) % 360)}deg`,
                "--t": `${3 + ((j * 13) % 10) / 10}s`,
                "--z": `${zamik + ((j * 31) % 100) / 120}s`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
