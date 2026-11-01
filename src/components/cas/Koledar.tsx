"use client";

import { Fragment, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bus, ChevronRight, EyeOff, LogIn, LogOut, TriangleAlert, Utensils } from "lucide-react";
import { danKratko, danVTednu, datumKratko, fmtCas, fmtSaldo, fmtTrajanje, opisNapake, oznakaDneva, OZNAKE, VIRI, type DanIzracun } from "@/lib/cas";
import type { Statistika } from "@/lib/casNastavitve";
import type { ZigKnjizen } from "@/lib/knjizenje";
import { CasovnaLinija, OsUr } from "./CasovnaLinija";

/**
 * Stolpci vrstice dneva. Računalnik: stanje | datum (dve vrstici) | časovna linija | stanje z besedo + dnevni saldo | oznake | malice in prevozi (eno pod drugim).
 * Telefon: zgoraj stanje, datum, beseda, oznake, števci - spodaj časovna linija čez celo širino. Levo od vrstice puščica (razpis dogodkov).
 */
const MREZA =
  "grid grid-cols-[1.25rem_2.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 [grid-template-areas:'i_d_s_o_c'_'t_t_t_t_t'] sm:grid-cols-[1.25rem_2.25rem_minmax(0,1fr)_6rem_2rem_1.75rem] sm:gap-x-2.5 sm:[grid-template-areas:'i_d_t_s_o_c']";

type Props = { dnevi: DanIzracun[]; statistike: Statistika[]; velik: boolean; zdajMin: number; onOdpri: (d: DanIzracun) => void };

/**
 * Koledar dni (mesec ali teden): vrstica za vsak dan, os ur zgoraj (lepljiva), tedni ločeni s tanko sivo črto.
 * Puščica levo razpre dogodke dneva (interval, knjižen in dejanski čas, statistika); klik na vrstico odpre okno dneva.
 */
