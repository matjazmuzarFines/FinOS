"use client";

import { useId, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { FlaskConical, LogIn, LogOut, Timer, TrendingUp, TriangleAlert } from "lucide-react";
import { NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { POLJE } from "@/components/ui/Polje";
import { fmtCas, fmtSaldo, fmtTrajanje, izCasa } from "@/lib/cas";
import type { CasNastavitve, IntervalVnos, PravilaIntervala, Zaokrozevanje } from "@/lib/casNastavitve";
import { knjiziKonec, knjiziZacetek, preizkusiIzhod, preizkusiPrihod, preizkusiTipko, vOknu, zaokrozi } from "@/lib/knjizenje";
import { IzbiraStatistike } from "./IntervalOkna";
import { PoljeObrazca } from "./Polja";
import { TestniPodatki } from "./Skupno";

const KORAKI = [5, 10, 15, 30, 60];
const ZAOKROZI: { id: Zaokrozevanje | null; ime: string }[] = [
  { id: null, ime: "Brez zaokroževanja" },
  { id: "gor", ime: "Navzgor" },
  { id: "dol", ime: "Navzdol" },
  { id: "najblizje", ime: "Najbližje" },
];

type Props = {
  vnos: IntervalVnos;
  n: CasNastavitve;
  napake: Partial<Record<keyof IntervalVnos, string>>;
  onSpremeni: (p: Partial<PravilaIntervala>) => void;
};

/**
 * Pravila knjiženja intervala (podrobnosti intervala), po vrsti: Prihod = Začetek izmene, Izhod = Konec izmene in Presežek
 * nad obveznostjo, Tipka = Trajanje (seštej trajanje, prekoračitev v drugo statistiko). Spodaj Preizkus za to vrsto.
 * Krmilnik vedno zapiše dejanski čas - pravila določijo knjižen čas.
 */
export function PravilaKnjizenja({ vnos, n, napake, onSpremeni }: Props) {
  const okno = `${vnos.cas_od}-${vnos.cas_do}`;
  const primerPrihod = vnos.zacetek_ne_prej && CAS.test(vnos.zacetek_ne_prej) ? fmtCas((izCasa(vnos.zacetek_ne_prej) - 8 + 1440) % 1440) : "06:22";
  const primerIzhod = vnos.konec_ne_pozneje && CAS.test(vnos.konec_ne_pozneje) ? fmtCas((izCasa(vnos.konec_ne_pozneje) + 6) % 1440) : "14:36";
  return (
    <section className="flex flex-col gap-3 border-t border-white/10 pt-4 2xl:border-t-0 2xl:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <NaslovRazdelka>Pravila knjiženja</NaslovRazdelka>
        {n.virPravil === "test" && <TestniPodatki opis={`Pravil v bazi še ni (zaženi migracijo 011): ${n.napakaPravil ?? ""}. Spremembe veljajo samo v tem brskalniku do osvežitve.`} />}
      </div>
      <KakoDeluje vnos={vnos} n={n} />

      {vnos.vrsta === "prihod" && (
        <Kartica ikona={LogIn} naslov="Začetek" opis={`Prihod v oknu ${okno} začne izmeno.`}>
          <Preklop
            value={vnos.zacetek_ne_prej == null ? "dejanski" : "meja"}
            moznosti={[
              { id: "dejanski", ime: "Dejanski čas", hint: "Knjiži se čas žiga" },
              { id: "meja", ime: "Ne prej kot", hint: "Zgodnejši prihod (v oknu) se knjiži ob tem času" },
            ]}
            onChange={(v) => onSpremeni({ zacetek_ne_prej: v === "meja" ? (vnos.zacetek_ne_prej ?? vnos.cas_do) : null })}
          />
          {vnos.zacetek_ne_prej != null && (
            <PoljeObrazca naslov="Ne prej kot" napaka={napake.zacetek_ne_prej} opis={`Prihod v oknu pred tem časom se knjiži ob tem času - npr. žig ${primerPrihod} -> knjiženo ${vnos.zacetek_ne_prej || "06:30"}.`}>
              <input type="time" className={`${POLJE} tabular-nums`} value={vnos.zacetek_ne_prej} onChange={(e) => onSpremeni({ zacetek_ne_prej: e.target.value })} title="Najzgodnejši knjižen prihod" />
            </PoljeObrazca>
          )}
          <Zaokrozevanje smer={vnos.zacetek_zaokrozi} korak={vnos.zacetek_korak} napaka={napake.zacetek_korak} onChange={(smer, korak) => onSpremeni({ zacetek_zaokrozi: smer, zacetek_korak: korak })} kaj="prihoda" />
        </Kartica>
      )}

      {vnos.vrsta === "izhod" && (
        <>
          <Kartica ikona={LogOut} naslov="Konec" opis={`Izhod brez tipke v oknu ${okno} konča izmeno.`}>
            <Preklop
              value={vnos.konec_ne_pozneje == null ? "dejanski" : "meja"}
              moznosti={[
                { id: "dejanski", ime: "Dejanski čas", hint: "Knjiži se čas žiga" },
                { id: "meja", ime: "Ne pozneje kot", hint: "Kasnejši izhod (v oknu) se knjiži ob tem času" },
              ]}
              onChange={(v) => onSpremeni({ konec_ne_pozneje: v === "meja" ? (vnos.konec_ne_pozneje ?? vnos.cas_od) : null })}
            />
            {vnos.konec_ne_pozneje != null && (
              <PoljeObrazca naslov="Ne pozneje kot" napaka={napake.konec_ne_pozneje} opis={`Izhod v oknu po tem času se knjiži ob tem času - npr. žig ${primerIzhod} -> knjiženo ${vnos.konec_ne_pozneje || "14:30"}.`}>
                <input type="time" className={`${POLJE} tabular-nums`} value={vnos.konec_ne_pozneje} onChange={(e) => onSpremeni({ konec_ne_pozneje: e.target.value })} title="Najpoznejši knjižen izhod" />
              </PoljeObrazca>
            )}
            <Zaokrozevanje smer={vnos.konec_zaokrozi} korak={vnos.konec_korak} napaka={napake.konec_korak} onChange={(smer, korak) => onSpremeni({ konec_zaokrozi: smer, konec_korak: korak })} kaj="izhoda" />
          </Kartica>

          <Kartica ikona={TrendingUp} naslov="Presežek nad obveznostjo" opis="Delo nad dnevno obveznostjo urnika gre v saldo.">
            <Preklop
              value={vnos.presezek}
              moznosti={[
                { id: "steje", ime: "Šteje ves", hint: "Ves presežek gre v saldo" },
                { id: "zaokrozi", ime: "Zaokroži", hint: "Presežek se zaokroži navzdol (npr. na 15 min)" },
                { id: "ne_steje", ime: "Ne šteje", hint: "Knjiži se največ obveznost, presežka ni" },
              ]}
              onChange={(v) => onSpremeni({ presezek: v as PravilaIntervala["presezek"] })}
            />
            {vnos.presezek === "zaokrozi" && (
              <PoljeObrazca naslov="Zaokroži navzdol na" napaka={napake.presezek_korak} opis="Do obveznosti se šteje dejanski čas, presežek se zaokroži navzdol.">
                <Korak value={vnos.presezek_korak} onChange={(presezek_korak) => onSpremeni({ presezek_korak })} hint="Korak zaokroževanja presežka" />
              </PoljeObrazca>
            )}
          </Kartica>
        </>
      )}

      {vnos.vrsta === "tipka" && (
        <Kartica ikona={Timer} naslov="Trajanje" opis="Vsi žigi s to tipko v dnevu se seštejejo.">
          <Preklop
            value={vnos.trajanje_max == null ? "brez" : "sestej"}
            moznosti={[
              { id: "brez", ime: "Brez omejitve", hint: "Ves čas gre v statistiko intervala" },
              { id: "sestej", ime: "Seštej trajanje", hint: "Do meje gre čas v statistiko intervala, več v statistiko prekoračitve" },
            ]}
            onChange={(v) => onSpremeni(v === "sestej" ? { trajanje_max: vnos.trajanje_max ?? 30 } : { trajanje_max: null, id_statistike_prekoracitve: null })}
          />
          {vnos.trajanje_max != null && (
            <>
              <PoljeObrazca naslov="Skupaj največ" napaka={napake.trajanje_max} opis="Na dan, vsi odseki skupaj (npr. 00:30 = 30 minut).">
                <input
                  type="time"
                  className={`${POLJE} tabular-nums`}
                  value={fmtCas(vnos.trajanje_max)}
                  onChange={(e) => onSpremeni({ trajanje_max: e.target.value ? izCasa(e.target.value) : 0 })}
                  title="Največje skupno trajanje na dan (ure:minute)"
                />
              </PoljeObrazca>
              <PoljeObrazca naslov="Štej prekoračitev intervala v" obvezno napaka={napake.id_statistike_prekoracitve} opis="Npr. Zamuda - če ne šteje v delovno obveznost, nastane manjko ur.">
                <IzbiraStatistike value={vnos.id_statistike_prekoracitve} onChange={(id) => onSpremeni({ id_statistike_prekoracitve: id })} statistike={n.statistike} hint="Statistika za čas nad trajanjem" />
              </PoljeObrazca>
            </>
          )}
        </Kartica>
      )}

      <Preizkus key={vnos.vrsta} vnos={vnos} />
    </section>
  );
}

type Pas = { od: number; do: number; tip: "napaka" | "meja" | "dejanski" };
const BARVA_PASU: Record<Pas["tip"], string> = {
  napaka: "repeating-linear-gradient(135deg, rgb(239 68 68 / 0.55) 0 4px, rgb(239 68 68 / 0.25) 4px 8px)",
  meja: "linear-gradient(180deg,#f19a66,#ca5010)",
  dejanski: "linear-gradient(180deg,#4ade80,#16a34a)",
};
const SMER: Record<Zaokrozevanje, string> = { gor: "navzgor", dol: "navzdol", najblizje: "na najbližjih" };

/**
 * Kako deluje interval: trak 00-24 (rdeče črtkano = napaka, oranžno = knjiži se ob meji, zeleno = dejanski čas) in
 * stavki iz trenutnih nastavitev. Opozorilo, ko "ne prej / ne pozneje kot" nima učinka (meja je izven okna).
 */
function KakoDeluje({ vnos, n }: { vnos: IntervalVnos; n: CasNastavitve }) {
  if (!CAS.test(vnos.cas_od) || !CAS.test(vnos.cas_do)) return null;
  const od = vnos.cas_od;
  const doo = vnos.cas_do;
  const celDan = od === "00:00" && doo >= "23:59";
  const ime = vnos.vrsta === "prihod" ? "Prihod" : vnos.vrsta === "izhod" ? "Izhod" : "Žig s tipko in vrnitev";
  const brezZaokr = { ...vnos, zacetek_zaokrozi: null, konec_zaokrozi: null };
  const tip = (t: number): Pas["tip"] => {
    if (!vOknu(t, vnos)) return "napaka";
    if (vnos.vrsta === "prihod" && knjiziZacetek(t, brezZaokr) !== t) return "meja";
    if (vnos.vrsta === "izhod" && knjiziKonec(t, 0, brezZaokr) !== t) return "meja";
    return "dejanski";
  };
  const pasovi: Pas[] = [];
  for (let t = 0; t < 1440; t++) {
    const x = tip(t);
    const zadnji = pasovi.at(-1);
    if (zadnji?.tip === x) zadnji.do = t + 1;
    else pasovi.push({ od: t, do: t + 1, tip: x });
  }
  const ucinek = pasovi.some((p) => p.tip === "meja");
  const meja = vnos.vrsta === "prihod" ? vnos.zacetek_ne_prej : vnos.vrsta === "izhod" ? vnos.konec_ne_pozneje : null;
  const zaokr = vnos.vrsta === "prihod" ? vnos.zacetek_zaokrozi : vnos.vrsta === "izhod" ? vnos.konec_zaokrozi : null;
  const korak = vnos.vrsta === "prihod" ? vnos.zacetek_korak : vnos.konec_korak;
  const stat = (id: number | null) => n.statistike.find((s) => s.id === id)?.ime ?? "izbrano statistiko";

  const stavki: ReactNode[] = [celDan ? `${ime}: v redu kadarkoli (okno ves dan).` : `${ime}: v redu med ${od} in ${doo}; prej ali pozneje je napaka in se knjiži dejanski čas.`];
  if (meja && ucinek) {
    const p = pasovi.find((x) => x.tip === "meja")!;
    stavki.push(`${vnos.vrsta === "prihod" ? "Prihod" : "Izhod"} med ${fmtCas(p.od)} in ${fmtCas(p.do % 1440)} se knjiži ob ${meja}.`);
  }
  if (zaokr) stavki.push(`Knjižen čas se zaokroži ${SMER[zaokr]} ${korak} min (npr. 06:13 -> ${fmtCas(zaokrozi(373, zaokr, korak))}).`);
  if (vnos.vrsta === "izhod")
    stavki.push(
      vnos.presezek === "steje"
        ? "Ves čas nad dnevno obveznostjo gre v saldo."
        : vnos.presezek === "zaokrozi"
          ? `Čas nad obveznostjo se zaokroži navzdol na ${vnos.presezek_korak} min (npr. 8:37 pri obveznosti 8:00 -> 8:${String(Math.floor(37 / vnos.presezek_korak) * vnos.presezek_korak).padStart(2, "0")}); knjižen odhod se premakne nazaj.`
          : "Čas nad obveznostjo se ne šteje - knjiži se največ obveznost.",
    );
  if (vnos.vrsta === "tipka")
    stavki.push(
      vnos.trajanje_max != null
        ? `Vsi odseki dneva skupaj do ${fmtCas(vnos.trajanje_max)} gredo v ${stat(vnos.id_statistike)}, kar je več, v ${stat(vnos.id_statistike_prekoracitve)}.`
        : `Ves čas od žiga s tipko do vrnitve gre v ${stat(vnos.id_statistike)}.`,
    );

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-white/10 bg-white/[0.03] p-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Kako deluje</span>
      <div className="flex h-4 overflow-hidden rounded-full border border-white/10" role="img" aria-label={`Trak dneva: ${pasovi.map((p) => `${fmtCas(p.od)}-${fmtCas(p.do % 1440)} ${p.tip}`).join(", ")}`}>
        {pasovi.map((p) => (
          <span
            key={p.od}
            style={{ width: `${((p.do - p.od) / 1440) * 100}%`, background: BARVA_PASU[p.tip] }}
            title={`${fmtCas(p.od)}-${fmtCas(p.do % 1440)}: ${p.tip === "napaka" ? "napaka, dejanski čas" : p.tip === "meja" ? `knjiži se ob ${meja}` : "dejanski čas"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] tabular-nums text-ink-500">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-400">
        <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: BARVA_PASU.dejanski }} />Dejanski čas</span>
        {ucinek && <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: BARVA_PASU.meja }} />Knjiži se ob {meja}</span>}
        {!celDan && <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm" style={{ background: BARVA_PASU.napaka }} />Napaka (izven okna)</span>}
      </div>
      <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-ink-300">
        {stavki.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      {meja && CAS.test(meja) && !ucinek && (
        <Napaka>
          »{vnos.vrsta === "prihod" ? "Ne prej kot" : "Ne pozneje kot"} {meja}« nima učinka: {vnos.vrsta === "prihod" ? `prihod pred ${od}` : `izhod po ${doo}`} je izven okna (napaka, dejanski čas).
          {vnos.vrsta === "prihod" ? ` Če naj se zgodnji prihod knjiži ob ${meja}, začni okno prej (npr. 00:00).` : ` Če naj se pozen izhod knjiži ob ${meja}, podaljšaj okno (npr. do 23:59).`}
        </Napaka>
      )}
    </div>
  );
}

function Kartica({ ikona: I, naslov, opis, children }: { ikona: typeof LogIn; naslov: string; opis: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start gap-2.5">
        <span className="fos-fines-fill grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-snow">
          <I className="h-4 w-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-bold text-white">{naslov}</span>
          <span className="text-[11px] text-ink-500">{opis}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

/** Preklop z drsečim oranžnim poljem (2-3 možnosti). */
export function Preklop({ value, moznosti, onChange }: { value: string; moznosti: { id: string; ime: string; hint: string }[]; onChange: (id: string) => void }) {
  const id = useId();
  return (
    <div role="radiogroup" className="flex rounded-full border border-white/10 bg-white/[0.04] p-1">
      {moznosti.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          title={m.hint}
          onClick={() => onChange(m.id)}
          className={`relative h-8 flex-1 rounded-full px-2 text-xs font-semibold transition-colors ${value === m.id ? "text-snow" : "text-ink-300 hover:text-white"}`}
        >
          {value === m.id && (
            <motion.span layoutId={`preklop-${id}`} className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_4px_14px_-6px_rgb(202_80_16/0.9)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span className="relative">{m.ime}</span>
        </button>
      ))}
    </div>
  );
}

function Korak({ value, onChange, hint }: { value: number; onChange: (v: number) => void; hint: string }) {
  const moznosti = KORAKI.includes(value) ? KORAKI : [...KORAKI, value].sort((a, b) => a - b);
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} title={hint} className={`${POLJE} cursor-pointer tabular-nums [&>option]:bg-ink-900`}>
      {moznosti.map((k) => (
        <option key={k} value={k}>
          {k} min
        </option>
      ))}
    </select>
  );
}

function Zaokrozevanje({ smer, korak, napaka, onChange, kaj }: { smer: Zaokrozevanje | null; korak: number; napaka?: string; onChange: (smer: Zaokrozevanje | null, korak: number) => void; kaj: string }) {
  return (
    <PoljeObrazca naslov="Zaokroževanje" napaka={napaka}>
      <div className={`grid gap-2 ${smer ? "grid-cols-[minmax(0,1fr)_6rem]" : ""}`}>
        <select
          value={smer ?? ""}
          onChange={(e) => onChange((e.target.value || null) as Zaokrozevanje | null, korak)}
          title={`Zaokroževanje knjiženega ${kaj}`}
          className={`${POLJE} cursor-pointer [&>option]:bg-ink-900`}
        >
          {ZAOKROZI.map((z) => (
            <option key={z.id ?? ""} value={z.id ?? ""}>
              {z.ime}
            </option>
          ))}
        </select>
        {smer && <Korak value={korak} onChange={(k) => onChange(smer, k)} hint={`Korak zaokroževanja ${kaj}`} />}
      </div>
    </PoljeObrazca>
  );
}

const CAS = /^\d{2}:\d{2}$/;
/** Čas po a (isti dan ali naslednji: izhod pred prihodom = čez polnoč). */
const po = (a: number, t: string) => (izCasa(t) < a ? izCasa(t) + 1440 : izCasa(t));

/** Preizkus pravil za vrsto intervala: vpiši čase - takoj vidiš knjižene čase in napake. */
function Preizkus({ vnos }: { vnos: IntervalVnos }) {
  const okno = CAS.test(vnos.cas_od) && CAS.test(vnos.cas_do);
  // ozko okno (npr. 00:00-06:30): 30 min pred koncem; široko (00:00-23:59): 07:00
  const dolzina = okno ? (izCasa(vnos.cas_do) - izCasa(vnos.cas_od) + 1440) % 1440 : 0;
  const ozko = okno && dolzina <= 600;
  const privzeto =
    vnos.vrsta === "prihod"
      ? ozko
        ? fmtCas(Math.max(izCasa(vnos.cas_od), (izCasa(vnos.cas_do) - 30 + 1440) % 1440))
        : "07:00"
      : vnos.vrsta === "izhod"
        ? ozko
          ? fmtCas((izCasa(vnos.cas_od) + 20) % 1440)
          : "15:30"
        : ozko
          ? fmtCas((izCasa(vnos.cas_od) + 5) % 1440)
          : "10:00";
  const [a, setA] = useState(vnos.vrsta === "izhod" ? "07:00" : privzeto);
  const [b, setB] = useState(vnos.vrsta === "izhod" ? privzeto : fmtCas((izCasa(privzeto) + 35) % 1440));
  const [obveznost, setObveznost] = useState("08:00");
  const veljavno = okno && CAS.test(a) && (vnos.vrsta === "prihod" || CAS.test(b)) && CAS.test(obveznost);
  const t = (naslov: string, v: string, set: (v: string) => void, hint: string) => (
    <PoljeObrazca naslov={naslov}>
      <input type="time" className={`${POLJE} px-2 tabular-nums`} value={v} onChange={(e) => set(e.target.value)} title={hint} />
    </PoljeObrazca>
  );

  let polja: ReactNode;
  let rezultat: ReactNode = null;
  if (vnos.vrsta === "prihod") {
    polja = t("Prihod", a, setA, "Dejanski čas prihoda (žig)");
    if (veljavno) {
      const r = preizkusiPrihod(izCasa(a), vnos);
      rezultat = (
        <>
          {!r.vOknu && <Napaka>Prihod ni v oknu {vnos.cas_od}-{vnos.cas_do} - knjiži se dejanski čas, izmena se šteje normalno.</Napaka>}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <Vrstica naslov="Knjižen prihod" vrednost={fmtCas(r.knjizen)} dejansko={r.knjizen !== izCasa(a) ? a : undefined} />
          </dl>
        </>
      );
    }
  } else if (vnos.vrsta === "izhod") {
    polja = (
      <>
        {t("Prihod", a, setA, "Dejanski čas prihoda (žig)")}
        {t("Odhod", b, setB, "Dejanski čas odhoda (žig)")}
        {t("Obveznost", obveznost, setObveznost, "Dnevna obveznost (ure:minute)")}
      </>
    );
    if (veljavno) {
      const o = po(izCasa(a), b);
      const r = preizkusiIzhod(izCasa(a), o, vnos, izCasa(obveznost));
      rezultat = (
        <>
          {!r.vOknu && <Napaka>Izhod ni v oknu {vnos.cas_od}-{vnos.cas_do} - knjiži se dejanski čas izhoda.</Napaka>}
          <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
            <Vrstica naslov="Knjižen odhod" vrednost={fmtCas(r.konec)} dejansko={r.konec !== o ? fmtCas(o) : undefined} />
            <Vrstica naslov="Delo" vrednost={fmtTrajanje(r.delo, true)} />
            <Vrstica naslov="Dnevni saldo" vrednost={fmtSaldo(r.saldo)} barva={r.saldo > 0 ? "text-ok-500" : r.saldo < 0 ? "text-nok-500" : undefined} />
          </dl>
          {r.nepriznano > 0 && <p className="text-[11px] text-ink-500">Nepriznan presežek: {fmtTrajanje(r.nepriznano, true)} h.</p>}
        </>
      );
    }
  } else {
    polja = (
      <>
        {t("Žig s tipko", a, setA, "Dejanski čas žiga s tipko (odhod)")}
        {t("Vrnitev", b, setB, "Dejanski čas vrnitve (naslednji žig)")}
      </>
    );
    if (veljavno) {
      const r = preizkusiTipko(izCasa(a), po(izCasa(a), b), vnos);
      rezultat = (
        <>
          {!r.odVOknu && <Napaka>Žig s tipko ni v oknu {vnos.cas_od}-{vnos.cas_do}.</Napaka>}
          {!r.doVOknu && <Napaka>Vrnitev ni v oknu {vnos.cas_od}-{vnos.cas_do}.</Napaka>}
          <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
            <Vrstica naslov="Trajanje" vrednost={fmtTrajanje(r.trajanje, true)} />
            <Vrstica naslov="V statistiki" vrednost={fmtTrajanje(r.vStatistiki, true)} />
            <Vrstica naslov="Prekoračitev" vrednost={fmtTrajanje(r.prekoraceno, true)} barva={r.prekoraceno > 0 ? "text-nok-500" : undefined} />
          </dl>
        </>
      );
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-dashed border-fines-400/40 bg-fines-500/[0.04] p-3">
      <span className="flex items-center gap-2 text-sm font-bold text-white">
        <FlaskConical className="h-4 w-4 text-fines-300" aria-hidden />
        Preizkus pravil
      </span>
      <div className={`grid gap-2 ${vnos.vrsta === "izhod" ? "grid-cols-3" : "grid-cols-2"}`}>{polja}</div>
      {rezultat ?? <p className="text-xs text-ink-500">Vpiši čase in okno intervala.</p>}
    </div>
  );
}

function Napaka({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs font-semibold text-nok-500">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Napaka: {children}</span>
    </p>
  );
}

function Vrstica({ naslov, vrednost, dejansko, barva = "text-white" }: { naslov: string; vrednost: string; dejansko?: string; barva?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{naslov}</dt>
      <dd className={`flex items-baseline gap-1.5 font-display text-base font-bold tabular-nums ${barva}`}>
        {vrednost}
        {dejansko && <span className="text-[11px] font-semibold text-ink-500 line-through" title="Dejanski čas žiga">{dejansko}</span>}
      </dd>
    </div>
  );
}
