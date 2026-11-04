"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Check, ClockPlus, DoorOpen, FilePenLine, Inbox, MousePointerClick, PencilLine, Send, Trash2, Undo2, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { Modal } from "@/components/ui/Modal";
import { obvesti } from "@/components/ui/Obvestila";
import { IskalnoPolje, POLJE } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { IkonaStatistike, TestniPodatki } from "@/components/cas/Skupno";
import { PoljeObrazca } from "@/components/cas/Polja";
import { fmtTrajanje, isoDatum, izCasa, fmtCas } from "@/lib/cas";
import { useCasNastavitve, type CasNastavitve } from "@/lib/casNastavitve";
import { testniUrnik } from "@/lib/casTest";
import { ujemaIskanje } from "@/lib/iskanje";
import { MOJ_FINES, ME_VSTOPI } from "@/lib/nav";
import {
  cakaSprememba,
  delovniDnevi,
  fmtObdobje,
  fmtTrenutek,
  oddajZahtevek,
  odlociZahtevek,
  opisPostavke,
  prekliciZahtevek,
  razlogiDovolilnice,
  razlogiOdsotnosti,
  STATUSI,
  useZahtevki,
  VRSTE,
  type StatusZahtevka,
  type TipDovolilnice,
  type VrstaZahtevka,
  type Zahtevek,
} from "@/lib/zahtevki";
import { polnoIme, zacetnice } from "@/lib/zaposleni";
import { imeOsebe, useJaz, type Jaz } from "./Jaz";

const OPISI: Record<VrstaZahtevka, string> = {
  odsotnost: "Najavi dopust, bolniško ali drug cel dan. Vodja zahtevek potrdi.",
  dovolilnica: "Izhod med delom ali delo izven urnika - en dan, od ure do ure.",
  popravek: "Popravki tvojega delovnega časa in kako je vodja odločil.",
};

type Filter = "vse" | StatusZahtevka;
const FILTRI: { id: Filter; ime: string }[] = [
  { id: "vse", ime: "Vse" },
  { id: "oddano", ime: "Oddano" },
  { id: "potrjeno", ime: "Potrjeno" },
  { id: "zavrnjeno", ime: "Zavrnjeno" },
];

/**
 * Stran zahtevkov FIN:ME (Odsotnosti, Dovolilnice, Popravki) - vse v enem oknu: zavihka "Moji" in (vodja) "Ekipa";
 * Moji: levo obrazec za nov zahtevek, desno seznam s filtri statusov. Ekipa: zahtevki podrejenih, Potrdi / Zavrni.
 * Stanje v naslovu: ?pogled=ekipa, ?datum= / ?oseba= (iz menija dneva v Mojem času).
 */