export function Koledar({ dnevi, statistike, velik, zdajMin, onOdpri }: Props) {
  const [razprti, setRazprti] = useState<ReadonlySet<string>>(new Set());
  const preklopi = (datum: string) =>
    setRazprti((r) => {
      const s = new Set(r);
      if (s.has(datum)) s.delete(datum);
      else s.add(datum);
      return s;
    });
  return (
    <div className="flex min-w-0 flex-col">
      <div className="sticky top-[68px] z-10 -mx-1 hidden items-center gap-1 rounded-[10px] bg-ink-950/80 px-2 py-1 backdrop-blur-md sm:flex">
        <button
          type="button"
          title={razprti.size ? "Zapri vse dneve" : "Razpri vse dneve z dogodki"}
          onClick={() => setRazprti(razprti.size ? new Set() : new Set(dnevi.filter((d) => d.podatki.zigi.length).map((d) => d.datum)))}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-ink-500 transition-colors hover:bg-white/[0.06] hover:text-fines-300"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${razprti.size ? "rotate-90" : ""}`} aria-hidden />
        </button>
        <div className={`${MREZA} min-w-0 flex-1 px-2`}>
          <span className="[grid-area:i]" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500 [grid-area:d]">Dan</span>
          <span className="[grid-area:t]">
            <OsUr />
          </span>
          <span className="flex flex-col items-end text-ink-500 [grid-area:c]" title="Malice in prevozi">
            <Utensils className="h-2.5 w-2.5" aria-hidden />
            <Bus className="h-2.5 w-2.5" aria-hidden />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500 [grid-area:s]">Stanje</span>
          <span className="[grid-area:o]" />
        </div>
      </div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {dnevi.map((d, i) => (
          <Fragment key={d.datum}>
            {i > 0 && danVTednu(d.datum) === 1 && <li aria-hidden className="mx-1 my-1 h-px bg-[linear-gradient(90deg,transparent,rgb(154_154_161/0.35)_8%,rgb(154_154_161/0.35)_92%,transparent)]" />}
            <DanVrstica d={d} statistike={statistike} velik={velik} zdajMin={zdajMin} zamik={i * 0.014} razprt={razprti.has(d.datum)} onRazpri={() => preklopi(d.datum)} onOdpri={onOdpri} />
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

type VrsticaProps = { d: DanIzracun; statistike: Statistika[]; velik: boolean; zdajMin: number; zamik: number; razprt: boolean; onRazpri: () => void; onOdpri: (d: DanIzracun) => void };

function DanVrstica({ d, statistike, velik, zdajMin, zamik, razprt, onRazpri, onOdpri }: VrsticaProps) {
  const S = d.stanje.ikona;
  const stat = (id: number | null) => statistike.find((s) => s.id === id);
  const ozadje = d.danes
    ? "border-fines-400/60 bg-fines-500/[0.07] shadow-[0_0_24px_-10px_rgb(238_122_58/0.9)]"
    : d.prost
      ? "border-white/[0.04] bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.025)_0_6px,transparent_6px_12px)]"
      : "border-white/[0.06] bg-white/[0.035]";
  const dogodkov = d.podatki.zigi.length;

  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26, delay: zamik }} className="flex flex-col">
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={onRazpri}
          disabled={!dogodkov && !d.podatki.odsotnost}
          aria-expanded={razprt}
          title={dogodkov ? `${razprt ? "Skrij" : "Pokaži"} dogodke dneva (${dogodkov})` : "Dan nima dogodkov"}
          className="grid w-5 shrink-0 place-items-center rounded-md text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-fines-300 disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink-400"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-300 ${razprt ? "rotate-90 text-fines-300" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onOdpri(d)}
          title={`Podrobnosti in urejanje dneva ${oznakaDneva(d.datum)}`}
          className={`${MREZA} min-w-0 flex-1 rounded-[10px] border px-2 text-left transition-all duration-300 hover:border-fines-400/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fines-400 ${velik ? "py-2" : "py-1"} ${ozadje} ${razprt ? "border-fines-400/30" : ""}`}
        >
          {/* stanje z ikono */}
          <span
            title={d.stanje.ime || "Dan še ni bil"}
            className={`grid h-5 w-5 place-items-center rounded-full [grid-area:i] ${d.prihodnji ? "border border-dashed border-white/15 text-ink-600" : ""}`}
            style={d.prihodnji ? undefined : { background: `color-mix(in srgb, ${d.stanje.barva} 16%, transparent)`, color: d.stanje.barva, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${d.stanje.barva} 35%, transparent)` }}
          >
            <S className="h-3 w-3" aria-hidden />
          </span>

          {/* datum: dd.mm, pod njim dan (oranžen: danes / praznik) */}
          <span className="flex flex-col leading-none [grid-area:d]" title={d.praznik ? `${oznakaDneva(d.datum)} - ${d.praznik}` : oznakaDneva(d.datum)}>
            <span className={`font-display text-[11px] font-bold tabular-nums ${d.prost ? "text-ink-400" : "text-white"}`}>{datumKratko(d.datum)}</span>
            <span className={`mt-0.5 text-[8.5px] font-bold tracking-wider ${d.danes || d.praznik ? "text-fines-300" : "text-ink-500"}`}>{d.danes ? "DANES" : danKratko(d.datum)}</span>
          </span>

          {/* časovna linija (+ v tednu žigi) */}
          <span className="flex min-w-0 flex-col gap-1.5 [grid-area:t]">
            <CasovnaLinija segmenti={d.segmenti} statistike={statistike} velik={velik} zdaj={d.danes ? zdajMin : null} zamik={zamik + 0.1} bledo={d.prihodnji} />
            {velik && d.zigi.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {d.zigi.map((z) => {
                  const s = stat(z.id_statistike);
                  const Smer = z.smer === "prihod" ? LogIn : LogOut;
                  return (
                    <span
                      key={z.id}
                      title={z.knjizen !== z.cas ? `Dejanski čas ${fmtCas(z.cas)}, knjiženo ${fmtCas(z.knjizen)}` : undefined}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-px text-[10px] font-semibold text-ink-200"
                    >
                      <Smer className={`h-2.5 w-2.5 ${z.smer === "prihod" ? "text-ok-500" : "text-ink-400"}`} aria-hidden />
                      <span className="tabular-nums">{fmtCas(z.knjizen)}</span>
                      {z.knjizen !== z.cas && <span className="tabular-nums text-[9px] text-ink-500 line-through">{fmtCas(z.cas)}</span>}
                      {z.smer === "odhod" && s && (
                        <span className="flex items-center gap-1 text-ink-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.barva }} />
                          {s.ime}
                        </span>
                      )}
                      {(z.vir === "online" || z.vir === "rocno") && <span className="text-[9px] text-ink-500">{z.vir === "online" ? "online" : "ročno"}</span>}
                    </span>
                  );
                })}
              </span>
            )}
          </span>

          {/* stanje z besedo, pod njim dnevni saldo (presežek zeleno, manjko rdeče) */}
          <span className="flex min-w-0 flex-col [grid-area:s]">
            {d.stanje.ime && (
              <span title={d.stanje.opis} className="inline-flex max-w-full items-center gap-1 truncate text-[11px] font-semibold" style={{ color: d.stanje.barva }}>
                <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block" style={{ background: d.stanje.barva, boxShadow: `0 0 8px ${d.stanje.barva}` }} />
                <span className="truncate">{d.stanje.koda === "praznik" && d.praznik ? d.praznik : d.stanje.ime}</span>
              </span>
            )}
            {d.saldo != null && d.saldo !== 0 && (
              <span title={d.saldo > 0 ? "Dnevni saldo: presežek ur" : "Dnevni saldo: manjko ur"} className={`text-[9px] font-bold tabular-nums sm:pl-2.5 ${d.saldo > 0 ? "text-ok-500" : "text-nok-500"}`}>
                {fmtSaldo(d.saldo)}
              </span>
            )}
          </span>

          {/* prostor za dodatne ikone (popravki, komentarji, napake ...) */}
          <span className="flex items-center justify-end gap-0.5 [grid-area:o]">
            {d.oznake.map((o, i) => {
              const O = OZNAKE[o.tip];
              return (
                <span key={i} title={o.besedilo}>
                  <O.ikona className="h-3 w-3" style={{ color: O.barva }} aria-label={o.besedilo} />
                </span>
              );
            })}
          </span>

          {/* malice in prevozi: čisto desno, eno pod drugim */}
          <span className="flex flex-col items-end leading-none [grid-area:c]">
            <Stevec ikona={Utensils} stevilo={d.malice} hint={`Malice: ${d.malice}`} />
            <Stevec ikona={Bus} stevilo={d.prevozi} hint={`Prevozi: ${d.prevozi}`} />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {razprt && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="overflow-hidden pl-6">
            <Razpis d={d} statistike={statistike} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

const VLOGA: Record<ZigKnjizen["vloga"], string> = { prihod: "Prihod", izhod: "Izhod", tipka: "Tipka", povratek: "Povratek" };

/**
 * Razpis dogodkov dneva (pod vrstico): vsak dogodek v časovnem zaporedju - smer, knjižen čas (dejanski prečrtan),
 * vloga in interval, statistika odseka, ki se z njim začne, vir, komentar, napaka. Spregledan dogodek je prečrtan.
 * Spodaj upoštevani odseki po statistikah.
 */
function Razpis({ d, statistike }: { d: DanIzracun; statistike: Statistika[] }) {
  const stat = (id: number | null) => statistike.find((s) => s.id === id);
  const knjizeni = new Map(d.zigi.map((z) => [z.id, z]));
  return (
    <div className="mb-1 mt-0.5 flex flex-col gap-1 rounded-[10px] border border-white/[0.06] bg-ink-950/40 px-2.5 py-2">
      {d.podatki.odsotnost && (
        <p className="text-[11px] text-ink-300">
          Celodnevna odsotnost: <b style={{ color: stat(d.podatki.odsotnost.id_statistike)?.barva }}>{stat(d.podatki.odsotnost.id_statistike)?.ime}</b>
        </p>
      )}
      <ul className="flex flex-col gap-0.5">
        {d.podatki.zigi.map((dz) => {
          const z = knjizeni.get(dz.id);
          const s = stat(z?.odsek ?? null);
          const napake = z ? d.napake.filter((x) => x.cas === z.cas) : [];
          return (
            <li key={dz.id} className={`grid grid-cols-[0.875rem_5.5rem_minmax(0,1fr)_auto] items-center gap-2 text-[11px] ${dz.spregledan ? "text-ink-600 line-through" : "text-ink-200"}`}>
              {dz.spregledan ? <EyeOff className="h-3 w-3" aria-label="Spregledan" /> : z?.smer === "prihod" ? <LogIn className="h-3 w-3 text-ok-500" aria-hidden /> : <LogOut className="h-3 w-3 text-ink-400" aria-hidden />}
              <span className="flex items-baseline gap-1.5 tabular-nums">
                <b className="font-display text-xs text-white">{fmtCas(z?.knjizen ?? dz.cas)}</b>
                {z && z.knjizen !== z.cas && <span className="text-[10px] text-ink-500" title="Dejanski čas žiga">(dej. {fmtCas(z.cas)})</span>}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold">{dz.spregledan ? "Spregledan" : z ? VLOGA[z.vloga] : ""}</span>
                {z?.interval && <span className="font-mono text-[10px] text-ink-400 [overflow-wrap:anywhere]">{z.interval.ime}</span>}
                {!dz.spregledan && s && (
                  <span className="inline-flex items-center gap-1 text-ink-300">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.barva }} />
                    {s.ime}
                  </span>
                )}
                {dz.komentar && <span className="italic text-ink-400">„{dz.komentar}“</span>}
                {napake.map((x, i) => (
                  <span key={i} title={opisNapake(x)} className="inline-flex items-center text-nok-500">
                    <TriangleAlert className="h-3 w-3" aria-label={opisNapake(x)} />
                  </span>
                ))}
              </span>
              <span className="text-[10px] text-ink-500">{VIRI[dz.vir]}</span>
            </li>
          );
        })}
      </ul>
      {d.segmenti.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 border-t border-white/[0.06] pt-1.5">
          {d.segmenti.map((x, i) => {
            const st = stat(x.id_statistike);
            return (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-px text-[10px] text-ink-300" title={`${st?.ime}: ${fmtCas(x.od)}-${fmtCas(x.do)}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: st?.barva }} />
                {st?.koda}
                <span className="tabular-nums text-ink-500">
                  {fmtCas(x.od)}-{fmtCas(x.do)} · {fmtTrajanje(x.do - x.od, true)}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stevec({ ikona: I, stevilo, hint }: { ikona: typeof Bus; stevilo: number; hint: string }) {
  return (
    <span title={hint} className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${stevilo ? "text-ink-100" : "text-ink-600"}`}>
      <I className={`h-2.5 w-2.5 ${stevilo ? "text-fines-300" : ""}`} aria-hidden />
      {stevilo}
    </span>
  );
}
