"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Network, ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, CreditCard, RefreshCw, RotateCcw, SearchX, UserRoundPlus } from "lucide-react";
import { DodajZaposlenega } from "./ZaposleniObrazec";
import { useLahkoUreja } from "@/lib/pravice";
import { Button } from "@/components/ui/Button";
import { GlavaStrani } from "@/components/ui/GlavaStrani";
import { IskalnoPolje, POLJE, PoljeNaslov } from "@/components/ui/Polje";
import { Avatar } from "@/components/ui/Avatar";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { ujemaIskanje } from "@/lib/iskanje";
import { osveziZaposlene, polnoIme, useZaposleni, zacetnice, type Zaposleni } from "@/lib/zaposleni";

type Sort = "ime" | "priimek" | "oddelek";
type Filtri = { iskanje: string; oddelki: number[]; vodja: number | null; sort: Sort; smer: 1 | -1 };

const PRIVZETO: Filtri = { iskanje: "", oddelki: [], vodja: null, sort: "priimek", smer: 1 };
/** Brez oddelka (filter). */
const BREZ = -1;
// filtri ostanejo, ko greš na list zaposlenega in nazaj
let spomin: Filtri = PRIVZETO;

const SORT_IME: Record<Sort, string> = { ime: "Ime", priimek: "Priimek", oddelek: "Oddelek" };
const SORT_PO: Record<Sort, string> = { ime: "imenu", priimek: "priimku", oddelek: "oddelku" };
const primerjaj = (a: string | undefined, b: string | undefined) => {
  if (!a && !b) return 0;
  if (!a) return 1; // prazne vrednosti vedno na koncu
  if (!b) return -1;
  return a.localeCompare(b, "sl", { sensitivity: "base" });
};

// stolpci seznama od sm naprej: avatar | ime | priimek | oddelek | vodja | kartica | puščica
const STOLPCI = "sm:grid sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_7.5rem_1.25rem] sm:items-center sm:gap-4";

