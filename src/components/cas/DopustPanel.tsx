"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Sun, TreePalm, type LucideIcon } from "lucide-react";
import { POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { fmtDni, izDni, kljucLeta, shraniDopust, useDopust } from "@/lib/dopust";
import { Panel, TestniPodatki } from "./Skupno";

type Osnutek = { kljuc: string; dopust?: string; lanski?: string };

/** Poraba dopusta v letu (dnevi s koledarja) in dnevi v zahtevkih, ki še čakajo na potrditev. */
export type PorabaDopusta = { dopust: number; lanski: number; cakaDopust: number; cakaLanski: number };

/** Osnutek okna Dopust za osebo in leto (YYYY); SaveBar je na strani (RegistracijaCasa). */
export function useDopustOsnutek(idZaposlenega: number | null, leto: string) {
  const s = useDopust();
  const kljuc = idZaposlenega == null ? "" : kljucLeta(idZaposlenega, leto);
  const [o, setO] = useState<Osnutek>({ kljuc });
  const os: Osnutek = o.kljuc === kljuc ? o : { kljuc };
  const zapis = s.leta[kljuc];
  const vrednosti = { dopust: os.dopust ?? (zapis ? fmtDni(zapis.dopust_dni) : ""), lanski: os.lanski ?? (zapis ? fmtDni(zapis.lanski_dni) : "") };
  const dopust = izDni(vrednosti.dopust);
  const lanski = izDni(vrednosti.lanski);
  const napake: { dopust?: string; lanski?: string } = {};
  if (dopust == null) napake.dopust = "Npr. 25 ali 20,5.";
  if (lanski == null) napake.lanski = "Npr. 5 ali 2,5.";
  const sprememb = Number((os.dopust !== undefined && dopust !== (zapis?.dopust_dni ?? 0)) || (os.lanski !== undefined && lanski !== (zapis?.lanski_dni ?? 0)));
  const [shranjujem, setShranjujem] = useState(false);

  return {
    vir: s.vir,
    napakaBaze: s.napaka,
    zapis,
    vrednosti,
    napake,
    sprememb,
    shranjujem,
    nastavi: (p: Partial<Omit<Osnutek, "kljuc">>) => setO({ ...os, ...p, kljuc }),
    preklici: () => setO({ kljuc }),
    shrani: async () => {
      if (idZaposlenega == null || !sprememb) return;
      if (Object.keys(napake).length) return obvesti("Popravi označena polja dopusta.", "napaka");
      setShranjujem(true);
      try {
        await shraniDopust(idZaposlenega, leto, { dopust_dni: dopust ?? 0, lanski_dni: lanski ?? 0 });
        setO({ kljuc });
        obvesti("Dopust je shranjen.");
      } catch (e) {
        obvesti((e as Error).message, "napaka");
      } finally {
        setShranjujem(false);
      }
    },
  };
}
export type DopustOsnutek = ReturnType<typeof useDopustOsnutek>;

/**
 * Okno "Dopust {leto}" (pod Po statistikah): letni in lanski dopust - porabljeno / vse s trakom, ostane, čaka na potrditev.
 * Administracija vpiše "vse" (koliko dni ima zaposleni), ostali samo ogled.
 */
export function DopustPanel({ o, poraba, leto, urejanje }: { o: DopustOsnutek; poraba: PorabaDopusta; leto: string; urejanje: boolean }) {
  return (
    <Panel
      naslov={
        <span className="flex items-center gap-1.5">
          <TreePalm className="h-3.5 w-3.5" aria-hidden />
          Dopust {leto}
        </span>
      }
      desno={o.vir === "test" ? <TestniPodatki opis={`Dopusta v bazi še ni (zaženi migracijo 020): ${o.napakaBaze ?? ""}. Vpis velja samo v tem brskalniku do osvežitve.`} /> : undefined}
      className="!gap-2 !p-2.5 sm:!p-3"
    >
      <Vrsta
        ikona={TreePalm}
        naslov="Dopust"
        porabljeno={poraba.dopust}
        caka={poraba.cakaDopust}
        vse={o.vrednosti.dopust}
        stevilo={izDni(o.vrednosti.dopust)}
        napaka={o.napake.dopust}
        urejanje={urejanje}
        onChange={(v) => o.nastavi({ dopust: v })}
        hint={`Dnevi letnega dopusta za ${leto}`}
      />
      <Vrsta
        ikona={Sun}
        naslov="Lanski dopust"
        porabljeno={poraba.lanski}
        caka={poraba.cakaLanski}
        vse={o.vrednosti.lanski}
        stevilo={izDni(o.vrednosti.lanski)}
        napaka={o.napake.lanski}
        urejanje={urejanje}
        onChange={(v) => o.nastavi({ lanski: v })}
        hint={`Dnevi dopusta, prenesenega iz ${Number(leto) - 1}`}
      />
    </Panel>
  );
}

type VrstaProps = { ikona: LucideIcon; naslov: string; porabljeno: number; caka: number; vse: string; stevilo: number | null; napaka?: string; urejanje: boolean; onChange: (v: string) => void; hint: string };

function Vrsta({ ikona: I, naslov, porabljeno, caka, vse, stevilo, napaka, urejanje, onChange, hint }: VrstaProps) {
  const imaVse = vse.trim() !== "" && stevilo != null;
  const ostane = imaVse ? stevilo - porabljeno : null;
  const delez = imaVse && stevilo > 0 ? Math.min(porabljeno / stevilo, 1) : 0;
  const delezCaka = imaVse && stevilo > 0 ? Math.min(caka / stevilo, 1 - delez) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-200">
          <span className="fos-fines-fill grid h-5 w-5 place-items-center rounded-[6px] text-snow">
            <I className="h-3 w-3" aria-hidden />
          </span>
          {naslov}
        </span>
        <span className="flex items-baseline gap-1 font-display tabular-nums" title={`Porabljeno ${fmtDni(porabljeno)} od ${imaVse ? fmtDni(stevilo) : "?"} dni`}>
          <b className="text-base text-white">{fmtDni(porabljeno)}</b>
          <span className="text-xs text-ink-500">/</span>
          {urejanje ? (
            <input
              className={`${POLJE} !h-7 !w-12 !px-1 text-center text-sm font-bold ${napaka ? "!border-nok-500/70" : ""}`}
              value={vse}
              inputMode="decimal"
              placeholder="0"
              onChange={(e) => onChange(e.target.value)}
              title={`${hint} (npr. 25 ali 20,5)${napaka ? ` - ${napaka}` : ""}`}
            />
          ) : (
            <span className="text-sm font-bold text-ink-300">{imaVse ? fmtDni(stevilo) : "-"}</span>
          )}
          <span className="text-[11px] text-ink-500">dni</span>
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06] shadow-[inset_0_1px_2px_rgb(0_0_0/0.3)]">
        <motion.span className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#38bdf8,#0284c7)]" initial={{ width: 0 }} animate={{ width: `${delez * 100}%` }} transition={{ type: "spring", stiffness: 80, damping: 20 }} />
        <motion.span
          className="absolute inset-y-0 rounded-full bg-[repeating-linear-gradient(135deg,rgb(245_158_11/0.8)_0_3px,rgb(245_158_11/0.35)_3px_6px)]"
          initial={{ width: 0 }}
          animate={{ left: `${delez * 100}%`, width: `${delezCaka * 100}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>
      <span className="flex justify-between gap-2 text-[11px] text-ink-500">
        <span title="Dni, ki še niso porabljeni">{ostane == null ? "Ni vpisano" : <>Ostane <b className={ostane < 0 ? "text-nok-500" : "text-ink-200"}>{fmtDni(ostane)}</b></>}</span>
        {caka > 0 && (
          <span className="text-warn-500" title="Dni v oddanih zahtevkih, ki čakajo na potrditev">
            Čaka {fmtDni(caka)}
          </span>
        )}
      </span>
    </div>
  );
}