export function ZahtevkiStran({ vrsta }: { vrsta: VrstaZahtevka }) {
  const j = useJaz();
  const n = useCasNastavitve();
  const zh = useZahtevki();
  const router = useRouter();
  const pot = usePathname();
  const iskalni = useSearchParams();
  const pogled = iskalni.get("pogled") === "ekipa" && j.vodja ? "ekipa" : "moji";
  const ekipaIds = useMemo(() => new Set(j.ekipa.map((z) => z.id)), [j.ekipa]);
  const vVrsti = zh.zahtevki.filter((z) => z.vrsta === vrsta);
  const moji = vVrsti.filter((z) => z.id_zaposlenega === j.jaz.id).sort((a, b) => b.id - a.id);
  const ekipni = vVrsti.filter((z) => ekipaIds.has(z.id_zaposlenega)).sort((a, b) => Number(b.status === "oddano") - Number(a.status === "oddano") || b.id - a.id);
  const cakaEkipa = ekipni.filter((z) => z.status === "oddano").length;
  const v = ME_VSTOPI.find((x) => x.href.endsWith(vrsta === "odsotnost" ? "odsotnosti" : vrsta === "dovolilnica" ? "dovolilnice" : "popravki"))!;
  // urejanje (sprememba gre v potrditev) in izbris (prošnja vodji) oddanega / potrjenega zahtevka
  const [urejam, setUrejam] = useState<Zahtevek | null>(null);
  const [brisem, setBrisem] = useState<Zahtevek | null>(null);

  const uredi = (z: Zahtevek) => {
    setUrejam(z);
    if (pogled === "ekipa") nastaviPogled("moji");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nastaviPogled = (p: "moji" | "ekipa") => {
    const q = new URLSearchParams(iskalni.toString());
    if (p === "ekipa") q.set("pogled", "ekipa");
    else q.delete("pogled");
    router.replace(q.size ? `${pot}?${q}` : pot, { scroll: false });
  };

  return (
    <>
      <GlavaStrani
        drobtine={[{ naslov: "FIN:OS", href: "/" }, { naslov: MOJ_FINES.naslov, href: MOJ_FINES.href }, { naslov: VRSTE[vrsta].mnozina }]}
        naslov={
          <span className="flex items-center gap-3">
            <span className="fos-fines-fill grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-snow sm:h-12 sm:w-12">
              <v.icon className="h-6 w-6" aria-hidden />
            </span>
            {VRSTE[vrsta].mnozina}
          </span>
        }
        opis={OPISI[vrsta]}
        akcije={zh.vir === "test" ? <TestniPodatki opis={`Zahtevkov v bazi še ni (zaženi migracijo 020): ${zh.napaka ?? ""}. Zahtevki so shranjeni samo v tem brskalniku.`} /> : undefined}
      />

      {j.vodja && (
        <div role="tablist" aria-label="Čigavi zahtevki" className="flex w-full max-w-xl rounded-[18px] border border-white/10 bg-white/[0.04] p-1.5">
          {(
            [
              { id: "moji", ime: "Moji", ikona: UserRound, hint: "Tvoji zahtevki in nov zahtevek", st: moji.filter((z) => z.status === "oddano").length },
              { id: "ekipa", ime: "Ekipa", ikona: Users, hint: "Zahtevki tvoje ekipe - potrdi ali zavrni", st: cakaEkipa },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={pogled === t.id}
              title={t.hint}
              onClick={() => nastaviPogled(t.id)}
              className={`relative flex h-12 flex-1 items-center justify-center gap-2 rounded-[13px] text-base font-bold transition-colors ${pogled === t.id ? "text-snow" : "text-ink-300 hover:text-white"}`}
            >
              {pogled === t.id && (
                <motion.span layoutId="me-zavihek" className="absolute inset-0 rounded-[13px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_6px_18px_-6px_rgb(202_80_16/0.9)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <t.ikona className="relative h-5 w-5" aria-hidden />
              <span className="relative">{t.ime}</span>
              {t.st > 0 && (
                <span className={`relative grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold ${t.id === "ekipa" ? "bg-snow text-fines-700" : "bg-warn-500 text-coal"}`} title={t.id === "ekipa" ? "Čaka na tvojo potrditev" : "Tvoji zahtevki, ki še čakajo"}>
                  {t.st}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={pogled} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {pogled === "moji" ? (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
              <div className="lg:sticky lg:top-[88px]">
                {vrsta === "popravek" ? <PopravekNavodila /> : <Obrazec key={`${iskalni}|${urejam?.id ?? ""}`} vrsta={vrsta} j={j} n={n} zahtevki={zh.zahtevki} urejam={urejam} onKonec={() => setUrejam(null)} />}
              </div>
              <Seznam j={j} n={n} zahtevki={moji} vsi={zh.zahtevki} ekipa={false} onUredi={uredi} onIzbrisi={setBrisem} />
            </div>
          ) : (
            <Seznam j={j} n={n} zahtevki={ekipni} vsi={zh.zahtevki} ekipa onUredi={uredi} onIzbrisi={setBrisem} />
          )}
        </motion.div>
      </AnimatePresence>
      <Izbris z={brisem} j={j} onClose={() => setBrisem(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Obrazec: odsotnost / dovolilnica
// ---------------------------------------------------------------------------------------------------------------

function Korak({ st, naslov, children }: { st: number; naslov: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2.5 text-base font-bold text-white">
        <span className="fos-fines-fill grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-sm text-snow">{st}</span>
        {naslov}
      </h3>
      {children}
    </section>
  );
}

function Ploscica({ izbrana, onClick, ikona, naslov, opis, hint }: { izbrana: boolean; onClick: () => void; ikona: ReactNode; naslov: string; opis?: string; hint: string }) {
  return (
    <button
      type="button"
      title={hint}
      aria-pressed={izbrana}
      onClick={onClick}
      className={`relative flex min-h-14 items-center gap-2.5 rounded-[14px] border p-2 text-left transition-all duration-300 active:scale-[0.97] ${
        izbrana ? "border-fines-400/70 bg-fines-500/15 shadow-[0_0_22px_-8px_rgb(238_122_58/0.9)]" : "border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
      }`}
    >
      {ikona}
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-bold leading-tight text-white">{naslov}</span>
        {opis && <span className="text-xs leading-tight text-ink-400">{opis}</span>}
      </span>
      <AnimatePresence>
        {izbrana && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[linear-gradient(135deg,#f19a66,#ca5010)] text-snow shadow-[0_0_10px_rgb(238_122_58/0.8)]">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

const CAS = /^\d{2}:\d{2}$/;

function Obrazec({ vrsta, j, n, zahtevki, urejam, onKonec }: { vrsta: "odsotnost" | "dovolilnica"; j: Jaz; n: CasNastavitve; zahtevki: Zahtevek[]; /** Sprememba obstoječega zahtevka. */ urejam: Zahtevek | null; onKonec: () => void }) {
  const iskalni = useSearchParams();
  const danes = isoDatum(new Date());
  const zacDatum = /^\d{4}-\d{2}-\d{2}$/.test(iskalni.get("datum") ?? "") ? iskalni.get("datum")! : danes;
  const zacOseba = Number(iskalni.get("oseba"));
  const u = urejam;
  const [oseba, setOseba] = useState(u ? u.id_zaposlenega : j.ekipa.some((z) => z.id === zacOseba) ? zacOseba : j.jaz.id);
  const [razlog, setRazlog] = useState<number | null>(u?.id_statistike ?? null);
  const [tip, setTip] = useState<TipDovolilnice | null>(u?.tip_dovolilnice ?? null);
  const [od, setOd] = useState(u?.datum_od ?? zacDatum);
  const [doo, setDo] = useState(u?.datum_do ?? zacDatum);
  const [casOd, setCasOd] = useState(u?.cas_od != null ? fmtCas(u.cas_od) : "");
  const [casDo, setCasDo] = useState(u?.cas_do != null ? fmtCas(u.cas_do) : "");
  const [opis, setOpis] = useState(u?.opis ?? "");
  const [poskus, setPoskus] = useState(false);
  const [oddajam, setOddajam] = useState(false);

  const zame = oseba === j.jaz.id;
  const urnik = testniUrnik(oseba, n);
  const dni = vrsta === "odsotnost" && od && doo >= od ? delovniDnevi(od, doo, n, urnik) : [];
  const razlogi = vrsta === "odsotnost" ? razlogiOdsotnosti(n) : razlogiDovolilnice(n);
  const trajanje = CAS.test(casOd) && CAS.test(casDo) ? izCasa(casDo) - izCasa(casOd) : null;
  const prekrivanje = zahtevki.find((z) => z.id !== u?.id && z.akcija !== "izbris" && z.vrsta === vrsta && z.id_zaposlenega === oseba && (z.status === "oddano" || z.status === "potrjeno") && z.datum_od <= (vrsta === "odsotnost" ? doo : od) && z.datum_do >= od && (vrsta === "odsotnost" || (trajanje != null && z.cas_od != null && z.cas_od < izCasa(casDo) && (z.cas_do ?? 0) > izCasa(casOd))));

  const napake: Record<string, string> = {};
  if (vrsta === "odsotnost") {
    if (!razlog) napake.razlog = "Izberi, zakaj te ne bo.";
    if (!od) napake.od = "Izberi prvi dan.";
    if (!doo || doo < od) napake.do = "Zadnji dan ne sme biti pred prvim.";
    else if (!dni.length) napake.do = "V teh dneh ni delovnih dni.";
  } else {
    if (!tip) napake.razlog = "Izberi, kaj potrebuješ.";
    else if (tip === "izhod" && !razlog) napake.razlog = "Izberi, ali greš službeno ali zasebno.";
    if (!od) napake.od = "Izberi dan.";
    if (!CAS.test(casOd)) napake.casOd = "Vpiši uro.";
    if (!CAS.test(casDo)) napake.casDo = "Vpiši uro.";
    else if (trajanje != null && trajanje <= 0) napake.casDo = "Konec mora biti po začetku.";
  }
  if (!opis.trim()) napake.opis = "Napiši, zakaj - vodja bo lažje odločil.";
  if (prekrivanje && !Object.keys(napake).length) napake.prekrivanje = `Za ta čas že obstaja zahtevek (${STATUSI[prekrivanje.status].ime.toLowerCase()}).`;
  const n1 = poskus ? napake : {};

  const oddaj = async () => {
    setPoskus(true);
    if (Object.keys(napake).length) return;
    setOddajam(true);
    try {
      await oddajZahtevek(
        {
          vrsta,
          id_zaposlenega: oseba,
          datum_od: od,
          datum_do: vrsta === "odsotnost" ? doo : od,
          cas_od: vrsta === "dovolilnica" ? izCasa(casOd) : null,
          cas_do: vrsta === "dovolilnica" ? izCasa(casDo) : null,
          id_statistike: vrsta === "dovolilnica" && tip === "delo" ? null : razlog,
          tip_dovolilnice: vrsta === "dovolilnica" ? tip : null,
          opis: opis.trim(),
          postavke: [],
          akcija: u ? "sprememba" : "nov",
          id_prejsnji: u?.id ?? null,
        },
        j.jaz.id,
        !zame,
      );
      obvesti(zame ? (u ? "Sprememba je oddana - vodja jo bo potrdil." : "Zahtevek je oddan - vodja ga bo potrdil.") : `${u ? "Spremenjeno" : "Vpisano"} in potrjeno za ${polnoIme(j.podatki.poId.get(oseba)!)}.`);
      if (u) onKonec();
      setRazlog(null);
      setTip(null);
      setOpis("");
      setCasOd("");
      setCasDo("");
      setPoskus(false);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setOddajam(false);
    }
  };

  return (
    <section className="fos-glass relative flex flex-col gap-5 overflow-hidden rounded-[24px] p-4 sm:p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8f380b,#ca5010_30%,#ee7a3a_60%,#ca5010)]" />
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
        {u ? <PencilLine className="h-5 w-5 text-fines-300" aria-hidden /> : <Send className="h-5 w-5 text-fines-300" aria-hidden />}
        {u ? (vrsta === "odsotnost" ? "Sprememba odsotnosti" : "Sprememba dovolilnice") : vrsta === "odsotnost" ? "Nova odsotnost" : "Nova dovolilnica"}
        {u && (
          <Button hint="Ne spremeni - vrni se na nov zahtevek" variant="neutral" onClick={onKonec} className="ml-auto !h-8 !px-3 !text-xs">
            Prekliči
          </Button>
        )}
      </h2>
      {u && (
        <p className="-mt-3 rounded-[12px] border border-fines-400/30 bg-fines-500/10 px-3 py-2 text-sm text-ink-200">
          Spreminjaš {u.status === "potrjeno" ? "potrjen" : "oddan"} zahtevek ({fmtObdobje(u.datum_od, u.datum_do)}). Sprememba gre ponovno vodji v potrditev{u.status === "potrjeno" ? " - do takrat velja stari zahtevek" : ""}.
        </p>
      )}

      {j.vodja && !u && (
        <PoljeObrazca naslov="Za koga?" opis={zame ? undefined : "Kot vodja vpišeš zahtevek za podrejenega - je takoj potrjen."}>
          <select value={oseba} onChange={(e) => setOseba(Number(e.target.value))} title="Za koga oddajaš zahtevek" className={`${POLJE} cursor-pointer [&>option]:bg-ink-900`}>
            <option value={j.jaz.id}>Zame</option>
            {j.ekipa.map((z) => (
              <option key={z.id} value={z.id}>
                {z.priimek} {z.ime}
              </option>
            ))}
          </select>
        </PoljeObrazca>
      )}

      <Korak st={1} naslov={vrsta === "odsotnost" ? "Zakaj te ne bo?" : "Kaj potrebuješ?"}>
        {vrsta === "dovolilnica" && (
          <div className="grid grid-cols-2 gap-2">
            <Ploscica
              izbrana={tip === "izhod"}
              onClick={() => setTip("izhod")}
              hint="Med delovnim časom greš ven (službeno ali zasebno)"
              ikona={<IkonaTip ikona={DoorOpen} />}
              naslov="Grem ven"
              opis="med delovnim časom"
            />
            <Ploscica
              izbrana={tip === "delo"}
              onClick={() => {
                setTip("delo");
                setRazlog(null);
              }}
              hint="Delaš izven svojega urnika (nadure)"
              ikona={<IkonaTip ikona={ClockPlus} />}
              naslov="Delam dlje"
              opis="izven urnika, nadure"
            />
          </div>
        )}
        {(vrsta === "odsotnost" || tip === "izhod") && (
          <div className="grid grid-cols-2 gap-2">
            {razlogi.map((s) => (
              <Ploscica key={s.id} izbrana={razlog === s.id} onClick={() => setRazlog(s.id)} hint={s.opis || s.ime} ikona={<IkonaStatistike s={s} />} naslov={s.ime} />
            ))}
          </div>
        )}
        {n1.razlog && <p className="text-sm font-semibold text-nok-500">{n1.razlog}</p>}
      </Korak>

      <Korak st={2} naslov="Kdaj?">
        {vrsta === "odsotnost" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <PoljeObrazca naslov="Od" napaka={n1.od}>
                <input
                  type="date"
                  className={`${POLJE} h-12 text-base`}
                  value={od}
                  onChange={(e) => {
                    setOd(e.target.value);
                    if (!doo || doo < e.target.value) setDo(e.target.value);
                  }}
                  title="Prvi dan odsotnosti"
                />
              </PoljeObrazca>
              <PoljeObrazca naslov="Do" napaka={n1.do}>
                <input type="date" className={`${POLJE} h-12 text-base`} value={doo} min={od} onChange={(e) => setDo(e.target.value)} title="Zadnji dan odsotnosti" />
              </PoljeObrazca>
            </div>
            {dni.length > 0 && (
              <p className="flex items-center gap-2 text-sm text-ink-300">
                <CalendarClock className="h-4 w-4 text-fines-300" aria-hidden />
                <b className="font-display text-lg text-white">{dni.length}</b> {dni.length === 1 ? "delovni dan" : dni.length === 2 ? "delovna dneva" : dni.length < 5 ? "delovni dnevi" : "delovnih dni"}
                <span className="text-ink-500">(vikendi in prazniki se ne štejejo)</span>
              </p>
            )}
          </>
        ) : (
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <PoljeObrazca naslov="Dan" napaka={n1.od}>
              <input type="date" className={`${POLJE} h-12 text-base`} value={od} onChange={(e) => setOd(e.target.value)} title="Dan dovolilnice" />
            </PoljeObrazca>
            <PoljeObrazca naslov="Od ure" napaka={n1.casOd}>
              <input type="time" className={`${POLJE} h-12 text-base tabular-nums`} value={casOd} onChange={(e) => setCasOd(e.target.value)} title="Od katere ure" />
            </PoljeObrazca>
            <PoljeObrazca naslov="Do ure" napaka={n1.casDo}>
              <input type="time" className={`${POLJE} h-12 text-base tabular-nums`} value={casDo} onChange={(e) => setCasDo(e.target.value)} title="Do katere ure" />
            </PoljeObrazca>
            {trajanje != null && trajanje > 0 && (
              <p className="col-span-3 flex items-center gap-2 text-sm text-ink-300">
                <CalendarClock className="h-4 w-4 text-fines-300" aria-hidden />
                Skupaj <b className="font-display text-lg text-white">{fmtTrajanje(trajanje, true)}</b> h
              </p>
            )}
          </div>
        )}
      </Korak>

      <Korak st={3} naslov="Zakaj?">
        <PoljeObrazca naslov="Kratko napiši vodji" obvezno napaka={n1.opis}>
          <input className={`${POLJE} h-12 text-base`} value={opis} onChange={(e) => setOpis(e.target.value)} placeholder={vrsta === "odsotnost" ? "npr. poroka v družini" : "npr. zdravnik, nujno naročilo"} title="Zakaj potrebuješ ta zahtevek (obvezno)" />
        </PoljeObrazca>
      </Korak>

      {n1.prekrivanje && <p className="rounded-[12px] border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-sm font-semibold text-warn-500">{n1.prekrivanje}</p>}

      <Button hint={zame ? "Pošlji zahtevek vodji v potrditev" : "Vpiši in potrdi zahtevek za podrejenega"} variant="success" size="lg" icon={zame ? Send : Check} onClick={oddaj} disabled={oddajam} className="w-full">
        {zame ? (u ? "Pošlji spremembo vodji" : "Pošlji vodji") : u ? "Spremeni in potrdi" : "Vpiši in potrdi"}
      </Button>
    </section>
  );
}

function IkonaTip({ ikona: I }: { ikona: LucideIcon }) {
  return (
    <span className="fos-fines-fill grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-snow">
      <I className="h-[18px] w-[18px]" aria-hidden />
    </span>
  );
}

/** Popravek se odda v Mojem času (klik ali desni klik na dan) - tu kratka navodila in izbira dneva. */
function PopravekNavodila() {
  const router = useRouter();
  const [dan, setDan] = useState(isoDatum(new Date()));
  const koraki: { ikona: LucideIcon; besedilo: string }[] = [
    { ikona: CalendarClock, besedilo: "Izberi dan (spodaj) ali odpri Moj čas" },
    { ikona: MousePointerClick, besedilo: "Desni klik na dan → Oddaj popravek" },
    { ikona: FilePenLine, besedilo: "Dodaj manjkajoč žig ali označi napačnega" },
    { ikona: Send, besedilo: "Oddaj - vodja potrdi" },
  ];
  return (
    <section className="fos-glass relative flex flex-col gap-4 overflow-hidden rounded-[24px] p-4 sm:p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8f380b,#ca5010_30%,#ee7a3a_60%,#ca5010)]" />
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
        <FilePenLine className="h-5 w-5 text-fines-300" aria-hidden />
        Nov popravek
      </h2>
      <ol className="flex flex-col gap-2.5">
        {koraki.map((k, i) => (
          <motion.li key={k.besedilo} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.06 }} className="flex items-center gap-3 text-sm font-semibold text-ink-100">
            <span className="fos-fines-fill relative grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-snow">
              <k.ikona className="h-5 w-5" aria-hidden />
              <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-snow font-display text-[11px] font-bold text-fines-700">{i + 1}</span>
            </span>
            {k.besedilo}
          </motion.li>
        ))}
      </ol>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <PoljeObrazca naslov="Dan za popravek">
          <input type="date" className={`${POLJE} h-12 text-base`} value={dan} max={isoDatum(new Date())} onChange={(e) => setDan(e.target.value)} title="Dan, ki ga želiš popraviti" />
        </PoljeObrazca>
        <Button hint="Odpri ta dan in sestavi popravek" variant="success" size="lg" icon={FilePenLine} onClick={() => dan && router.push(`/moj-fines/cas?datum=${dan}&odpri=${dan}`)}>
          Popravi
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Seznam zahtevkov (moji / ekipa)
// ---------------------------------------------------------------------------------------------------------------

type Akcije = { vsi: Zahtevek[]; onUredi: (z: Zahtevek) => void; onIzbrisi: (z: Zahtevek) => void };

function Seznam({ j, n, zahtevki, ekipa, vsi, onUredi, onIzbrisi }: { j: Jaz; n: CasNastavitve; zahtevki: Zahtevek[]; ekipa: boolean } & Akcije) {
  const [filter, setFilter] = useState<Filter>(ekipa ? "oddano" : "vse");
  const [iskanje, setIskanje] = useState("");
  const [zavracam, setZavracam] = useState<Zahtevek | null>(null);
  const st = (f: Filter) => (f === "vse" ? zahtevki.length : zahtevki.filter((z) => z.status === f).length);
  const prikazani = zahtevki.filter((z) => (filter === "vse" || z.status === filter) && ujemaIskanje(iskanje, [j.podatki.poId.get(z.id_zaposlenega)?.ime, j.podatki.poId.get(z.id_zaposlenega)?.priimek]));

  const potrdi = async (z: Zahtevek) => {
    try {
      await odlociZahtevek(z, "potrjeno", "", j.jaz.id);
      obvesti(`Potrjeno: ${imeOsebe(j, z.id_zaposlenega)}.`);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  const umakni = async (z: Zahtevek) => {
    if (!confirm("Umaknem ta zahtevek? Vodja ga ne bo več videl za potrditev.")) return;
    try {
      await prekliciZahtevek(z);
      obvesti("Zahtevek je umaknjen.");
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <NaslovRazdelka>{ekipa ? "Zahtevki ekipe" : "Moji zahtevki"}</NaslovRazdelka>
      <div className="flex flex-wrap items-center gap-2">
        {FILTRI.map((f) => {
          const S = f.id === "vse" ? null : STATUSI[f.id];
          const izbran = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              title={S ? S.opis : "Pokaži vse zahtevke"}
              onClick={() => setFilter(f.id)}
              className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-all duration-300 ${izbran ? "border-fines-400/60 bg-fines-500/15 text-white shadow-[0_0_16px_-6px_rgb(238_122_58/0.9)]" : "border-white/10 bg-white/[0.04] text-ink-300 hover:border-white/25 hover:text-white"}`}
            >
              {S && <S.ikona className="h-4 w-4" style={{ color: S.barva }} aria-hidden />}
              {f.ime}
              <span className="rounded-full bg-white/10 px-1.5 text-xs tabular-nums">{st(f.id)}</span>
            </button>
          );
        })}
        {ekipa && j.ekipa.length > 5 && <IskalnoPolje value={iskanje} onChange={setIskanje} hint="Išči po imenu in priimku" placeholder="Išči osebo ..." className="ml-auto w-full sm:w-64" />}
      </div>

      {prikazani.length ? (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {prikazani.map((z, i) => (
              <motion.li key={z.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(i, 10) * 0.03 }}>
                <Kartica z={z} j={j} n={n} ekipa={ekipa} onPotrdi={() => potrdi(z)} onZavrni={() => setZavracam(z)} onUmakni={() => umakni(z)} vsi={vsi} onUredi={onUredi} onIzbrisi={onIzbrisi} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <PraznoStanje icon={Inbox} naslov={ekipa ? (filter === "oddano" ? "Nič ne čaka na potrditev" : "Ni zahtevkov") : "Ni zahtevkov"} opis={ekipa ? "Ko bo kdo iz ekipe oddal zahtevek, bo tukaj." : "Ko oddaš zahtevek, ga vidiš tukaj - in ali ga je vodja potrdil."} />
      )}

      <Zavrni z={zavracam} j={j} onClose={() => setZavracam(null)} />
    </section>
  );
}

function Kartica({
  z,
  j,
  n,
  ekipa,
  onPotrdi,
  onZavrni,
  onUmakni,
  vsi,
  onUredi,
  onIzbrisi,
}: { z: Zahtevek; j: Jaz; n: CasNastavitve; ekipa: boolean; onPotrdi: () => void; onZavrni: () => void; onUmakni: () => void } & Akcije) {
  const caka = cakaSprememba(z, vsi);
  const prej = z.id_prejsnji != null ? vsi.find((x) => x.id === z.id_prejsnji) : undefined;
  // urejanje / izbris: odsotnosti in dovolilnice, oddane ali potrjene, brez čakajoče spremembe; ekipa samo potrjene (oddane potrdi / zavrne)
  const spremenljiv = z.vrsta !== "popravek" && z.akcija !== "izbris" && !caka && (ekipa ? z.status === "potrjeno" && z.id_zaposlenega !== j.jaz.id : z.status === "oddano" || z.status === "potrjeno");
  const S = STATUSI[z.status];
  const stat = n.statistike.find((s) => s.id === z.id_statistike);
  const oseba = j.podatki.poId.get(z.id_zaposlenega);
  const naslov = z.vrsta === "popravek" ? "Popravek dneva" : z.vrsta === "dovolilnica" && z.tip_dovolilnice === "delo" ? "Delo izven urnika" : z.vrsta === "dovolilnica" ? `Izhod · ${stat?.ime ?? ""}` : (stat?.ime ?? "Odsotnost");
  const dni = z.vrsta === "odsotnost" ? delovniDnevi(z.datum_od, z.datum_do, n, testniUrnik(z.id_zaposlenega, n)).length : 0;
  const kdaj =
    z.vrsta === "dovolilnica" && z.cas_od != null
      ? `${fmtObdobje(z.datum_od, z.datum_od)} · ${fmtCas(z.cas_od)} - ${fmtCas(z.cas_do ?? 0)} (${fmtTrajanje((z.cas_do ?? 0) - z.cas_od, true)} h)`
      : `${fmtObdobje(z.datum_od, z.datum_do)}${z.vrsta === "odsotnost" ? ` · ${dni} ${dni === 1 ? "dan" : dni === 2 ? "dneva" : dni < 5 ? "dnevi" : "dni"}` : ""}`;
  const ikona =
    z.vrsta === "popravek" ? <IkonaTip ikona={FilePenLine} /> : z.vrsta === "dovolilnica" && z.tip_dovolilnice === "delo" ? <IkonaTip ikona={ClockPlus} /> : <IkonaStatistike s={stat} />;
  const odlocaj = ekipa && z.status === "oddano" && z.id_zaposlenega !== j.jaz.id;

  return (
    <div
      className={`fos-glass flex flex-col gap-3 rounded-[18px] p-3 sm:flex-row sm:items-center sm:p-3.5 ${z.status === "oddano" && ekipa ? "border-fines-400/30" : ""} ${z.status === "preklicano" ? "opacity-60" : ""}`}
      style={{ boxShadow: `inset 3px 0 0 ${S.barva}` }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {ikona}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {ekipa && oseba && (
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <Avatar besedilo={zacetnice(oseba)} velikost="sm" className="!h-6 !w-6 !text-[10px]" />
              {polnoIme(oseba)}
              <span className="text-xs font-normal text-ink-500">{oseba.oddelek?.ime_oddelka}</span>
            </span>
          )}
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {z.akcija !== "nov" && (
              <span className={`self-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${z.akcija === "izbris" ? "bg-nok-500/15 text-nok-500" : "bg-fines-500/15 text-fines-300"}`} title={z.akcija === "izbris" ? "Prošnja za izbris zahtevka" : "Sprememba prejšnjega zahtevka"}>
                {z.akcija === "izbris" ? "Izbris" : "Sprememba"}
              </span>
            )}
            <b className={`${ekipa ? "text-sm text-ink-100" : "text-base text-white"} ${z.akcija === "izbris" ? "line-through decoration-nok-500/70" : ""}`}>{naslov}</b>
            <span className="text-sm tabular-nums text-ink-300">{kdaj}</span>
          </span>
          {z.vrsta === "popravek" && z.postavke.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {z.postavke.map((p, i) => (
                <li key={i} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-ink-200">
                  {opisPostavke(p, n)}
                </li>
              ))}
            </ul>
          )}
          {z.akcija === "sprememba" && prej && (
            <span className="text-xs text-ink-500">
              Prej: <span className="line-through">{prej.cas_od != null ? `${fmtObdobje(prej.datum_od, prej.datum_od)} ${fmtCas(prej.cas_od)} - ${fmtCas(prej.cas_do ?? 0)}` : fmtObdobje(prej.datum_od, prej.datum_do)}</span>
            </span>
          )}
          {z.opis && <span className="text-sm italic text-ink-400">„{z.opis}“</span>}
          {caka && <span className="text-xs font-semibold text-warn-500">{caka.akcija === "izbris" ? "Izbris čaka na potrditev vodje." : "Sprememba čaka na potrditev vodje."}</span>}
          <span className="text-xs text-ink-500">
            Oddano {fmtTrenutek(z.oddano_ob)}
            {z.id_oddal != null && z.id_oddal !== z.id_zaposlenega && ` · vpisal ${imeOsebe(j, z.id_oddal)}`}
            {z.odloceno_ob && z.status !== "preklicano" && z.id_oddal !== z.id_odlocil && ` · ${S.ime.toLowerCase()}: ${imeOsebe(j, z.id_odlocil)}, ${fmtTrenutek(z.odloceno_ob)}`}
          </span>
          {z.komentar_odlocitve && <span className="text-sm text-nok-500">Razlog: {z.komentar_odlocitve}</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <span title={S.opis} className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold" style={{ color: S.barva, borderColor: `color-mix(in srgb, ${S.barva} 45%, transparent)`, background: `color-mix(in srgb, ${S.barva} 12%, transparent)` }}>
          <S.ikona className="h-4 w-4" aria-hidden />
          {S.ime}
        </span>
        {odlocaj && (
          <>
            <Button hint={`Zavrni zahtevek - ${oseba ? polnoIme(oseba) : ""}`} variant="danger" icon={X} onClick={onZavrni}>
              Zavrni
            </Button>
            <Button hint={`Potrdi zahtevek - ${oseba ? polnoIme(oseba) : ""}`} variant="success" icon={Check} onClick={onPotrdi}>
              Potrdi
            </Button>
          </>
        )}
        {spremenljiv && (
          <Button hint={z.status === "potrjeno" && !ekipa ? "Spremeni zahtevek - gre ponovno v potrditev" : "Spremeni zahtevek"} variant="primary" icon={PencilLine} onClick={() => onUredi(z)} className="!h-8 !px-3 !text-xs">
            Uredi
          </Button>
        )}
        {!ekipa && z.status === "oddano" && (
          <Button hint="Umakni zahtevek, ki še ni potrjen" variant="danger" icon={Undo2} onClick={onUmakni} className="!h-8 !px-3 !text-xs">
            Umakni
          </Button>
        )}
        {spremenljiv && z.status === "potrjeno" && (
          <Button hint={ekipa ? "Izbriši potrjen zahtevek podrejenega" : "Prosi vodjo za izbris potrjenega zahtevka"} variant="danger" icon={Trash2} onClick={() => onIzbrisi(z)} className="!h-8 !px-3 !text-xs">
            Izbriši
          </Button>
        )}
      </div>
    </div>
  );
}

/** Izbris potrjenega zahtevka: zaposleni prosi vodjo (zahtevek "izbris"), vodja za podrejenega izbriše takoj. Razlog obvezen. */
function Izbris({ z, j, onClose }: { z: Zahtevek | null; j: Jaz; onClose: () => void }) {
  const [razlog, setRazlog] = useState("");
  const [poskus, setPoskus] = useState(false);
  const zame = z?.id_zaposlenega === j.jaz.id;
  const potrdi = async () => {
    setPoskus(true);
    if (!z || !razlog.trim()) return;
    try {
      await oddajZahtevek(
        { vrsta: z.vrsta, id_zaposlenega: z.id_zaposlenega, datum_od: z.datum_od, datum_do: z.datum_do, cas_od: z.cas_od, cas_do: z.cas_do, id_statistike: z.id_statistike, tip_dovolilnice: z.tip_dovolilnice, opis: razlog.trim(), postavke: [], akcija: "izbris", id_prejsnji: z.id },
        j.jaz.id,
        !zame,
      );
      obvesti(zame ? "Prošnja za izbris je oddana - vodja jo bo potrdil." : `Izbrisano: ${imeOsebe(j, z.id_zaposlenega)}.`);
      setRazlog("");
      setPoskus(false);
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  return (
    <Modal
      open={!!z}
      title={zame ? "Izbriši zahtevek?" : "Izbriši zahtevek podrejenega?"}
      onClose={onClose}
      noga={
        <>
          <Button hint="Zapri brez izbrisa" variant="neutral" onClick={onClose}>
            Prekliči
          </Button>
          <Button hint={zame ? "Pošlji prošnjo za izbris vodji" : "Izbriši zahtevek"} variant="danger" icon={Trash2} onClick={potrdi}>
            {zame ? "Pošlji vodji" : "Izbriši"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-300">
          {zame ? "Zahtevek je že potrjen, zato ga mora izbris potrditi vodja. Do takrat zahtevek velja." : "Kot vodja zahtevek izbrišeš takoj - zaposleni bo videl razlog."}
        </p>
        <PoljeObrazca naslov="Zakaj?" obvezno napaka={poskus && !razlog.trim() ? "Napiši razlog." : undefined}>
          <textarea rows={3} autoFocus className={`${POLJE} h-auto py-2 text-base`} value={razlog} onChange={(e) => setRazlog(e.target.value)} placeholder="npr. dopust prestavljen" title="Razlog izbrisa" />
        </PoljeObrazca>
      </div>
    </Modal>
  );
}

/** Zavrnitev: razlog je obvezen (zaposleni ga vidi pri zahtevku). */
function Zavrni({ z, j, onClose }: { z: Zahtevek | null; j: Jaz; onClose: () => void }) {
  const [razlog, setRazlog] = useState("");
  const [poskus, setPoskus] = useState(false);
  const potrdi = async () => {
    setPoskus(true);
    if (!z || !razlog.trim()) return;
    try {
      await odlociZahtevek(z, "zavrnjeno", razlog, j.jaz.id);
      obvesti(`Zavrnjeno: ${imeOsebe(j, z.id_zaposlenega)}.`);
      setRazlog("");
      setPoskus(false);
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  return (
    <Modal
      open={!!z}
      title="Zavrni zahtevek"
      onClose={onClose}
      noga={
        <>
          <Button hint="Zapri brez zavrnitve" variant="neutral" onClick={onClose}>
            Prekliči
          </Button>
          <Button hint="Zavrni zahtevek z razlogom" variant="danger" icon={X} onClick={potrdi}>
            Zavrni
          </Button>
        </>
      }
    >
      <PoljeObrazca naslov="Zakaj zavračaš?" obvezno napaka={poskus && !razlog.trim() ? "Napiši razlog - zaposleni ga bo videl." : undefined}>
        <textarea rows={3} autoFocus className={`${POLJE} h-auto py-2 text-base`} value={razlog} onChange={(e) => setRazlog(e.target.value)} placeholder="npr. ta teden je premalo ljudi" title="Razlog zavrnitve" />
      </PoljeObrazca>
    </Modal>
  );
}
