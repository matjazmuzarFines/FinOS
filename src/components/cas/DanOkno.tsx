"use client";

import { Bus, CalendarRange, Clock, LogIn, LogOut, Utensils } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { fmtCas, fmtTrajanje, izIso, MESECI, OZNAKE, VIRI, type DanIzracun } from "@/lib/cas";
import type { CasNastavitve, Interval, Urnik } from "@/lib/casNastavitve";
import { CasovnaLinija } from "./CasovnaLinija";
import { CipStatistike } from "./Skupno";

const DNEVI = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];

type Props = { d: DanIzracun | null; n: CasNastavitve; urnik: Urnik | null; interval: Interval | null; zdajMin: number; onClose: () => void };

/** Podrobnosti dneva: stanje, časovna linija, štempljanja, števci in oznake (klik na vrstico koledarja). */
export function DanOkno({ d, n, urnik, interval, zdajMin, onClose }: Props) {
  const naslov = d ? `${DNEVI[izIso(d.datum).getDay()]}, ${Number(d.datum.slice(8))}. ${MESECI[Number(d.datum.slice(5, 7)) - 1]} ${d.datum.slice(0, 4)}` : "";
  const stat = (id: number | null) => n.statistike.find((s) => s.id === id);

  return (
    <Modal
      open={!!d}
      title={naslov.charAt(0).toUpperCase() + naslov.slice(1)}
      onClose={onClose}
      noga={
        <Button hint="Zapri podrobnosti dneva" variant="neutral" onClick={onClose}>
          Zapri
        </Button>
      }
    >
      {d && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${d.stanje.barva} 18%, transparent)`, color: d.stanje.barva }}>
              <d.stanje.ikona className="h-6 w-6" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-lg font-bold" style={{ color: d.stanje.barva }}>
                {d.stanje.ime || "Dan še ni bil"}
              </span>
              <span className="text-sm text-ink-400">{d.praznik ? `${d.praznik} - dela prost dan.` : d.stanje.opis}</span>
            </span>
          </div>

          <CasovnaLinija segmenti={d.segmenti} statistike={n.statistike} velik zdaj={d.danes ? zdajMin : null} />

          <div className="grid grid-cols-3 gap-2">
            <Stevilka ikona={Clock} naslov="Delovni čas" vrednost={fmtTrajanje(d.delo, true)} />
            <Stevilka ikona={Utensils} naslov="Malice" vrednost={String(d.malice)} />
            <Stevilka ikona={Bus} naslov="Prevozi" vrednost={String(d.prevozi)} />
          </div>

          {urnik && (
            <p className="flex items-center gap-2 text-sm text-ink-300">
              <CalendarRange className="h-4 w-4 shrink-0 text-fines-300" aria-hidden />
              <span>
                Urnik <b className="text-white">{urnik.ime}</b>
                {interval ? (
                  <>
                    {" "}
                    · {interval.ime} (prihod {interval.cas_od} - {interval.cas_do})
                  </>
                ) : (
                  " · na ta dan ni intervala (prost dan)"
                )}
              </span>
            </p>
          )}

          <section className="flex flex-col gap-2">
            <NaslovRazdelka>Štempljanja</NaslovRazdelka>
            {d.podatki.odsotnost && (
              <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-ink-200">
                Celodnevna odsotnost <CipStatistike s={stat(d.podatki.odsotnost.id_statistike)} />
                <span className="text-ink-400">
                  {fmtCas(d.podatki.odsotnost.od)} - {fmtCas(d.podatki.odsotnost.do)}
                </span>
              </div>
            )}
            {d.podatki.zigi.length ? (
              <ul className="flex flex-col gap-1">
                {[...d.podatki.zigi]
                  .sort((a, b) => a.cas - b.cas)
                  .map((z, i) => (
                    <li key={i} className="grid grid-cols-[1.25rem_3.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm">
                      {z.smer === "prihod" ? <LogIn className="h-4 w-4 text-ok-500" aria-hidden /> : <LogOut className="h-4 w-4 text-ink-400" aria-hidden />}
                      <span className="font-display font-bold tabular-nums text-white">{fmtCas(z.cas)}</span>
                      <span className="flex min-w-0 flex-wrap items-center gap-2 text-ink-300">
                        {z.smer === "prihod" ? "Prihod" : z.id_statistike ? "Izhod" : "Odhod"}
                        {z.id_statistike != null && <CipStatistike s={stat(z.id_statistike)} />}
                      </span>
                      <span className="text-xs text-ink-500">{VIRI[z.vir]}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              !d.podatki.odsotnost && <p className="text-sm text-ink-500">Ni štempljanj.</p>
            )}
          </section>

          {d.podatki.oznake.length > 0 && (
            <section className="flex flex-col gap-2">
              <NaslovRazdelka>Oznake</NaslovRazdelka>
              {d.podatki.oznake.map((o, i) => {
                const O = OZNAKE[o.tip];
                return (
                  <p key={i} className="flex items-start gap-2 text-sm text-ink-200">
                    <O.ikona className="mt-0.5 h-4 w-4 shrink-0" style={{ color: O.barva }} aria-hidden />
                    {o.besedilo}
                  </p>
                );
              })}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stevilka({ ikona: I, naslov, vrednost }: { ikona: typeof Clock; naslov: string; vrednost: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-white/10 bg-white/[0.04] p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
        <I className="h-3.5 w-3.5 text-fines-300" aria-hidden />
        {naslov}
      </span>
      <span className="font-display text-xl font-bold tabular-nums text-white">{vrednost}</span>
    </div>
  );
}
