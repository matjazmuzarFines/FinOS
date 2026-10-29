"use client";

import { motion } from "motion/react";
import { CalendarClock, Coffee, DoorOpen, HeartPulse, IdCard, Palmtree, type LucideIcon } from "lucide-react";

type Modul = { ime: string; opis: string; icon: LucideIcon; hint: string };

export const MODULI: Modul[] = [
  { ime: "Delovni čas", opis: "Prihodi, odhodi, ure", icon: CalendarClock, hint: "Beleženje delovnega časa zaposlenih (kmalu)" },
  { ime: "Dopusti", opis: "Zahtevki in odobritve", icon: Palmtree, hint: "Načrtovanje in odobritev dopustov (kmalu)" },
  { ime: "Prosti čas", opis: "Izhodi, ure, menjave", icon: Coffee, hint: "Evidenca prostih ur in izhodov (kmalu)" },
  { ime: "Bolniška", opis: "Odsotnosti in potrdila", icon: HeartPulse, hint: "Evidenca bolniških odsotnosti zaposlenih (kmalu)" },
  { ime: "FIN:DOOR", opis: "Dostopi do prostorov", icon: DoorOpen, hint: "Upravljanje dostopov do prostorov (kmalu)" },
  { ime: "Kartice", opis: "Kartice zaposlenih", icon: IdCard, hint: "Urejanje kartic zaposlenih (kmalu)" },
];

/** Predogled prihajajočih modulov: steklene ploščice, ki rahlo lebdijo. */
export function Moduli({ zamik = 0 }: { zamik?: number }) {
  return (
    <section aria-labelledby="moduli-naslov" className="w-full">
      <div className="mb-4 flex items-center gap-3">
        <h2 id="moduli-naslov" className="text-[11px] font-bold uppercase tracking-[0.2em] text-fines-400">
          Moduli v pripravi
        </h2>
        <span aria-hidden className="h-px flex-1 bg-[linear-gradient(90deg,rgb(238_122_58/0.5),transparent)]" />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {MODULI.map((m, i) => (
          <motion.li
            key={m.ime}
            title={m.hint}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 140, damping: 18, delay: zamik + i * 0.07 }}
            className="min-w-0"
          >
            <div className="animate-float" style={{ animationDelay: `${-i * 0.9}s` }}>
              <div className="fos-glass group relative flex h-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl p-3 transition-all duration-300 hover:-translate-y-1 hover:border-fines-400/40 hover:shadow-[0_16px_40px_-16px_rgb(202_80_16/0.7)]">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,rgb(238_122_58/0.25),rgb(202_80_16/0.08))] text-fines-300 ring-1 ring-fines-400/25 transition-all duration-300 group-hover:bg-[linear-gradient(135deg,#ee7a3a,#ca5010)] group-hover:text-white group-hover:shadow-[0_0_20px_rgb(238_122_58/0.6)]">
                  <m.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{m.ime}</span>
                  <span className="block truncate text-xs text-ink-400">{m.opis}</span>
                </span>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

/** Neskončen trak ključnih besed (marquee). */
export function Trak() {
  const besede = ["Delovni čas", "Dopusti", "Prosti čas", "Bolniška", "FIN:DOOR", "Kartice", "Dostopi", "People Bake for People"];
  const vrsta = [...besede, ...besede];
  return (
    <div aria-hidden className="relative w-full overflow-hidden py-3 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <motion.div className="flex w-max gap-8" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}>
        {vrsta.map((b, i) => (
          <span key={i} className="flex items-center gap-8 font-display text-2xl font-semibold text-white/15 sm:text-4xl">
            {b}
            <span className="fos-fines-fill h-2 w-2 rounded-[2px]" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
