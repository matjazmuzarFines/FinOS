"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Bus, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { fmtSaldo, fmtTrajanje, type DanIzracun, type StanjeDneva } from "@/lib/cas";
import type { Statistika } from "@/lib/casNastavitve";
import { Panel } from "./Skupno";

/** Saldo za vrstice prenosa: prenos = stanje na začetku obdobja (null = ni začetnega stanja / obdobje je pred njim). */
export type SaldoObdobja = {
  prenos: number | null;
  /** "Prenos iz prejšnjega obdobja" ali "Začetno stanje" (če se začne v tem obdobju). */
  naziv: string;
  /** Zakaj prenosa ni (hover / besedilo). */
  brez?: string;
  /** Prenos v izplačilo (samo mesečni pogled), sicer null. */
  izplacilo: number | null;
  /** Dnevi pred tem datumom (pred začetnim stanjem) ne štejejo v saldo. */
  od: string | null;
};

type Props = { dnevi: DanIzracun[]; statistike: Statistika[]; obdobje: string; saldo: SaldoObdobja; zgoraj?: ReactNode };

/**
 * Povzetek obdobja (mesec / teden): na vrhu okno Saldo (zgoraj), opravljene ure proti obveznosti (urnik), saldo obdobja
 * (presežek, manjko), prenos iz prejšnjega obdobja -> izplačilo -> stanje na koncu, malice, prevozi, ure po statistikah,
 * dnevi po stanjih. Obveznost in saldo štejejo samo zaključeni dnevi (od začetnega stanja naprej).
 */
