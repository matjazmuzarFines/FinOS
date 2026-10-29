"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { nadrejena, type Drobtina } from "@/lib/nav";

type Props = {
  drobtine?: Drobtina[];
  naslov: ReactNode;
  opis?: ReactNode;
  /** Gumbi desno (v `flex-wrap`, na tablici se prelomijo pod naslov). */
  akcije?: ReactNode;
};

/** Vrh strani: drobtine (pot) in desno gumb nazaj (nadrejena stran), velik naslov s prelivom, opis; desno akcije. */
export function GlavaStrani({ drobtine, naslov, opis, akcije }: Props) {
  const nazaj = nadrejena(usePathname());
  return (
    <div className="flex flex-col gap-2">
      {/* vrsta 1: pot levo, nazaj ob desnem robu */}
      <div className="flex min-h-10 items-center justify-between gap-3">
        {drobtine && drobtine.length > 0 && (
          <motion.nav aria-label="Pot do strani" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-medium text-ink-400">
            {drobtine.map((d, i) => (
              <span key={d.naslov + i} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fines-400/70" aria-hidden />}
                {d.href ? (
                  <Link href={d.href} title={`Odpri stran ${d.naslov}`} className="truncate transition-colors hover:text-fines-300">
                    {d.naslov}
                  </Link>
                ) : (
                  <span className="truncate text-ink-200">{d.naslov}</span>
                )}
              </span>
            ))}
          </motion.nav>
        )}
        {nazaj && (
          <Link
            href={nazaj.href}
            title={nazaj.hint}
            className="group/btn ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.06] px-3.5 text-sm font-semibold text-ink-100 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.12] active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover/btn:-translate-x-0.5" aria-hidden />
            Nazaj
          </Link>
        )}
      </div>

      {/* vrsta 2: naslov in opis levo, gumbi desno */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-[min(100%,18rem)] flex-1 flex-col gap-2">
          <motion.h1
            className="fos-text-grad font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.45 }}
          >
            {naslov}
          </motion.h1>
          {opis && (
            <motion.p className="max-w-2xl text-sm text-ink-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              {opis}
            </motion.p>
          )}
        </div>
        {akcije && <div className="flex flex-wrap items-end gap-2">{akcije}</div>}
      </div>
    </div>
  );
}

/** Naslov razdelka: oranžen, 11 px, velike črke, desno tanka črta s prelivom (finos_stil.txt → 10). */
export function NaslovRazdelka({ children, desno }: { children: ReactNode; desno?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-fines-400">{children}</h2>
      <span aria-hidden className="h-px flex-1 bg-[linear-gradient(90deg,rgb(238_122_58/0.5),transparent)]" />
      {desno}
    </div>
  );
}
