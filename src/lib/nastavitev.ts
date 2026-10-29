"use client";

import { useSyncExternalStore } from "react";

/**
 * Nastavitev brskalnika z dvema vrednostma (animacije, tema): localStorage + atribut na <html>
 * (za CSS; ob nalaganju ga nastavi že skripta v layout.tsx). Sprememba v drugem zavihku se prenese sama.
 */
export function ustvariNastavitev<T extends string>(kljuc: string, atribut: string, privzeto: T, vrednosti: readonly T[]) {
  const poslusalci = new Set<() => void>();

  const beri = (): T => {
    try {
      const v = localStorage.getItem(kljuc) as T | null;
      return v && vrednosti.includes(v) ? v : privzeto;
    } catch {
      return privzeto;
    }
  };

  const nastavi = (v: T) => {
    try {
      localStorage.setItem(kljuc, v);
    } catch {}
    document.documentElement.dataset[atribut] = v;
    poslusalci.forEach((p) => p());
  };

  const narocnina = (p: () => void) => {
    poslusalci.add(p);
    const naStorage = (e: StorageEvent) => {
      if (e.key !== kljuc) return;
      document.documentElement.dataset[atribut] = beri();
      p();
    };
    window.addEventListener("storage", naStorage);
    return () => {
      poslusalci.delete(p);
      window.removeEventListener("storage", naStorage);
    };
  };

  const useVrednost = (): T => useSyncExternalStore(narocnina, beri, () => privzeto);

  return { nastavi, useVrednost };
}
