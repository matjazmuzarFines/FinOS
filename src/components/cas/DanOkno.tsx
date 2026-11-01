"use client";

import { useState } from "react";
import { Bus, CalendarRange, Clock, EyeOff, LogIn, LogOut, Plus, Scale, Target, Utensils } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { fmtCas, fmtSaldo, fmtTrajanje, izCasa, izIso, MESECI, OZNAKE, VIRI, type DanIzracun } from "@/lib/cas";
import { dodajDogodek, spregledaj } from "@/lib/dogodki";
import type { ZigKnjizen } from "@/lib/knjizenje";
import { POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import type { CasNastavitve, Urnik } from "@/lib/casNastavitve";
import { CasovnaLinija } from "./CasovnaLinija";
import { CipStatistike } from "./Skupno";
import { Kvadratek, PoljeObrazca } from "./Polja";

const DNEVI = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];

type Props = {
  d: DanIzracun | null;
  n: CasNastavitve;
  urnik: Urnik | null;
  zdajMin: number;
  idZaposlenega: number | null;
  /** Ročni popravki (dodaj dogodek, spreglej) - samo Administracija. */
  urejanje: boolean;
  onClose: () => void;
};

/**
 * Podrobnosti dneva: stanje, časovna linija, delo / obveznost / saldo, štempljanja (knjižen in dejanski čas), oznake.
 * Ročni popravki: dogodka se ne briše ne ureja - "Spreglej" (izračun ga ne upošteva, prečrtan) in "Dodaj dogodek".
 */
