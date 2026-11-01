"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { fmtSaldo, fmtTrajanje, izUr, kratekDatum, MESECI } from "@/lib/cas";
import { kljucMeseca, PRAZEN_MESEC, shraniSaldo, useSaldo } from "@/lib/saldo";
import { PoljeObrazca } from "./Polja";
import { Panel, TestniPodatki } from "./Skupno";

type Osnutek = { kljuc: string; zacSaldo?: string; zacDatum?: string; izplacilo?: string; zaznamki?: string };

/**
 * Osnutek okna Saldo za osebo in mesec (YYYY-MM-DD): začetno stanje (saldo pred FIN:OS + datum), prenos v izplačilo
 * in mesečni zaznamki. SaveBar je na strani (RegistracijaCasa), zato je stanje v kljuki.
 */
export function useSaldoOsnutek(idZaposlenega: number | null, mesec: string) {
  const s = useSaldo();
  const kljuc = idZaposlenega == null ? "" : kljucMeseca(idZaposlenega, mesec);
  const [o, setO] = useState<Osnutek>({ kljuc });
  const os: Osnutek = o.kljuc === kljuc ? o : { kljuc };
  const zac = idZaposlenega == null ? undefined : s.zacetna[idZaposlenega];
  const mes = s.meseci[kljuc] ?? PRAZEN_MESEC;

  const vrednosti = {
    zacSaldo: os.zacSaldo ?? (zac ? fmtSaldo(zac.saldo_min) : ""),
    zacDatum: os.zacDatum ?? zac?.datum ?? "",
    izplacilo: os.izplacilo ?? (mes.izplacilo_min ? fmtTrajanje(mes.izplacilo_min, true) : ""),
    zaznamki: os.zaznamki ?? mes.zaznamki,
  };
  const zacMin = izUr(vrednosti.zacSaldo, true);
  const izplMin = izUr(vrednosti.izplacilo, true);
  const napake: { zacSaldo?: string; zacDatum?: string; izplacilo?: string } = {};
  if (zacMin == null) napake.zacSaldo = "Npr. +12:30 ali -3:15.";
  if (vrednosti.zacSaldo.trim() && !vrednosti.zacDatum) napake.zacDatum = "Vpiši, od katerega dne velja.";
  if (izplMin == null || izplMin < 0) napake.izplacilo = "Npr. 5 ali 5:30.";

  const novoZacetno = vrednosti.zacDatum ? { saldo_min: zacMin ?? 0, datum: vrednosti.zacDatum } : null;
  const zacSpremenjeno = (os.zacSaldo !== undefined || os.zacDatum !== undefined) && JSON.stringify(novoZacetno) !== JSON.stringify(zac ?? null);
  const mesSpremenjen = (os.izplacilo !== undefined && izplMin !== mes.izplacilo_min) || (os.zaznamki !== undefined && os.zaznamki !== mes.zaznamki);
  const sprememb = Number(zacSpremenjeno) + Number(mesSpremenjen);
  const [shranjujem, setShranjujem] = useState(false);

  return {
    vir: s.vir,
    napakaBaze: s.napaka,
    vrednosti,
    napake,
    sprememb,
    shranjujem,
    nastavi: (p: Partial<Omit<Osnutek, "kljuc">>) => setO({ ...os, ...p, kljuc }),
    preklici: () => setO({ kljuc }),
    shrani: async () => {
      if (idZaposlenega == null) return;
      if (Object.keys(napake).length) return obvesti("Popravi označena polja salda.", "napaka");
      setShranjujem(true);
      try {
        await shraniSaldo(idZaposlenega, {
          zacetno: zacSpremenjeno ? novoZacetno : undefined,
          mesec: mesSpremenjen ? { mesec, podatki: { izplacilo_min: izplMin ?? 0, zaznamki: vrednosti.zaznamki } } : undefined,
        });
        setO({ kljuc });
        obvesti("Saldo je shranjen.");
      } catch (e) {
        obvesti((e as Error).message, "napaka");
      } finally {
        setShranjujem(false);
      }
    },
  };
}
export type SaldoOsnutek = ReturnType<typeof useSaldoOsnutek>;

