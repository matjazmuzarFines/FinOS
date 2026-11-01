"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, RotateCcw, SearchX, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IskalnoPolje, Izbira } from "@/components/ui/Polje";
import { ujemaIskanje } from "@/lib/iskanje";
import { polnoIme, primerjajImena, zacetnice, type Oddelek, type Vodja, type Zaposleni } from "@/lib/zaposleni";
import { Kvadratek } from "./Polja";

type Props = {
  ljudje: Zaposleni[];
  oddelki: Oddelek[];
  vodje: Vodja[];
  izbran: Zaposleni | null;
  onIzberi: (z: Zaposleni) => void;
  /** Označene osebe (kvadratki) - za izvoze; neodvisno od izbrane osebe na koledarju. */
  oznaceni: ReadonlySet<number>;
  onOznaci: (oznaceni: ReadonlySet<number>) => void;
};

// filtri ostanejo ob menjavi strani
const PRAZNO = { iskanje: "", oddelek: null as number | null, vodja: null as number | null };
let spomin = PRAZNO;

/**
 * Izbor osebe: iskanje po imenu / priimku / oddelku / vodji, filtra Oddelek in Vodja (neposredni podrejeni), seznam.
 * Seznam dobi že omejene ljudi (Administracija vse, FIN:ME sebe in podrejene - vidniZaposleni). Na telefonu zložen.
 */
