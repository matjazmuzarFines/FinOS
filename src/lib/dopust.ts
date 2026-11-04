"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchAll, getSupabase } from "./supabase";

/**
 * Dopust zaposlenega po letih (migracija 020: fos_dopust_leta, en viden zapis na zaposlenega in leto; piše se prek
 * fos_nastavi_dopust_leta). Vpiše Administracija: koliko dni letnega dopusta ima zaposleni in koliko lanskega
 * (prenesenega). Porabljeno se izračuna iz koledarja (dnevi v statistikah s kvadratkom "Štej letni dopust" /
 * "Štej lanski dopust"). Brez tabele samo v brskalniku do osvežitve (vir = "test").
 */

export type DopustLeta = { dopust_dni: number; lanski_dni: number };
type Stanje = { leta: Record<string, DopustLeta>; vir: "nalagam" | "baza" | "test"; napaka: string | null };

export const kljucLeta = (idZaposlenega: number, leto: string | number) => `${idZaposlenega}:${String(leto).slice(0, 4)}`;

let stanje: Stanje = { leta: {}, vir: "nalagam", napaka: null };
const poslusalci = new Set<() => void>();
const spremeni = (fn: (s: Stanje) => Stanje) => {
  stanje = fn(stanje);
  poslusalci.forEach((p) => p());
};
const narocnina = (p: () => void) => {
  poslusalci.add(p);
  return () => poslusalci.delete(p);
};

let nalaganje: Promise<void> | null = null;
async function nalozi() {
  try {
    const vrstice = await fetchAll<DopustLeta & { id_zaposlenega: number; leto: number }>((from, to) =>
      getSupabase().from("fos_dopust_leta").select("id_zaposlenega, leto, dopust_dni, lanski_dni").eq("visible", true).order("id").range(from, to),
    );
    spremeni(() => ({ vir: "baza", napaka: null, leta: Object.fromEntries(vrstice.map((v) => [kljucLeta(v.id_zaposlenega, v.leto), { dopust_dni: Number(v.dopust_dni), lanski_dni: Number(v.lanski_dni) }])) }));
  } catch (e) {
    nalaganje = null;
    spremeni((s) => ({ ...s, vir: "test", napaka: (e as Error).message }));
  }
}

export function useDopust() {
  useEffect(() => {
    nalaganje ??= nalozi();
  }, []);
  return useSyncExternalStore(narocnina, () => stanje, () => stanje);
}

/** Shrani dopust za leto (dni, tudi pol dneva: 0,5). */
export async function shraniDopust(idZaposlenega: number, leto: string, v: DopustLeta) {
  if (stanje.vir !== "baza") return spremeni((s) => ({ ...s, leta: { ...s.leta, [kljucLeta(idZaposlenega, leto)]: v } }));
  try {
    const { error } = await getSupabase().rpc("fos_nastavi_dopust_leta", { p_id_zaposlenega: idZaposlenega, p_leto: Number(leto.slice(0, 4)), p_dopust_dni: v.dopust_dni, p_lanski_dni: v.lanski_dni });
    if (error) throw new Error(error.message);
  } finally {
    nalaganje = nalozi();
    await nalaganje;
  }
}

/** "20", "20,5", "20.5" -> število dni (null = napaka, prazno = 0). */
export const izDni = (s: string) => {
  const t = s.trim().replace(",", ".");
  if (!t) return 0;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 && v <= 366 && Math.round(v * 2) === v * 2 ? v : null;
};
export const fmtDni = (v: number) => String(v).replace(".", ",");