/** Okno Saldo (desno zgoraj): začetno stanje, prenos v izplačilo in mesečni zaznamki za mesec. Brez urejanja = samo ogled. */
export function SaldoPanel({ o, mesec, urejanje }: { o: SaldoOsnutek; mesec: string; urejanje: boolean }) {
  const imeMes = MESECI[Number(mesec.slice(5, 7)) - 1];
  const v = o.vrednosti;
  return (
    <Panel
      naslov={
        <span className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          Saldo
        </span>
      }
      desno={o.vir === "test" ? <TestniPodatki opis={`Salda v bazi še ni (zaženi migracijo 012): ${o.napakaBaze ?? ""}. Spremembe veljajo samo v tem brskalniku do osvežitve.`} /> : undefined}
      className="!gap-2 !p-2.5 sm:!p-3"
    >
      {urejanje ? (
        <div className="flex flex-col gap-2">
          {/* začetno stanje (saldo + datum) in prenos v izplačilo v eni vrsti; pojasnila v hover tekstu */}
          <div className="grid grid-cols-[minmax(0,1fr)_4.75rem] gap-2">
            <PoljeObrazca naslov="Začetno stanje" napaka={o.napake.zacSaldo ?? o.napake.zacDatum}>
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-1.5">
                <input
                  className={`${POLJE} h-9 px-1.5 text-center font-display text-sm font-bold tabular-nums`}
                  value={v.zacSaldo}
                  placeholder="+0:00"
                  inputMode="decimal"
                  onChange={(e) => o.nastavi({ zacSaldo: e.target.value })}
                  title="Saldo ur pred začetkom FIN:OS (npr. +12:30 ali -3:15); od datuma naprej se štejejo dnevni saldi"
                />
                <input type="date" className={`${POLJE} h-9 px-1.5 text-xs`} value={v.zacDatum} onChange={(e) => o.nastavi({ zacDatum: e.target.value })} title="Od katerega dne velja začetno stanje" />
              </div>
            </PoljeObrazca>
            <PoljeObrazca naslov="Izplačilo" napaka={o.napake.izplacilo}>
              <input
                className={`${POLJE} h-9 px-1.5 text-center font-display text-sm font-bold tabular-nums`}
                value={v.izplacilo}
                placeholder="0:00"
                inputMode="decimal"
                onChange={(e) => o.nastavi({ izplacilo: e.target.value })}
                title={`Prenos v izplačilo · ${imeMes}: ure salda, ki gredo ta mesec v izplačilo (npr. 5 ali 5:30)`}
              />
            </PoljeObrazca>
          </div>
          <PoljeObrazca naslov={`Zaznamki · ${imeMes}`}>
            <textarea rows={2} className={`${POLJE} h-auto min-h-12 resize-y py-1.5 text-sm`} value={v.zaznamki} onChange={(e) => o.nastavi({ zaznamki: e.target.value })} title={`Mesečni zaznamki za ${imeMes}`} placeholder="Npr. dogovor o nadurah ..." />
          </PoljeObrazca>
        </div>
      ) : (
        <dl className="flex flex-col gap-2 text-xs">
          <Ogled naslov="Začetno stanje" vrednost={v.zacDatum ? `${v.zacSaldo} (od ${kratekDatum(v.zacDatum)})` : "Ni vpisano"} />
          <Ogled naslov={`Prenos v izplačilo · ${imeMes}`} vrednost={v.izplacilo || "0:00"} />
          {v.zaznamki && <Ogled naslov={`Zaznamki · ${imeMes}`} vrednost={v.zaznamki} />}
        </dl>
      )}
    </Panel>
  );
}

function Ogled({ naslov, vrednost }: { naslov: string; vrednost: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-semibold text-ink-400">{naslov}</dt>
      <dd className="whitespace-pre-wrap text-ink-100">{vrednost}</dd>
    </div>
  );
}
