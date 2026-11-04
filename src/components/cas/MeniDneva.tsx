"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

export type PostavkaMenija = { ikona: LucideIcon; besedilo: string; opis: string; onClick: () => void };

/**
 * Meni dneva (desni klik na vrstico koledarja): steklen, ob kazalcu, nikoli izven zaslona.
 * Zapre se ob kliku drugam, Escape, drsenju ali izbiri.
 */
export function MeniDneva({ odprt, naslov, postavke, onClose }: { odprt: { x: number; y: number } | null; naslov: string; postavke: PostavkaMenija[]; onClose: () => void }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  useEffect(() => {
    if (!odprt) return;
    const zapri = () => onClose();
    const tipka = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", zapri);
    window.addEventListener("scroll", zapri, true);
    window.addEventListener("resize", zapri);
    window.addEventListener("keydown", tipka);
    return () => {
      window.removeEventListener("pointerdown", zapri);
      window.removeEventListener("scroll", zapri, true);
      window.removeEventListener("resize", zapri);
      window.removeEventListener("keydown", tipka);
    };
  }, [odprt, onClose]);

  if (!mounted) return null;
  const sirina = 272;
  const visina = 56 + postavke.length * 58;
  const x = odprt ? Math.max(8, Math.min(odprt.x, window.innerWidth - sirina - 8)) : 0;
  const y = odprt ? Math.max(8, Math.min(odprt.y, window.innerHeight - visina - 8)) : 0;

  return createPortal(
    <AnimatePresence>
      {odprt && (
        <motion.div
          role="menu"
          aria-label={naslov}
          initial={{ opacity: 0, scale: 0.92, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          style={{ left: x, top: y, width: sirina, transformOrigin: "top left" }}
          onPointerDown={(e) => e.stopPropagation()}
          className="fos-popup fixed z-[60] flex flex-col gap-0.5 overflow-hidden rounded-[16px] p-1.5"
        >
          <span className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-fines-400">{naslov}</span>
          {postavke.map((p) => (
            <button
              key={p.besedilo}
              type="button"
              role="menuitem"
              title={p.opis}
              onClick={() => {
                onClose();
                p.onClick();
              }}
              className="group flex items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none"
            >
              <span className="fos-fines-fill grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-snow transition-transform duration-300 group-hover:scale-110">
                <p.ikona className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold text-white">{p.besedilo}</span>
                <span className="text-[11px] leading-tight text-ink-400">{p.opis}</span>
              </span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
