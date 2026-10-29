"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, XCircle } from "lucide-react";

type Obvestilo = { id: number; tekst: string; vrsta: "ok" | "napaka" };

let obvestila: Obvestilo[] = [];
let stevec = 0;
const poslusalci = new Set<() => void>();
const javi = () => poslusalci.forEach((p) => p());

/** Pokaži obvestilo (zgoraj na sredini, izgine samo). */
export function obvesti(tekst: string, vrsta: Obvestilo["vrsta"] = "ok") {
  const id = ++stevec;
  obvestila = [...obvestila, { id, tekst, vrsta }];
  javi();
  setTimeout(() => {
    obvestila = obvestila.filter((o) => o.id !== id);
    javi();
  }, vrsta === "napaka" ? 6000 : 3000);
}

const narocnina = (p: () => void) => {
  poslusalci.add(p);
  return () => poslusalci.delete(p);
};

/** Obvestila (Toast): zgoraj na sredini, barvna leva črta (zelena uspeh, rdeča napaka). Enkrat v okvirju. */
export function Obvestila() {
  const seznam = useSyncExternalStore(narocnina, () => obvestila, () => obvestila);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {seznam.map((o) => (
          <motion.div
            key={o.id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            role="status"
            className={`pointer-events-auto flex max-w-md items-center gap-2 overflow-hidden rounded-[14px] border border-l-4 border-white/10 bg-ink-900/95 px-4 py-3 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl text-sm font-semibold text-white ${
              o.vrsta === "ok" ? "border-l-ok-500" : "border-l-nok-500"
            }`}
          >
            {o.vrsta === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ok-500" aria-hidden /> : <XCircle className="h-4 w-4 shrink-0 text-nok-500" aria-hidden />}
            {o.tekst}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
