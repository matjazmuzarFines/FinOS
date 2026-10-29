"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { IconButton } from "./Button";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Gumbi v nogi okna (ne drsijo z vsebino). */
  noga?: ReactNode;
};

/** Okno: od `sm` na sredini (steklo, zaobljeno 20 px), na telefonu cel zaslon. Vedno v <body>. */
export function Modal({ open, title, onClose, children, noga }: Props) {
  // portal šele v brskalniku (na strežniku ni document.body)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className="fos-glass flex h-full w-full flex-col overflow-hidden bg-ink-900/80 sm:h-auto sm:max-h-[85vh] sm:max-w-xl sm:rounded-[20px]"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-white">{title}</h2>
              <IconButton hint="Zapri okno" icon={X} onClick={onClose} />
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,#ee7a3a,transparent)]" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {noga && <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3">{noga}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