export function IzbiraOseb({ ljudje, oddelki, vodje, izbran, onIzberi, oznaceni, onOznaci }: Props) {
  const [f, setF] = useState(spomin);
  const [odprto, setOdprto] = useState(false);
  const nastavi = (p: Partial<typeof spomin>) => {
    spomin = { ...spomin, ...p };
    setF(spomin);
  };

  const prikazani = useMemo(
    () =>
      ljudje
        .filter((z) => (f.oddelek == null || z.id_oddelek === f.oddelek) && (f.vodja == null || z.id_vodja === f.vodja))
        .filter((z) => ujemaIskanje(f.iskanje, [z.ime, z.priimek, z.oddelek?.ime_oddelka, z.vodja && polnoIme(z.vodja)]))
        .sort(primerjajImena),
    [ljudje, f],
  );
  const vOddelkih = oddelki.filter((o) => ljudje.some((z) => z.id_oddelek === o.id));
  // vodje, ki imajo v seznamu vsaj enega podrejenega (s številom)
  const vodjeSeznama = vodje
    .map((v) => ({ v, n: ljudje.filter((z) => z.id_vodja === v.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => primerjajImena(a.v.zaposleni, b.v.zaposleni));
  const filtrirano = f.iskanje !== "" || f.oddelek != null || f.vodja != null;
  const oznacenihPrikazanih = prikazani.filter((z) => oznaceni.has(z.id)).length;
  const vsiOznaceni = prikazani.length > 0 && oznacenihPrikazanih === prikazani.length;

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
        <span className="flex items-center gap-2">
          {filtrirano && (
            <button type="button" onClick={() => nastavi(PRAZNO)} title="Počisti iskanje in filtra" className="flex items-center gap-1 text-[11px] font-semibold text-ink-400 transition-colors hover:text-fines-300">
              <RotateCcw className="h-3 w-3" aria-hidden />
              Ponastavi
            </button>
          )}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-400" title="Prikazanih / vseh oseb">
            {prikazani.length === ljudje.length ? ljudje.length : `${prikazani.length} / ${ljudje.length}`}
          </span>
        </span>
      </div>

      <div className={`${odprto ? "flex" : "hidden"} shrink-0 flex-col gap-2 lg:flex`}>
        <IskalnoPolje value={f.iskanje} onChange={(v) => nastavi({ iskanje: v })} hint="Išči po imenu, priimku, oddelku ali vodji" placeholder="Išči osebo ..." />
        <div className="grid grid-cols-2 gap-2">
          <Izbira value={f.oddelek} onChange={(v) => nastavi({ oddelek: v })} moznosti={vOddelkih.map((o) => ({ id: o.id, ime: o.ime_oddelka }))} prazno="Vsi oddelki" hint="Pokaži samo osebe iz oddelka" />
          <Izbira
            value={f.vodja}
            onChange={(v) => nastavi({ vodja: v })}
            moznosti={vodjeSeznama.map(({ v, n }) => ({ id: v.id, ime: `${v.zaposleni.priimek} ${v.zaposleni.ime} (${n})` }))}
            prazno="Vsi vodje"
            hint="Pokaži samo neposredne podrejene vodje"
          />
        </div>
      </div>

      {/* označevanje oseb (za izvoze): vse prikazane po filtru; označeni ostanejo, tudi ko jih filter skrije */}
      <div className={`${odprto ? "flex" : "hidden"} shrink-0 items-center gap-2 border-y border-white/[0.06] px-1 py-1.5 lg:flex`}>
        <Kvadratek
          majhen
          vklop={vsiOznaceni}
          delno={oznacenihPrikazanih > 0}
          onChange={(da) => {
            const s = new Set(oznaceni);
            for (const z of prikazani) {
              if (da) s.add(z.id);
              else s.delete(z.id);
            }
            onOznaci(s);
          }}
          hint={vsiOznaceni ? "Odznači vse prikazane osebe" : "Označi vse prikazane osebe (za izvoz)"}
          disabled={!prikazani.length}
        />
        <span className="text-xs font-semibold text-ink-300">Označi vse{filtrirano ? " prikazane" : ""}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-ink-500">
          {oznaceni.size > 0 && (
            <>
              <b className="tabular-nums text-fines-300">{oznaceni.size}</b> označenih
              <button type="button" onClick={() => onOznaci(new Set())} title="Odznači vse osebe (tudi skrite s filtrom)" className="font-semibold text-ink-400 transition-colors hover:text-fines-300">
                Počisti
              </button>
            </>
          )}
        </span>
      </div>

      {/* vrstica osebe v eni vrsti (~26 px): kvadratek, začetnice, priimek in ime, desno oddelek */}
      <ul className={`${odprto ? "flex" : "hidden"} -mx-1 max-h-[50dvh] min-h-0 flex-col overflow-y-auto px-1 lg:flex lg:max-h-none lg:flex-1`}>
        <AnimatePresence initial={false}>
          {prikazani.map((z) => {
            const je = z.id === izbran?.id;
            const oznacen = oznaceni.has(z.id);
            return (
              <motion.li key={z.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 pl-1">
                <Kvadratek
                  majhen
                  vklop={oznacen}
                  onChange={(da) => {
                    const s = new Set(oznaceni);
                    if (da) s.add(z.id);
                    else s.delete(z.id);
                    onOznaci(s);
                  }}
                  hint={`${oznacen ? "Odznači" : "Označi"} osebo ${polnoIme(z)} (za izvoz)`}
                />
                <button
                  type="button"
                  onClick={() => {
                    onIzberi(z);
                    setOdprto(false);
                  }}
                  aria-pressed={je}
                  title={`Pokaži registracijo časa: ${polnoIme(z)}`}
                  className={`group relative flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-1.5 py-[3px] text-left transition-colors duration-300 ${je ? "text-snow" : "text-ink-200 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  {je && (
                    <motion.span
                      layoutId="izbrana-oseba"
                      className="absolute inset-0 rounded-[8px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_4px_14px_-6px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className={`relative grid h-5 w-5 shrink-0 place-items-center rounded-[5px] font-display text-[9px] font-bold ${je ? "bg-black/15" : "bg-fines-500/10 text-fines-300 ring-1 ring-fines-400/25"}`}>{zacetnice(z)}</span>
                  <span className="relative min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {z.priimek} {z.ime}
                  </span>
                  <span className={`relative max-w-[45%] shrink-0 truncate text-[11px] ${je ? "text-snow/75" : "text-ink-500"}`} title={z.oddelek?.ime_oddelka ?? "Brez oddelka"}>
                    {z.oddelek?.ime_oddelka ?? "Brez oddelka"}
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
