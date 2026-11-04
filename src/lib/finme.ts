"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchAll, getSupabase } from "./supabase";

/**
 * Nastavitve FIN:ME po zaposlenem (list zaposlenega -> zavihek FIN:ME). Migracija 020: fos_zaposleni_finme (en viden zapis
 * na zaposlenega), piše se prek fos_nastavi_finme (samo Administracija).
 *   virtualno_belezenje  zaposleni sme štempljati v Mojem Finesu (Delovna ura) - vir "online"
 * Brez tabele so nastavitve v tem brskalniku (localStorage, vir = "test").
 */
export type FinMeNastavitve = { virtualno_belezenje: boolean };
export const PRIVZETE_FINME: FinMeNastavitve = { virtualno_belezenje: false };

type Stanje = { po: Record<number, FinMeNastavitve>; vir: "nalagam" | "baza" | "test"; napaka: string | null };
let stanje: Stanje = { po: {}, vir: "nalagam", napaka: null };
const poslusalci = new Set<() => void>();
const spremeni = (fn: (s: Stanje) => Stanje) => {
  stanje = fn(stanje);
  poslusalci.forEach((p) => p());
};
const narocnina = (p: () => void) => {
  poslusalci.add(p);
  return () => poslusalci.delete(p);
};

const KLJUC = "fos_finme_test";
const beriTest = (): Record<number, FinMeNastavitve> => {
  try {
    return JSON.parse(localStorage.getItem(KLJUC) ?? "{}");
  } catch {
    return {};
  }
};

let nalaganje: Promise<void> | null = null;
async function nalozi() {
  try {
    const vrstice = await fetchAll<FinMeNastavitve & { id_zaposlenega: number }>((from, to) =>
      getSupabase().from("fos_zaposleni_finme").select("id_zaposlenega, virtualno_belezenje").eq("visible", true).order("id").range(from, to),
    );
    spremeni(() => ({ vir: "baza", napaka: null, po: Object.fromEntries(vrstice.map((v) => [v.id_zaposlenega, { virtualno_belezenje: v.virtualno_belezenje }])) }));
  } catch (e) {
    spremeni(() => ({ vir: "test", napaka: (e as Error).message, po: beriTest() }));
  }
}

export function useFinMe() {
  useEffect(() => {
    nalaganje ??= nalozi();
  }, []);
  return useSyncExternalStore(narocnina, () => stanje, () => stanje);
}

export const finMeZa = (s: Pick<Stanje, "po">, idZaposlenega: number) => s.po[idZaposlenega] ?? PRIVZETE_FINME;

export async function shraniFinMe(idZaposlenega: number, v: FinMeNastavitve) {
  if (stanje.vir !== "baza") {
    const po = { ...stanje.po, [idZaposlenega]: v };
    try {
      localStorage.setItem(KLJUC, JSON.stringify(po));
    } catch {}
    return spremeni((s) => ({ ...s, po }));
  }
  try {
    const { error } = await getSupabase().rpc("fos_nastavi_finme", { p_id_zaposlenega: idZaposlenega, p_virtualno_belezenje: v.virtualno_belezenje });
    if (error) throw new Error(error.message);
  } finally {
    nalaganje = nalozi();
    await nalaganje;
  }
}
