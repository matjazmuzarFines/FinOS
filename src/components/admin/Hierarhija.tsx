"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle, Building2, ChevronDown, ChevronUp, ExternalLink, GitBranchPlus, Hand, Plus, UserPlus, UserRoundPlus, Users, X } from "lucide-react";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { IskalnoPolje } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { obvesti } from "@/components/ui/Obvestila";
import { DodajZaposlenega } from "./ZaposleniObrazec";
import { Platno } from "./Platno";
import { useLahkoUreja } from "@/lib/pravice";
import { ujemaIskanje } from "@/lib/iskanje";
import { hierarhija, osveziZaposlene, polnoIme, premakniZaposlenega, primerjajImena, useZaposleni, zacetnice, zagotoviVodjo, type Zaposleni, type ZaposleniVnos } from "@/lib/zaposleni";

/** Kam se doda zaposleni: pod vodjo ali na vrh nove lestvice. */
type Cilj = { nadrejeni: Zaposleni } | { novaLestvica: true };

type Kontekst = {
  ureja: boolean;
  aktivni: number | null;
  prepovedani: Set<number>;
  zlozeni: Set<number>;
  preklopi: (id: number) => void;
  podrejeni: Map<number, Zaposleni[]>;
  /** Odpri izbiro za prazno mesto (nov / obstoječ zaposleni). */
  meni: (c: Cilj) => void;
};
const HierKontekst = createContext<Kontekst | null>(null);
const useHier = () => useContext(HierKontekst)!;

/**
 * Cilj spusta = element pod kazalcem, izmerjen sproti (povečava platna s CSS zoom ne sproži ponovnega merjenja
 * v dnd-kit, zato shranjeni pravokotniki niso zanesljivi). Pri več zadetkih zmaga najmanjši (najbolj notranji).
 */
const podKazalcem: CollisionDetection = ({ pointerCoordinates, droppableContainers }) => {
  if (!pointerCoordinates) return [];
  const { x, y } = pointerCoordinates;
  return droppableContainers
    .flatMap((c) => {
      const el = c.node.current;
      if (!el || c.disabled) return [];
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? [{ id: c.id, data: { droppableContainer: c, value: r.width * r.height } }] : [];
    })
    .sort((a, b) => a.data.value - b.data.value);
};

const DROBTINE = [
  { naslov: "FIN:OS", href: "/" },
  { naslov: "Administracija", href: "/administracija" },
  { naslov: "Zaposleni", href: "/administracija/zaposleni" },
  { naslov: "Hierarhija" },
];

/**
 * Prikaz hierarhije: lestvice vodij kot drevesa, prazna mesta "+" (nov ali obstoječ zaposleni),
 * povleci in spusti zaposlenega (z vsemi podrejenimi) k drugemu vodji, v novo lestvico ali med nerazporejene.
 */
