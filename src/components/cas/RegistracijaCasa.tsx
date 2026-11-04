"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CalendarPlus, CalendarRange, ChevronLeft, ChevronRight, Eye, FilePenLine, PencilLine, Settings, TicketCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { GlavaStrani } from "@/components/ui/GlavaStrani";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { SaveBar } from "@/components/ui/SaveBar";
import { obvesti } from "@/components/ui/Obvestila";
import { dodajDni, dodajMesece, dneviMeseca, dneviTedna, imeMeseca, isoDatum, izracunajDan, kratekDatum, stTedna, useZdaj, zacetekMeseca, zacetekTedna } from "@/lib/cas";
import { useCasNastavitve } from "@/lib/casNastavitve";
import { testniDan, testniUrnik } from "@/lib/casTest";
import { podatkiDne, useDogodki } from "@/lib/dogodki";
import { izplacilaMed, kljucMeseca, useSaldo } from "@/lib/saldo";
import { delovniDnevi, jeLanskiDopust, jeLetniDopust, oddajZahtevek, useZahtevki, zZahtevki, type PostavkaPopravka } from "@/lib/zahtevki";
import type { Drobtina } from "@/lib/nav";
import { polnoIme, primerjajImena, useZaposleni, vidniZaposleni, zacetnice, type Obseg } from "@/lib/zaposleni";
import type { DanIzracun } from "@/lib/cas";
import { DanOkno } from "./DanOkno";
import { DopustPanel, useDopustOsnutek, type PorabaDopusta } from "./DopustPanel";
import { MeniDneva, type PostavkaMenija } from "./MeniDneva";
import { IzbiraOseb } from "./IzbiraOseb";
import { Koledar } from "./Koledar";
import { Povzetek, type SaldoObdobja } from "./Povzetek";
import { SaldoPanel, useSaldoOsnutek } from "./SaldoPanel";
import { TestniPodatki } from "./Skupno";

type Pogled = "mesec" | "teden";
const POGLEDI: { id: Pogled; ime: string; hint: string }[] = [
  { id: "mesec", ime: "Mesec", hint: "Pokaži cel mesec po dnevih" },
  { id: "teden", ime: "Teden", hint: "Pokaži en teden s podrobnostmi" },
];

type Props = {
  /** Kdo je viden: Administracija vse, FIN:ME sebe in podrejene. */
  obseg: Obseg;
  drobtine: Drobtina[];
  opis: string;
  /** Pot do nastavitev registracije (gumb v glavi; samo Administracija). */
  nastavitve?: string;
  /** Naslov strani (privzeto "Registracija časa"; FIN:ME "Moj čas"). */
  naslov?: string;
  /**
   * FIN:ME: prijavljen zaposleni. Svoj dan samo predlaga (popravek v potrditev), dneve podrejenih ureja (vodja);
   * desni klik na dan odpre meni (popravek, odsotnost, dovolilnica).
   */
  idJaz?: number;
};

/**
 * Registracija časa: levo izbor oseb (ozek), na sredini koledar štempljanj (mesec / teden, puščici levo-desno),
 * desno okno Saldo (začetno stanje, izplačilo, zaznamki - ureja samo Administracija) in povzetek obdobja s prenosom.
 * Stanje v naslovu: ?oseba=&datum=&pogled=. Isti pogled bo v FIN:ME (drug obseg).
 */
