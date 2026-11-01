"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchAll, getSupabase } from "./supabase";

/**
 * Saldo ur zaposlenega (012_saldo.sql): začetno stanje (saldo pred FIN:OS, od datuma naprej se štejejo dnevni saldi) in
 * po mesecih prenos v izplačilo + mesečni zaznamki. Izračun prenosa je v RegistracijaCasa (dnevni saldi iz cas.ts):
 *   stanje na koncu = prenos iz prejšnjega obdobja + saldo obdobja - prenos v izplačilo
 * Dokler tabel ni, je vse samo v brskalniku (vir = "test", do osvežitve strani).
 */

export type ZacetnoStanje = { saldo_min: number; datum: string };
export type MesecSalda = { izplacilo_min: number; zaznamki: string };
type Stanje = {
  zacetna: Record<number, ZacetnoStanje>;
  /** Ključ `${id_zaposlenega}:${YYYY-MM}`. */
  meseci: Record<string, MesecSalda>;
  vir: "nalagam" | "baza" | "test";
  napaka: string | null;
};

export const PRAZEN_MESEC: MesecSalda = { izplacilo_min: 0, zaznamki: "" };
export const kljucMeseca = (idZaposlenega: number, mesec: string) => `${idZaposlenega}:${mesec.slice(0, 7)}`;

let stanje: Stanje = { zacetna: {}, meseci: {}, vir: "nalagam", napaka: null };
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
  const sb = getSupabase();
  try {
    const [zacetna, meseci] = await Promise.all([
      fetchAll<ZacetnoStanje & { id_zaposlenega: number }>((from, to) => sb.from("fos_saldo_zacetno").select("id_zaposlenega, saldo_min, datum").eq("visible", true).order("id").range(from, to)),
      fetchAll<MesecSalda & { id_zaposlenega: number; mesec: string }>((from, to) =>
        sb.from("fos_saldo_meseci").select("id_zaposlenega, mesec, izplacilo_min, zaznamki").eq("visible", true).order("id").range(from, to),
      ),
    ]);
    spremeni(() => ({
      vir: "baza",
      napaka: null,
      zacetna: Object.fromEntries(zacetna.map((z) => [z.id_zaposlenega, { saldo_min: z.saldo_min, datum: z.datum }])),
      meseci: Object.fromEntries(meseci.map((m) => [kljucMeseca(m.id_zaposlenega, m.mesec), { izplacilo_min: m.izplacilo_min, zaznamki: m.zaznamki }])),
    }));
  } catch (e) {
    nalaganje = null;
    spremeni((s) => ({ ...s, vir: "test", napaka: (e as Error).message }));
  }
}

export function useSaldo() {
  useEffect(() => {
    nalaganje ??= nalozi();
  }, []);
  return useSyncExternalStore(narocnina, () => stanje, () => stanje);
}

const preveri = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};

/** Shrani začetno stanje (null = brez) in / ali mesec salda zaposlenega. Brez baze samo v brskalniku. */
export async function shraniSaldo(idZaposlenega: number, sprememba: { zacetno?: ZacetnoStanje | null; mesec?: { mesec: string; podatki: MesecSalda } }) {
  const { zacetno, mesec } = sprememba;
  const lokalno = () =>
    spremeni((s) => {
      const zacetna = { ...s.zacetna };
      if (zacetno === null) delete zacetna[idZaposlenega];
      else if (zacetno) zacetna[idZaposlenega] = zacetno;
      return { ...s, zacetna, meseci: mesec ? { ...s.meseci, [kljucMeseca(idZaposlenega, mesec.mesec)]: mesec.podatki } : s.meseci };
    });
  if (stanje.vir !== "baza") return lokalno();
  const sb = getSupabase();
  try {
    if (zacetno !== undefined)
      preveri(await sb.rpc("fos_nastavi_zacetni_saldo", { p_id_zaposlenega: idZaposlenega, p_saldo_min: zacetno?.saldo_min ?? 0, p_datum: zacetno?.datum ?? null }));
    if (mesec)
      preveri(
        await sb.rpc("fos_nastavi_mesec_salda", { p_id_zaposlenega: idZaposlenega, p_mesec: `${mesec.mesec.slice(0, 7)}-01`, p_izplacilo_min: mesec.podatki.izplacilo_min, p_zaznamki: mesec.podatki.zaznamki }),
      );
  } finally {
    nalaganje = nalozi();
    await nalaganje;
  }
}

/** Seštevek izplačil zaposlenega v mesecih [od, do) (YYYY-MM). */
export const izplacilaMed = (s: Pick<Stanje, "meseci">, idZaposlenega: number, od: string, doo: string) =>
  Object.entries(s.meseci).reduce((v, [k, m]) => {
    const [id, mes] = k.split(":");
    return Number(id) === idZaposlenega && mes >= od && mes < doo ? v + m.izplacilo_min : v;
  }, 0);
