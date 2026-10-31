"use client";

import { Fragment } from "react";
import { motion } from "motion/react";
import { Bus, LogIn, LogOut, Utensils } from "lucide-react";
import { danKratko, danVTednu, datumKratko, fmtCas, oznakaDneva, OZNAKE, type DanIzracun } from "@/lib/cas";
import type { Statistika } from "@/lib/casNastavitve";
import { CasovnaLinija, OsUr } from "./CasovnaLinija";

/**
 * Stolpci vrstice dneva. Računalnik: stanje | datum (dve vrstici) | časovna linija | stanje z besedo | oznake | malice in prevozi (eno pod drugim).
 * Telefon: zgoraj stanje, datum, beseda, oznake, števci - spodaj časovna linija čez celo širino.
 */
const MREZA =
  "grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 gap-y-1.5 [grid-template-areas:'i_d_s_o_c'_'t_t_t_t_t'] sm:grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_6.75rem_2.25rem_2rem] sm:gap-x-3 sm:[grid-template-areas:'i_d_t_s_o_c']";

type Props = { dnevi: DanIzracun[]; statistike: Statistika[]; velik: boolean; zdajMin: number; onOdpri: (d: DanIzracun) => void };

/** Koledar dni (mesec ali teden): vrstica za vsak dan, os ur zgoraj (lepljiva), tedni ločeni s tanko sivo črto. */
export function Koledar({ dnevi, statistike, velik, zdajMin, onOdpri }: Props) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className={`${MREZA} sticky top-[68px] z-10 -mx-1 hidden rounded-[10px] bg-ink-950/80 px-3 py-1.5 backdrop-blur-md sm:grid`}>
        <span className="[grid-area:i]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 [grid-area:d]">Dan</span>
        <span className="[grid-area:t]">
          <OsUr />
        </span>
        <span className="flex flex-col items-end text-ink-500 [grid-area:c]" title="Malice in prevozi">
          <Utensils className="h-3 w-3" aria-hidden />
          <Bus className="h-3 w-3" aria-hidden />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500 [grid-area:s]">Stanje</span>
        <span className="[grid-area:o]" />
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {dnevi.map((d, i) => (
          <Fragment key={d.datum}>
            {i > 0 && danVTednu(d.datum) === 1 && <li aria-hidden className="mx-1 my-1.5 h-px bg-[linear-gradient(90deg,transparent,rgb(154_154_161/0.35)_8%,rgb(154_154_161/0.35)_92%,transparent)]" />}
            <DanVrstica d={d} statistike={statistike} velik={velik} zdajMin={zdajMin} zamik={i * 0.018} onOdpri={onOdpri} />
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

function DanVrstica({ d, statistike, velik, zdajMin, zamik, onOdpri }: { d: DanIzracun; statistike: Statistika[]; velik: boolean; zdajMin: number; zamik: number; onOdpri: (d: DanIzracun) => void }) {
  const S = d.stanje.ikona;
  const stat = (id: number | null) => statistike.find((s) => s.id === id);
  const ozadje = d.danes
    ? "border-fines-400/60 bg-fines-500/[0.07] shadow-[0_0_24px_-10px_rgb(238_122_58/0.9)]"
    : d.prost
      ? "border-white/[0.04] bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.025)_0_6px,transparent_6px_12px)]"
      : "border-white/[0.06] bg-white/[0.035]";

  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 26, delay: zamik }}>
      <button
        type="button"
        onClick={() => onOdpri(d)}
        title={`Podrobnosti dneva ${oznakaDneva(d.datum)}`}
        className={`${MREZA} w-full rounded-[14px] border px-2.5 text-left transition-all duration-300 hover:border-fines-400/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fines-400 sm:px-3 ${velik ? "py-3" : "py-1.5"} ${ozadje}`}
      >
        {/* stanje z ikono */}
        <span
          title={d.stanje.ime || "Dan še ni bil"}
          className={`grid h-7 w-7 place-items-center rounded-full [grid-area:i] ${d.prihodnji ? "border border-dashed border-white/15 text-ink-600" : ""}`}
          style={d.prihodnji ? undefined : { background: `color-mix(in srgb, ${d.stanje.barva} 16%, transparent)`, color: d.stanje.barva, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${d.stanje.barva} 35%, transparent)` }}
        >
          <S className="h-3.5 w-3.5" aria-hidden />
        </span>

        {/* datum: dd.mm, pod njim dan (oranžen: danes / praznik) */}
        <span className="flex flex-col leading-none [grid-area:d]" title={d.praznik ? `${oznakaDneva(d.datum)} - ${d.praznik}` : oznakaDneva(d.datum)}>
          <span className={`font-display text-[13px] font-bold tabular-nums ${d.prost ? "text-ink-400" : "text-white"}`}>{datumKratko(d.datum)}</span>
          <span className={`mt-1 text-[10px] font-bold tracking-wider ${d.danes || d.praznik ? "text-fines-300" : "text-ink-500"}`}>{d.danes ? "DANES" : danKratko(d.datum)}</span>
        </span>

        {/* časovna linija (+ v tednu žigi) */}
        <span className="flex min-w-0 flex-col gap-2 [grid-area:t]">
          <CasovnaLinija segmenti={d.segmenti} statistike={statistike} velik={velik} zdaj={d.danes ? zdajMin : null} zamik={zamik + 0.1} bledo={d.prihodnji} />
          {velik && d.podatki.zigi.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {[...d.podatki.zigi]
                .sort((a, b) => a.cas - b.cas)
                .map((z, i) => {
                  const s = stat(z.id_statistike);
                  const Smer = z.smer === "prihod" ? LogIn : LogOut;
                  return (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-ink-200">
                      <Smer className={`h-3 w-3 ${z.smer === "prihod" ? "text-ok-500" : "text-ink-400"}`} aria-hidden />
                      <span className="tabular-nums">{fmtCas(z.cas)}</span>
                      {z.smer === "odhod" && s && (
                        <span className="flex items-center gap-1 text-ink-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.barva }} />
                          {s.ime}
                        </span>
                      )}
                      {z.vir !== "krmilnik" && <span className="text-[10px] text-ink-500">{z.vir === "online" ? "online" : "ročno"}</span>}
                    </span>
                  );
                })}
            </span>
          )}
        </span>

        {/* stanje z besedo */}
        <span className="min-w-0 [grid-area:s]">
          {d.stanje.ime && (
            <span title={d.stanje.opis} className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-semibold" style={{ color: d.stanje.barva }}>
              <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block" style={{ background: d.stanje.barva, boxShadow: `0 0 8px ${d.stanje.barva}` }} />
              <span className="truncate">{d.stanje.koda === "praznik" && d.praznik ? d.praznik : d.stanje.ime}</span>
            </span>
          )}
        </span>

        {/* prostor za dodatne ikone (popravki, komentarji, spremembe ...) */}
        <span className="flex items-center justify-end gap-1 [grid-area:o]">
          {d.podatki.oznake.map((o, i) => {
            const O = OZNAKE[o.tip];
            return (
              <span key={i} title={o.besedilo}>
                <O.ikona className="h-3.5 w-3.5" style={{ color: O.barva }} aria-label={o.besedilo} />
              </span>
            );
          })}
        </span>

        {/* malice in prevozi: čisto desno, eno pod drugim */}
        <span className="flex flex-col items-end gap-0.5 [grid-area:c]">
          <Stevec ikona={Utensils} stevilo={d.malice} hint={`Malice: ${d.malice}`} />
          <Stevec ikona={Bus} stevilo={d.prevozi} hint={`Prevozi: ${d.prevozi}`} />
        </span>
      </button>
    </motion.li>
  );
}

function Stevec({ ikona: I, stevilo, hint }: { ikona: typeof Bus; stevilo: number; hint: string }) {
  return (
    <span title={hint} className={`inline-flex items-center gap-0.5 text-xs font-bold tabular-nums ${stevilo ? "text-ink-100" : "text-ink-600"}`}>
      <I className={`h-3.5 w-3.5 ${stevilo ? "text-fines-300" : ""}`} aria-hidden />
      {stevilo}
    </span>
  );
}
