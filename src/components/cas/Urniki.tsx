"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarOff, CalendarRange, Check, Copy, GripVertical, ListPlus, Pencil, Plus, SearchX, Trash, Unlink, UsersRound, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { GlavaStrani } from "@/components/ui/GlavaStrani";
import { Modal } from "@/components/ui/Modal";
import { IskalnoPolje, POLJE } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { SaveBar } from "@/components/ui/SaveBar";
import { obvesti } from "@/components/ui/Obvestila";
import { ujemaIskanje } from "@/lib/iskanje";
import {
  cezPolnoc,
  odvezi,
  povezi,
  POLJA_PRAVIL,
  PRAZEN_INTERVAL,
  preurediIntervale, preurediUrnike,
  preveriInterval,
  shraniInterval,
  skrijInterval,
  useCasNastavitve,
  type CasNastavitve,
  type Interval,
  type IntervalVnos,
  type Urnik,
  type VrstaIntervala,
  VRSTE_INTERVALOV,
} from "@/lib/casNastavitve";
import { IzbiraStatistike, IzbiraTipke, UrnikOkno } from "./IntervalOkna";
import { PrazniciOkno } from "./PrazniciOkno";
import { UrnikiZaposlenih } from "./UrnikiZaposlenih";
import { PoljeObrazca } from "./Polja";
import { PravilaKnjizenja, Preklop } from "./PravilaKnjizenja";
import { Panel, TestniPodatki } from "./Skupno";

const DROBTINE = [
  { naslov: "FIN:OS", href: "/" },
  { naslov: "Administracija", href: "/administracija" },
  { naslov: "Registracija časa", href: "/administracija/registracija" },
  { naslov: "Nastavitve", href: "/administracija/registracija/nastavitve" },
  { naslov: "Urniki" },
];

/** Stolpci seznama intervalov: ročaj (povleci) | interval (glavno ime) | od / do | dnevi | dodaj / odstrani iz urnika */
const STOLPCI = "md:grid md:grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_9.25rem_2.5rem] md:items-center md:gap-3";
/** Dolga imena (PRIHOD_PISARNA_PET) se prelomijo, nikoli ne skrajšajo. */
const CELO_IME = "[overflow-wrap:anywhere]";
type Prikaz = "vsi" | "v_urniku" | "ostali";
const NOV = -1;

const vnosIz = (i: Interval): IntervalVnos => ({
  ime: i.ime,
  prikazno_ime: i.prikazno_ime,
  opis: i.opis,
  vrsta: i.vrsta,
  cas_od: i.cas_od,
  cas_do: i.cas_do,
  dnevi: i.dnevi,
  id_statistike: i.id_statistike,
  id_tipke: i.id_tipke,
  ...Object.fromEntries(POLJA_PRAVIL.map((k) => [k, i[k]])),
}) as IntervalVnos;
const POLJA: (keyof IntervalVnos)[] = ["ime", "prikazno_ime", "opis", "vrsta", "cas_od", "cas_do", "dnevi", "id_statistike", "id_tipke", ...POLJA_PRAVIL];

/**
 * Urniki: levo izbor urnikov in intervali izbranega urnika, na sredini VEDNO seznam vseh intervalov ("+" doda interval
 * v izbran urnik, kljukica ga odstrani; ročaj = povleci in spusti za vrstni red, npr. prihodi na vrhu, izhodi na koncu),
 * desno podrobnosti intervala. V seznamih je glavno ime (PRIHOD_PISARNA); prikazno ime (Prihod) je za krmilnik.
 * Desno zgoraj gumb Prazniki (standardni + posebni dela prosti dnevi).
 * Izbor v naslovu: ?urnik=&interval=.
 */
