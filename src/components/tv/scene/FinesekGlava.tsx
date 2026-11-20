"use client";

import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Razpolozenje } from "@/lib/tvScene";

/**
 * Glava Fineseka (pečica z obrazom) v SVG - za FIN:TV scene. Obraz (obrvi, oči, usta, rdečica) je narisan posebej in
 * se zvezno spremeni med počutji (usta in obrvi se preoblikujejo, zenice se zožijo / razširijo, oči mežikajo).
 * Po zgledu slik stopenj (FINES_Production data/finesek_obrazi) - tam so premajhne za 4K, zato vektorsko.
 * Dodatki: navdušen = iskrice, ponosen = medalja, zaskrbljen = potna kapljica in rdeča lučka.
 * MIRNA (2026-11-20, televizor): nič ne teče ves čas (brez utripanja lučke, kapljanja, iskric v zanki, mežikanja) in brez
 * filtra zameglitve - vsaka sprememba SVG nariše znova celo glavo. Gibanje je samo ob menjavi počutja (obraz ~0,5 s).
 * `mirno` = sličica / predogled (brez prehodov).
 */

type Obraz = {
  /** leva obrv: zunanji konec, kontrolna točka, notranji konec (desna je zrcalna) */
  obrv: [number, number, number, number, number, number];
  usta: string;
  jezik: number;
  oci: { skala: number; zenica: number; odsev: number; zaprte?: boolean };
  pogledY: number;
  lucka: string;
  toplota: number;
};

const OBRAZI: Record<Razpolozenje, Obraz> = {
  navdusen: {
    obrv: [186, 158, 222, 130, 258, 152],
    usta: "M 246 262 C 270 270 330 270 354 262 C 350 322 250 322 246 262 Z",
    jezik: 1,
    oci: { skala: 1.1, zenica: 22, odsev: 14 },
    pogledY: -2,
    lucka: "#22c55e",
    toplota: 0.55,
  },
  vesel: {
    obrv: [186, 166, 222, 148, 258, 162],
    usta: "M 256 266 C 280 274 320 274 344 266 C 338 304 262 304 256 266 Z",
    jezik: 1,
    oci: { skala: 1, zenica: 20, odsev: 12 },
    pogledY: 0,
    lucka: "#22c55e",
    toplota: 0.42,
  },
  zadovoljen: {
    obrv: [186, 170, 222, 160, 258, 168],
    usta: "M 262 270 C 282 290 318 290 338 270 C 318 296 282 296 262 270 Z",
    jezik: 0,
    oci: { skala: 1, zenica: 19, odsev: 11 },
    pogledY: 0,
    lucka: "#ee7a3a",
    toplota: 0.25,
  },
  zaskrbljen: {
    obrv: [186, 174, 222, 166, 258, 148],
    usta: "M 270 292 C 286 278 314 278 330 292 C 314 285 286 285 270 292 Z",
    jezik: 0,
    oci: { skala: 0.94, zenica: 15, odsev: 10 },
    pogledY: -6,
    lucka: "#ef4444",
    toplota: 0.08,
  },
  ponosen: {
    obrv: [186, 162, 222, 146, 258, 162],
    usta: "M 252 266 C 278 292 322 292 348 266 C 324 304 276 304 252 266 Z",
    jezik: 0,
    oci: { skala: 1, zenica: 20, odsev: 12, zaprte: true },
    pogledY: 0,
    lucka: "#eab308",
    toplota: 0.45,
  },
};

const OKO_X = [222, 378] as const;
const OKO_Y = 218;
const RJAVA = "#3b1606";
const PREOBLIKUJ = { duration: 0.5, ease: "easeInOut" } as const;

const obrvPot = ([x1, y1, cx, cy, x2, y2]: Obraz["obrv"], zrcalno: boolean) => {
  const x = (v: number) => (zrcalno ? 600 - v : v);
  return `M ${x(x1)} ${y1} Q ${x(cx)} ${cy} ${x(x2)} ${y2}`;
};

/** Zvezda s 5 kraki (medalja). */
const ZVEZDA = Array.from({ length: 10 }, (_, i) => {
  const a = ((-90 + i * 36) * Math.PI) / 180;
  const r = i % 2 ? 11 : 26;
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}).join(" ");
const ISKRICA = "M 0 -28 C 4 -6 6 -4 28 0 C 6 4 4 6 0 28 C -4 6 -6 4 -28 0 C -6 -4 -4 -6 0 -28 Z";
const ISKRICE = [
  { x: -24, y: 40, s: 1, d: 0 },
  { x: 624, y: 24, s: 0.8, d: 0.5 },
  { x: 610, y: 330, s: 1.1, d: 1 },
  { x: -6, y: 340, s: 0.7, d: 1.4 },
  { x: 300, y: -34, s: 0.6, d: 0.8 },
];

