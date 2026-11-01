"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus } from "lucide-react";

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

/**
 * Kvadratek za vklop (lastnost, dan, oseba): oranžen preliv in kljukica z odskokom. delno = del skupine je označen
 * ("Označi vse"): bled oranžen z vodoravno črto; klik ga vklopi.
 */
export function Kvadratek({ vklop, delno, onChange, hint, disabled, majhen }: { vklop: boolean; delno?: boolean; onChange?: (v: boolean) => void; hint: string; disabled?: boolean; /** 18 px (gosti seznami) */ majhen?: boolean }) {
  const ikona = majhen ? "h-3 w-3" : "h-4 w-4";
  const pol = !vklop && !!delno;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={pol ? "mixed" : vklop}
      title={hint}
      disabled={disabled || !onChange}
      onClick={() => onChange?.(!vklop)}
      className={`grid shrink-0 place-items-center transition-all duration-300 disabled:cursor-default ${majhen ? "h-[18px] w-[18px] rounded-[5px]" : "h-6 w-6 rounded-[7px]"} ${
        vklop
          ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_0_14px_-3px_rgb(238_122_58/0.9)]"
          : pol
            ? "border border-fines-400/60 bg-fines-500/20 text-fines-200"
            : "border border-white/15 bg-white/[0.04] hover:border-fines-400/50"
      }`}
    >
      <AnimatePresence>
        {(vklop || pol) && (
          <motion.span key={vklop ? "da" : "delno"} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
            {vklop ? <Check className={ikona} strokeWidth={3} aria-hidden /> : <Minus className={ikona} strokeWidth={3} aria-hidden />}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
