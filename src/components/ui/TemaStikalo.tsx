"use client";

import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { nastaviTemo, useTema } from "@/lib/tema";

/** Gumb svetla / temna tema (desno zgoraj v glavi): steklen krog, ikona se ob menjavi zavrti. */
export function TemaStikalo() {
  const tema = useTema();
  const svetla = tema === "svetla";
  const hint = svetla ? "Preklopi na temno temo" : "Preklopi na svetlo temo";

  return (
    <button
      type="button"
      title={hint}
      aria-label={hint}
      onClick={() => nastaviTemo(svetla ? "temna" : "svetla")}
      className="group/btn relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.05] text-ink-200 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-fines-400/50 hover:text-fines-300 hover:shadow-[0_0_24px_-4px_rgb(238_122_58/0.7)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fines-400"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={tema}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
        >
          {svetla ? <Moon className="h-5 w-5" aria-hidden /> : <Sun className="h-5 w-5" aria-hidden />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
