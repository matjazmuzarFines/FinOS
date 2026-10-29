"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

type Props = { icon: LucideIcon; naslov: string; opis?: ReactNode; akcija?: ReactNode; ton?: "nevtralno" | "napaka" };

/** Prazno stanje / napaka: steklena kartica na sredini z ikono, naslovom, opisom in gumbom. */
export function PraznoStanje({ icon: Icon, naslov, opis, akcija, ton = "nevtralno" }: Props) {
  const napaka = ton === "napaka";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`fos-glass flex flex-col items-center gap-3 rounded-[20px] px-6 py-10 text-center ${napaka ? "border-nok-500/40" : ""}`}
    >
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${napaka ? "bg-nok-500/15 text-nok-500" : "bg-fines-500/10 text-fines-300 ring-1 ring-fines-400/25"}`}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h3 className="font-display text-lg font-bold text-white">{naslov}</h3>
      {opis && <div className="max-w-md text-sm text-ink-400">{opis}</div>}
      {akcija && <div className="mt-2 flex flex-wrap justify-center gap-2">{akcija}</div>}
    </motion.div>
  );
}
