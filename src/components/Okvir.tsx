"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Ozadje } from "./Ozadje";
import { Glava } from "./Glava";
import { Obvestila } from "./ui/Obvestila";
import { APP_VERSION } from "@/lib/verzije";
import { sirinaStrani } from "@/lib/nav";

/**
 * Okvir podstrani (Administracija, kasneje Moj Fines): ozadje, glava, obvestila,
 * vsebina s prehodom ob menjavi strani, noga. Glava ostane, menja se samo vsebina.
 */
export function Okvir({ children }: { children: ReactNode }) {
  const pot = usePathname();

  return (
    <>
      <Ozadje />
      <Obvestila />
      <div className="flex min-h-dvh flex-col overflow-x-clip">
        <Glava />
        <motion.main
          key={pot}
          className={`mx-auto flex w-full flex-1 flex-col gap-6 px-3 pb-10 pt-6 sm:gap-8 sm:px-6 sm:pt-10 ${sirinaStrani(pot)}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        >
          {children}
        </motion.main>
        <footer className="border-t border-white/5 py-4 text-center text-xs text-ink-500">FINES d.o.o. | FIN:OS | Verzija {APP_VERSION}</footer>
      </div>
    </>
  );
}
