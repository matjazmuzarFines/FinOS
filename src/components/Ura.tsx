"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const DATUM = new Intl.DateTimeFormat("sl-SI", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Živa ura: vsaka števka se ob spremembi zavrti navzgor. */
export function Ura() {
  const [zdaj, setZdaj] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setZdaj(new Date());
    const prvi = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(prvi);
      clearInterval(t);
    };
  }, []);

  const cas = zdaj ? [zdaj.getHours(), zdaj.getMinutes(), zdaj.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":") : "--:--:--";

  return (
    <div className="fos-glass inline-flex flex-col items-center rounded-2xl px-5 py-3" title="Trenutni čas in datum">
      <div className="flex font-display text-3xl font-bold tabular-nums text-white sm:text-4xl" aria-label={cas}>
        {cas.split("").map((znak, i) =>
          znak === ":" ? (
            <span key={i} className="fos-text-fines px-0.5 [animation:pulse_1s_ease-in-out_infinite]">
              :
            </span>
          ) : (
            <span key={i} className="relative inline-block h-[1.1em] w-[0.62em] overflow-hidden">
              <AnimatePresence initial={false}>
                <motion.span
                  key={znak}
                  className="absolute inset-0 text-center"
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                >
                  {znak}
                </motion.span>
              </AnimatePresence>
            </span>
          ),
        )}
      </div>
      <span className="mt-1 text-xs font-medium text-ink-300 first-letter:uppercase">{zdaj ? DATUM.format(zdaj) : " "}</span>
    </div>
  );
}
