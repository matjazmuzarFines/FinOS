"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { CalendarRange, FileText, Gauge, PackageCheck, Trophy, Workflow, type LucideIcon } from "lucide-react";
import { Znak } from "@/components/Znak";
import { PREHOD_MS } from "@/lib/tvPredvajanje";
import { RAZPOLOZENJA, SVETI, TONI, utripOb, type Scena as ScenaT, type Svet } from "@/lib/tvScene";
import { UraSceni } from "./Ura";
import { SvetKoledar, SvetMerilnik, SvetPodij, SvetPot, SvetTrak, type SvetProps } from "./Sveti";

/**
 * Animirana scena FIN:TV (oder 1920 × 1080, stalne temne barve). Skupno vsem: levo zgoraj nadnaslov v barvi SVETA
 * (vsaka komponenta svoja barva), naslov (celica) in podnaslov; pike utripov in znak FIN:TV spodaj; sij v barvi
 * počutja ob Fineseku. Sredina = SVET komponente (Sveti.tsx) - vsaka komponenta svojo postavitev in animacijo.
 * Čas: `odmikMs` = koliko diapozitiva je že minilo (povezani zasloni usklajeni); scena se začne po prehodu.
 */

const IKONE: Record<string, LucideIcon> = {
  fp_delo_vceraj: Gauge,
  fp_zakljuceni_krovni: Trophy,
  fp_plan_workflow: Workflow,
  fp_plan_pregled: CalendarRange,
  fp_pripravljenost_mat: PackageCheck,
};

const SVET_KOMPONENTA: Record<Svet, (p: SvetProps) => React.ReactNode> = {
  merilnik: SvetMerilnik,
  podij: SvetPodij,
  trak: SvetTrak,
  pot: SvetPot,
  koledar: SvetKoledar,
};

/** Kje je Finesek (sij počutja v ozadju). */
const FOKUS: Record<Svet, string> = { merilnik: "40% 72%", podij: "28% 60%", trak: "50% 70%", pot: "50% 70%", koledar: "28% 55%" };

/**
 * Ozadje scene. Sij počutja: en element na barvo, menjava = prelivanje prosojnosti (CSS, grafična kartica) - prej se je
 * preliv barve računal v JavaScriptu in se je 1,2 s vsako sličico na novo narisal cel zaslon.
 */
function OzadjeSceni({ barvaSveta, barvaPocutja, barvePocutij, fokus }: { barvaSveta: string; barvaPocutja: string; barvePocutij: string[]; fokus: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,#2b2b2f,#121214_60%)]" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 45% at 8% 0%, ${barvaSveta}40, ${barvaSveta}00 70%)` }} />
      {barvePocutij.map((b) => (
        <div key={b} className="fos-tv-sij absolute inset-0" style={{ opacity: b === barvaPocutja ? 1 : 0, background: `radial-gradient(ellipse 50% 60% at ${fokus}, ${b}44, ${b}00 70%)` }} />
      ))}
      <div
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "96px 96px", maskImage: "radial-gradient(ellipse at 40% 50%, black, transparent 80%)" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-3" style={{ background: `linear-gradient(90deg, ${barvaSveta}, ${barvaSveta}80 60%, ${barvaSveta}00)` }} />
    </>
  );
}

type Props = {
  scena: ScenaT;
  /** koliko diapozitiva je že minilo (vključno s prehodom) */
  odmikMs?: number;
  /** sličica / predogled: prvi utrip, brez animacij */
  mirno?: boolean;
};

export function Scena({ scena, odmikMs = 0, mirno }: Props) {
  // ura scene: začetek ob prikazu, nato tiktaka sama (setInterval samo za menjavo utripa - gibanje teče v motion)
  const [zacetek] = useState(() => Date.now() - odmikMs);
  const [i, setI] = useState(() => (mirno ? 0 : utripOb(scena, odmikMs - PREHOD_MS)));
  useEffect(() => {
    if (mirno) return;
    const t = setInterval(() => setI(utripOb(scena, Date.now() - zacetek - PREHOD_MS)), 100);
    return () => clearInterval(t);
  }, [scena, zacetek, mirno]);

  const barvePocutij = useMemo(() => [...new Set(scena.utripi.map((x) => RAZPOLOZENJA[x.razpolozenje].barva))], [scena]);
  const u = scena.utripi[i] ?? scena.utripi[0];
  if (!u) return null;
  const { svet, barva } = SVETI[scena.komponenta] ?? { svet: "merilnik" as Svet, barva: "#ee7a3a" };
  const SvetX = SVET_KOMPONENTA[svet];
  const Ikona = IKONE[scena.komponenta] ?? FileText;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#121214] font-sans text-white">
      <OzadjeSceni barvaSveta={barva} barvaPocutja={RAZPOLOZENJA[u.razpolozenje].barva} barvePocutij={barvePocutij} fokus={FOKUS[svet]} />

      {/* naslov */}
      <motion.div
        className="absolute left-[110px] top-[70px] flex flex-col gap-3"
        initial={mirno ? false : { opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 16, delay: 0.2 }}
      >
        <span className="flex items-center gap-4 text-[30px] font-bold uppercase tracking-[0.16em]" style={{ color: barva }}>
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl text-white"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${barva} 60%, white), ${barva} 45%, color-mix(in srgb, ${barva} 55%, black))`, boxShadow: `0 10px 40px -8px ${barva}` }}
          >
            <Ikona className="h-8 w-8" strokeWidth={2} aria-hidden />
          </span>
          {scena.nadnaslov}
        </span>
        <h2 className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text pb-2 font-display text-[110px] font-bold leading-[1] tracking-[-0.03em] text-transparent">{scena.naslov}</h2>
        <span className="text-[38px] font-medium text-[#9a9aa1]">{scena.podnaslov}</span>
      </motion.div>

      {/* utripi (pike; pri poti so postaje) + znak */}
      {scena.utripi.length > 1 && svet !== "pot" && (
        <div className="absolute bottom-[56px] right-[330px] flex items-center gap-4">
          {scena.utripi.map((x, j) => (
            <motion.span
              key={x.kljuc + j}
              className="h-4 rounded-full"
              initial={false}
              animate={{ width: j === i ? 64 : 16, backgroundColor: j === i ? TONI[x.ton] : j < i ? "#6b6b72" : "#2f2f34" }}
              transition={{ duration: mirno ? 0 : 0.5 }}
            />
          ))}
        </div>
      )}
      <UraSceni />
      <div className="absolute bottom-[44px] right-[110px] opacity-60">
        <Znak pripona="TV" className="text-[40px]" />
      </div>

      {/* svet je narisan ZADNJI: v njem so animirani sloji (lebdenje, kamera) - kar bi bilo narisano za njimi, bi postalo svoj velik sloj */}
      <SvetX scena={scena} i={i} u={u} mirno={mirno} barva={barva} />
    </div>
  );
}
