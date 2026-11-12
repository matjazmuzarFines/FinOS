"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Tv } from "lucide-react";
import { Znak } from "@/components/Znak";
import type { Prehod, TvOkno, TvVir } from "@/lib/tv";
import { diapozitivi, polozaj, PREHOD_MS, type Diapozitiv as DiapozitivT } from "@/lib/tvPredvajanje";
import { Diapozitiv, Oder } from "./Diapozitiv";

const KRIVULJA = [0.22, 1, 0.36, 1] as const;
/** Prehod 2 s (pred naslovom in pred vsebino - skupaj z naslovom 8 s). */
const TRAJANJE = PREHOD_MS / 1000;

/** Prehodi (kot v PowerPointu). Izhod starega okna se ravna po prehodu NOVEGA (custom v AnimatePresence). */
const PREHODI: Variants = {
  vstop: (p: Prehod) =>
    ({
      brez: { opacity: 1 },
      pojemanje: { opacity: 0 },
      drsenje: { x: "100%" },
      povecava: { opacity: 0, scale: 1.14, filter: "blur(18px)" },
      zavesa: { clipPath: "inset(0 100% 0 0)" },
    })[p],
  zdaj: (p: Prehod) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    ...(p === "povecava" ? { filter: "blur(0px)" } : {}),
    ...(p === "zavesa" ? { clipPath: "inset(0 0% 0 0)" } : {}),
    transition: { duration: p === "brez" ? 0 : TRAJANJE, ease: KRIVULJA },
  }),
  izhod: (p: Prehod) =>
    ({
      brez: { opacity: 0, transition: { duration: 0 } },
      pojemanje: { opacity: 0, transition: { duration: TRAJANJE } },
      drsenje: { x: "-100%", transition: { duration: TRAJANJE, ease: KRIVULJA } },
      povecava: { opacity: 0, scale: 0.92, transition: { duration: TRAJANJE, ease: KRIVULJA } },
      // novo okno se odgrne čez staro - staro ostane, dokler ga zavesa ne pokrije
      // (izhod mora nekaj animirati, sicer se staro okno odstrani takoj - potemni)
      zavesa: { filter: "brightness(0.45)", transition: { duration: TRAJANJE, ease: KRIVULJA } },
    })[p],
};

type Props = {
  okna: TvOkno[];
  /** komponente (zadnje objave) za okna vrste "vir" */
  viri?: TvVir[];
  url: (pot: string) => string | undefined;
  /** popravek ure: čas strežnika - čas računalnika (ms) */
  odmikUre?: number;
  ustavljeno?: boolean;
  /** ob menjavi diapozitiva: kaj se vrti (za stanje v Administraciji) */
  onTrenutno?: (d: DiapozitivT, i: number, n: number) => void;
  className?: string;
};

/**
 * Predvajalnik FIN:TV: diapozitivi seznama po vrsti, položaj iz ure (povezani zasloni usklajeni), prehodi.
 * Okno, katerega datoteke še niso naložene, se preskoči.
 */
export function Predvajalnik({ okna, viri = [], url, odmikUre = 0, ustavljeno, onTrenutno, className = "" }: Props) {
  // ustavljeno = čas obstane (ob nadaljevanju skoči na usklajen položaj)
  const [cas, setCas] = useState(() => Date.now() + odmikUre);
  useEffect(() => {
    if (ustavljeno) return;
    const t = setInterval(() => setCas(Date.now() + odmikUre), 250);
    return () => clearInterval(t);
  }, [ustavljeno, odmikUre]);

  // velja od-do se preveri vsako minuto (seznam se ne računa ob vsakem tiku)
  const minuta = Math.floor(cas / 60_000);
  const seznam = useMemo(
    () => diapozitivi(okna, minuta * 60_000, viri).filter((d) => d.naslovna || d.okno.vrsta === "obvestilo" || !!url(d.stran ?? d.okno.datoteka ?? "")),
    [okna, minuta, url, viri],
  );
  const p = polozaj(seznam, cas);
  const d = p ? seznam[p.i] : undefined;
  // isti `prikaz` (deli iste pokončne strani) = isti element - stran zdrsne, brez prehoda
  const kljuc = d && p ? (seznam.length === 1 ? d.prikaz : `${d.prikaz}#${p.krog}`) : "prazno";

  // naslednji diapozitiv vnaprej (slika je v pomnilniku, ko pride na vrsto)
  useEffect(() => {
    if (!p || seznam.length < 2) return;
    const n = seznam[(p.i + 1) % seznam.length];
    const pot = n.stran ?? (n.okno.vrsta === "slika" || n.okno.vsebina.obvestilo?.priloga === "slika" ? n.okno.datoteka : null);
    const u = pot ? url(pot) : undefined;
    if (u) new Image().src = u;
  }, [kljuc]); // eslint-disable-line react-hooks/exhaustive-deps

  const javi = useRef(onTrenutno);
  useEffect(() => {
    javi.current = onTrenutno;
  });
  useEffect(() => {
    if (d && p) javi.current?.(d, p.i, seznam.length);
  }, [d?.kljuc, p?.krog]); // eslint-disable-line react-hooks/exhaustive-deps

  const prehod: Prehod = d?.okno.prehod ?? "pojemanje";
  return (
    <Oder className={className}>
      <AnimatePresence initial={false} custom={prehod}>
        {d && p ? (
          <motion.div key={kljuc} custom={prehod} variants={PREHODI} initial="vstop" animate="zdaj" exit="izhod" className="absolute inset-0" style={{ zIndex: p.krog * 1000 + p.i + 1 }}>
            <Diapozitiv d={d} url={url} vir={viri.find((v) => v.id === d.okno.id_vira)} odmikMs={p.odmikMs} zanka={seznam.length === 1} />
          </motion.div>
        ) : (
          <motion.div key="prazno" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
            <PrazenTv />
          </motion.div>
        )}
      </AnimatePresence>
    </Oder>
  );
}

/** Ni vsebine: znak FIN:TV na temnem ozadju. */
export function PrazenTv({ besedilo = "Ni vsebine za prikaz" }: { besedilo?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_top,#2b2b2f,#1c1c1f_45%,#121214)]">
      <div className="flex flex-col items-center gap-10">
        <Znak pripona="TV" className="text-[220px]" />
        <span className="flex items-center gap-5 text-[44px] font-semibold text-[#9a9aa1]">
          <Tv className="h-12 w-12" aria-hidden />
          {besedilo}
        </span>
      </div>
    </div>
  );
}