export function Urniki() {
  const router = useRouter();
  const pot = usePathname();
  const iskalni = useSearchParams();
  const n = useCasNastavitve();

  const urniki = n.urniki.filter((u) => u.visible);
  const urnik = urniki.find((u) => u.id === Number(iskalni.get("urnik"))) ?? urniki[0] ?? null;
  const vsi = n.intervali.filter((i) => i.visible);
  // intervali urnika v istem vrstnem redu kot seznam vseh
  const intervali = vsi.filter((i) => urnik?.intervali.includes(i.id));
  const idIntervala = Number(iskalni.get("interval")) || null;
  const [nov, setNov] = useState(false);
  const izbran = nov ? null : (vsi.find((i) => i.id === idIntervala) ?? intervali[0] ?? vsi[0] ?? null);
  const [iskanje, setIskanje] = useState("");
  const [prikaz, setPrikaz] = useState<Prikaz>("vsi");
  const vUrniku = (id: number) => !!urnik?.intervali.includes(id);
  const prikazani = vsi.filter((i) => (prikaz === "vsi" ? true : prikaz === "v_urniku" ? vUrniku(i.id) : !vUrniku(i.id)) && ujemaIskanje(iskanje, [i.ime, i.prikazno_ime, i.opis, i.cas_od]));

  const senzorji = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  /** Napaka iz baze -> rdeče obvestilo (prikaz se že sam vrne na stanje baze). */
  const javi = (p: Promise<unknown>, uspeh?: string) => p.then(() => uspeh && obvesti(uspeh)).catch((e: Error) => obvesti(e.message, "napaka"));
  const spustiUrnik = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) javi(preurediUrnike(Number(active.id), Number(over.id)));
  };
  const spusti = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) javi(preurediIntervale(Number(active.id), Number(over.id)));
  };
  const [urnikOkno, setUrnikOkno] = useState<{ urnik?: Urnik } | null>(null);
  const [praznikiOdprti, setPraznikiOdprti] = useState(false);
  const [zaposleniOdprti, setZaposleniOdprti] = useState(false);
  const [brisem, setBrisem] = useState(false);

  // osnutek podrobnosti izbranega (ali novega) intervala
  const [osnutek, setOsnutek] = useState<{ id: number; vnos: IntervalVnos } | null>(null);
  // nov interval: prazen ali kopija izbranega
  const [kopija, setKopija] = useState<IntervalVnos | null>(null);
  const kljuc = nov ? NOV : (izbran?.id ?? null);
  const izvor = nov ? (kopija ?? { ...PRAZEN_INTERVAL, dnevi: n.dnevi.filter((d) => d.iso != null && d.iso <= 5).map((d) => d.id) }) : izbran ? vnosIz(izbran) : null;
  const vnos = osnutek && osnutek.id === kljuc ? osnutek.vnos : izvor;
  const sprememb = vnos && izvor ? (nov ? 1 : POLJA.filter((k) => JSON.stringify(vnos[k]) !== JSON.stringify(izvor[k])).length) : 0;
  const [poskus, setPoskus] = useState(false);
  const napake = vnos ? preveriInterval(vnos, nov ? undefined : izbran?.id) : {};

  const naslov = (p: { urnik?: number; interval?: number | null }) => {
    const q = new URLSearchParams(iskalni.toString());
    if (p.urnik !== undefined) {
      q.set("urnik", String(p.urnik));
      q.delete("interval");
    }
    if (p.interval) q.set("interval", String(p.interval));
    else if (p.interval === null) q.delete("interval");
    router.replace(`${pot}?${q}`, { scroll: false });
  };
  const lahkoZapustim = () => !sprememb || confirm("Imaš neshranjene spremembe intervala. Jih zavržem?");
  const pocisti = () => {
    setOsnutek(null);
    setPoskus(false);
    setNov(false);
    setKopija(null);
  };
  const odpriNov = (zacetek: IntervalVnos | null) => {
    if (!lahkoZapustim()) return;
    pocisti();
    setKopija(zacetek);
    setNov(true);
    requestAnimationFrame(() => document.getElementById("podrobnosti-intervala")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  /** Kopija izbranega intervala: vsa polja enaka, ime s pripono _KOPIJA (enolično); v urnik se doda posebej s +. */
  const kopiraj = () => {
    if (!izbran) return;
    const imena = new Set(vsi.map((i) => i.ime.trim().toLowerCase()));
    let ime = `${izbran.ime}_KOPIJA`;
    for (let k = 2; imena.has(ime.toLowerCase()); k++) ime = `${izbran.ime}_KOPIJA_${k}`;
    odpriNov({ ...vnosIz(izbran), ime });
  };
  const izberiUrnik = (id: number) => {
    if (!lahkoZapustim()) return;
    pocisti();
    naslov({ urnik: id });
  };
  const izberiInterval = (id: number) => {
    if (id === izbran?.id && !nov) return;
    if (!lahkoZapustim()) return;
    pocisti();
    naslov({ interval: id });
  };
  const nastavi = (p: Partial<IntervalVnos>) => vnos && kljuc != null && setOsnutek({ id: kljuc, vnos: { ...vnos, ...p } });
  const [shranjujem, setShranjujem] = useState(false);
  const shrani = async () => {
    if (!vnos) return;
    setPoskus(true);
    if (Object.keys(napake).length) return obvesti("Popravi označena polja intervala.", "napaka");
    setShranjujem(true);
    try {
      const id = await shraniInterval(vnos, nov ? undefined : izbran?.id);
      obvesti(nov ? `Interval ${vnos.ime.trim()} je dodan med intervale - v urnik ga dodaš s +.` : "Interval je shranjen.");
      pocisti();
      naslov({ interval: id });
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };
  const dodajVUrnik = (i: Interval) => {
    if (!urnik) return;
    javi(povezi(urnik.id, [i.id]), `${i.ime} je dodan v urnik ${urnik.ime}.`);
  };
  const odstraniIzUrnika = (i: Interval) => {
    if (!urnik) return;
    javi(odvezi(urnik.id, i.id), `${i.ime} je odstranjen iz urnika ${urnik.ime} (ostane med intervali).`);
  };

  return (
    <>
      <GlavaStrani
        drobtine={DROBTINE}
        naslov="Urniki"
        opis="Vsak zaposleni bo v eni skupini urnikov. Urnik sestavljajo intervali - časovno okno prihoda od-do (npr. 6:00-9:00), dnevi, statistika, v katero gre čas, in pravila knjiženja (zaokroževanje, presežek)."
        akcije={
          <>
            {n.virUrnikov === "test" && <TestniPodatki opis={`Tabele urnikov še ni v bazi (zaženi 010_urniki.sql): ${n.napakaUrnikov}. Spremembe se ne shranijo.`} />}
            <Button hint="Seznam dela prostih dni: standardni in posebni" variant="primary" icon={CalendarOff} onClick={() => setPraznikiOdprti(true)}>
              Prazniki
            </Button>
            <Button hint="Kateri zaposleni je v katerem urniku" variant="primary" icon={UsersRound} onClick={() => setZaposleniOdprti(true)} disabled={n.virUrnikov === "nalagam"}>
              Urniki zaposlenih
            </Button>
          </>
        }
      />

      {n.virUrnikov === "nalagam" ? (
        <div className="fos-glass h-96 animate-pulse rounded-[20px]" aria-label="Nalagam urnike" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_24rem] xl:gap-5 2xl:grid-cols-[16rem_minmax(0,1fr)_minmax(40rem,50rem)]">
          {/* levo: urniki + intervali urnika */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="flex min-w-0 flex-col gap-4 lg:row-span-2 xl:row-span-1">
            <Panel
              naslov={
                <span className="flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                  Urniki
                </span>
              }
              desno={<IconButton hint="Dodaj nov urnik" icon={Plus} variant="success" className="!h-8 !w-8" onClick={() => setUrnikOkno({})} />}>
              <DndContext sensors={senzorji} collisionDetection={closestCenter} onDragEnd={spustiUrnik}>
                <SortableContext items={urniki.map((u) => u.id)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-0.5">
                    {urniki.map((u) => (
                      <VrsticaUrnika
                        key={u.id}
                        u={u}
                        je={u.id === urnik?.id}
                        intervalov={u.intervali.filter((id) => n.intervali.some((i) => i.id === id && i.visible)).length}
                        oseb={n.zaposleniUrniki.filter((z) => z.id_urnika === u.id).length}
                        onIzberi={() => izberiUrnik(u.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </Panel>

            {urnik && (
              <Panel
                naslov={`V urniku · ${intervali.length}`}
                desno={<IconButton hint={`Uredi ime in opis urnika ${urnik.ime}`} icon={Pencil} className="!h-8 !w-8" onClick={() => setUrnikOkno({ urnik })} />}
              >
                <div className="flex flex-col">
                  <span className="truncate font-display text-base font-bold text-white">{urnik.ime}</span>
                  <span className="text-xs text-ink-500">{urnik.opis || "Brez opisa."}</span>
                </div>
                {intervali.length ? (
                  <ul className="flex flex-col gap-1">
                    {intervali.map((i) => (
                        <li
                          key={i.id}
                          className={`group flex items-start rounded-[10px] transition-colors ${i.id === izbran?.id ? "bg-white/[0.08] text-white" : "text-ink-300 hover:bg-white/[0.05]"}`}
                        >
                          <button type="button" onClick={() => izberiInterval(i.id)} title={`Izberi interval ${i.ime}`} className="flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left">
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: n.statistike.find((s) => s.id === i.id_statistike)?.barva ?? "#6b6b72" }} />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className={`font-mono text-[11px] font-bold leading-snug ${CELO_IME}`}>{i.ime}</span>
                              <span className="text-[10px] tabular-nums text-ink-500">
                                {i.cas_od} - {i.cas_do}
                                {cezPolnoc(i) && " +1"}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => odstraniIzUrnika(i)}
                            title={`Odstrani iz urnika ${urnik.ime}`}
                            className="mr-1 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-500 transition-colors hover:bg-nok-500/15 hover:text-nok-500"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-500">Urnik še nima intervalov - dodaj jih s + v seznamu vseh intervalov.</p>
                )}
              </Panel>
            )}
          </motion.div>

          {/* sredina: seznam VSEH intervalov, "+" doda v izbran urnik */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="fos-glass flex min-w-0 flex-col gap-4 rounded-[20px] p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="fos-fines-fill relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-snow">
                  <CalendarRange className="h-5 w-5" aria-hidden />
                  <span className="fos-shine absolute inset-0" />
                </span>
                <h2 className="self-center font-display text-xl font-bold text-white">
                  Vsi intervali <span className="text-base text-ink-500">{vsi.length}</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <IconButton hint={izbran ? `Kopiraj interval ${izbran.ime}` : "Izberi interval za kopiranje"} variant="primary" icon={Copy} disabled={!izbran} onClick={kopiraj} />
                <Button hint="Dodaj nov interval med vse intervale" variant="success" icon={ListPlus} onClick={() => odpriNov(null)}>
                  Nov interval
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <IskalnoPolje value={iskanje} onChange={setIskanje} hint="Išči interval po imenu ali opisu" placeholder="Išči interval ..." className="min-w-[12rem] flex-1" />
              <div role="tablist" aria-label="Kateri intervali" className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">
                {(
                  [
                    ["vsi", "Vsi", vsi.length],
                    ["v_urniku", "V urniku", vsi.filter((i) => vUrniku(i.id)).length],
                    ["ostali", "Ostali", vsi.filter((i) => !vUrniku(i.id)).length],
                  ] as const
                ).map(([id, ime, st]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={prikaz === id}
                    title={id === "vsi" ? "Pokaži vse intervale" : id === "v_urniku" ? "Samo intervali v izbranem urniku" : "Samo intervali, ki niso v izbranem urniku"}
                    onClick={() => setPrikaz(id)}
                    className={`relative h-8 rounded-full px-3 text-xs font-semibold transition-colors ${prikaz === id ? "text-snow" : "text-ink-300 hover:text-white"}`}
                  >
                    {prikaz === id && (
                      <motion.span
                        layoutId="prikaz-intervalov"
                        className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)]"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">
                      {ime} <span className="opacity-70">{st}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {prikazani.length ? (
              <div className="flex flex-col gap-1.5">
                <div className={`${STOLPCI} hidden px-3 text-[10px] font-bold uppercase tracking-wider text-ink-500`}>
                  <span />
                  <span>Interval</span>
                  <span>Čas</span>
                  <span>Dnevi</span>
                  <span />
                </div>
                <DndContext sensors={senzorji} collisionDetection={closestCenter} onDragEnd={spusti}>
                  <SortableContext items={prikazani.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <ul className="flex flex-col gap-1.5">
                      {prikazani.map((i, k) => (
                        <VrsticaIntervala
                          key={i.id}
                          i={i}
                          n={n}
                          zamik={k * 0.03}
                          izbran={i.id === izbran?.id}
                          urnik={urnik}
                          vUrniku={vUrniku(i.id)}
                          onIzberi={() => izberiInterval(i.id)}
                          onDodaj={() => dodajVUrnik(i)}
                          onOdstrani={() => odstraniIzUrnika(i)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </div>
            ) : (
              <PraznoStanje
                icon={vsi.length ? SearchX : CalendarRange}
                naslov={vsi.length ? "Ni intervalov za ta filter" : "Ni intervalov"}
                opis={vsi.length ? "Spremeni iskanje ali izbiro." : "Dodaj prvi interval (npr. Prihod na delo 06:00-09:00)."}
              />
            )}
          </motion.section>

          {/* desno: podrobnosti intervala */}
          <div id="podrobnosti-intervala" className="min-w-0 scroll-mt-24 lg:col-start-2 xl:sticky xl:top-[84px] xl:col-start-auto">
            <AnimatePresence mode="wait" initial={false}>
              {vnos ? (
                <motion.div key={kljuc} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
                  <Podrobnosti vnos={vnos} nov={nov} n={n} napake={poskus ? napake : {}} onSpremeni={nastavi} kopija={nov && !!kopija} onIzbrisi={izbran && !nov ? () => setBrisem(true) : undefined} />
                </motion.div>
              ) : (
                <Panel naslov="Podrobnosti intervala">
                  <p className="text-xs text-ink-500">Izberi interval v seznamu.</p>
                </Panel>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <SaveBar sprememb={sprememb} shranjujem={shranjujem} onShrani={shrani} onPreklici={pocisti} />

      <UrnikOkno
        okno={urnikOkno}
        onClose={() => setUrnikOkno(null)}
        onShranjeno={(id) => {
          setUrnikOkno(null);
          if (id) naslov({ urnik: id });
          else router.replace(pot, { scroll: false });
        }}
      />
      <PrazniciOkno open={praznikiOdprti} onClose={() => setPraznikiOdprti(false)} />
      <UrnikiZaposlenih open={zaposleniOdprti} onClose={() => setZaposleniOdprti(false)} />
      <Modal
        open={brisem && !!izbran}
        title="Izbriši interval"
        onClose={() => setBrisem(false)}
        noga={
          <>
            <Button hint="Ne briši intervala" variant="neutral" onClick={() => setBrisem(false)}>
              Prekliči
            </Button>
            <Button
              hint="Skrij interval in ga odstrani iz vseh urnikov"
              variant="danger"
              icon={Trash}
              onClick={() => {
                if (!izbran) return;
                setBrisem(false);
                pocisti();
                naslov({ interval: null });
                javi(skrijInterval(izbran.id), `Interval ${izbran.ime} je izbrisan (skrit).`);
              }}
            >
              Izbriši
            </Button>
          </>
        }
      >
        {izbran && (
          <p className="text-sm text-ink-300">
            Interval <b className="text-white">{izbran.ime}</b> se skrije in odstrani iz vseh urnikov (
            {n.urniki
              .filter((u) => u.visible && u.intervali.includes(izbran.id))
              .map((u) => u.ime)
              .join(", ") || "nobenega"}
            ). Če ga želiš samo umakniti iz tega urnika, uporabi &nbsp;
            <Unlink className="inline h-3.5 w-3.5" aria-hidden /> Odstrani v seznamu.
          </p>
        )}
      </Modal>
    </>
  );
}

type VrsticaProps = {
  i: Interval;
  n: CasNastavitve;
  zamik: number;
  izbran: boolean;
  urnik: Urnik | null;
  vUrniku: boolean;
  onIzberi: () => void;
  onDodaj: () => void;
  onOdstrani: () => void;
};

/** Vrstica urnika (levo): ročaj = povleci za vrstni red, klik izbere urnik. Ime se nikoli ne skrajša. */
function VrsticaUrnika({ u, je, intervalov, oseb, onIzberi }: { u: Urnik; je: boolean; intervalov: number; oseb: number; onIzberi: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: u.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative flex items-start rounded-[12px] transition-colors duration-300 ${isDragging ? "z-20 bg-ink-900/95 shadow-[0_12px_30px_-10px_rgb(0_0_0/0.8),0_0_24px_-8px_rgb(238_122_58/0.8)] ring-1 ring-fines-400/60" : ""} ${je ? "text-snow" : "text-ink-200 hover:bg-white/[0.06] hover:text-white"}`}
    >
      {je && !isDragging && (
        <motion.span
          layoutId="izbran-urnik"
          className="absolute inset-0 rounded-[12px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_6px_20px_-8px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Povleci za vrstni red urnikov"
        aria-label={`Premakni urnik ${u.ime}`}
        className={`relative mt-1.5 grid h-7 w-6 shrink-0 touch-none place-items-center rounded-[7px] transition-colors ${je ? "text-snow/70 hover:text-snow" : "text-ink-500 hover:bg-white/10 hover:text-fines-300"} ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" onClick={onIzberi} aria-pressed={je} title={`Odpri urnik ${u.ime}`} className="relative flex min-w-0 flex-1 flex-col py-2 pl-1 pr-2 text-left">
        <span className={`text-sm font-semibold leading-snug ${CELO_IME}`}>{u.ime}</span>
        <span className={`text-[11px] ${je ? "text-snow/75" : "text-ink-500"}`}>
          {intervalov} intervalov · {oseb} oseb
        </span>
      </button>
    </li>
  );
}

/** Vrstica intervala: ročaj (povleci za vrstni red), klik izbere interval (podrobnosti desno), + / kljukica = v urniku. */
function VrsticaIntervala({ i, n, zamik, izbran, urnik, vUrniku, onIzberi, onDodaj, onOdstrani }: VrsticaProps) {
  const stat = n.statistike.find((s) => s.id === i.id_statistike);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: i.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`relative ${isDragging ? "z-20" : ""}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, scale: isDragging ? 1.015 : 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: isDragging ? 0 : zamik }}
        className={`rounded-[14px] border transition-colors duration-300 ${
          isDragging
            ? "border-fines-400/70 bg-ink-900/95 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.8),0_0_30px_-8px_rgb(238_122_58/0.8)]"
            : izbran
              ? "border-fines-400/60 bg-fines-500/[0.06] shadow-[0_0_24px_-12px_rgb(238_122_58/0.9)]"
              : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onIzberi}
          onKeyDown={(e) => e.key === "Enter" && onIzberi()}
          title={`Izberi interval ${i.ime}`}
          className={`${STOLPCI} grid cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_2.25rem] items-center gap-x-3 gap-y-2 rounded-[14px] px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-fines-400`}
        >
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            title="Povleci za vrstni red (npr. prihodi na vrh, izhodi na konec)"
            aria-label={`Premakni interval ${i.ime}`}
            className={`grid h-8 w-7 shrink-0 touch-none place-items-center rounded-[8px] text-ink-500 transition-colors hover:bg-white/10 hover:text-fines-300 ${isDragging ? "cursor-grabbing text-fines-300" : "cursor-grab"}`}
          >
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <span className="flex min-w-0 items-start gap-2">
            <span
              className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full"
              title={stat ? `Statistika ${stat.koda} - ${stat.ime}` : "Brez statistike"}
              style={{ background: stat?.barva ?? "#6b6b72", boxShadow: stat ? `0 0 8px ${stat.barva}` : undefined }}
            />
            <span className={`font-mono text-[13px] font-bold leading-snug text-white ${CELO_IME}`}>{i.ime}</span>
          </span>
          {/* telefon: čas in dnevi v drugi vrsti */}
          <span className="col-span-2 col-start-2 row-start-2 flex flex-wrap items-center gap-3 md:contents">
            <span className="grid grid-cols-[1.5rem_auto] items-baseline gap-x-1 text-xs tabular-nums" title={cezPolnoc(i) ? "Okno prečka polnoč - čas se šteje v dan začetka" : undefined}>
              <span className="text-[10px] font-semibold text-ink-500">Od</span>
              <span className="font-display font-bold text-ink-100">{i.cas_od}</span>
              <span className="text-[10px] font-semibold text-ink-500">Do</span>
              <span className="flex items-center gap-1 font-display font-bold text-ink-100">
                {i.cas_do}
                {cezPolnoc(i) && <span className="rounded-full bg-sync-500/15 px-1 text-[9px] font-bold text-sync-500">+1</span>}
              </span>
            </span>
            <Dnevi izbrani={i.dnevi} n={n} />
          </span>
          {urnik &&
            (vUrniku ? (
              <button
                type="button"
                title={`V urniku ${urnik.ime} - klik ga odstrani`}
                aria-label={`Odstrani iz urnika ${urnik.ime}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOdstrani();
                }}
                className="group/v col-start-3 row-start-1 grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,#4ade80,#16a34a_55%,#15803d)] text-snow shadow-[0_6px_18px_-6px_rgb(22_163_74/0.8)] transition-all hover:bg-[linear-gradient(135deg,#f87171,#dc2626_55%,#b91c1c)] hover:shadow-[0_6px_18px_-6px_rgb(220_38_38/0.8)] active:scale-95 md:col-start-auto md:row-start-auto"
              >
                <Check className="h-4 w-4 group-hover/v:hidden" strokeWidth={3} aria-hidden />
                <Unlink className="hidden h-4 w-4 group-hover/v:block" aria-hidden />
              </button>
            ) : (
              <IconButton
                hint={`Dodaj v urnik ${urnik.ime}`}
                icon={Plus}
                className="col-start-3 row-start-1 !h-9 !w-9 md:col-start-auto md:row-start-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onDodaj();
                }}
              />
            ))}
        </div>
      </motion.div>
    </li>
  );
}

/** Dnevi intervala kot 8 kvadratkov (Pon ... Ned, Praz). */
function Dnevi({ izbrani, n, onChange }: { izbrani: number[]; n: CasNastavitve; onChange?: (d: number[]) => void }) {
  return (
    <span className={`flex ${onChange ? "flex-wrap gap-1.5" : "gap-0.5"}`}>
      {n.dnevi.map((d) => {
        const je = izbrani.includes(d.id);
        const cls = je ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_0_10px_-3px_rgb(238_122_58/0.9)]" : "border border-white/10 bg-white/[0.03] text-ink-500";
        if (!onChange)
          return (
            <span key={d.id} title={`${d.ime}: ${je ? "velja" : "ne velja"}`} className={`grid h-5 w-4 place-items-center rounded-[4px] text-[9px] font-bold ${cls}`}>
              {d.iso == null ? "P" : d.kratko.charAt(0)}
            </span>
          );
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={je}
            title={`${d.ime}: ${je ? "velja - klik izključi" : "ne velja - klik vključi"}`}
            onClick={() => onChange(je ? izbrani.filter((x) => x !== d.id) : [...izbrani, d.id].sort((a, b) => a - b))}
            className={`h-9 rounded-[9px] px-2.5 text-xs font-bold transition-all duration-300 active:scale-95 ${cls} ${je ? "" : "hover:border-fines-400/50 hover:text-ink-200"}`}
          >
            {d.kratko}
          </button>
        );
      })}
    </span>
  );
}

type PodrobnostiProps = {
  vnos: IntervalVnos;
  nov: boolean;
  n: CasNastavitve;
  napake: Partial<Record<keyof IntervalVnos, string>>;
  onSpremeni: (p: Partial<IntervalVnos>) => void;
  /** Nov interval je kopija izbranega (naslov "Kopija intervala"). */
  kopija?: boolean;
  onIzbrisi?: () => void;
};

/** Podrobnosti intervala (desno): ime, prikazno ime, opis, čas od-do, dnevi, statistika, pravila knjiženja. Spremembe -> SaveBar. */
function Podrobnosti({ vnos, nov, n, napake, onSpremeni, kopija, onIzbrisi }: PodrobnostiProps) {
  const vrsta = VRSTE_INTERVALOV[vnos.vrsta];
  return (
    <Panel
      naslov={kopija ? "Kopija intervala" : nov ? "Nov interval" : "Podrobnosti intervala"}
      desno={nov ? <span className="rounded-full bg-ok-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ok-500">Neshranjen</span> : undefined}
      className="relative overflow-hidden"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#f19a66,#ca5010,transparent)]" />
      {/* na širokem zaslonu: levo osnovni podatki, desno pravila knjiženja (manj drsenja) */}
      <div className="grid items-start gap-x-6 gap-y-4 2xl:grid-cols-2">
      <div className="flex flex-col gap-4">
        <PoljeObrazca naslov="Ime" obvezno napaka={napake.ime} opis="Glavno ime v seznamih (enolično), npr. PRIHOD_PISARNA.">
          <input className={`${POLJE} font-mono`} value={vnos.ime} onChange={(e) => onSpremeni({ ime: e.target.value })} title="Interno ime intervala" autoFocus={nov} />
        </PoljeObrazca>
        <PoljeObrazca naslov="Prikazno ime" opis="Izpiše se v FIN:ME, npr. Prihod. Na krmilniku se izpiše besedilo tipke.">
          <input className={POLJE} value={vnos.prikazno_ime} onChange={(e) => onSpremeni({ prikazno_ime: e.target.value })} title="Ime za prikaz" />
        </PoljeObrazca>
        <PoljeObrazca naslov="Vrsta" obvezno opis={vrsta.opis}>
          <Preklop
            value={vnos.vrsta}
            moznosti={(Object.keys(VRSTE_INTERVALOV) as VrstaIntervala[]).map((v) => ({ id: v, ime: VRSTE_INTERVALOV[v].ime, hint: VRSTE_INTERVALOV[v].opis }))}
            onChange={(v) => onSpremeni({ vrsta: v as VrstaIntervala })}
          />
        </PoljeObrazca>
          <PoljeObrazca
            naslov="Tipka"
            obvezno={vnos.vrsta === "tipka"}
            napaka={napake.id_tipke}
            opis={
              <>
                {vnos.vrsta === "tipka" ? "Tipka odsotnosti (odhod in vrnitev)." : "Brez tipke = samodejno ob prislonu kartice; s tipko = drug prihod / izhod (npr. Izredno za nadure)."} Tipke urejaš v{" "}
                <Link href="/administracija/registracija/nastavitve/krmilnik" className="text-fines-300 underline-offset-2 hover:underline">
                  Krmilniku
                </Link>
                .
              </>
            }
          >
            <IzbiraTipke value={vnos.id_tipke} onChange={(id) => onSpremeni({ id_tipke: id })} tipke={n.tipke} hint="Tipka intervala" obvezno={vnos.vrsta === "tipka"} />
          </PoljeObrazca>
        <PoljeObrazca naslov="Opis">
          <textarea className={`${POLJE} h-auto min-h-16 resize-y py-2`} value={vnos.opis} onChange={(e) => onSpremeni({ opis: e.target.value })} title="Opis intervala" />
        </PoljeObrazca>
        <div className="grid grid-cols-2 gap-3">
          <PoljeObrazca naslov={`${vrsta.okno} od`} obvezno napaka={napake.cas_od} opis={vnos.vrsta === "tipka" ? "Okno za oba žiga (s tipko in vrnitev)." : "Npr. 00:00 (ves dan: 00:00-23:59)."}>
            <input type="time" className={`${POLJE} tabular-nums`} value={vnos.cas_od} onChange={(e) => onSpremeni({ cas_od: e.target.value })} title="Začetek okna" />
          </PoljeObrazca>
          <PoljeObrazca naslov={`${vrsta.okno} do`} obvezno napaka={napake.cas_do} opis={cezPolnoc(vnos) ? "Naslednji dan (+1) - šteje v dan začetka." : "Žig izven okna = napaka (dejanski čas)."}>
            <input type="time" className={`${POLJE} tabular-nums`} value={vnos.cas_do} onChange={(e) => onSpremeni({ cas_do: e.target.value })} title="Konec okna" />
          </PoljeObrazca>
        </div>
        <PoljeObrazca naslov="Dnevi" obvezno napaka={napake.dnevi} opis="Na katere dni velja interval (Praz = slovenski prazniki).">
          <Dnevi izbrani={vnos.dnevi} n={n} onChange={(dnevi) => onSpremeni({ dnevi })} />
        </PoljeObrazca>
        <PoljeObrazca
          naslov="Statistika"
          obvezno
          napaka={napake.id_statistike}
          opis={
            vnos.vrsta === "prihod"
              ? "V katero statistiko gre čas od prihoda do izhoda."
              : vnos.vrsta === "izhod"
                ? "Pri izhodu se ne uporablja - čas izmene gre v statistiko prihoda."
                : "V katero statistiko gre čas od žiga s tipko do vrnitve."
          }
        >
          <IzbiraStatistike value={vnos.id_statistike} onChange={(id) => onSpremeni({ id_statistike: id })} statistike={n.statistike} hint="Statistika intervala" obvezno />
        </PoljeObrazca>
      </div>
        <PravilaKnjizenja vnos={vnos} n={n} napake={napake} onSpremeni={onSpremeni} />
      </div>
      {onIzbrisi && (
        <div className="flex justify-end border-t border-white/10 pt-4">
          <Button hint="Izbriši (skrij) interval" variant="danger" icon={Trash} onClick={onIzbrisi}>
            Izbriši
          </Button>
        </div>
      )}
    </Panel>
  );
}
