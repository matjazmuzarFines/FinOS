"use client";

import { motion } from "motion/react";
import { Bus, Utensils } from "lucide-react";
import { fmtTrajanje, type DanIzracun, type StanjeDneva } from "@/lib/cas";
import type { Statistika } from "@/lib/casNastavitve";
import { Panel } from "./Skupno";

type Props = { dnevi: DanIzracun[]; statistike: Statistika[]; obdobje: string };

/** Povzetek obdobja (mesec / teden): opravljene ure proti obveznosti, malice, prevozi, ure po statistikah, dnevi po stanjih. */
export function Povzetek({ dnevi, statistike, obdobje }: Props) {
  const preteceni = dnevi.filter((d) => !d.prihodnji);
  const delo = dnevi.reduce((v, d) => v + d.delo, 0);
  // testna obveznost: 8 h na pretečen delovni dan (kasneje iz urnika in pogodbe)
  const obveznost = preteceni.filter((d) => !d.prost).length * 480;
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
    <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-[84px]">
      <Panel naslov="Povzetek" desno={<span className="text-xs font-semibold capitalize text-ink-400">{obdobje}</span>}>
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <span className="flex flex-col">
              <span className="text-[11px] font-semibold text-ink-400">Opravljeno</span>
              <span className="font-display text-3xl font-bold tabular-nums text-white">{fmtTrajanje(delo, true)}</span>
            </span>
            <span className="text-right text-xs text-ink-400" title="Testno: 8 h na vsak pretečen delovni dan">
              od <b className="tabular-nums text-ink-200">{fmtTrajanje(obveznost, true)}</b> h
            </span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.06] shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)]">
            <motion.span
              className={`absolute inset-y-0 left-0 rounded-full ${delez >= 1 ? "bg-[linear-gradient(90deg,#4ade80,#16a34a)]" : "bg-[linear-gradient(90deg,#f19a66,#ca5010)]"}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(delez, 1) * 100}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.2 }}
            />
          </div>
          <span className="text-xs text-ink-500">
            {obveznost ? `${Math.round(delez * 100)} % obveznosti do danes` : "V tem obdobju še ni delovnih dni."}
            {delo - obveznost !== 0 && obveznost > 0 && (
              <b className={`ml-1 ${delo >= obveznost ? "text-ok-500" : "text-nok-500"}`}>
                ({delo >= obveznost ? "+" : "-"}
                {fmtTrajanje(Math.abs(delo - obveznost), true)})
              </b>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stevec ikona={Utensils} naslov="Malice" stevilo={dnevi.reduce((v, d) => v + d.malice, 0)} />
          <Stevec ikona={Bus} naslov="Prevozi" stevilo={dnevi.reduce((v, d) => v + d.prevozi, 0)} />
        </div>
      </Panel>

      <Panel naslov="Po statistikah">
        {statistikeObdobja.length ? (
          <ul className="flex flex-col gap-2">
            {statistikeObdobja.map(({ s, min }, i) => (
              <li key={s?.id ?? i} className="flex flex-col gap-1">
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink-200">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s?.barva, boxShadow: `0 0 6px ${s?.barva}` }} />
                    <span className="truncate">{s?.ime ?? "Neznana"}</span>
                  </span>
                  <span className="tabular-nums text-ink-400">{fmtTrajanje(min, true)} h</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
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

      <Panel naslov="Dnevi">
        <ul className="flex flex-col gap-1.5">
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

function Stevec({ ikona: I, naslov, stevilo }: { ikona: typeof Bus; naslov: string; stevilo: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] p-2.5">
      <span className="fos-fines-fill grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-snow">
        <I className="h-4 w-4" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] font-semibold text-ink-400">{naslov}</span>
        <span className="font-display text-lg font-bold tabular-nums text-white">{stevilo}</span>
      </span>
    </div>
  );
}
