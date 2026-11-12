"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Network, Search, User, type LucideIcon } from "lucide-react";
import { ADMIN_PLOSCICE, SEKCIJE } from "@/lib/nav";
import { ujemaIskanje } from "@/lib/iskanje";
import { polnoIme, useZaposleni } from "@/lib/zaposleni";

/** Odpre iskanje od kjerkoli (npr. gumb Išči na vstopu v Administracijo). */
export const odpriIskanje = () => window.dispatchEvent(new Event("fos-iskanje"));

type Zadetek = { ime: string; skupina: string; href: string; ikona: LucideIcon };

/** Vse strani Administracije (iz nav.ts - nova stran se doda sama). */
function strani(): Zadetek[] {
  const z: Zadetek[] = ADMIN_PLOSCICE.map((p) => ({ ime: p.naslov, skupina: "Administracija", href: p.href, ikona: p.icon }));
  z.push({ ime: "Prikaz hierarhije", skupina: "Zaposleni", href: "/administracija/zaposleni/hierarhija", ikona: Network });
  for (const s of SEKCIJE) {
    z.push({ ime: s.naslov, skupina: "Pregled nastavitev", href: s.koren, ikona: ADMIN_PLOSCICE.find((p) => s.koren.startsWith(p.href))?.icon ?? Search });
    for (const r of s.razdelki) for (const p of r.ploscice) z.push({ ime: p.naslov, skupina: `${s.naslov} · ${r.naslov}`, href: p.href, ikona: p.icon });
  }
  return z;
}

/**
 * Iskanje po vsej Administraciji (Ctrl+K ali odpriIskanje()): strani, nastavitve in zaposleni. Puščici gor / dol,
 * Enter odpre, Esc zapre. Vključeno v administracija/layout.tsx - deluje na vseh straneh Administracije.
 */
export function IskanjeAdmin() {
  const [odprto, setOdprto] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const router = useRouter();
  const { podatki } = useZaposleni();
  const vhod = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tipka = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOdprto((o) => !o);
      }
    };
    const odpri = () => setOdprto(true);
    window.addEventListener("keydown", tipka);
    window.addEventListener("fos-iskanje", odpri);
    return () => {
      window.removeEventListener("keydown", tipka);
      window.removeEventListener("fos-iskanje", odpri);
    };
  }, []);

  const vse = useMemo(
    () => [...strani(), ...(podatki?.zaposleni ?? []).map((z) => ({ ime: polnoIme(z), skupina: z.oddelek?.ime_oddelka ?? "Zaposleni", href: `/administracija/zaposleni/${z.id}`, ikona: User }))],
    [podatki],
  );
  const zadetki = useMemo(() => {
    return (q.trim() ? vse.filter((z) => ujemaIskanje(q, [z.ime, z.skupina])) : vse.slice(0, 12)).slice(0, 40);
  }, [q, vse]);

  const zapri = () => {
    setOdprto(false);
    setQ("");
    setI(0);
  };
  const odpri = (z: Zadetek | undefined) => {
    if (!z) return;
    zapri();
    router.push(z.href);
  };

  return (
    <AnimatePresence>
      {odprto && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/80 p-4 pt-[12vh] backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={zapri}>
          <motion.div
            role="dialog"
            aria-label="Iskanje po Administraciji"
            initial={{ y: -16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onAnimationComplete={() => vhod.current?.focus()}
            className="fos-popup w-full max-w-xl overflow-hidden rounded-[20px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="h-5 w-5 text-fines-300" aria-hidden />
              <input
                ref={vhod}
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setI(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") zapri();
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setI((x) => (e.key === "ArrowDown" ? Math.min(x + 1, zadetki.length - 1) : Math.max(x - 1, 0)));
                  }
                  if (e.key === "Enter") odpri(zadetki[i]);
                }}
                placeholder="Išči stran, nastavitev ali zaposlenega ..."
                title="Iskanje po Administraciji"
                className="h-14 flex-1 bg-transparent text-base text-white outline-none placeholder:text-ink-500"
              />
              <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 text-[11px] text-ink-400">Esc</kbd>
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,#ee7a3a,transparent)]" />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {zadetki.map((z, k) => (
                <li key={z.href + z.ime}>
                  <button
                    type="button"
                    title={`Odpri ${z.ime}`}
                    onMouseEnter={() => setI(k)}
                    onClick={() => odpri(z)}
                    className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm transition-colors ${k === i ? "bg-fines-500/12 text-white" : "text-ink-200"}`}
                  >
                    <z.ikona className="h-4 w-4 shrink-0 text-fines-300" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-semibold">{z.ime}</span>
                    <span className="shrink-0 text-xs text-ink-500">{z.skupina}</span>
                  </button>
                </li>
              ))}
              {!zadetki.length && <li className="px-3 py-6 text-center text-sm text-ink-500">Ni zadetkov.</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
