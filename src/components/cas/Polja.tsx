"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

/** Polje obrazca: naslov zgoraj (* = obvezno), pod poljem opis ali napaka (rdeče). Poravnano zgoraj. */
export function PoljeObrazca({ naslov, obvezno, opis, napaka, children, className = "" }: { naslov: string; obvezno?: boolean; opis?: ReactNode; napaka?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-ink-400">
        {naslov}
        {obvezno && <span className="text-fines-400"> *</span>}
      </span>
      <div className={napaka ? "[&_input]:border-nok-500/70 [&_select]:border-nok-500/70 [&_textarea]:border-nok-500/70" : ""}>{children}</div>
      <AnimatePresence initial={false}>
        {napaka ? (
          <motion.span key="n" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs font-semibold text-nok-500">
            {napaka}
          </motion.span>
        ) : (
          opis && <span className="text-xs text-ink-500">{opis}</span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Kvadratek za vklop (lastnost, dan): oranžen preliv in kljukica z odskokom. */
export function Kvadratek({ vklop, onChange, hint, disabled }: { vklop: boolean; onChange?: (v: boolean) => void; hint: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={vklop}
      title={hint}
      disabled={disabled || !onChange}
      onClick={() => onChange?.(!vklop)}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-[7px] transition-all duration-300 disabled:cursor-default ${
        vklop ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_0_14px_-3px_rgb(238_122_58/0.9)]" : "border border-white/15 bg-white/[0.04] hover:border-fines-400/50"
      }`}
    >
      <AnimatePresence>
        {vklop && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