/** Seznam zaposlenih: hitri filtri (iskanje, oddelki, vodja), razvrščanje po imenu / priimku / oddelku, klik odpre list. */
export function SeznamZaposlenih() {
  const { podatki, napaka } = useZaposleni();
  const lahkoUreja = useLahkoUreja();
  const [dodaj, setDodaj] = useState(false);
  const router = useRouter();
  const [f, setF] = useState<Filtri>(spomin);
  const nastavi = (p: Partial<Filtri>) =>
    setF((s) => {
      spomin = { ...s, ...p };
      return spomin;
    });

  const zaposleni = useMemo(() => podatki?.zaposleni ?? [], [podatki]);
  const oddelki = podatki?.oddelki ?? [];
  const vodje = podatki?.vodje ?? [];

  const poOddelku = useMemo(() => {
    const m = new Map<number, number>();
    for (const z of zaposleni) m.set(z.id_oddelek ?? BREZ, (m.get(z.id_oddelek ?? BREZ) ?? 0) + 1);
    return m;
  }, [zaposleni]);

  const prikazani = useMemo(() => {
    const kljuc = (z: Zaposleni) => (f.sort === "oddelek" ? z.oddelek?.ime_oddelka : z[f.sort]);
    return zaposleni
      .filter((z) => !f.oddelki.length || f.oddelki.includes(z.id_oddelek ?? BREZ))
      .filter((z) => f.vodja == null || z.id_vodja === f.vodja)
      .filter((z) => ujemaIskanje(f.iskanje, [z.ime, z.priimek, z.st_kartice, z.oddelek?.ime_oddelka, z.vodja && polnoIme(z.vodja)]))
      .sort((a, b) => {
        const ka = kljuc(a);
        const kb = kljuc(b);
        if (!ka !== !kb) return primerjaj(ka, kb); // prazne na koncu ne glede na smer
        return f.smer * primerjaj(ka, kb) || primerjaj(a.priimek, b.priimek) || primerjaj(a.ime, b.ime);
      });
  }, [zaposleni, f]);

  const filtrirano = f.iskanje !== "" || f.oddelki.length > 0 || f.vodja != null;
  const razvrsti = (s: Sort) => nastavi(f.sort === s ? { smer: f.smer === 1 ? -1 : 1 } : { sort: s, smer: 1 });
  const preklopiOddelek = (id: number) => nastavi({ oddelki: f.oddelki.includes(id) ? f.oddelki.filter((o) => o !== id) : [...f.oddelki, id] });
  const ponastavi = () => nastavi({ iskanje: "", oddelki: [], vodja: null });

  const chipi = [...oddelki.map((o) => ({ id: o.id, ime: o.ime_oddelka })), ...(poOddelku.get(BREZ) ? [{ id: BREZ, ime: "Brez oddelka" }] : [])];

  return (
    <>
      <GlavaStrani
        drobtine={[{ naslov: "FIN:OS", href: "/" }, { naslov: "Administracija", href: "/administracija" }, { naslov: "Zaposleni" }]}
        naslov="Zaposleni"
        opis={podatki ? `${zaposleni.length} zaposlenih v ${oddelki.length} oddelkih. Klikni zaposlenega za njegov list.` : "Seznam vseh zaposlenih in njihovih podatkov."}
        akcije={
          <>
            <Button hint="Odpri drevo vodij in podrejenih" variant="neutral" icon={Network} onClick={() => router.push("/administracija/zaposleni/hierarhija")}>
              Prikaz hierarhije
            </Button>
            {lahkoUreja && podatki && (
              <Button hint="Dodaj novega zaposlenega v bazo" variant="success" icon={UserRoundPlus} onClick={() => setDodaj(true)}>
                Dodaj zaposlenega
              </Button>
            )}
          </>
        }
      />

      {/* hitri filtri */}
      <motion.section
        aria-label="Filtri zaposlenih"
        className="fos-glass relative z-10 flex flex-col gap-4 rounded-[20px] p-3 sm:p-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <PoljeNaslov naslov="Iskanje" className="min-w-[min(100%,16rem)] flex-[2]">
            <IskalnoPolje value={f.iskanje} onChange={(v) => nastavi({ iskanje: v })} hint="Išči po imenu, priimku, kartici, oddelku, vodji" placeholder="Ime, priimek, kartica ..." />
          </PoljeNaslov>
          <PoljeNaslov naslov="Vodja" className="min-w-[min(100%,12rem)] flex-1">
            <select
              value={f.vodja ?? ""}
              onChange={(e) => nastavi({ vodja: e.target.value ? Number(e.target.value) : null })}
              title="Prikaži samo zaposlene izbranega vodje"
              className={`${POLJE} cursor-pointer [&>option]:bg-ink-900`}
            >
              <option value="">Vsi vodje</option>
              {vodje.map((v) => (
                <option key={v.id} value={v.id}>
                  {polnoIme(v.zaposleni)}
                </option>
              ))}
            </select>
          </PoljeNaslov>
          {filtrirano && (
            <Button hint="Počisti iskanje in vse filtre" variant="neutral" icon={RotateCcw} onClick={ponastavi}>
              Ponastavi
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-400">Oddelki</span>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            <Chip izbran={!f.oddelki.length} onClick={() => nastavi({ oddelki: [] })} hint="Prikaži zaposlene iz vseh oddelkov" stevilo={zaposleni.length}>
              Vsi
            </Chip>
            {chipi.map((o) => (
              <Chip key={o.id} izbran={f.oddelki.includes(o.id)} onClick={() => preklopiOddelek(o.id)} hint={`Prikaži ali skrij oddelek ${o.ime}`} stevilo={poOddelku.get(o.id) ?? 0}>
                {o.ime}
              </Chip>
            ))}
          </div>
        </div>

        {/* razvrščanje na telefonu (od sm naprej je v glavi seznama) */}
        <div className="flex flex-col gap-1.5 sm:hidden">
          <span className="text-xs font-semibold text-ink-400">Razvrsti</span>
          <div className="flex gap-2">
            {(Object.keys(SORT_IME) as Sort[]).map((s) => (
              <Chip key={s} izbran={f.sort === s} onClick={() => razvrsti(s)} hint={`Razvrsti po ${SORT_PO[s]}, ponovni klik obrne`}>
                {SORT_IME[s]}
                {f.sort === s && (f.smer === 1 ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
              </Chip>
            ))}
          </div>
        </div>
      </motion.section>

      {/* seznam */}
      {napaka ? (
        <PraznoStanje
          ton="napaka"
          icon={AlertTriangle}
          naslov="Zaposlenih ni mogoče prebrati"
          opis={
            <>
              <p>{napaka}</p>
              {/relation|does not exist|schema cache/i.test(napaka) && (
                <p className="mt-2">
                  Tabele še niso ustvarjene: v Supabase (SQL Editor) po vrsti zaženi <code className="font-mono text-fines-300">001_zaposleni.sql</code> in <code className="font-mono text-fines-300">002_vodje.sql</code> (mapa supabase/migrations).
                </p>
              )}
            </>
          }
          akcija={
            <Button hint="Poskusi znova prebrati zaposlene" variant="sync" icon={RefreshCw} onClick={osveziZaposlene}>
              Poskusi znova
            </Button>
          }
        />
      ) : !podatki ? (
        <Nalaganje />
      ) : !zaposleni.length ? (
        <PraznoStanje
          icon={UserRoundPlus}
          naslov="V bazi še ni zaposlenih"
          opis={lahkoUreja ? "Dodaj prvega zaposlenega." : "Zaposlene dodaja administrator."}
          akcija={
            lahkoUreja && (
              <Button hint="Dodaj novega zaposlenega v bazo" variant="success" icon={UserRoundPlus} onClick={() => setDodaj(true)}>
                Dodaj zaposlenega
              </Button>
            )
          }
        />
      ) : (
        <section aria-label="Seznam zaposlenih" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 px-1 text-xs text-ink-400">
            <span>
              Prikazanih <b className="text-ink-200 tabular-nums">{prikazani.length}</b> od <span className="tabular-nums">{zaposleni.length}</span>
            </span>
          </div>

          {/* glava seznama = razvrščanje (od sm naprej), lepljiva pod glavo aplikacije */}
          <div className={`sticky top-[68px] z-20 hidden rounded-[14px] border border-white/10 bg-ink-800/80 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-300 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.8)] backdrop-blur-xl ${STOLPCI}`}>
            <span />
            <SortGlava ime="Ime" po="imenu" aktiven={f.sort === "ime"} smer={f.smer} onClick={() => razvrsti("ime")} />
            <SortGlava ime="Priimek" po="priimku" aktiven={f.sort === "priimek"} smer={f.smer} onClick={() => razvrsti("priimek")} />
            <SortGlava ime="Oddelek" po="oddelku" aktiven={f.sort === "oddelek"} smer={f.smer} onClick={() => razvrsti("oddelek")} />
            <span>Vodja</span>
            <span>Kartica</span>
            <span />
          </div>

          {prikazani.length ? (
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false} mode="popLayout">
                {prikazani.map((z, i) => (
                  <Vrstica key={z.id} z={z} zamik={Math.min(i, 14) * 0.025} />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <PraznoStanje
              icon={SearchX}
              naslov="Ni zaposlenih za izbrane filtre"
              opis="Spremeni iskanje ali izbrane oddelke."
              akcija={
                <Button hint="Počisti iskanje in vse filtre" variant="neutral" icon={RotateCcw} onClick={ponastavi}>
                  Ponastavi filtre
                </Button>
              }
            />
          )}
        </section>
      )}
      {podatki && <DodajZaposlenega open={dodaj} onClose={() => setDodaj(false)} podatki={podatki} />}
    </>
  );
}

/** Vrstica zaposlenega: od sm naprej stolpci, na telefonu kartica. */
function Vrstica({ z, zamik }: { z: Zaposleni; zamik: number }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: zamik, type: "spring", stiffness: 260, damping: 26 } }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
    >
      <Link
        href={`/administracija/zaposleni/${z.id}`}
        title={`Odpri list zaposlenega ${polnoIme(z)}`}
        className={`fos-glass group relative flex items-center gap-3 overflow-hidden rounded-[16px] px-3 py-2.5 outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-fines-400/40 hover:shadow-[0_16px_40px_-18px_rgb(202_80_16/0.7)] focus-visible:ring-2 focus-visible:ring-fines-400 sm:px-4 ${STOLPCI}`}
      >
        <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] origin-center scale-y-0 rounded-full bg-[linear-gradient(180deg,#f19a66,#ca5010)] transition-transform duration-300 group-hover:scale-y-100" />
        <Avatar besedilo={zacetnice(z)} />

        {/* telefon: ime + oddelek + vodja / kartica v dveh vrsticah */}
        <span className="flex min-w-0 flex-1 flex-col sm:hidden">
          <span className="truncate font-semibold text-white">{polnoIme(z)}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-ink-400">
            <OddelekZnacka z={z} />
            {z.st_kartice && (
              <span className="flex items-center gap-1 font-mono">
                <CreditCard className="h-3 w-3" aria-hidden />
                {z.st_kartice}
              </span>
            )}
          </span>
        </span>

        <span className="hidden truncate font-semibold text-white sm:block">{z.ime}</span>
        <span className="hidden truncate font-semibold text-white sm:block">{z.priimek}</span>
        <span className="hidden min-w-0 sm:block">
          <OddelekZnacka z={z} />
        </span>
        <span className="hidden truncate text-sm text-ink-300 sm:block">{z.vodja ? polnoIme(z.vodja) : <span className="text-ink-500">-</span>}</span>
        <span className="hidden items-center gap-1.5 truncate font-mono text-sm text-ink-300 sm:flex">
          {z.st_kartice ? (
            <>
              <CreditCard className="h-3.5 w-3.5 shrink-0 text-fines-400" aria-hidden />
              {z.st_kartice}
            </>
          ) : (
            <span className="text-ink-500">-</span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-500 transition-all duration-300 group-hover:translate-x-1 group-hover:text-fines-300" aria-hidden />
      </Link>
    </motion.li>
  );
}

function OddelekZnacka({ z }: { z: Zaposleni }) {
  if (!z.oddelek) return <span className="text-xs text-ink-500">Brez oddelka</span>;
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-full border border-fines-400/30 bg-fines-500/10 px-2.5 py-0.5 text-xs font-semibold text-fines-300">
      {z.oddelek.ime_oddelka}
    </span>
  );
}

function SortGlava({ ime, po, aktiven, smer, onClick }: { ime: string; po: string; aktiven: boolean; smer: 1 | -1; onClick: () => void }) {
  const Ikona = !aktiven ? ArrowUpDown : smer === 1 ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      title={aktiven ? `Obrni razvrščanje po ${po}` : `Razvrsti po ${po} naraščajoče`}
      className={`group/s flex items-center gap-1.5 justify-self-start rounded-md uppercase tracking-wider transition-colors hover:text-fines-300 ${aktiven ? "text-fines-300" : ""}`}
    >
      {ime}
      <motion.span key={`${aktiven}-${smer}`} initial={{ y: aktiven ? (smer === 1 ? 4 : -4) : 0, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }}>
        <Ikona className={`h-3.5 w-3.5 ${aktiven ? "" : "opacity-40 group-hover/s:opacity-80"}`} aria-hidden />
      </motion.span>
    </button>
  );
}

/** Gumb-filter (čip): izbran oranžen preliv s sijem, neizbran steklen. */
function Chip({ izbran, onClick, hint, stevilo, children }: { izbran: boolean; onClick: () => void; hint: string; stevilo?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={izbran}
      className={`flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-all duration-300 active:scale-[0.97] ${
        izbran
          ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_6px_20px_-8px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
          : "border border-white/10 bg-white/[0.04] text-ink-200 hover:border-fines-400/40 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
      {stevilo != null && <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${izbran ? "bg-black/20" : "bg-white/10 text-ink-400"}`}>{stevilo}</span>}
    </button>
  );
}

/** Okostje seznama med nalaganjem. */
function Nalaganje() {
  return (
    <ul aria-label="Nalagam zaposlene" className="flex flex-col gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="fos-glass flex h-16 items-center gap-3 overflow-hidden rounded-[16px] px-4" style={{ opacity: 1 - i * 0.13 }}>
          <span className="h-11 w-11 animate-pulse rounded-xl bg-white/10" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
            <span className="h-2.5 w-1/5 animate-pulse rounded bg-white/[0.07]" />
          </span>
        </li>
      ))}
    </ul>
  );
}
