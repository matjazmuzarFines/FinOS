"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Settings } from "lucide-react";
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
          className="group relative min-w-0 transition-transform duration-300 hover:-translate-y-1.5"
        >
          <Link
            href={p.href}
            title={p.hint}
            className="relative block aspect-square rounded-[22px] p-px outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-fines-400 active:scale-[0.98]"
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
                  <span className={`font-display text-2xl font-bold tabular-nums text-white sm:text-3xl ${p.nastavitve ? "pr-11 sm:pr-12" : ""}`} title={`Število: ${p.stevilo}`}>
                    {p.stevilo}
                  </span>
                )}
              </span>
              <span className="mt-auto min-w-0">
                {/* puščica je v vrsti z naslovom (ne prekrije opisa); ob hoverju zdrsne noter */}
                <span className="flex min-w-0 items-center gap-2">
                  <NaslovPloscice besedilo={p.naslov} />
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 -translate-x-2 text-fines-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 line-clamp-3 block text-xs leading-snug text-ink-400 sm:text-sm">{p.opis}</span>
              </span>
            </span>
          </Link>
          {/* zobnik: nastavitve modula (sosednja povezava - povezava v povezavi ni dovoljena) */}
          {p.nastavitve && (
            <Link
              href={p.nastavitve.href}
              title={p.nastavitve.hint}
              aria-label={p.nastavitve.hint}
              className="group/zob absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-ink-200 backdrop-blur-md transition-all duration-300 hover:border-fines-400/60 hover:text-fines-300 hover:shadow-[0_0_24px_-4px_rgb(238_122_58/0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fines-400 active:scale-95 sm:right-4 sm:top-4"
            >
              <Settings className="h-5 w-5 transition-transform duration-500 group-hover/zob:rotate-90" aria-hidden />
            </Link>
          )}
        </motion.li>
      ))}
    </ul>
  );
}

/** Ena vrstica: velika pisava; dve vrstici: manjša. */
const ENA = "text-lg sm:text-2xl";
const DVE = "text-[15px] leading-tight sm:text-lg sm:leading-tight";

/**
 * Naslov ploščice se vedno vidi cel (nikoli "..."): če gre v eno vrsto, je velik, sicer se prelomi v največ dve
 * vrstici z manjšo pisavo. Daljši naslov ni primeren za ploščico - v razvoju opozori v konzoli (finos_stil.txt -> 14).
 */
function NaslovPloscice({ besedilo }: { besedilo: string }) {
  const okvir = useRef<HTMLSpanElement>(null);
  const meritev = useRef<HTMLSpanElement>(null);
  const [dve, setDve] = useState(false);

  useLayoutEffect(() => {
    const el = okvir.current;
    const m = meritev.current;
    if (!el || !m) return;
    const preveri = () => {
      // skrita kopija v eni vrsti in veliki pisavi: ali je širša od vrstice brez puščice (puščica je ob naslovu)
      const vrsta = el.parentElement;
      const puscica = vrsta?.lastElementChild instanceof HTMLElement && vrsta.lastElementChild !== el ? vrsta.lastElementChild.offsetWidth + 8 : 0;
      const preozko = m.offsetWidth > (vrsta?.clientWidth ?? el.clientWidth) - puscica + 0.5;
      setDve(preozko);
      if (preozko && process.env.NODE_ENV !== "production") {
        requestAnimationFrame(() => {
          const vrstica = parseFloat(getComputedStyle(el).lineHeight) || 20;
          if (el.scrollHeight > vrstica * 2 + 2) console.warn(`FIN:OS: naslov ploščice "${besedilo}" je predolg (več kot 2 vrstici) - skrajšaj ga.`);
        });
      }
    };
    preveri();
    const ro = new ResizeObserver(preveri);
    ro.observe(el.parentElement ?? el);
    document.fonts?.ready.then(preveri);
    return () => ro.disconnect();
  }, [besedilo]);

  return (
    <span ref={okvir} title={besedilo} className={`relative min-w-0 break-words font-display font-bold text-white ${dve ? DVE : ENA}`}>
      {besedilo}
      <span ref={meritev} aria-hidden className={`pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap ${ENA}`}>
        {besedilo}
      </span>
    </span>
  );
}
