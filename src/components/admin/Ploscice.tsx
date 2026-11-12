"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Settings } from "lucide-react";
import type { Ploscica } from "@/lib/nav";

type Props = { ploscice: (Ploscica & { stevilo?: number | null })[] };

/**
 * Mreža pravokotnih ploščic (pregled nastavitev sekcije): levo ikona v oranžnem prelivu, desno naslov s puščico in
 * opis (največ 2 vrstici), desno zgoraj število. Mreža se prilagodi širini (kartica najmanj 18 rem), zato se ob meniju
 * sekcije nič ne lomi. Ob hoverju dvig, vrteča oranžna obroba in sij. Izgled: finos_stil.txt -> 14.
 */
export function Ploscice({ ploscice }: Props) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
      {ploscice.map((p, i) => (
        <motion.li
          key={p.href}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.05 + i * 0.04 }}
          className="group relative min-w-0 transition-transform duration-300 hover:-translate-y-1"
        >
          <Link
            href={p.href}
            title={p.hint}
            className="relative block h-full rounded-[18px] p-px outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-fines-400 active:scale-[0.99]"
          >
            <span aria-hidden className="absolute inset-0 rounded-[18px] bg-white/10" />
            <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[18px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <span className="fos-border-anim absolute -inset-[50%]" />
            </span>
            <span aria-hidden className="absolute -inset-2 -z-10 rounded-[24px] bg-[radial-gradient(closest-side,rgb(202_80_16/0.35),transparent)] opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

            <span className="fos-kartica relative flex h-full min-h-[5.5rem] items-start gap-3.5 overflow-hidden rounded-[17px] p-4 backdrop-blur-xl">
              <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.16),transparent_70%)] transition-transform duration-700 group-hover:scale-150" />
              <span className="fos-fines-fill relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-snow transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110">
                <p.icon className="h-5 w-5" aria-hidden />
                <span className="fos-shine absolute inset-0" />
              </span>
              <span className={`relative flex min-w-0 flex-1 flex-col gap-1 ${p.nastavitve ? "pr-9" : ""}`}>
                {/* naslov in puščica v isti vrsti (ne prekrije opisa); naslov se prelomi po besedah, nikoli "..." */}
                <span className="flex items-start gap-2">
                  <span className="min-w-0 font-display text-base font-bold leading-snug text-white">{p.naslov}</span>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 -translate-x-1 text-fines-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  {p.stevilo != null && (
                    <span className="ml-auto shrink-0 font-display text-xl font-bold leading-none tabular-nums text-white" title={`Število: ${p.stevilo}`}>
                      {p.stevilo}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs leading-snug text-ink-400">{p.opis}</span>
              </span>
            </span>
          </Link>
          {/* zobnik: nastavitve modula (sosednja povezava - povezava v povezavi ni dovoljena) */}
          {p.nastavitve && (
            <Link
              href={p.nastavitve.href}
              title={p.nastavitve.hint}
              aria-label={p.nastavitve.hint}
              className="group/zob absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-ink-200 backdrop-blur-md transition-all duration-300 hover:border-fines-400/60 hover:text-fines-300 hover:shadow-[0_0_24px_-4px_rgb(238_122_58/0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fines-400 active:scale-95"
            >
              <Settings className="h-4 w-4 transition-transform duration-500 group-hover/zob:rotate-90" aria-hidden />
            </Link>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
