"use client";

import type { CSSProperties, ReactNode } from "react";
import { Clock, FlaskConical } from "lucide-react";
import { IKONE_STATISTIK, type Statistika } from "@/lib/casNastavitve";

/** Značka "Testni podatki": prikaz še ni povezan z bazo (rumena, hover pove zakaj). */
export function TestniPodatki({ opis = "Prikaz uporablja testne podatke - baza še ni potrjena. Spremembe se ob osvežitvi strani ponastavijo." }: { opis?: string }) {
  return (
    <span title={opis} className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-warn-500/40 bg-warn-500/10 px-2.5 text-[11px] font-bold uppercase tracking-wider text-warn-500">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      Testni podatki
    </span>
  );
}

/** Ploščica z ikono statistike v njeni barvi (preliv in sij). */
export function IkonaStatistike({ s, velikost = "md", className = "" }: { s: Pick<Statistika, "barva" | "ikona"> | undefined; velikost?: "sm" | "md" | "lg"; className?: string }) {
  const Ikona = IKONE_STATISTIK[s?.ikona ?? ""] ?? Clock;
  const barva = s?.barva ?? "#6b6b72";
  const v = velikost === "lg" ? "h-16 w-16 rounded-2xl" : velikost === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-[10px]";
  const i = velikost === "lg" ? "h-8 w-8" : velikost === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden text-snow ${v} ${className}`}
      style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${barva} 70%, white), ${barva} 55%, color-mix(in srgb, ${barva} 70%, black))`, boxShadow: `0 6px 18px -8px ${barva}, inset 0 1px 0 rgb(255 255 255 / 0.3)` }}
    >
      <Ikona className={i} aria-hidden />
    </span>
  );
}

/** Čip statistike: barvna pika, koda, ime. */
export function CipStatistike({ s, kratko }: { s: Statistika | undefined; kratko?: boolean }) {
  if (!s) return <span className="text-xs text-ink-500">Brez statistike</span>;
  return (
    <span title={`${s.koda} - ${s.ime}${s.visible ? "" : " (skrita)"}`} className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-0.5 pl-1.5 pr-2.5 text-xs font-semibold text-ink-200 ${s.visible ? "" : "opacity-50"}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.barva, boxShadow: `0 0 8px ${s.barva}` }} />
      <span className="font-mono text-[11px] text-ink-400">{s.koda}</span>
      {!kratko && <span className="truncate">{s.ime}</span>}
    </span>
  );
}

/** Ozadje odseka časovne linije v barvi statistike (celodnevno = poševne črte). */
export function slogOdseka(barva: string, celodnevno?: boolean): CSSProperties {
  const preliv = `linear-gradient(180deg, color-mix(in srgb, ${barva} 72%, white), ${barva} 60%, color-mix(in srgb, ${barva} 80%, black))`;
  return {
    background: celodnevno ? `repeating-linear-gradient(135deg, rgb(255 255 255 / 0.22) 0 3px, transparent 3px 8px), ${preliv}` : preliv,
    boxShadow: `0 0 12px -3px ${barva}, inset 0 1px 0 rgb(255 255 255 / 0.35)`,
  };
}

/** Kartica-panel s steklom in naslovom (levi / desni stolpec strani). */
export function Panel({ naslov, desno, children, className = "" }: { naslov?: ReactNode; desno?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`fos-glass flex min-w-0 flex-col gap-3 rounded-[20px] p-3 sm:p-4 ${className}`}>
      {(naslov || desno) && (
        <div className="flex min-h-8 items-center justify-between gap-2">
          {naslov && <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-fines-400">{naslov}</h3>}
          {desno}
        </div>
      )}
      {children}
    </section>
  );
}
