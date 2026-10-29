"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Znak } from "./Znak";

export const SLOGAN = "People Bake for People";
const TRAJANJE_MS = 3400;

/**
 * Uvodna animacija ob nalaganju: črke FIN:OS priletijo in se zložijo, pod njimi preleti
 * oranžna črta, izpiše se "Fines Operating System" in slogan; nato se zavesa dvigne.
 * Klik ali tipka preskoči animacijo.
 */
export function Intro({ onKonec }: { onKonec: () => void }) {
  const [odprto, setOdprto] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setOdprto(false), reduced ? 300 : TRAJANJE_MS);
    const preskoci = () => setOdprto(false);
    window.addEventListener("keydown", preskoci);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", preskoci);
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={onKonec}>
      {odprto && (
        <motion.div
          key="intro"
          className="fos-intro fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-ink-950"
          title="Klikni za preskok uvodne animacije"
          onClick={() => setOdprto(false)}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* sij v ozadju, ki se razširi iz sredine */}
          <motion.div
            aria-hidden
            className="absolute h-[80vmin] w-[80vmin] rounded-full bg-[radial-gradient(circle,rgb(202_80_16/0.45),transparent_60%)] blur-2xl"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.3, 1], opacity: [0, 1, 0.7] }}
            transition={{ duration: 1.8, delay: 0.3, ease: "easeOut" }}
          />
          {/* krogi, ki se širijo kot val ob zložitvi */}
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute h-[30vmin] w-[30vmin] rounded-full border border-fines-400/40"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 3.2, opacity: [0, 0.8, 0] }}
              transition={{ duration: 1.8, delay: 1.05 + i * 0.22, ease: "easeOut" }}
            />
          ))}

          <div className="relative flex flex-col items-center px-4">
            <Znak zlozi zamik={0.15} className="text-[clamp(4.5rem,18vw,12rem)]" />

            <motion.span
              aria-hidden
              className="mt-4 h-[3px] w-full origin-left rounded-full bg-[linear-gradient(90deg,transparent,#ee7a3a_20%,#ca5010_80%,transparent)] shadow-[0_0_20px_rgb(238_122_58/0.8)]"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.1, ease: [0.65, 0, 0.35, 1] }}
            />

            <motion.p
              className="mt-5 text-center text-xs font-semibold uppercase text-ink-300 sm:text-sm"
              initial={{ opacity: 0, letterSpacing: "1.2em", filter: "blur(6px)" }}
              animate={{ opacity: 1, letterSpacing: "0.45em", filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 1.35, ease: "easeOut" }}
            >
              Fines Operating System
            </motion.p>

            <p className="mt-6 flex flex-wrap justify-center gap-x-[0.35em] font-display text-xl font-medium text-white sm:text-3xl">
              {SLOGAN.split(" ").map((beseda, i) => (
                <motion.span
                  key={i}
                  className={beseda === "Bake" ? "fos-text-fines font-bold" : ""}
                  initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.5, delay: 1.85 + i * 0.14, ease: "easeOut" }}
                >
                  {beseda}
                </motion.span>
              ))}
            </p>
          </div>

          {/* napredek nalaganja */}
          <motion.span
            aria-hidden
            className="absolute bottom-0 left-0 h-[3px] bg-[linear-gradient(90deg,#8f380b,#ee7a3a)]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: TRAJANJE_MS / 1000, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
