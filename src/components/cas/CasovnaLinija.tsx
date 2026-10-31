"use client";

import { motion } from "motion/react";
import { ChevronsRight, Clock } from "lucide-react";
import { fmtCas, fmtTrajanje, type Segment } from "@/lib/cas";
import { IKONE_STATISTIK, type Statistika } from "@/lib/casNastavitve";
import { slogOdseka } from "./Skupno";

const DAN = 1440;
const pct = (min: number) => `${(Math.min(Math.max(min, 0), DAN) / DAN) * 100}%`;
/** Mreža ur: tanka črta vsako uro, močnejša vsake 3 ure. */
const MREZA =
  "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.11) 0 1px, transparent 1px calc(100% / 8)), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px calc(100% / 24))";

type Props = {
  segmenti: Segment[];
  statistike: Statistika[];
  /** Tedenski pogled: višja linija z oznakami ur. */
  velik?: boolean;
  /** Minute od polnoči (danes): oranžna črta "zdaj". */
  zdaj?: number | null;
  zamik?: number;
  /** Bled prikaz (prihodnji dan). */
  bledo?: boolean;
};

/** Časovna linija dneva 00:00-24:00: odseki v barvi statistike (celodnevne odsotnosti s poševnimi črtami). */
export function CasovnaLinija({ segmenti, statistike, velik, zdaj, zamik = 0, bledo }: Props) {
  const stat = (id: number) => statistike.find((s) => s.id === id);
  const oznake = velik ? oznakeCasov(segmenti) : [];

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${bledo ? "opacity-40" : ""}`}>
      <div className={`relative w-full overflow-hidden rounded-[6px] border border-white/[0.07] bg-white/[0.03] ${velik ? "h-9" : "h-[18px]"}`} style={{ backgroundImage: MREZA }}>
        {segmenti.filter((x) => x.od < DAN).map((x, i) => {
          const s = stat(x.id_statistike);
          const barva = s?.barva ?? "#6b6b72";
          const sirina = ((Math.min(x.do, DAN) - x.od) / DAN) * 100;
          const cez = x.do > DAN; // nadaljuje se naslednji dan (šteje v ta dan)
          const Ikona = IKONE_STATISTIK[s?.ikona ?? ""] ?? Clock;
          return (
            <motion.div
              key={`${x.od}-${i}`}
              title={`${fmtCas(x.od)} - ${x.odprt ? "zdaj" : fmtCas(x.do)} · ${s?.ime ?? "Neznana statistika"} · ${fmtTrajanje(x.do - x.od)}${x.celodnevno ? " (celodnevno)" : ""}${cez ? " · nadaljuje se naslednji dan, šteje v ta dan" : ""}`}
              className={`absolute inset-y-[2px] flex items-center justify-center overflow-hidden ${x.odprt ? "rounded-l-[4px]" : "rounded-[4px]"}`}
              style={{ left: pct(x.od), width: `max(${sirina}%, 3px)`, transformOrigin: "left", ...slogOdseka(barva, x.celodnevno) }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 140, damping: 22, delay: zamik + i * 0.05 }}
            >
              {x.celodnevno && sirina > 12 && <Ikona className={`text-snow drop-shadow ${velik ? "h-4 w-4" : "h-3 w-3"}`} aria-hidden />}
              {x.odprt && <span className="fos-deko absolute right-0 top-0 h-full w-1.5 animate-pulse bg-snow/70" />}
              {cez && <ChevronsRight className={`absolute right-0.5 text-snow drop-shadow ${velik ? "h-4 w-4" : "h-3 w-3"}`} aria-hidden />}
            </motion.div>
          );
        })}
        {zdaj != null && (
          <span
            aria-hidden
            title={`Zdaj ${fmtCas(zdaj)}`}
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-fines-400 shadow-[0_0_8px_1px_rgb(238_122_58/0.9)]"
            style={{ left: pct(zdaj) }}
          />
        )}
      </div>
      {velik && oznake.length > 0 && (
        <div className="relative h-3.5 text-[10px] font-semibold tabular-nums text-ink-400">
          {oznake.map((m) => (
            <span key={m} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(m) }}>
              {fmtCas(m)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Časi na robovih odsekov (brez prekrivanja - vsaj 70 min narazen). */
function oznakeCasov(segmenti: Segment[]) {
  const casi = [...new Set(segmenti.filter((s) => !s.celodnevno).flatMap((s) => (s.odprt ? [s.od] : [s.od, s.do])))].sort((a, b) => a - b);
  const out: number[] = [];
  for (const c of casi) if (c <= DAN && (!out.length || c - out[out.length - 1] >= 70)) out.push(c);
  return out;
}

/** Os ur nad koledarjem (poravnana s časovno linijo). */
export function OsUr() {
  return (
    <div className="relative h-4 text-[10px] font-semibold tabular-nums text-ink-500">
      {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
        <span key={h} className={`absolute ${h === 0 ? "" : h === 24 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${(h / 24) * 100}%` }}>
          {String(h).padStart(2, "0")}
        </span>
      ))}
    </div>
  );
}
