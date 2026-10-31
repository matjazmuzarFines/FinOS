"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, SearchX, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IskalnoPolje, Izbira } from "@/components/ui/Polje";
import { ujemaIskanje } from "@/lib/iskanje";
import { polnoIme, primerjajImena, zacetnice, type Oddelek, type Zaposleni } from "@/lib/zaposleni";

type Props = {
  ljudje: Zaposleni[];
  oddelki: Oddelek[];
  izbran: Zaposleni | null;
  onIzberi: (z: Zaposleni) => void;
};

// filtri ostanejo ob menjavi strani
let spomin = { iskanje: "", oddelek: null as number | null };

/**
 * Izbor osebe (ni osrednja funkcija - ozek stolpec): iskanje po imenu / priimku, filter oddelka, seznam.
 * Seznam dobi že omejene ljudi (Administracija vse, FIN:ME sebe in podrejene - vidniZaposleni). Na telefonu zložen.
 */
export function IzbiraOseb({ ljudje, oddelki, izbran, onIzberi }: Props) {
  const [iskanje, setIskanje] = useState(spomin.iskanje);
  const [oddelek, setOddelek] = useState(spomin.oddelek);
  const [odprto, setOdprto] = useState(false);
  const nastavi = (p: Partial<typeof spomin>) => {
    spomin = { ...spomin, ...p };
    if (p.iskanje !== undefined) setIskanje(p.iskanje);
    if (p.oddelek !== undefined) setOddelek(p.oddelek);
  };

  const prikazani = useMemo(
    () => ljudje.filter((z) => (oddelek == null || z.id_oddelek === oddelek) && ujemaIskanje(iskanje, [z.ime, z.priimek, z.oddelek?.ime_oddelka])).sort(primerjajImena),
    [ljudje, iskanje, oddelek],
  );
  const vOddelkih = oddelki.filter((o) => ljudje.some((z) => z.id_oddelek === o.id));

  return (
    <section className="fos-glass flex min-w-0 flex-col gap-3 rounded-[20px] p-3 lg:sticky lg:top-[84px] lg:max-h-[calc(100dvh-108px)]">
      {/* telefon / tablica: izbrana oseba, klik razpre seznam */}
      <button
        type="button"
        onClick={() => setOdprto((o) => !o)}
        title={odprto ? "Skrij seznam oseb" : "Izberi drugo osebo"}
        aria-expanded={odprto}
        className="flex items-center gap-3 rounded-[14px] text-left lg:hidden"
      >
        {izbran ? <Avatar besedilo={zacetnice(izbran)} velikost="sm" /> : <Users className="h-5 w-5 text-ink-400" aria-hidden />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-white">{izbran ? polnoIme(izbran) : "Izberi osebo"}</span>
          <span className="truncate text-xs text-ink-400">{izbran?.oddelek?.ime_oddelka ?? `${ljudje.length} oseb`}</span>
        </span>
        <ChevronDown className={`h-5 w-5 text-ink-400 transition-transform duration-300 ${odprto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      <div className="hidden items-center justify-between gap-2 lg:flex">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-fines-400">Osebe</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-400" title="Prikazanih / vseh oseb">
          {prikazani.length === ljudje.length ? ljudje.length : `${prikazani.length} / ${ljudje.length}`}
        </span>
      </div>

      <div className={`${odprto ? "flex" : "hidden"} min-h-0 flex-col gap-2 lg:flex`}>
        <IskalnoPolje value={iskanje} onChange={(v) => nastavi({ iskanje: v })} hint="Išči po imenu, priimku ali oddelku" placeholder="Išči osebo ..." />
        {vOddelkih.length > 1 && <Izbira value={oddelek} onChange={(v) => nastavi({ oddelek: v })} moznosti={vOddelkih.map((o) => ({ id: o.id, ime: o.ime_oddelka }))} prazno="Vsi oddelki" hint="Pokaži samo osebe iz oddelka" />}
      </div>

      <ul className={`${odprto ? "flex" : "hidden"} -mx-1 max-h-[50dvh] min-h-0 flex-col gap-0.5 overflow-y-auto px-1 lg:flex lg:max-h-none lg:flex-1`}>
        <AnimatePresence initial={false}>
          {prikazani.map((z) => {
            const je = z.id === izbran?.id;
            return (
              <motion.li key={z.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    onIzberi(z);
                    setOdprto(false);
                  }}
                  aria-pressed={je}
                  title={`Pokaži registracijo časa: ${polnoIme(z)}`}
                  className={`group relative flex w-full items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-left transition-colors duration-300 ${je ? "text-snow" : "text-ink-200 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  {je && (
                    <motion.span
                      layoutId="izbrana-oseba"
                      className="absolute inset-0 rounded-[12px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_6px_20px_-8px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-[9px] font-display text-[11px] font-bold ${je ? "bg-black/15" : "bg-fines-500/10 text-fines-300 ring-1 ring-fines-400/25"}`}>{zacetnice(z)}</span>
                  <span className="relative flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">
                      {z.priimek} {z.ime}
                    </span>
                    <span className={`truncate text-[11px] ${je ? "text-snow/75" : "text-ink-500"}`}>{z.oddelek?.ime_oddelka ?? "Brez oddelka"}</span>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {!prikazani.length && (
          <li className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ink-500">
            <SearchX className="h-5 w-5" aria-hidden />
            Ni oseb za ta filter.
          </li>
        )}
      </ul>
    </section>
  );
}