export function Hierarhija() {
  const { podatki, napaka } = useZaposleni();
  const ureja = useLahkoUreja();
  const [aktivni, setAktivni] = useState<number | null>(null);
  const [zlozeni, setZlozeni] = useState<Set<number>>(new Set());
  const [dodajCilj, setDodajCilj] = useState<{ zacetno: Partial<ZaposleniVnos>; naslov: string; kljuc: number } | null>(null);
  const [izberiCilj, setIzberiCilj] = useState<Cilj | null>(null);
  const [meniCilj, setMeniCilj] = useState<Cilj | null>(null);

  const h = useMemo(() => hierarhija(podatki?.zaposleni ?? []), [podatki]);
  const prepovedani = useMemo(() => (aktivni == null ? new Set<number>() : new Set([aktivni, ...h.potomci(aktivni)])), [aktivni, h]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const premakni = async (z: Zaposleni, nadrejeni: Zaposleni | null, novaLestvica = false) => {
    try {
      await premakniZaposlenega(z, nadrejeni, novaLestvica);
      obvesti(nadrejeni ? `${polnoIme(z)} → vodja ${polnoIme(nadrejeni)}` : novaLestvica ? `${polnoIme(z)} vodi novo lestvico` : `${polnoIme(z)} je brez vodje`);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };

  const konec = ({ active, over }: DragEndEvent) => {
    setAktivni(null);
    const z = podatki?.poId.get(Number(String(active.id).slice(2)));
    if (!z || !over) return;
    const cilj = String(over.id);
    if (cilj === "nova") return premakni(z, null, true);
    if (cilj === "pladenj") return z.vodja ? premakni(z, null) : undefined;
    const t = podatki?.poId.get(Number(cilj.slice(2)));
    if (!t || prepovedani.has(t.id) || z.vodja?.id === t.id) return;
    premakni(z, t);
  };

  const dodaj = async (c: Cilj) => {
    try {
      if ("novaLestvica" in c) return setDodajCilj({ zacetno: { je_vodja: true }, naslov: "Nov vodja (nova lestvica)", kljuc: Date.now() });
      const idVodja = await zagotoviVodjo(c.nadrejeni);
      if (c.nadrejeni.id_kot_vodja == null) osveziZaposlene();
      setDodajCilj({ zacetno: { id_vodja: idVodja, id_oddelek: c.nadrejeni.id_oddelek }, naslov: `Nov zaposleni pod ${polnoIme(c.nadrejeni)}`, kljuc: Date.now() });
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };

  if (napaka) return <PraznoStanje ton="napaka" icon={AlertTriangle} naslov="Hierarhije ni mogoče prebrati" opis={napaka} />;
  if (!podatki) return <div className="fos-glass h-64 animate-pulse rounded-[24px]" aria-label="Nalagam hierarhijo" />;

  const aktivnaOseba = aktivni != null ? podatki.poId.get(aktivni) : undefined;
  const kontekst: Kontekst = {
    ureja,
    aktivni,
    prepovedani,
    zlozeni,
    preklopi: (id) =>
      setZlozeni((s) => {
        const n = new Set(s);
        if (!n.delete(id)) n.add(id);
        return n;
      }),
    podrejeni: h.podrejeni,
    meni: setMeniCilj,
  };

  return (
    <HierKontekst.Provider value={kontekst}>
      <GlavaStrani
        drobtine={DROBTINE}
        naslov="Hierarhija"
        opis={`${h.vrhovi.length} ${h.vrhovi.length === 1 ? "lestvica" : "lestvic"}, ${podatki.vodje.length} vodij, ${h.nerazporejeni.length} brez vodje.`}
      />

      {ureja && (
        <p className="fos-glass flex items-start gap-2 rounded-[14px] px-4 py-3 text-sm text-ink-300">
          <Hand className="mt-0.5 h-4 w-4 shrink-0 text-fines-400" aria-hidden />
          <span>
            Povleci zaposlenega (skupaj z njegovimi podrejenimi) na drugega vodjo, v <b className="text-white">Nova lestvica</b> ali med <b className="text-white">Brez vodje</b>. Na telefonu kartico
            pridrži, nato povleci. Kolešček miške poveča / pomanjša, vlečenje praznega ozadja premakne pogled. Prazna mesta <Plus className="inline h-3.5 w-3.5 text-fines-400" aria-hidden /> dodajo zaposlenega.
          </span>
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={podKazalcem} onDragStart={({ active }: DragStartEvent) => setAktivni(Number(String(active.id).slice(2)))} onDragEnd={konec} onDragCancel={() => setAktivni(null)}>
        <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-4">
          <NaslovRazdelka desno={<span className="text-xs tabular-nums text-ink-400">{h.vrhovi.length}</span>}>Lestvice</NaslovRazdelka>
          {/* okna lestvic drug ob drugem na platnu s povečavo (kolešček) in premikom (vleci ozadje) */}
          <Platno>
            <div className="fos-drevo flex w-max items-start gap-5">
              {h.vrhovi.map((v, i) => (
                <motion.ul key={v.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 6) * 0.06 }}>
                  <Vozel z={v} />
                </motion.ul>
              ))}
              {ureja && <NovaLestvica />}
            </div>
          </Platno>
        </section>

        <Pladenj nerazporejeni={h.nerazporejeni} />
        </div>

        <DragOverlay dropAnimation={{ duration: 200 }}>{aktivnaOseba && <KarticaPlavajoca z={aktivnaOseba} />}</DragOverlay>
      </DndContext>

      <Modal open={meniCilj != null} title={meniCilj && "nadrejeni" in meniCilj ? `Dodaj pod ${polnoIme(meniCilj.nadrejeni)}` : "Nova lestvica"} onClose={() => setMeniCilj(null)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <MeniGumb
            icon={UserRoundPlus}
            naslov="Nov zaposleni"
            opis={meniCilj && "nadrejeni" in meniCilj ? "Ustvari novega zaposlenega s tem vodjo." : "Ustvari novega zaposlenega, ki vodi novo lestvico."}
            onClick={() => {
              const c = meniCilj!;
              setMeniCilj(null);
              dodaj(c);
            }}
          />
          <MeniGumb
            icon={UserPlus}
            naslov="Obstoječ zaposleni"
            opis={meniCilj && "nadrejeni" in meniCilj ? "Premakni zaposlenega (s podrejenimi) k temu vodji." : "Premakni zaposlenega na vrh nove lestvice."}
            onClick={() => {
              setIzberiCilj(meniCilj);
              setMeniCilj(null);
            }}
          />
        </div>
      </Modal>

      {dodajCilj && (
        <DodajZaposlenega key={dodajCilj.kljuc} open onClose={() => setDodajCilj(null)} podatki={podatki} zacetno={dodajCilj.zacetno} naslov={dodajCilj.naslov} odpriList={false} />
      )}
      <IzberiZaposlenega cilj={izberiCilj} onClose={() => setIzberiCilj(null)} zaposleni={podatki.zaposleni} onIzberi={(z, c) => ("novaLestvica" in c ? premakni(z, null, true) : premakni(z, c.nadrejeni))} />
    </HierKontekst.Provider>
  );
}

/** Vozel drevesa: kartica in pod njo podrejeni + prazno mesto za dodajanje. */
function Vozel({ z }: { z: Zaposleni }) {
  const { podrejeni, zlozeni, ureja } = useHier();
  const otroci = podrejeni.get(z.id) ?? [];
  const zlozen = zlozeni.has(z.id);
  const jeVodja = z.id_kot_vodja != null || otroci.length > 0;
  const pokaziVrsto = !zlozen && (otroci.length > 0 || (ureja && jeVodja));

  const vsebina = (
    <>
      <Kartica z={z} stPodrejenih={otroci.length} />
      {pokaziVrsto && (
        <ul>
          {otroci.map((o) => (
            <Vozel key={o.id} z={o} />
          ))}
          {ureja && (
            <li>
              <PraznoMesto cilj={{ nadrejeni: z }} />
            </li>
          )}
        </ul>
      )}
    </>
  );

  return <li>{jeVodja ? <Okno z={z}>{vsebina}</Okno> : vsebina}</li>;
}

/** Okno vodje: glava z imenom oddelka, ki ga vodi (oddelek vodje), in številom ljudi v ekipi; v njem vodja in ekipa. */
function Okno({ z, children }: { z: Zaposleni; children: ReactNode }) {
  const { podrejeni } = useHier();
  let ekipa = 0;
  for (const sklad = [z.id]; sklad.length; )
    for (const p of podrejeni.get(sklad.pop()!) ?? []) {
      ekipa++;
      sklad.push(p.id);
    }
  return (
    <div className="fos-glass flex flex-col items-center rounded-[22px] px-3 pb-4 pt-3 sm:px-4">
      <div className="mb-3 flex w-full min-w-44 items-center gap-2 border-b border-white/10 pb-2.5">
        <Building2 className="h-4 w-4 shrink-0 text-fines-400" aria-hidden />
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-fines-400" title={`Oddelek, ki ga vodi ${polnoIme(z)}`}>
          {z.oddelek?.ime_oddelka ?? "Brez oddelka"}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-400" title="Število ljudi v ekipi (vsi podrejeni)">
          {ekipa}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Kartica zaposlenega: vleče se (z vsemi podrejenimi) in nanjo se spusti drugega zaposlenega. */
function Kartica({ z, stPodrejenih = 0 }: { z: Zaposleni; stPodrejenih?: number }) {
  const { ureja, aktivni, prepovedani, zlozeni, preklopi, meni } = useHier();
  const id = `z-${z.id}`;
  const drag = useDraggable({ id, disabled: !ureja });
  const drop = useDroppable({ id });

  const vlecem = aktivni != null;
  const dovoljeno = vlecem && !prepovedani.has(z.id);
  const nad = drop.isOver && vlecem;
  const vir = drag.isDragging;

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      {...drag.listeners}
      {...drag.attributes}
      data-kartica
      title={ureja ? `${polnoIme(z)} - povleci k drugemu vodji` : polnoIme(z)}
      className={`group relative w-44 touch-manipulation select-none rounded-[16px] border p-3 text-left backdrop-blur-xl transition-all duration-200 ${
        nad && dovoljeno
            ? "scale-105 border-fines-400 bg-fines-500/15 shadow-[0_0_0_4px_rgb(238_122_58/0.25),0_16px_40px_-12px_rgb(202_80_16/0.8)]"
            : nad
              ? "border-nok-500/70 bg-nok-500/10"
              : "fos-kartica border-white/10 shadow-[var(--fos-shadow-card)] hover:border-fines-400/40"
      } ${vir ? "opacity-30" : ""} ${vlecem && !dovoljeno && !vir ? "opacity-50" : ""} ${ureja ? "cursor-grab" : ""}`}
    >
      <KarticaOseba z={z} />

      {/* gumbi v kartici ne začnejo vlečenja (miška / tipkovnica) */}
      <div className="mt-2 flex items-center justify-between gap-1" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {stPodrejenih > 0 ? (
            <button
              type="button"
              onClick={() => preklopi(z.id)}
              title={zlozeni.has(z.id) ? "Pokaži podrejene" : "Skrij podrejene"}
              className="flex h-7 items-center gap-1 rounded-full border border-fines-400/30 bg-fines-500/10 px-2 text-[11px] font-bold text-fines-300 transition-colors hover:bg-fines-500/20"
            >
              <Users className="h-3 w-3" aria-hidden />
              {stPodrejenih}
              {zlozeni.has(z.id) ? <ChevronDown className="h-3 w-3" aria-hidden /> : <ChevronUp className="h-3 w-3" aria-hidden />}
            </button>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1">
            {ureja && stPodrejenih === 0 && z.id_kot_vodja == null && (
              <IkonaGumb hint={`Dodaj podrejenega pod ${polnoIme(z)}`} onClick={() => meni({ nadrejeni: z })}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </IkonaGumb>
            )}
            <Link
              href={`/administracija/zaposleni/${z.id}`}
              title={`Odpri list zaposlenega ${polnoIme(z)}`}
              className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/10 hover:text-fines-300"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </span>
      </div>
    </div>
  );
}

function KarticaOseba({ z }: { z: Zaposleni }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar besedilo={zacetnice(z)} velikost="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-white">{polnoIme(z)}</span>
        <span className="truncate text-[11px] text-ink-400">{z.oddelek?.ime_oddelka ?? "Brez oddelka"}</span>
      </span>
    </div>
  );
}

/** Kartica, ki med vlečenjem sledi kazalcu (brez dnd kavljev - id ima samo prava kartica). */
function KarticaPlavajoca({ z }: { z: Zaposleni }) {
  return (
    <div className="w-44 rotate-2 scale-105 cursor-grabbing rounded-[16px] border border-fines-400/70 bg-ink-800/95 p-3 shadow-[0_24px_60px_-12px_rgb(202_80_16/0.8)] backdrop-blur-xl">
      <KarticaOseba z={z} />
    </div>
  );
}

/** Prazno mesto pod vodjo: "+" odpre izbiro Nov zaposleni / Obstoječ zaposleni. */
function PraznoMesto({ cilj }: { cilj: Cilj }) {
  const { meni, aktivni } = useHier();
  const ime = "nadrejeni" in cilj ? polnoIme(cilj.nadrejeni) : "";
  return (
    <div className={`transition-opacity ${aktivni != null ? "opacity-40" : ""}`}>
      <button
        type="button"
        onClick={() => meni(cilj)}
        title={`Dodaj zaposlenega pod ${ime}`}
        className="group/p grid h-[74px] w-28 place-items-center rounded-[16px] border-2 border-dashed border-white/15 text-ink-500 transition-all duration-300 hover:border-fines-400/60 hover:bg-fines-500/10 hover:text-fines-300"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full border border-current transition-transform duration-300 group-hover/p:rotate-90 group-hover/p:scale-110">
          <Plus className="h-4 w-4" aria-hidden />
        </span>
      </button>
    </div>
  );
}

/** Nova lestvica: spusti zaposlenega sem ali klikni za nov / obstoječ zaposleni na vrhu. */
function NovaLestvica() {
  const { meni, aktivni } = useHier();
  const { setNodeRef, isOver } = useDroppable({ id: "nova" });
  return (
    <div ref={setNodeRef}>
      <button
        type="button"
        onClick={() => meni({ novaLestvica: true })}
        title="Dodaj vodjo nove hierarhične lestvice"
        className={`flex h-48 w-44 flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed px-4 text-center text-sm font-semibold transition-all duration-300 ${
          isOver ? "scale-[1.01] border-fines-400 bg-fines-500/15 text-fines-300" : aktivni != null ? "border-fines-400/50 text-fines-300" : "border-white/15 text-ink-400 hover:border-fines-400/60 hover:text-fines-300"
        }`}
      >
        <GitBranchPlus className="h-5 w-5" aria-hidden />
        {aktivni != null ? "Spusti sem - nova lestvica" : "Nova lestvica"}
      </button>
    </div>
  );
}

/** Zaposleni brez vodje in brez podrejenih; spusti sem = zaposleni ostane brez vodje. */
function Pladenj({ nerazporejeni }: { nerazporejeni: Zaposleni[] }) {
  const { aktivni } = useHier();
  const { setNodeRef, isOver } = useDroppable({ id: "pladenj" });
  return (
    <section className="flex flex-col gap-2">
      <NaslovRazdelka desno={<span className="text-xs tabular-nums text-ink-400">{nerazporejeni.length}</span>}>Brez vodje</NaslovRazdelka>
      <div
        ref={setNodeRef}
        className={`flex min-h-20 flex-wrap gap-2.5 rounded-[20px] border-2 border-dashed p-3 transition-all duration-300 ${
          isOver ? "border-fines-400 bg-fines-500/10" : aktivni != null ? "border-fines-400/40" : "border-white/10"
        }`}
      >
        {nerazporejeni.map((z) => (
          <Kartica key={z.id} z={z} />
        ))}
        {!nerazporejeni.length && <p className="m-auto text-sm text-ink-500">{aktivni != null ? "Spusti sem - zaposleni ostane brez vodje" : "Vsi zaposleni imajo vodjo ali vodijo lestvico."}</p>}
      </div>
    </section>
  );
}

/** Izbira v oknu "Dodaj": velika ploščica z ikono, naslovom in opisom. */
function MeniGumb({ icon: Icon, naslov, opis, onClick }: { icon: typeof Plus; naslov: string; opis: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={opis}
      onClick={onClick}
      className="fos-glass group flex flex-col items-start gap-3 rounded-[18px] p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-fines-400/50 hover:shadow-[0_16px_40px_-18px_rgb(202_80_16/0.7)]"
    >
      <span className="fos-fines-fill grid h-11 w-11 place-items-center rounded-xl text-snow transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-display text-base font-bold text-white">{naslov}</span>
      <span className="text-xs text-ink-400">{opis}</span>
    </button>
  );
}

function IkonaGumb({ hint, onClick, children }: { hint: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={hint} aria-label={hint} onClick={onClick} className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition-colors hover:bg-fines-500/15 hover:text-fines-300">
      {children}
    </button>
  );
}

/** Izbira obstoječega zaposlenega za prazno mesto (brez nadrejenih, da ne nastane krog). */
function IzberiZaposlenega({ cilj, onClose, zaposleni, onIzberi }: { cilj: Cilj | null; onClose: () => void; zaposleni: Zaposleni[]; onIzberi: (z: Zaposleni, c: Cilj) => void }) {
  const [iskanje, setIskanje] = useState("");
  const nadrejeni = cilj && "nadrejeni" in cilj ? cilj.nadrejeni : null;

  const kandidati = useMemo(() => {
    if (!cilj) return [];
    // nadrejeni in vsi njegovi vodje navzgor ne morejo pod njega
    const izloci = new Set<number>();
    for (let v: Zaposleni | undefined = nadrejeni ?? undefined; v; v = v.vodja ? zaposleni.find((x) => x.id === v!.vodja!.id) : undefined) {
      if (izloci.has(v.id)) break;
      izloci.add(v.id);
    }
    return zaposleni
      .filter((z) => !izloci.has(z.id) && (nadrejeni ? z.vodja?.id !== nadrejeni.id : z.vodja != null || z.id_kot_vodja == null))
      .filter((z) => ujemaIskanje(iskanje, [z.ime, z.priimek, z.oddelek?.ime_oddelka, z.vodja && polnoIme(z.vodja)]))
      .sort(primerjajImena);
  }, [cilj, nadrejeni, zaposleni, iskanje]);

  const zapri = () => {
    setIskanje("");
    onClose();
  };

  return (
    <Modal open={cilj != null} title={nadrejeni ? `Obstoječ zaposleni pod ${polnoIme(nadrejeni)}` : "Obstoječ zaposleni - nova lestvica"} onClose={zapri}>
      <div className="flex flex-col gap-3">
        <IskalnoPolje value={iskanje} onChange={setIskanje} hint="Išči zaposlenega po imenu, priimku, oddelku" placeholder="Išči zaposlenega ..." autoFocus />
        <ul className="flex flex-col gap-1.5">
          {kandidati.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                title={nadrejeni ? `Premakni ${polnoIme(z)} pod ${polnoIme(nadrejeni)}` : `${polnoIme(z)} naj vodi novo lestvico`}
                onClick={() => {
                  onIzberi(z, cilj!);
                  zapri();
                }}
                className="fos-glass flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-all hover:border-fines-400/40"
              >
                <Avatar besedilo={zacetnice(z)} velikost="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-white">{polnoIme(z)}</span>
                  <span className="truncate text-xs text-ink-400">
                    {z.oddelek?.ime_oddelka ?? "Brez oddelka"} · {z.vodja ? `vodja ${polnoIme(z.vodja)}` : "brez vodje"}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!kandidati.length && (
            <li className="flex items-center justify-center gap-2 py-6 text-sm text-ink-500">
              <X className="h-4 w-4" aria-hidden />
              Ni zaposlenih za izbiro.
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