type Props = {
  razpolozenje: Razpolozenje;
  /** kam gleda (zenice, -10 ... 10) */
  pogledX?: number;
  mirno?: boolean;
  className?: string;
};

export function FinesekGlava({ razpolozenje, pogledX = 0, mirno, className = "" }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const o = OBRAZI[razpolozenje];
  const prehod = mirno ? { duration: 0 } : PREOBLIKUJ;

  return (
    <svg viewBox="-60 -60 720 540" className={className} role="img" aria-label={`Finesek - ${razpolozenje}`}>
      <defs>
        <linearGradient id={`${id}-kovina`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fafafb" />
          <stop offset="0.18" stopColor="#d9dce1" />
          <stop offset="0.5" stopColor="#aeb3bb" />
          <stop offset="0.8" stopColor="#e3e5e9" />
          <stop offset="1" stopColor="#7d828b" />
        </linearGradient>
        <linearGradient id={`${id}-rocaj`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8d929b" />
          <stop offset="0.5" stopColor="#f3f4f6" />
          <stop offset="1" stopColor="#9aa0a8" />
        </linearGradient>
        <linearGradient id={`${id}-pas`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3d44" />
          <stop offset="1" stopColor="#141518" />
        </linearGradient>
        <radialGradient id={`${id}-okno`} cx="0.5" cy="0.5" r="0.62">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="0.45" stopColor="#f7a43c" />
          <stop offset="0.8" stopColor="#d0700f" />
          <stop offset="1" stopColor="#7a3505" />
        </radialGradient>
        <radialGradient id={`${id}-toplota`} cx="0.5" cy="0.48" r="0.5">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-sarenica`} cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#d9852f" />
          <stop offset="0.55" stopColor="#8a3a0c" />
          <stop offset="1" stopColor="#3b1606" />
        </radialGradient>
        <radialGradient id={`${id}-medalja`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#86efac" />
          <stop offset="0.5" stopColor="#16a34a" />
          <stop offset="1" stopColor="#14532d" />
        </radialGradient>
        <linearGradient id={`${id}-kaplja`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0f2ff" />
          <stop offset="1" stopColor="#4aa8ff" />
        </linearGradient>
        <clipPath id={`${id}-steklo`}>
          <rect x="72" y="114" width="456" height="222" rx="18" />
        </clipPath>
        <clipPath id={`${id}-usta`}>
          <motion.path initial={false} animate={{ d: o.usta }} transition={prehod} />
        </clipPath>
      </defs>

      {/* senca pod pečico */}
      <ellipse cx="300" cy="412" rx="270" ry="18" fill="#000" opacity="0.35" />
      {/* noge */}
      <rect x="70" y="372" width="70" height="30" rx="7" fill="#2a2c31" />
      <rect x="460" y="372" width="70" height="30" rx="7" fill="#2a2c31" />

      {/* ohišje */}
      <rect x="10" y="20" width="580" height="360" rx="46" fill={`url(#${id}-kovina)`} stroke="#5d6169" strokeWidth="3" />
      <rect x="18" y="26" width="564" height="12" rx="6" fill="#ffffff" opacity="0.55" />
      {/* zgornji pas z lučko */}
      <rect x="28" y="40" width="544" height="48" rx="20" fill={`url(#${id}-pas)`} />
      {/* lučka: sij = širši prosojen pravokotnik (brez filtra), barva se zamenja takoj */}
      <rect x="160" y="51" width="280" height="25" rx="12.5" fill={o.lucka} opacity="0.35" />
      <rect x="170" y="58" width="260" height="11" rx="5.5" fill={o.lucka} />
      {/* ročaj */}
      <rect x="22" y="118" width="22" height="206" rx="11" fill={`url(#${id}-rocaj)`} stroke="#6b6f78" strokeWidth="2" />
      {/* spodnji rob */}
      <rect x="28" y="352" width="544" height="14" rx="7" fill="#8d929b" opacity="0.6" />

      {/* okno */}
      <rect x="56" y="100" width="488" height="250" rx="28" fill="#141518" />
      <g clipPath={`url(#${id}-steklo)`}>
        <rect x="72" y="114" width="456" height="222" fill={`url(#${id}-okno)`} />
        <motion.rect x="72" y="114" width="456" height="222" fill={`url(#${id}-toplota)`} initial={false} animate={{ opacity: o.toplota }} transition={{ duration: mirno ? 0 : 0.8 }} />
        {/* police ob straneh */}
        {[150, 200, 250, 300].map((y) => (
          <g key={y} stroke="#9a4a0c" strokeWidth="4" strokeLinecap="round" opacity="0.45">
            <line x1="84" y1={y} x2="140" y2={y - 6} />
            <line x1="460" y1={y - 6} x2="516" y2={y} />
          </g>
        ))}
        <rect x="72" y="114" width="456" height="222" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="18" />
        {/* odsev stekla */}
        <path d="M 96 114 L 196 114 L 126 336 L 72 336 L 72 190 Z" fill="#ffffff" opacity="0.07" />
      </g>

      {/* OBRAZ */}
      {/* rdečica */}
      {[178, 422].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="262" rx="26" ry="12" fill="#ff7b7b" opacity="0.45" />
          {[-10, 0, 10].map((dx) => (
            <line key={dx} x1={x + dx - 3} y1="267" x2={x + dx + 3} y2="257" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
          ))}
        </g>
      ))}

      {/* obrvi */}
      {[false, true].map((zrcalno) => (
        <motion.path
          key={String(zrcalno)}
          initial={false}
          animate={{ d: obrvPot(o.obrv, zrcalno) }}
          transition={prehod}
          fill="none"
          stroke={RJAVA}
          strokeWidth="10"
          strokeLinecap="round"
        />
      ))}

      {/* oči */}
      {OKO_X.map((cx) => (
        <g key={cx}>
          <motion.g initial={false} animate={{ scale: o.oci.zaprte ? 0.2 : o.oci.skala, opacity: o.oci.zaprte ? 0 : 1 }} transition={prehod}>
            <g>
              <circle cx={cx} cy={OKO_Y} r="40" fill={`url(#${id}-sarenica)`} stroke="#2a0f04" strokeWidth="5" />
              <motion.g initial={false} animate={{ x: pogledX, y: o.pogledY }} transition={prehod}>
                <motion.circle cx={cx} cy={OKO_Y} initial={false} animate={{ r: o.oci.zenica }} transition={prehod} fill="#1a0802" />
                <motion.circle cx={cx + 13} cy={OKO_Y - 14} initial={false} animate={{ r: o.oci.odsev }} transition={prehod} fill="#fff" />
                <circle cx={cx - 13} cy={OKO_Y + 15} r="5" fill="#fff" opacity="0.9" />
              </motion.g>
            </g>
          </motion.g>
          {/* zaprte oči (ponosen): ^ ^ */}
          <motion.path
            d={`M ${cx - 34} ${OKO_Y + 10} Q ${cx} ${OKO_Y - 26} ${cx + 34} ${OKO_Y + 10}`}
            fill="none"
            stroke={RJAVA}
            strokeWidth="10"
            strokeLinecap="round"
            initial={false}
            animate={{ opacity: o.oci.zaprte ? 1 : 0 }}
            transition={{ duration: mirno ? 0 : 0.3 }}
          />
        </g>
      ))}

      {/* usta + jezik */}
      <motion.path initial={false} animate={{ d: o.usta }} transition={prehod} fill="#4a1a08" stroke={RJAVA} strokeWidth="6" strokeLinejoin="round" />
      <g clipPath={`url(#${id}-usta)`}>
        <motion.ellipse cx="300" cy="306" rx="30" ry="15" fill="#ff6f61" initial={false} animate={{ opacity: o.jezik }} transition={{ duration: mirno ? 0 : 0.3 }} />
      </g>

      {/* DODATKI */}
      <AnimatePresence>
        {razpolozenje === "zaskrbljen" && (
          <motion.g key="kaplja" initial={mirno ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <path d="M 0 0 C 10 16 16 24 16 32 A 16 16 0 0 1 -16 32 C -16 24 -10 16 0 0 Z" transform="translate(478 140)" fill={`url(#${id}-kaplja)`} stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
          </motion.g>
        )}
        {razpolozenje === "navdusen" &&
          ISKRICE.map((s, i) => (
            <motion.g key={`iskrica${i}`} initial={mirno ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <path d={ISKRICA} transform={`translate(${s.x} ${s.y}) scale(${s.s})`} fill="#fff3c4" stroke="#facc15" strokeWidth="2" />
            </motion.g>
          ))}
        {razpolozenje === "ponosen" && (
          <motion.g
            key="medalja"
            initial={mirno ? false : { x: 560, y: 20, scale: 0, rotate: -50 }}
            animate={{ x: 560, y: 20, scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 12, delay: 0.5 }}
          >
            <polygon points="-26,20 -48,96 -24,84 -10,106 6,30" fill="#16a34a" />
            <polygon points="26,20 48,96 24,84 10,106 -6,30" fill="#15803d" />
            <circle r="54" fill={`url(#${id}-medalja)`} stroke="#bbf7d0" strokeWidth="4" />
            <circle r="40" fill="none" stroke="#dcfce7" strokeOpacity="0.6" strokeWidth="3" />
            <polygon points={ZVEZDA} fill="#facc15" stroke="#a16207" strokeWidth="2" strokeLinejoin="round" />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}
