"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type TargetAndTransition } from "motion/react";
import { FileText, Gauge, PackageCheck, Trophy, Workflow, CalendarRange, type LucideIcon } from "lucide-react";
import { Znak } from "@/components/Znak";
import { PREHOD_MS } from "@/lib/tvPredvajanje";
import { RAZPOLOZENJA, TONI, ure, utripOb, type Razpolozenje, type Scena as ScenaT, type Utrip } from "@/lib/tvScene";
import { FinesekGlava } from "./FinesekGlava";

/**
 * Animirana scena FIN:TV (oder 1920 × 1080, stalne temne barve): levo zgoraj nadnaslov + naslov (celica), levo velika
 * glava Fineseka, desno EN podatek utripa (oznaka, glava, vrednost šteje navzgor, trak, stavek). Ob vsakem utripu
 * kamera približa glavo in se oddalji, Finesek se odzove po počutju (poskok / tresenje / ponos), podatek pripelje z desne.
 * Čas: `odmikMs` = koliko diapozitiva je že minilo (povezani zasloni usklajeni); scena se začne po prehodu.
 */

const IKONE: Record<string, LucideIcon> = {
  fp_delo_vceraj: Gauge,
  fp_zakljuceni_krovni: Trophy,
  fp_plan_workflow: Workflow,
  fp_plan_pregled: CalendarRange,
  fp_pripravljenost_mat: PackageCheck,
};

/** Odziv glave na začetku utripa (po zoomu). */
const ODZIV: Record<Razpolozenje, TargetAndTransition> = {
  navdusen: { y: [0, -110, 0, -55, 0, -20, 0], scaleY: [1, 1.06, 0.88, 1.04, 0.94, 1, 1], rotate: [0, -5, 5, -3, 3, 0, 0], transition: { duration: 1.8, delay: 0.7, ease: "easeOut" } },
  vesel: { y: [0, -60, 0, -22, 0], scaleY: [1, 1.04, 0.92, 1.02, 1], transition: { duration: 1.3, delay: 0.7, ease: "easeOut" } },
  zadovoljen: { y: [0, 12, 0, 8, 0], rotate: [0, 3, 0, -2, 0], transition: { duration: 1.4, delay: 0.7, ease: "easeInOut" } },
  zaskrbljen: { x: [0, -22, 22, -18, 18, -10, 10, 0], rotate: [0, -4, 4, -3, 3, -1, 1, 0], scale: [1, 0.97, 0.97, 0.97, 0.97, 0.98, 0.99, 1], transition: { duration: 1, delay: 0.8 } },
  ponosen: { scale: [1, 1.12, 1.06], rotate: [0, -6, 6, -3, 0], y: [0, -20, -10], transition: { duration: 1.8, delay: 0.7, ease: "easeInOut" } },
};

/** Ozadje: sij v barvi počutja levo (pod glavo), mreža, črta spodaj. */
function OzadjeSceni({ barva, mirno }: { barva: string; mirno?: boolean }) {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,#2b2b2f,#121214_60%)]" />
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ background: `radial-gradient(ellipse 55% 75% at 26% 62%, ${barva}55, ${barva}00 70%)` }}
        transition={{ duration: mirno ? 0 : 1.2 }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "96px 96px", maskImage: "radial-gradient(ellipse at 40% 50%, black, transparent 80%)" }}
      />
      <motion.div className="absolute inset-x-0 bottom-0 h-3" initial={false} animate={{ background: `linear-gradient(90deg, ${barva}, ${barva}80 60%, ${barva}00)` }} transition={{ duration: mirno ? 0 : 1.2 }} />
    </>
  );
}

/** Vrednost, ki šteje navzgor (7,6 / 28 h). */
function Vrednost({ v, barva, mirno }: { v: Utrip["vrednost"]; barva: string; mirno?: boolean }) {
  const st = useMotionValue(mirno ? v.st : 0);
  const besedilo = useTransform(st, (x) => ure(x));
  useEffect(() => {
    if (mirno) return;
    const a = animate(st, v.st, { duration: 1.4, delay: 1.3, ease: [0.22, 1, 0.36, 1] });
    return () => a.stop();
  }, [st, v.st, mirno]);
  return (
    <div className="flex items-baseline font-display font-bold leading-none tracking-[-0.03em]" style={{ color: barva, textShadow: `0 0 60px ${barva}66` }}>
      <span className="text-[150px]">
        {v.predpona}
        <motion.span>{besedilo}</motion.span>
      </span>
      {v.pripona && <span className="ml-3 text-[80px] opacity-80">{v.pripona.trim()}</span>}
    </div>
  );
}

