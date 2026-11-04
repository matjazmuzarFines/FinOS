"use client";

import { useSyncExternalStore } from "react";

/**
 * Testni pogled FIN:ME (samo Super Admin): ikona epruvete v glavi vklopi trak "Ogled kot" - FIN:ME pogledaš kot
 * kateri koli zaposleni. Izklopljen = vidiš svoj FIN:ME kot vsak zaposleni (višina, potek). Zapomni si brskalnik.
 */
const KLJUC = "fos_me_testni_pogled";
const poslusalci = new Set<() => void>();
const beri = () => {
  try {
    return localStorage.getItem(KLJUC) === "da";
  } catch {
    return false;
  }
};

export function nastaviTestniPogled(v: boolean) {
  try {
    if (v) localStorage.setItem(KLJUC, "da");
    else localStorage.removeItem(KLJUC);
  } catch {}
  poslusalci.forEach((p) => p());
}

export const useTestniPogled = () =>
  useSyncExternalStore(
    (p) => {
      poslusalci.add(p);
      return () => poslusalci.delete(p);
    },
    beri,
    () => false,
  );