export function DanOkno({ d, n, urnik, zdajMin, idZaposlenega, urejanje, onClose }: Props) {
  const interval = d?.interval ?? null;
  const naslov = d ? `${DNEVI[izIso(d.datum).getDay()]}, ${Number(d.datum.slice(8))}. ${MESECI[Number(d.datum.slice(5, 7)) - 1]} ${d.datum.slice(0, 4)}` : "";
  const stat = (id: number | null) => n.statistike.find((s) => s.id === id);
  const knjizeni = new Map((d?.zigi ?? []).map((z) => [z.id, z]));

  return (
    <Modal
      open={!!d}
      siroko
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
            <Stevilka ikona={Target} naslov="Obveznost" vrednost={d.obveznost == null ? "-" : fmtTrajanje(d.obveznost, true)} hint={d.obveznost == null ? "Zaposleni nima urnika" : "Delovna obveznost dneva po urniku"} />
            <Stevilka
              ikona={Scale}
              naslov="Dnevni saldo"
              vrednost={d.saldo == null ? "-" : fmtSaldo(d.saldo)}
              barva={d.saldo == null || d.saldo === 0 ? undefined : d.saldo > 0 ? "text-ok-500" : "text-nok-500"}
              hint={d.saldo == null ? (d.obveznost == null ? "Brez urnika ni salda" : "Dan še ni zaključen") : d.saldo > 0 ? "Presežek ur (v saldo)" : d.saldo < 0 ? "Manjko ur" : "Natanko obveznost"}
            />
            <Stevilka ikona={Utensils} naslov="Malice" vrednost={String(d.malice)} />
            <Stevilka ikona={Bus} naslov="Prevozi" vrednost={String(d.prevozi)} />
          </div>
          {d.nepriznano > 0 && (
            <p className="-mt-2 text-xs text-ink-400">
              Pravilo intervala ni priznalo <b className="text-ink-200">{fmtTrajanje(d.nepriznano, true)} h</b> presežka (knjižen odhod je zato prej).
            </p>
          )}
          {d.prekoraceno > 0 && (
            <p className="-mt-2 text-xs text-ink-400">
              Odseki s tipko so presegli dovoljeno trajanje za <b className="text-nok-500">{fmtTrajanje(d.prekoraceno, true)} h</b> - ta čas je v statistiki prekoračitve.
            </p>
          )}

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
                {d.podatki.zigi.map((dz) => {
                  const z = knjizeni.get(dz.id);
                  const s = stat(z?.odsek ?? null);
                  return (
                    <li
                      key={dz.id}
                      className={`grid grid-cols-[1.25rem_4.25rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-[12px] border px-3 py-2 text-sm ${dz.spregledan ? "border-white/[0.04] bg-transparent" : "border-white/[0.06] bg-white/[0.03]"}`}
                    >
                      {dz.spregledan ? <EyeOff className="h-4 w-4 text-ink-600" aria-hidden /> : z?.smer === "prihod" ? <LogIn className="h-4 w-4 text-ok-500" aria-hidden /> : <LogOut className="h-4 w-4 text-ink-400" aria-hidden />}
                      <span
                        className={`flex flex-col leading-tight ${dz.spregledan ? "line-through opacity-50" : ""}`}
                        title={z && z.knjizen !== z.cas ? `Dejanski čas ${fmtCas(z.cas)}, knjiženo ${fmtCas(z.knjizen)} (pravilo intervala)` : "Knjiženo po dejanskem času"}
                      >
                        <span className="font-display font-bold tabular-nums text-white">{fmtCas(z?.knjizen ?? dz.cas)}</span>
                        {z && z.knjizen !== z.cas && <span className="text-[10px] tabular-nums text-ink-500 line-through">{fmtCas(z.cas)}</span>}
                      </span>
                      <span className={`flex min-w-0 flex-col gap-0.5 ${dz.spregledan ? "line-through opacity-50" : ""}`}>
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-ink-300">
                          {dz.spregledan ? "Spregledan - ne šteje" : z ? `${VLOGA[z.vloga]}${z.interval ? ` · ${z.interval.ime}` : ""}` : ""}
                          {!dz.spregledan && s && <CipStatistike s={s} />}
                        </span>
                        {dz.komentar && <span className="text-xs italic text-ink-400">„{dz.komentar}“</span>}
                      </span>
                      <span className="text-xs text-ink-500">{VIRI[dz.vir]}</span>
                      {urejanje ? (
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-300" title={dz.spregledan ? "Dogodek se spet upošteva" : "Izračun dogodka ne upošteva (dogodek ostane, prečrtan)"}>
                          <Kvadratek vklop={!!dz.spregledan} hint="Spreglej dogodek" onChange={(v) => idZaposlenega != null && spregledaj(idZaposlenega, dz.id, v).catch((e: Error) => obvesti(e.message, "napaka"))} />
                          Spreglej
                        </label>
                      ) : (
                        <span />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              !d.podatki.odsotnost && <p className="text-sm text-ink-500">Ni štempljanj.</p>
            )}
            {urejanje && idZaposlenega != null && <DodajDogodek key={d.datum} datum={d.datum} idZaposlenega={idZaposlenega} n={n} />}
          </section>

          {d.oznake.length > 0 && (
            <section className="flex flex-col gap-2">
              <NaslovRazdelka>Oznake</NaslovRazdelka>
              {d.oznake.map((o, i) => {
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

const VLOGA: Record<ZigKnjizen["vloga"], string> = { prihod: "Prihod", izhod: "Izhod", tipka: "Tipka", povratek: "Povratek" };
const CAS = /^\d{2}:\d{2}$/;

/** Ročni dogodek: datum, čas, tipka (brez = prihod / izhod po smeri), komentar. Vir = ročni popravek. */
function DodajDogodek({ datum, idZaposlenega, n }: { datum: string; idZaposlenega: number; n: CasNastavitve }) {
  const [dan, setDan] = useState(datum);
  const [cas, setCas] = useState("");
  const [tipka, setTipka] = useState<number | null>(null);
  const [komentar, setKomentar] = useState("");
  const [poskus, setPoskus] = useState(false);
  const napaka = !dan ? "Izberi datum." : !CAS.test(cas) ? "Vpiši čas dogodka." : null;
  const tipke = n.tipke.filter((t) => t.visible && !t.funkcija).sort((a, b) => a.tipka - b.tipka);

  const [shranjujem, setShranjujem] = useState(false);
  const dodaj = async () => {
    setPoskus(true);
    if (napaka) return;
    setShranjujem(true);
    try {
      await dodajDogodek({ idZaposlenega, datum: dan, cas: izCasa(cas), idTipke: tipka, komentar });
      obvesti(`Dogodek ${cas} je dodan${dan !== datum ? ` na ${dan.split("-").reverse().join(".")}` : ""}.`);
      setCas("");
      setKomentar("");
      setTipka(null);
      setPoskus(false);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[14px] border border-dashed border-ok-500/40 bg-ok-500/[0.04] p-3">
      <span className="flex items-center gap-2 text-sm font-bold text-white">
        <Plus className="h-4 w-4 text-ok-500" aria-hidden />
        Dodaj dogodek
        <span className="text-[11px] font-normal text-ink-500">ročni popravek - smer določi zaporedje dogodkov</span>
      </span>
      <div className="grid gap-2 sm:grid-cols-[9.5rem_6.5rem_minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
        <PoljeObrazca naslov="Datum" obvezno>
          <input type="date" className={`${POLJE} tabular-nums`} value={dan} onChange={(e) => setDan(e.target.value)} title="Datum dogodka" />
        </PoljeObrazca>
        <PoljeObrazca naslov="Čas" obvezno>
          <input type="time" className={`${POLJE} tabular-nums ${poskus && !CAS.test(cas) ? "!border-nok-500/70" : ""}`} value={cas} onChange={(e) => setCas(e.target.value)} title="Čas dogodka" />
        </PoljeObrazca>
        <PoljeObrazca naslov="Tipka">
          <select value={tipka ?? ""} onChange={(e) => setTipka(e.target.value ? Number(e.target.value) : null)} title="Tipka dogodka" className={`${POLJE} cursor-pointer [&>option]:bg-ink-900`}>
            <option value="">Brez tipke (prihod / izhod)</option>
            {tipke.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tipka} - {t.besedilo}
              </option>
            ))}
          </select>
        </PoljeObrazca>
        <PoljeObrazca naslov="Komentar">
          <input className={POLJE} value={komentar} onChange={(e) => setKomentar(e.target.value)} placeholder="npr. pozabil štempljati" title="Komentar ročnega popravka" />
        </PoljeObrazca>
        <Button hint="Dodaj ročni dogodek" variant="success" icon={Plus} onClick={dodaj} disabled={shranjujem}>
          Dodaj
        </Button>
      </div>
      {poskus && napaka && <p className="text-xs text-nok-500">{napaka}</p>}
    </div>
  );
}

function Stevilka({ ikona: I, naslov, vrednost, barva = "text-white", hint }: { ikona: typeof Clock; naslov: string; vrednost: string; barva?: string; hint?: string }) {
  return (
    <div title={hint} className="flex flex-col gap-1 rounded-[14px] border border-white/10 bg-white/[0.04] p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
        <I className="h-3.5 w-3.5 text-fines-300" aria-hidden />
        {naslov}
      </span>
      <span className={`font-display text-xl font-bold tabular-nums ${barva}`}>{vrednost}</span>
    </div>
  );
}
