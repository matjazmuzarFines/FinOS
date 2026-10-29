"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { Ploscica } from "@/lib/nav";

type Props = { ploscice: (Ploscica & { stevilo?: number | null })[] };

/**
 * Mreža kvadratnih ploščic (vstop v module). Steklo, ikona v oranžnem prelivu, naslov in kratek opis;
 * ob hoverju dvig, vrteča oranžna obroba in sij. Izgled: finos_stil.txt → 14.
 */
export function Ploscice({ ploscice }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
      {ploscice.map((p, i) => (
        <motion.li
          key={p.href}
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 18, delay: 0.1 + i * 0.06 }}
          className="min-w-0"
        >
          <Link
            href={p.href}
            title={p.hint}
            className="group relative block aspect-square rounded-[22px] p-px outline-none transition-transform duration-300 hover:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-fines-400 active:scale-[0.98]"
          >
            <span aria-hidden className="absolute inset-0 rounded-[22px] bg-white/10" />
            <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[22px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <span className="fos-border-anim absolute -inset-[50%]" />
            </span>
            <span aria-hidden className="absolute -inset-3 -z-10 rounded-[30px] bg-[radial-gradient(closest-side,rgb(202_80_16/0.4),transparent)] opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

            <span className="fos-kartica relative flex h-full flex-col overflow-hidden rounded-[21px] p-4 backdrop-blur-xl sm:p-5">
              <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.18),transparent_70%)] transition-transform duration-700 group-hover:scale-150" />
              <span className="flex items-start justify-between gap-2">
                <span className="fos-fines-fill relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-snow transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110 sm:h-14 sm:w-14 sm:rounded-2xl">
                  <p.icon className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden />
                  <span className="fos-shine absolute inset-0" />
                </span>
                {p.stevilo != null && (
                  <span className="font-display text-2xl font-bold tabular-nums text-white sm:text-3xl" title={`Število: ${p.stevilo}`}>
                    {p.stevilo}
                  </span>
                )}
              </span>
              <span className="mt-auto min-w-0">
                {/* puščica je v vrsti z naslovom (ne prekrije opisa); ob hoverju zdrsne noter */}
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-display text-lg font-bold text-white sm:text-2xl">{p.naslov}</span>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 -translate-x-2 text-fines-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 line-clamp-3 block text-xs leading-snug text-ink-400 sm:text-sm">{p.opis}</span>
              </span>
            </span>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}
