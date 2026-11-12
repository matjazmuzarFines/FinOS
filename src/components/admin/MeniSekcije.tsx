"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { ustvariNastavitev } from "@/lib/nastavitev";
import { sekcijaPoti, type Sekcija } from "@/lib/nav";

/** Meni sekcije razširjen / zložen - zapomni si brskalnik (velja za vse sekcije). */
const meni = ustvariNastavitev("fos_meni_sekcije", "meniSekcije", "odprt", ["odprt", "zlozen"] as const);

const vzmet = { type: "spring" as const, stiffness: 300, damping: 30 };

/** Ali je pot izbrana: koren samo točno, ostale tudi podstrani. */
const izbrana = (pot: string, href: string, koren: string) => (href === koren ? pot === koren : pot === href || pot.startsWith(`${href}/`));

/**
 * Sekcija z menijem (finos_stil.txt -> 14): levo zložljiv meni sekcije (Pregled = mreža nastavitev, nato razdelki s
 * stranmi), desno cela obstoječa stran. Na telefonu / tablici je meni vodoravna vrsta čipov nad stranjo.
 * Uporabi se v layout.tsx korena sekcije (SEKCIJE v nav.ts).
 */
export function SekcijaZMenijem({ children }: { children: ReactNode }) {
  const pot = usePathname();
  const s = sekcijaPoti(pot);
  if (!s) return <>{children}</>;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <MeniSekcije s={s} pot={pot} />
      <motion.div
        key={pot}
        className="flex min-w-0 flex-1 flex-col gap-6 sm:gap-8"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function MeniSekcije({ s, pot }: { s: Sekcija; pot: string }) {
  const zlozen = meni.useVrednost() === "zlozen";
  const postavke = [{ href: s.koren, naslov: "Pregled", hint: `Vse nastavitve: ${s.naslov}`, icon: LayoutGrid }, ...s.razdelki.flatMap((r) => r.ploscice)];

  return (
    <>
      {/* telefon / tablica: vrsta čipov */}
      <nav aria-label={s.naslov} className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 lg:hidden">
        {postavke.map((p) => {
          const je = izbrana(pot, p.href, s.koren);
          return (
            <Link
              key={p.href}
              href={p.href}
              title={p.hint}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${je ? "border-fines-400/60 bg-fines-500/15 text-white" : "border-white/10 bg-white/[0.04] text-ink-300"}`}
            >
              <p.icon className="h-4 w-4 text-fines-300" aria-hidden />
              {p.naslov}
            </Link>
          );
        })}
      </nav>

      {/* računalnik: meni levo */}
      <motion.nav
        aria-label={s.naslov}
        initial={false}
        animate={{ width: zlozen ? 60 : 236 }}
        transition={vzmet}
        className="fos-glass sticky top-[88px] hidden max-h-[calc(100dvh-110px)] shrink-0 flex-col gap-0.5 overflow-y-auto overflow-x-hidden rounded-[20px] p-2 lg:flex"
      >
        <div className={`flex items-center gap-2 pb-1 ${zlozen ? "justify-center" : "justify-between pl-2"}`}>
          {/* naslov se prelomi (nikoli pod gumb) - gumb ima svoj prostor desno */}
          {!zlozen && <span className="min-w-0 flex-1 text-[11px] font-bold uppercase leading-snug tracking-[0.16em] text-fines-400">{s.naslov}</span>}
          <IconButton
            hint={zlozen ? "Razširi meni" : "Zloži meni - več prostora za stran"}
            icon={zlozen ? PanelLeftOpen : PanelLeftClose}
            onClick={() => meni.nastavi(zlozen ? "odprt" : "zlozen")}
            className="!h-9 !w-9 shrink-0"
          />
        </div>
        <Postavka p={postavke[0]} je={izbrana(pot, s.koren, s.koren)} zlozen={zlozen} />
        {s.razdelki.map((r) => (
          <div key={r.naslov} className="flex flex-col gap-0.5">
            {zlozen ? <span aria-hidden className="mx-3 my-2 h-px bg-white/10" /> : <span className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">{r.naslov}</span>}
            {r.ploscice.map((p) => (
              <Postavka key={p.href} p={p} je={izbrana(pot, p.href, s.koren)} zlozen={zlozen} />
            ))}
          </div>
        ))}
      </motion.nav>
    </>
  );
}

function Postavka({ p, je, zlozen }: { p: { href: string; naslov: string; hint: string; icon: typeof LayoutGrid }; je: boolean; zlozen: boolean }) {
  return (
    <Link href={p.href} title={zlozen ? p.naslov : p.hint} className={`group relative flex items-center gap-3 rounded-[12px] py-2 text-sm font-semibold transition-colors ${zlozen ? "justify-center px-0" : "px-3"} ${je ? "text-white" : "text-ink-300 hover:text-white"}`}>
      {je && <motion.span layoutId="meni-sekcije" transition={vzmet} className="absolute inset-0 rounded-[12px] border border-fines-400/50 bg-fines-500/10 shadow-[0_0_20px_-8px_rgb(238_122_58/0.8)]" />}
      {!je && <span aria-hidden className="absolute inset-0 rounded-[12px] bg-white/[0.05] opacity-0 transition-opacity group-hover:opacity-100" />}
      <p.icon className={`relative h-[18px] w-[18px] shrink-0 transition-colors ${je ? "text-fines-300" : "text-ink-400 group-hover:text-fines-300"}`} aria-hidden />
      {!zlozen && <span className="relative truncate">{p.naslov}</span>}
    </Link>
  );
}