export function Povzetek({ dnevi, statistike, obdobje, saldo: sal, zgoraj }: Props) {
  const preteceni = dnevi.filter((d) => !d.prihodnji);
  const zakljuceni = dnevi.filter((d) => d.saldo != null && (!sal.od || d.datum >= sal.od));
  const konec = sal.prenos == null ? null : sal.prenos + zakljuceni.reduce((v, d) => v + d.saldo!, 0) - (sal.izplacilo ?? 0);
  const delo = zakljuceni.reduce((v, d) => v + d.delo, 0);
  const obveznost = zakljuceni.reduce((v, d) => v + (d.obveznost ?? 0), 0);
  const presezek = zakljuceni.reduce((v, d) => v + Math.max(0, d.saldo!), 0);
  const manjko = zakljuceni.reduce((v, d) => v + Math.max(0, -d.saldo!), 0);
  const saldo = presezek - manjko;
  const brezUrnika = preteceni.length > 0 && preteceni.every((d) => d.obveznost == null);
  const delez = obveznost ? Math.min(delo / obveznost, 1.25) : 0;

  const poStat = new Map<number, number>();
  for (const d of dnevi) for (const s of d.segmenti) poStat.set(s.id_statistike, (poStat.get(s.id_statistike) ?? 0) + s.do - s.od);
  const statistikeObdobja = [...poStat].map(([id, min]) => ({ s: statistike.find((x) => x.id === id), min })).sort((a, b) => b.min - a.min);
  const najvec = statistikeObdobja[0]?.min ?? 1;

  const poStanju = new Map<string, { st: StanjeDneva; n: number }>();
  for (const d of preteceni) {
    const k = d.stanje.koda === "na_delu" ? "prisoten" : d.stanje.koda;
    poStanju.set(k, { st: d.stanje, n: (poStanju.get(k)?.n ?? 0) + 1 });
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-[84px]">
      {zgoraj}
      <Panel naslov="Povzetek" desno={<span className="text-xs font-semibold capitalize text-ink-400">{obdobje}</span>} className={ZBITO}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-semibold text-ink-400">Opravljeno</span>
              <span className="font-display text-2xl font-bold tabular-nums text-white">{fmtTrajanje(delo, true)}</span>
            </span>
            <span className="text-right text-xs text-ink-400" title="Delovna obveznost zaključenih dni po urniku">
              od <b className="tabular-nums text-ink-200">{fmtTrajanje(obveznost, true)}</b> h{obveznost > 0 && !brezUrnika && <b className="ml-1.5 tabular-nums text-ink-200">{Math.round(delez * 100)} %</b>}
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06] shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)]">
            <motion.span
              className={`absolute inset-y-0 left-0 rounded-full ${delez >= 1 ? "bg-[linear-gradient(90deg,#4ade80,#16a34a)]" : "bg-[linear-gradient(90deg,#f19a66,#ca5010)]"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(delez, 1) * 100}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.2 }}
            />
          </div>
          {(brezUrnika || !obveznost) && <span className="text-xs text-ink-500">{brezUrnika ? "Zaposleni nima urnika - obveznosti in salda ni." : "V tem obdobju še ni zaključenih delovnih dni."}</span>}
        </div>
        {!brezUrnika && (
          <div className="grid grid-cols-3 gap-2">
            <Saldo ikona={TrendingUp} naslov="Presežek" vrednost={presezek ? `+${fmtTrajanje(presezek, true)}` : "0:00"} barva={presezek ? "text-ok-500" : "text-ink-500"} hint="Presežek ur zaključenih dni (gre v saldo)" />
            <Saldo ikona={TrendingDown} naslov="Manjko" vrednost={manjko ? `-${fmtTrajanje(manjko, true)}` : "0:00"} barva={manjko ? "text-nok-500" : "text-ink-500"} hint="Manjko ur zaključenih dni" />
            <Saldo naslov="Saldo" vrednost={fmtSaldo(saldo)} barva={saldo > 0 ? "text-ok-500" : saldo < 0 ? "text-nok-500" : "text-white"} hint="Saldo obdobja = presežek - manjko" poudarjen />
          </div>
        )}
        {!brezUrnika && (
          <dl className="flex flex-col gap-1 rounded-[12px] border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs">
            <Postavka naslov={sal.naziv} vrednost={sal.prenos} hint={sal.brez ?? "Saldo na začetku obdobja"} />
            <Postavka naslov="Saldo obdobja" vrednost={saldo} hint="Presežek - manjko zaključenih dni" />
            {sal.izplacilo != null && <Postavka naslov="Prenos v izplačilo" vrednost={-sal.izplacilo} hint="Ure, ki gredo ta mesec v izplačilo (okno Saldo)" />}
            <div className="my-0.5 h-px bg-[linear-gradient(90deg,rgb(238_122_58/0.5),transparent)]" />
            <Postavka naslov="Stanje na koncu obdobja" vrednost={konec} hint={sal.brez ?? "Prenos + saldo obdobja - izplačilo"} poudarjeno />
            {sal.brez && <p className="text-[11px] text-ink-500">{sal.brez}</p>}
          </dl>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Stevec ikona={Utensils} naslov="Malice" stevilo={dnevi.reduce((v, d) => v + d.malice, 0)} />
          <Stevec ikona={Bus} naslov="Prevozi" stevilo={dnevi.reduce((v, d) => v + d.prevozi, 0)} />
        </div>
      </Panel>

      <Panel naslov="Po statistikah" className={ZBITO}>
        {statistikeObdobja.length ? (
          <ul className="flex flex-col gap-1.5">
            {statistikeObdobja.map(({ s, min }, i) => (
              <li key={s?.id ?? i} className="flex flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-200">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s?.barva, boxShadow: `0 0 6px ${s?.barva}` }} />
                    <span className="truncate">{s?.ime ?? "Neznana"}</span>
                  </span>
                  <span className="tabular-nums text-ink-400">{fmtTrajanje(min, true)} h</span>
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${s?.barva} 70%, white), ${s?.barva})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(min / najvec) * 100}%` }}
                    transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.25 + i * 0.05 }}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-500">Ni štempljanj v tem obdobju.</p>
        )}
      </Panel>

      <Panel naslov="Dnevi" className={ZBITO}>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {[...poStanju.values()]
            .sort((a, b) => b.n - a.n)
            .map(({ st, n }) => (
              <li key={st.koda} className="flex items-center justify-between gap-2 text-xs" title={st.opis}>
                <span className="flex min-w-0 items-center gap-2 font-semibold" style={{ color: st.barva }}>
                  <st.ikona className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{st.koda === "na_delu" ? "Prisoten" : st.ime}</span>
                </span>
                <span className="font-bold tabular-nums text-ink-200">{n}</span>
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
}

/** Zbit panel v desnem stolpcu (manj odmika in razmika - čim manj višine). */
const ZBITO = "!gap-2 !p-2.5 sm:!p-3";

function Postavka({ naslov, vrednost, hint, poudarjeno }: { naslov: string; vrednost: number | null; hint: string; poudarjeno?: boolean }) {
  return (
    <div title={hint} className="flex items-baseline justify-between gap-2">
      <dt className={poudarjeno ? "font-bold text-white" : "font-semibold text-ink-400"}>{naslov}</dt>
      <dd
        className={`font-display font-bold tabular-nums ${poudarjeno ? "text-base" : ""} ${vrednost == null ? "text-ink-600" : vrednost > 0 ? "text-ok-500" : vrednost < 0 ? "text-nok-500" : "text-ink-200"}`}
      >
        {vrednost == null ? "-" : fmtSaldo(vrednost)}
      </dd>
    </div>
  );
}

function Saldo({ ikona: I, naslov, vrednost, barva, hint, poudarjen }: { ikona?: typeof Bus; naslov: string; vrednost: string; barva: string; hint: string; poudarjen?: boolean }) {
  return (
    <div title={hint} className={`flex flex-col rounded-[10px] border px-2 py-1 ${poudarjen ? "border-fines-400/40 bg-fines-500/[0.07]" : "border-white/10 bg-white/[0.04]"}`}>
      <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
        {I && <I className="h-3 w-3" aria-hidden />}
        {naslov}
      </span>
      <span className={`font-display text-sm font-bold tabular-nums ${barva}`}>{vrednost}</span>
    </div>
  );
}

function Stevec({ ikona: I, naslov, stevilo }: { ikona: typeof Bus; naslov: string; stevilo: number }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-2 py-1">
      <span className="fos-fines-fill grid h-6 w-6 shrink-0 place-items-center rounded-[8px] text-snow">
        <I className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="text-[11px] font-semibold text-ink-400">{naslov}</span>
      <span className="ml-auto font-display text-base font-bold tabular-nums text-white">{stevilo}</span>
    </div>
  );
}
