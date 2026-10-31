"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Crown, SearchX, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { IskalnoPolje, Izbira, POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { nastaviUrnike, useCasNastavitve } from "@/lib/casNastavitve";
import { ujemaIskanje } from "@/lib/iskanje";
import { primerjajImena, useZaposleni, zacetnice } from "@/lib/zaposleni";

/** Brez urnika (filter). */
const BREZ = -1;
/** Stolpci seznama: začetnice | zaposleni | oddelek | urnik */
const STOLPCI = "sm:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,0.8fr)_14rem]";
type Sort = { po: "ime" | "oddelek"; smer: 1 | -1 };

/**
 * Urniki zaposlenih (gumb na strani Urniki): seznam vseh zaposlenih (ime, priimek, oddelek; vodja s krono) in pri vsakem
 * izbira urnika. Spremembe se zbirajo, Shrani jih zapiše (ln_fos_zaposleni_urniki prek fos_nastavi_urnik - star zapis
 * se skrije, nov velja od danes). Brez posebnih skupin: zaposleni se veže neposredno na urnik.
 */
export function UrnikiZaposlenih({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [osnutek, setOsnutek] = useState<Map<number, number | null>>(new Map());
  const [shranjujem, setShranjujem] = useState(false);
  const zapri = () => {
    if (osnutek.size && !confirm("Imaš neshranjene spremembe urnikov. Jih zavržem?")) return;
    setOsnutek(new Map());
    onClose();
  };
  const shrani = async () => {
    setShranjujem(true);
    try {
      await nastaviUrnike([...osnutek].map(([id_zaposlenega, id_urnika]) => ({ id_zaposlenega, id_urnika })));
      obvesti(osnutek.size === 1 ? "Urnik zaposlenega je shranjen." : `Urniki ${osnutek.size} zaposlenih so shranjeni.`);
      setOsnutek(new Map());
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };
  return (
    <Modal
      open={open}
      title="Urniki zaposlenih"
      onClose={zapri}
      siroko
      noga={
        // noga okna je vedno na dnu (ne prekriva seznama)
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink-400">{osnutek.size ? <span className="text-warn-500">{osnutek.size} sprememb</span> : "Ni sprememb"}</span>
          <span className="flex gap-2">
            <Button hint="Zavrzi spremembe urnikov" variant="neutral" icon={Undo2} onClick={() => setOsnutek(new Map())} disabled={!osnutek.size || shranjujem}>
              Prekliči
            </Button>
            <Button hint="Shrani urnike zaposlenih" variant="success" icon={Check} onClick={shrani} disabled={!osnutek.size || shranjujem}>
              {shranjujem ? "Shranjujem ..." : "Shrani"}
            </Button>
          </span>
        </div>
      }
    >
      {open && <Seznam osnutek={osnutek} setOsnutek={setOsnutek} />}
    </Modal>
  );
}

type SeznamProps = { osnutek: Map<number, number | null>; setOsnutek: (m: Map<number, number | null>) => void };

function Seznam({ osnutek, setOsnutek }: SeznamProps) {
  const { podatki, napaka } = useZaposleni();
  const n = useCasNastavitve();
  const [iskanjeIme, setIskanjeIme] = useState("");
  const [iskanjeOddelek, setIskanjeOddelek] = useState("");
  const [sort, setSort] = useState<Sort>({ po: "ime", smer: 1 });
  // klik: naraščajoče, ponovni klik padajoče
  const razvrsti = (po: Sort["po"]) => setSort((x) => ({ po, smer: x.po === po ? (-x.smer as 1 | -1) : 1 }));
  const [filter, setFilter] = useState<number | null>(null);

  const urniki = n.urniki.filter((u) => u.visible);
  const trenutni = (id: number) => {
    const z = n.zaposleniUrniki.find((x) => x.id_zaposlenega === id);
    return z && urniki.some((u) => u.id === z.id_urnika) ? z.id_urnika : null;
  };
  const izbran = (id: number) => (osnutek.has(id) ? osnutek.get(id)! : trenutni(id));
  const nastavi = (id: number, urnik: number | null) => {
    const m = new Map(osnutek);
    if (urnik === trenutni(id)) m.delete(id);
    else m.set(id, urnik);
    setOsnutek(m);
  };

  const zaposleni = useMemo(() => [...(podatki?.zaposleni ?? [])].sort(primerjajImena), [podatki]);
  const prikazani = zaposleni
    .filter((z) => (filter == null ? true : filter === BREZ ? izbran(z.id) == null : izbran(z.id) === filter) && ujemaIskanje(iskanjeIme, [z.ime, z.priimek]) && ujemaIskanje(iskanjeOddelek, [z.oddelek?.ime_oddelka]))
    .sort((a, b) => {
      if (sort.po === "ime") return sort.smer * primerjajImena(a, b);
      const oa = a.oddelek?.ime_oddelka;
      const ob = b.oddelek?.ime_oddelka;
      if (!oa !== !ob) return oa ? -1 : 1; // brez oddelka vedno na koncu
      return sort.smer * (oa ?? "").localeCompare(ob ?? "", "sl", { sensitivity: "base" }) || primerjajImena(a, b);
    });
  const brez = zaposleni.filter((z) => izbran(z.id) == null).length;

  if (napaka) return <p className="text-sm text-nok-500">Zaposlenih ni bilo mogoče naložiti: {napaka}</p>;
  if (!podatki) return <div className="h-64 animate-pulse rounded-[16px] bg-white/[0.04]" aria-label="Nalagam zaposlene" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_14rem]">
        <IskalnoPolje value={iskanjeIme} onChange={setIskanjeIme} hint="Išči po imenu ali priimku" placeholder="Išči ime ali priimek ..." />
        <IskalnoPolje value={iskanjeOddelek} onChange={setIskanjeOddelek} hint="Išči po oddelku" placeholder="Išči oddelek ..." />
        <Izbira value={filter} onChange={setFilter} moznosti={[{ id: BREZ, ime: `Brez urnika (${brez})` }, ...urniki.map((u) => ({ id: u.id, ime: u.ime }))]} prazno={`Vsi zaposleni (${zaposleni.length})`} hint="Pokaži samo zaposlene v izbranem urniku" />
      </div>
      {!urniki.length && <p className="rounded-[12px] border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs font-semibold text-warn-500">Najprej dodaj vsaj en urnik.</p>}

      <div className={`grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 px-3 ${STOLPCI}`}>
        <span />
        <SortGlava ime="Zaposleni" aktiven={sort.po === "ime"} smer={sort.smer} onClick={() => razvrsti("ime")} />
        <SortGlava ime="Oddelek" aktiven={sort.po === "oddelek"} smer={sort.smer} onClick={() => razvrsti("oddelek")} />
        <span className="hidden text-[10px] font-bold uppercase tracking-wider text-ink-500 sm:block">Urnik</span>
      </div>
      <ul className="flex flex-col gap-1">
        {prikazani.map((z) => {
          const sprememba = osnutek.has(z.id);
          const vodja = z.id_kot_vodja != null;
          return (
            <li
              key={z.id}
              className={`grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-[12px] border px-3 py-2 ${STOLPCI} ${
                sprememba ? "border-warn-500/50 bg-warn-500/[0.06]" : "border-white/[0.06] bg-white/[0.03]"
              }`}
            >
              <span className="relative grid h-9 w-9 place-items-center rounded-[10px] bg-fines-500/10 font-display text-xs font-bold text-fines-300 ring-1 ring-fines-400/25">
                {zacetnice(z)}
                {vodja && (
                  <span title="Vodja" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[linear-gradient(135deg,#fde68a,#f59e0b)] text-coal shadow-[0_0_10px_-2px_rgb(245_158_11/0.9)]">
                    <Crown className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  {z.ime} {z.priimek}
                  {vodja && <span className="rounded-full bg-warn-500/15 px-1.5 text-[10px] font-bold uppercase tracking-wider text-warn-500">Vodja</span>}
                </span>
                <span className="text-xs text-ink-500 sm:hidden">{z.oddelek?.ime_oddelka ?? "Brez oddelka"}</span>
              </span>
              <span className="hidden text-sm text-ink-300 sm:block">{z.oddelek?.ime_oddelka ?? <span className="text-ink-500">Brez oddelka</span>}</span>
              <select
                value={izbran(z.id) ?? ""}
                onChange={(e) => nastavi(z.id, e.target.value ? Number(e.target.value) : null)}
                title={`Urnik: ${z.ime} ${z.priimek}`}
                disabled={!urniki.length}
                className={`${POLJE} col-span-2 cursor-pointer sm:col-span-1 [&>option]:bg-ink-900 ${izbran(z.id) == null ? "text-ink-500" : ""}`}
              >
                <option value="">Brez urnika</option>
                {urniki.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ime}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
        {!prikazani.length && (
          <li className="flex flex-col items-center gap-2 py-8 text-sm text-ink-500">
            <SearchX className="h-5 w-5" aria-hidden />
            Ni zaposlenih za ta filter.
          </li>
        )}
      </ul>

    </div>
  );
}

/** Glava stolpca za razvrščanje: klik naraščajoče, ponovni klik padajoče. */
function SortGlava({ ime, aktiven, smer, onClick }: { ime: string; aktiven: boolean; smer: 1 | -1; onClick: () => void }) {
  const Ikona = !aktiven ? ArrowUpDown : smer === 1 ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Razvrsti po ${ime.toLowerCase()} ${aktiven && smer === 1 ? "padajoče" : "naraščajoče"}`}
      className={`flex items-center gap-1 justify-self-start text-[10px] font-bold uppercase tracking-wider transition-colors ${aktiven ? "text-fines-300" : "text-ink-500 hover:text-ink-200"}`}
    >
      {ime}
      <Ikona className="h-3 w-3" aria-hidden />
    </button>
  );
}
