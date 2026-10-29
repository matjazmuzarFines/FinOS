"use client";

import { motion, type Variants } from "motion/react";

/**
 * Znak FIN:<pripona> (FIN:OS, FIN:ME, FIN:DOOR ...).
 * "FIN" bel preliv, dvopičje = dve oranžni sijoči piki, pripona v oranžnem prelivu.
 * `zlozi` = črke priletijo od vsepovsod in se zložijo (uvodna animacija).
 */
type Props = {
  pripona?: string;
  className?: string;
  zlozi?: boolean;
  /** Zamik začetka animacije (s). */
  zamik?: number;
};

// Fiksni odmiki (brez Math.random - enako ob vsakem izrisu)
const ODMIKI = [
  { x: -260, y: -140, rotate: -70, scale: 2.2 },
  { x: -60, y: 220, rotate: 40, scale: 0.3 },
  { x: 120, y: -240, rotate: 120, scale: 1.8 },
  { x: -200, y: 200, rotate: -140, scale: 0.4 },
  { x: 260, y: 160, rotate: 80, scale: 2 },
  { x: 300, y: -120, rotate: -40, scale: 0.5 },
];

type Crka = { i: number; z: number };

const crka: Variants = {
  skrito: ({ i }: Crka) => ({ ...ODMIKI[i % ODMIKI.length], opacity: 0, filter: "blur(14px)" }),
  vidno: ({ i, z }: Crka) => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    opacity: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 140, damping: 14, mass: 0.9, delay: z + i * 0.08 },
  }),
};

export function Znak({ pripona = "OS", className = "", zlozi = false, zamik = 0 }: Props) {
  const crke = ["F", "I", "N"];
  const anim = zlozi ? { initial: "skrito", animate: "vidno" } : {};
  return (
    <motion.span
      className={`inline-flex select-none items-center font-display font-bold leading-none tracking-[-0.04em] ${className}`}
      {...anim}
      aria-label={`FIN:${pripona}`}
      role="img"
    >
      {crke.map((c, i) => (
        <motion.span key={c} custom={{ i, z: zamik }} variants={crka} className="fos-text-grad inline-block">
          {c}
        </motion.span>
      ))}
      <Dvopicje zlozi={zlozi} zamik={zamik} />
      {pripona.split("").map((c, i) => (
        <motion.span
          key={`${c}${i}`}
          custom={{ i: i + 3, z: zamik }}
          variants={crka}
          className="fos-text-fines inline-block drop-shadow-[0_0_24px_rgb(238_122_58/0.45)]"
        >
          {c}
        </motion.span>
      ))}
    </motion.span>
  );
}

function Dvopicje({ zlozi, zamik }: { zlozi: boolean; zamik: number }) {
  const pika = "fos-fines-fill block h-[0.15em] w-[0.15em] rounded-[0.035em]";
  return (
    <span className="mx-[0.06em] inline-flex flex-col justify-center gap-[0.17em] self-stretch pt-[0.05em]">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className={pika}
          initial={zlozi ? { y: "-3em", opacity: 0, scale: 0.2 } : false}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 12, delay: zamik + 0.45 + i * 0.12 }}
        />
      ))}
    </span>
  );
}