export function RegistracijaCasa({ obseg, drobtine, opis, nastavitve, naslov = "Registracija časa", idJaz }: Props) {
  const router = useRouter();
  const pot = usePathname();
  const iskalni = useSearchParams();
  const { podatki, napaka } = useZaposleni();
  const n = useCasNastavitve();
  const zdaj = useZdaj();
  const danes = isoDatum(zdaj);
  const zdajMin = zdaj.getHours() * 60 + zdaj.getMinutes();
  // odprt dan (datum): okno se preračuna ob ročnem dogodku ali spregledu
  // ?odpri=YYYY-MM-DD odpre okno dneva ob prihodu na stran (npr. FIN:ME -> Popravki -> Popravi)
  const [odprt, setOdprt] = useState<string | null>(() => (/^\d{4}-\d{2}-\d{2}$/.test(iskalni.get("odpri") ?? "") ? iskalni.get("odpri") : null));
  // označene osebe (kvadratki v izboru oseb) - za izvoze
  const [oznaceni, setOznaceni] = useState<ReadonlySet<number>>(new Set());

  const pogled: Pogled = iskalni.get("pogled") === "teden" ? "teden" : "mesec";
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(iskalni.get("datum") ?? "") ? iskalni.get("datum")! : danes;
  const ljudje = useMemo(() => (podatki ? vidniZaposleni(podatki.zaposleni, obseg).sort(primerjajImena) : []), [podatki, obseg]);
  const idOsebe = Number(iskalni.get("oseba")) || (obseg.nacin === "moji" ? obseg.idZaposlenega : ljudje[0]?.id);
  const oseba = ljudje.find((z) => z.id === idOsebe) ?? ljudje[0] ?? null;

  const leto = datum.slice(0, 4);
  const saldoOsnutek = useSaldoOsnutek(oseba?.id ?? null, datum);
  const dopustOsnutek = useDopustOsnutek(oseba?.id ?? null, leto);
  const zh = useZahtevki();
  const [meni, setMeni] = useState<{ d: DanIzracun; x: number; y: number } | null>(null);
  const nastavi = (p: { oseba?: number; datum?: string; pogled?: Pogled }) => {
    const drugMesec = p.datum !== undefined && p.datum.slice(0, 7) !== datum.slice(0, 7);
    const drugoLeto = p.datum !== undefined && p.datum.slice(0, 4) !== leto;
    const izgubi = (saldoOsnutek.sprememb && (p.oseba !== undefined || drugMesec)) || (dopustOsnutek.sprememb && (p.oseba !== undefined || drugoLeto));
    if (izgubi && !confirm("Imaš neshranjene spremembe salda / dopusta. Jih zavržem?")) return;
    const q = new URLSearchParams(iskalni.toString());
    for (const [k, v] of Object.entries(p)) q.set(k, String(v));
    if (q.get("datum") === danes) q.delete("datum");
    if (q.get("pogled") === "mesec") q.delete("pogled");
    router.replace(q.size ? `${pot}?${q}` : pot, { scroll: false });
  };

  const tedenOd = zacetekTedna(datum);
  const odObdobja = pogled === "mesec" ? zacetekMeseca(datum) : tedenOd;
  const doObdobja = pogled === "mesec" ? dneviMeseca(datum).at(-1)! : dodajDni(tedenOd, 6);
  // saldo: prenos = začetno stanje + dnevni saldi od datuma začetnega stanja do obdobja - izplačila preteklih mesecev
  const s = useSaldo();
  const zac = oseba ? s.zacetna[oseba.id] : undefined;
  // dogodki osebe od začetnega stanja (prenos) oz. začetka leta (dopust) do konca obdobja oz. leta
  const odDogodkov = [zac && zac.datum < odObdobja ? zac.datum : odObdobja, `${leto}-01-01`].sort()[0];
  const doDogodkov = [doObdobja, `${leto}-12-31`].sort()[1];
  const dog = useDogodki(oseba?.id ?? null, odDogodkov, doDogodkov);

  const urnik = oseba ? testniUrnik(oseba.id, n) : null;
  /** Izračun dneva: dogodki iz baze (brez baze testna štempljanja) z ročnimi dogodki in spregledi ter zahtevki (FIN:ME). */
  const izracun = (id: number, d: string) => izracunajDan(d, zZahtevki(id, d, podatkiDne(id, d, () => testniDan(id, d, n, danes, zdajMin), dog), zh.zahtevki, n, urnik), n, danes, zdajMin, urnik);
  const dnevi = useMemo(() => {
    if (!oseba) return [];
    const datumi = pogled === "mesec" ? dneviMeseca(datum) : dneviTedna(datum);
    return datumi.map((d) => izracun(oseba.id, d));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- izracun je odvisen od naštetih
  }, [oseba, pogled, datum, n, danes, zdajMin, urnik, dog, zh]);

  const premik = (smer: 1 | -1) => nastavi({ datum: pogled === "mesec" ? dodajMesece(datum, smer) : dodajDni(zacetekTedna(datum), 7 * smer) });
  const obdobje = pogled === "mesec" ? imeMeseca(datum) : `T${stTedna(datum)} · ${kratekDatum(tedenOd)} - ${kratekDatum(dodajDni(tedenOd, 6))} ${dodajDni(tedenOd, 6).slice(0, 4)}`;
  const vObdobju = pogled === "mesec" ? datum.slice(0, 7) === danes.slice(0, 7) : tedenOd === zacetekTedna(danes);

  const prenos = useMemo(() => {
    if (!oseba || !zac || zac.datum > doObdobja) return null;
    if (zac.datum >= odObdobja) return zac.saldo_min;
    let v = zac.saldo_min;
    for (let d = zac.datum, k = 0; d < odObdobja && k < 3700; d = dodajDni(d, 1), k++) v += izracun(oseba.id, d).saldo ?? 0;
    return v - izplacilaMed(s, oseba.id, zac.datum.slice(0, 7), odObdobja.slice(0, 7));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- izracun je odvisen od naštetih
  }, [oseba, zac, odObdobja, doObdobja, n, danes, zdajMin, urnik, s, dog, zh]);

  // dopust v letu: porabljeni dnevi s koledarja (letni / lanski po kvadratkih statistik) in dnevi v oddanih zahtevkih
  const poraba = useMemo((): PorabaDopusta => {
    const p = { dopust: 0, lanski: 0, cakaDopust: 0, cakaLanski: 0 };
    if (!oseba) return p;
    const st = (id: number | null) => n.statistike.find((x) => x.id === id);
    for (let d = `${leto}-01-01`, k = 0; d <= `${leto}-12-31` && k < 370; d = dodajDni(d, 1), k++) {
      const o = izracun(oseba.id, d).podatki.odsotnost;
      if (!o) continue;
      if (jeLanskiDopust(st(o.id_statistike), n)) p.lanski++;
      else if (jeLetniDopust(st(o.id_statistike), n)) p.dopust++;
    }
    for (const z of zh.zahtevki) {
      if (z.id_zaposlenega !== oseba.id || z.status !== "oddano" || z.vrsta !== "odsotnost" || z.akcija === "izbris") continue;
      const dni = delovniDnevi([z.datum_od, `${leto}-01-01`].sort()[1], [z.datum_do, `${leto}-12-31`].sort()[0], n, urnik).length;
      if (jeLanskiDopust(st(z.id_statistike), n)) p.cakaLanski += dni;
      else if (jeLetniDopust(st(z.id_statistike), n)) p.cakaDopust += dni;
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- izracun je odvisen od naštetih
  }, [oseba, leto, n, danes, zdajMin, urnik, dog, zh]);

  // FIN:ME: svoj dan = predlog popravka, dan podrejenega = urejanje (vodja); Administracija ureja vse
  const nacinDneva = idJaz == null ? "uredi" : oseba?.id === idJaz ? "predlog" : "uredi";
  const oddajPopravek = async (postavke: PostavkaPopravka[], razlog: string) => {
    if (!oseba || idJaz == null || !odprt) return;
    const datumi = postavke.map((p) => p.datum).sort();
    await oddajZahtevek(
      { vrsta: "popravek", id_zaposlenega: oseba.id, datum_od: [odprt, datumi[0]].sort()[0], datum_do: [odprt, datumi.at(-1)!].sort()[1], cas_od: null, cas_do: null, id_statistike: null, tip_dovolilnice: null, opis: razlog, postavke },
      idJaz,
      oseba.id !== idJaz,
    );
    obvesti("Popravek je oddan - vodja ga bo potrdil.");
  };
  const postavkeMenija = (d: DanIzracun): PostavkaMenija[] => {
    if (!oseba || idJaz == null) return [];
    const q = `datum=${d.datum}${oseba.id !== idJaz ? `&oseba=${oseba.id}` : ""}`;
    const skupne: PostavkaMenija[] = [
      { ikona: CalendarPlus, besedilo: "Najavi odsotnost", opis: "Dopust, bolniška ... od tega dne", onClick: () => router.push(`/moj-fines/odsotnosti?${q}`) },
      { ikona: TicketCheck, besedilo: "Dovolilnica", opis: "Izhod med delom ali delo izven urnika", onClick: () => router.push(`/moj-fines/dovolilnice?${q}`) },
    ];
    return oseba.id === idJaz
      ? [{ ikona: FilePenLine, besedilo: "Oddaj popravek", opis: "Manjka žig, napačen žig ali cel dan drugje", onClick: () => setOdprt(d.datum) }, ...skupne, { ikona: Eye, besedilo: "Podrobnosti", opis: "Žigi in ure tega dne", onClick: () => setOdprt(d.datum) }]
      : [{ ikona: PencilLine, besedilo: "Uredi dan", opis: `Popravi žige - ${oseba.ime}`, onClick: () => setOdprt(d.datum) }, ...skupne];
  };
  const odprtDan = odprt && oseba ? (dnevi.find((d) => d.datum === odprt) ?? izracun(oseba.id, odprt)) : null;
  const saldo: SaldoObdobja = {
    prenos,
    naziv: zac && zac.datum >= odObdobja && zac.datum <= doObdobja ? `Začetno stanje (${kratekDatum(zac.datum)})` : "Prenos iz prejšnjega obdobja",
    brez: !zac ? "Ni začetnega stanja - vpiši ga v okno Saldo." : zac.datum > doObdobja ? `Obdobje je pred začetnim stanjem (${kratekDatum(zac.datum)}).` : undefined,
    izplacilo: pogled === "mesec" && oseba ? (s.meseci[kljucMeseca(oseba.id, datum)]?.izplacilo_min ?? 0) : null,
    od: zac?.datum ?? null,
  };

  return (
    <>
      <GlavaStrani
        drobtine={drobtine}
        naslov={naslov}
        opis={opis}
        akcije={
          <>
            {dog.vir === "test" && <TestniPodatki opis={`Dogodkov v bazi še ni (zaženi migracijo 015): ${dog.napaka ?? ""}. Štempljanja so testna, ročni dogodki in spregledi veljajo samo v tem brskalniku.`} />}
            {nastavitve && (
              <Button hint="Odpri nastavitve: urniki, statistike" variant="neutral" icon={Settings} onClick={() => router.push(nastavitve)}>
                Nastavitve
              </Button>
            )}
          </>
        }
      />

      {napaka ? (
        <PraznoStanje icon={AlertTriangle} ton="napaka" naslov="Zaposlenih ni bilo mogoče naložiti" opis={napaka} />
      ) : !podatki ? (
        <div className="fos-glass h-96 animate-pulse rounded-[20px]" aria-label="Nalagam" />
      ) : !oseba ? (
        <PraznoStanje icon={Users} naslov="Ni oseb za prikaz" opis="V tem pregledu ni nobenega zaposlenega." />
      ) : (
        <div className={`grid items-start gap-4 lg:gap-5 ${ljudje.length > 1 ? "lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem] 2xl:grid-cols-[24rem_minmax(0,1fr)_21.5rem]" : "xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_21.5rem]"}`}>
          {ljudje.length > 1 && (
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }} className="min-w-0 lg:row-span-2 xl:row-span-1">
              <IzbiraOseb ljudje={ljudje} oddelki={podatki.oddelki} vodje={podatki.vodje} oznaceni={oznaceni} onOznaci={setOznaceni} izbran={oseba} onIzberi={(z) => nastavi({ oseba: z.id })} />
            </motion.div>
          )}

          {/* koledar - osrednji del */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.1 }} className="fos-glass flex min-w-0 flex-col gap-2.5 rounded-[18px] p-2.5 sm:p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar besedilo={zacetnice(oseba)} velikost="sm" className="!h-8 !w-8" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-base font-bold text-white">{polnoIme(oseba)}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
                    {oseba.oddelek?.ime_oddelka ?? "Brez oddelka"}
                    {urnik && (
                      <span className="flex items-center gap-1 text-fines-300" title="Urnik zaposlenega (testno)">
                        <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                        {urnik.ime}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="Pogled koledarja" className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">
                  {POGLEDI.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={pogled === p.id}
                      title={p.hint}
                      onClick={() => nastavi({ pogled: p.id })}
                      className={`relative h-7 rounded-full px-3 text-xs font-semibold transition-colors ${pogled === p.id ? "text-snow" : "text-ink-300 hover:text-white"}`}
                    >
                      {pogled === p.id && (
                        <motion.span layoutId="pogled-koledarja" className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_4px_14px_-6px_rgb(202_80_16/0.9)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                      )}
                      <span className="relative">{p.ime}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <IconButton hint={pogled === "mesec" ? "Prejšnji mesec" : "Prejšnji teden"} icon={ChevronLeft} onClick={() => premik(-1)} className="!h-8 !w-8" />
                  <span className="min-w-[8.5rem] text-center font-display text-xs font-bold capitalize text-white tabular-nums">{obdobje}</span>
                  <IconButton hint={pogled === "mesec" ? "Naslednji mesec" : "Naslednji teden"} icon={ChevronRight} onClick={() => premik(1)} className="!h-8 !w-8" />
                </div>
                {!vObdobju && (
                  <Button hint="Skoči na današnji dan" variant="neutral" className="!h-8 !px-3 !text-xs" onClick={() => nastavi({ datum: danes })}>
                    Danes
                  </Button>
                )}
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${oseba.id}-${pogled}-${pogled === "mesec" ? datum.slice(0, 7) : tedenOd}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                <Koledar dnevi={dnevi} statistike={n.statistike} velik={pogled === "teden"} zdajMin={zdajMin} onOdpri={(d) => setOdprt(d.datum)} onMeni={idJaz != null ? (d, x, y) => setMeni({ d, x, y }) : undefined} />
              </motion.div>
            </AnimatePresence>
          </motion.section>

          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className={`min-w-0 ${ljudje.length > 1 ? "lg:col-start-2 xl:col-start-auto" : ""}`}>
            <Povzetek
              dnevi={dnevi}
              statistike={n.statistike}
              obdobje={obdobje}
              saldo={saldo}
              zgoraj={<SaldoPanel o={saldoOsnutek} mesec={datum} urejanje={obseg.nacin === "vsi"} />}
              podStatistikami={<DopustPanel o={dopustOsnutek} poraba={poraba} leto={leto} urejanje={obseg.nacin === "vsi"} />}
            />
          </motion.div>
        </div>
      )}

      <SaveBar
        sprememb={saldoOsnutek.sprememb + dopustOsnutek.sprememb}
        shranjujem={saldoOsnutek.shranjujem || dopustOsnutek.shranjujem}
        onShrani={async () => {
          if (saldoOsnutek.sprememb) await saldoOsnutek.shrani();
          if (dopustOsnutek.sprememb) await dopustOsnutek.shrani();
        }}
        onPreklici={() => {
          saldoOsnutek.preklici();
          dopustOsnutek.preklici();
        }}
      />
      <DanOkno d={odprtDan} n={n} urnik={urnik} zdajMin={zdajMin} idZaposlenega={oseba?.id ?? null} nacin={nacinDneva} onOddajPopravek={oddajPopravek} onClose={() => setOdprt(null)} />
      <MeniDneva odprt={meni} naslov={meni ? `${kratekDatum(meni.d.datum)} ${meni.d.datum.slice(0, 4)}` : ""} postavke={meni ? postavkeMenija(meni.d) : []} onClose={() => setMeni(null)} />
    </>
  );
}
