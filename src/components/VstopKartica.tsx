"use client";

import { useRef, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Znak } from "./Znak";

type Props = {
  naslov: string;
  pripona: string;
  opis: string;
  hint: string;
  icon: LucideIcon;
  funkcije: string[];
  zamik?: number;
  /** Kam vodi kartica; brez = "Kmalu" (ne klikne). */
  href?: string;
};

/**
 * Velika vstopna kartica (Administracija, Moj Fines): steklo, 3D nagib za miško,
 * svetlobni žaromet pod kazalcem, animirana obroba s prelivom ob hoverju.
 * Brez `href` ne vodi nikamor (`aria-disabled`, značka "Kmalu").
 */
export function VstopKartica({ naslov, pripona, opis, hint, icon: Icon, funkcije, zamik = 0, href }: Props) {
  const router = useRouter();
  const odpri = () => href && router.push(href);
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotX = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 180, damping: 18 });
  const rotY = useSpring(useTransform(px, [0, 1], [-9, 9]), { stiffness: 180, damping: 18 });
  const sx = useTransform(px, (v) => `${v * 100}%`);
  const sy = useTransform(py, (v) => `${v * 100}%`);
  const zaromet = useMotionTemplate`radial-gradient(420px circle at ${sx} ${sy}, rgb(238 122 58 / 0.22), transparent 60%)`;

  const premik = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const ven = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay: zamik }}
      className="[perspective:1200px]"
    >
      <motion.div
        ref={ref}
        role="link"
        aria-disabled={!href}
        tabIndex={0}
        onClick={odpri}
        onKeyDown={(e) => e.key === "Enter" && odpri()}
        title={hint}
        onPointerMove={premik}
        onPointerLeave={ven}
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.985 }}
        className="group relative cursor-pointer rounded-[28px] p-px outline-none focus-visible:ring-2 focus-visible:ring-fines-400"
      >
        {/* obroba: tiha siva, ob hoverju vrteča oranžna */}
        <span aria-hidden className="absolute inset-0 rounded-[28px] bg-white/10" />
        <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[28px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <span className="fos-border-anim absolute -inset-[50%]" />
        </span>
        {/* zunanji sij */}
        <span aria-hidden className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgb(202_80_16/0.45),transparent)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative overflow-hidden rounded-[27px] fos-kartica p-6 backdrop-blur-xl sm:p-8">
          <motion.span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: zaromet }} />
          {/* velik prosojen znak v ozadju */}
          <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 font-display text-[9rem] font-bold leading-none text-white/[0.03] transition-transform duration-700 group-hover:-translate-x-4 sm:text-[11rem]">
            {pripona}
          </span>

          <div className="relative flex items-start justify-between gap-4" style={{ transform: "translateZ(40px)" }}>
            <span className="fos-fines-fill relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-snow transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110 sm:h-16 sm:w-16">
              <Icon className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              <span className="fos-shine absolute inset-0" />
            </span>
            {!href && (
              <span className="rounded-full border border-fines-400/30 bg-fines-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-fines-300">
                Kmalu
              </span>
            )}
          </div>

          <div className="relative mt-6" style={{ transform: "translateZ(30px)" }}>
            <Znak pripona={pripona} className="text-lg sm:text-xl" />
            <h2 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">{naslov}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-300 sm:text-base">{opis}</p>
          </div>

          <ul className="relative mt-6 flex flex-wrap gap-2" style={{ transform: "translateZ(20px)" }}>
            {funkcije.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: zamik + 0.3 + i * 0.06 }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink-200 transition-colors duration-300 group-hover:border-fines-400/30 group-hover:text-white"
              >
                {f}
              </motion.li>
            ))}
          </ul>

          <div className="relative mt-8 flex items-center gap-3 text-sm font-semibold text-fines-300" style={{ transform: "translateZ(30px)" }}>
            <span>Vstopi</span>
            <span className="h-px flex-1 origin-left scale-x-[0.25] bg-[linear-gradient(90deg,#ee7a3a,transparent)] transition-transform duration-500 group-hover:scale-x-100" />
            <span className="grid h-10 w-10 place-items-center rounded-full border border-fines-400/40 bg-fines-500/10 transition-all duration-500 group-hover:translate-x-1 group-hover:bg-fines-500 group-hover:text-snow group-hover:shadow-[0_0_24px_rgb(238_122_58/0.8)]">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