function PodatekUtripa({ u, mirno }: { u: Utrip; mirno?: boolean }) {
  const barva = TONI[u.ton];
  const zamik = (s: number) => (mirno ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 18, delay: s });
  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-center gap-8"
      initial={mirno ? false : { opacity: 0, x: 160 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -80, transition: { duration: 0.5 } }}
      transition={zamik(0.9)}
    >
      <motion.span
        className="w-fit rounded-full px-9 py-3 text-[44px] font-bold uppercase tracking-[0.08em] text-white"
        style={{ background: `linear-gradient(135deg, ${barva}, color-mix(in srgb, ${barva} 60%, black))`, boxShadow: `0 20px 60px -15px ${barva}, inset 0 2px 0 rgb(255 255 255 / 0.3)` }}
        initial={mirno ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={zamik(1.1)}
      >
        {u.oznaka}
      </motion.span>
      <div>
        <div className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text pb-2 font-display text-[170px] font-bold leading-[0.95] tracking-[-0.04em] text-transparent">{u.glava}</div>
        {u.pod && <div className="mt-2 line-clamp-1 text-[44px] font-medium text-[#9a9aa1]">{u.pod}</div>}
      </div>
      <Vrednost v={u.vrednost} barva={barva} mirno={mirno} />
      {u.trak != null && (
        <div className="h-7 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${barva} 55%, black), ${barva})`, boxShadow: `0 0 30px ${barva}` }}
            initial={mirno ? false : { width: "0%" }}
            animate={{ width: `${Math.min(1, u.trak) * 100}%` }}
            transition={mirno ? { duration: 0 } : { duration: 1.4, delay: 1.3, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}
      <motion.p className="text-[52px] font-semibold leading-tight text-[#dcdcdf]" initial={mirno ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={zamik(2.2)}>
        {u.stavek}
      </motion.p>
    </motion.div>
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

  const u = scena.utripi[i] ?? scena.utripi[0];
  if (!u) return null;
  const barva = RAZPOLOZENJA[u.razpolozenje].barva;
  const Ikona = IKONE[scena.komponenta] ?? FileText;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#121214] font-sans text-white">
      <OzadjeSceni barva={barva} mirno={mirno} />

      {/* kamera: ob vsakem utripu približa glavo in se oddalji */}
      <motion.div
        key={mirno ? "mirno" : `kamera${i}`}
        className="absolute inset-0"
        style={{ transformOrigin: "27% 75%" }}
        initial={false}
        animate={mirno ? undefined : { scale: [1, 1.16, 1.16, 1] }}
        transition={{ duration: 1.9, times: [0, 0.35, 0.55, 1], ease: "easeInOut" }}
      >
        {/* glava levo */}
        <motion.div
          className="absolute left-[80px] top-[310px] w-[860px]"
          initial={mirno ? false : { opacity: 0, scale: 0.5, y: 120 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 14 }}
        >
          <motion.div animate={mirno ? undefined : { y: [0, -14, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}>
            <motion.div key={mirno ? "mirno" : `odziv${i}`} animate={mirno ? undefined : ODZIV[u.razpolozenje]} style={{ transformOrigin: "50% 85%" }}>
              <FinesekGlava razpolozenje={u.razpolozenje} pogledX={8} mirno={mirno} className="w-full" />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* naslov */}
      <motion.div
        className="absolute left-[110px] top-[70px] flex flex-col gap-3"
        initial={mirno ? false : { opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 16, delay: 0.2 }}
      >
        <span className="flex items-center gap-4 text-[30px] font-bold uppercase tracking-[0.16em] text-[#f19a66]">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#f19a66,#ee7a3a_35%,#ca5010_70%,#8f380b)] text-white shadow-[0_10px_40px_-8px_#ee7a3a]">
            <Ikona className="h-8 w-8" strokeWidth={2} aria-hidden />
          </span>
          {scena.nadnaslov}
        </span>
        <h2 className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text pb-2 font-display text-[120px] font-bold leading-[1] tracking-[-0.03em] text-transparent">{scena.naslov}</h2>
        <span className="text-[40px] font-medium text-[#9a9aa1]">{scena.podnaslov}</span>
      </motion.div>

      {/* podatek desno */}
      <div className="absolute bottom-[130px] left-[1010px] right-[110px] top-[250px]">
        <AnimatePresence mode="wait" initial={false}>
          <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} />
        </AnimatePresence>
      </div>

      {/* utripi (pike) + znak */}
      {scena.utripi.length > 1 && (
        <div className="absolute bottom-[56px] left-[1010px] flex items-center gap-4">
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
      <div className="absolute bottom-[44px] right-[110px] opacity-60">
        <Znak pripona="TV" className="text-[40px]" />
      </div>
    </div>
  );
}
