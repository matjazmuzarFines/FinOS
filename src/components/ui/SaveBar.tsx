"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Undo2 } from "lucide-react";
import { Button } from "./Button";

type Props = { sprememb: number; shranjujem: boolean; onShrani: () => void; onPreklici: () => void };

/**
 * Neshranjene spremembe (standard SaveBar): spodnja lepljiva vrstica s številom sprememb,
 * Prekliči (bel) in Shrani (zelen); opozorilo brskalnika pred odhodom s strani.
 */
export function SaveBar({ sprememb, shranjujem, onShrani, onPreklici }: Props) {
  useEffect(() => {
    if (!sprememb) return;
    const opozori = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", opozori);
    return () => window.removeEventListener("beforeunload", opozori);
  }, [sprememb]);

  return (
    <AnimatePresence>
      {sprememb > 0 && (
        <motion.div
          className="sticky bottom-3 z-30 mt-auto"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-warn-500/40 bg-ink-900/95 px-4 py-3 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl">
            <span className="flex items-center gap-2 text-sm font-semibold text-warn-500">
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-warn-500 px-1.5 text-xs font-bold text-coal">{sprememb}</span>
              {sprememb === 1 ? "Neshranjena sprememba" : "Neshranjene spremembe"}
            </span>
            <span className="flex gap-2">
              <Button hint="Zavrzi neshranjene spremembe" variant="neutral" icon={Undo2} onClick={onPreklici} disabled={shranjujem}>
                Prekliči
              </Button>
              <Button hint="Shrani spremembe zaposlenega v bazo" variant="success" icon={Check} onClick={onShrani} disabled={shranjujem}>
                {shranjujem ? "Shranjujem ..." : "Shrani"}
              </Button>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
