"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserLock, type LucideIcon } from "lucide-react";
import { fetchAll, getSupabase } from "./supabase";
import { osveziZaposlene } from "./zaposleni";

/**
 * Funkcije (pravice) uporabnikov - fos_funkcije, ln_fos_zaposleni_funkcije (008_funkcije.sql).
 * Nova funkcija = nova vrstica v 008 (koda, ime, opis, obsega) + po potrebi ikona v IKONE in preverjanje v bazi.
 */
export type Funkcija = { id: number; koda: string; ime: string; opis: string; obsega: string[] };

/** Ikona funkcije (neznana funkcija: KeyRound). */
export const IKONE: Record<string, LucideIcon> = { super_admin: ShieldCheck, kadrovanje: UserLock };

let predpomnilnik: Promise<Funkcija[]> | null = null;

/** Vse vidne funkcije po vrstnem redu (null = nalagam). */
export function useFunkcije() {
  const [stanje, setStanje] = useState<{ funkcije: Funkcija[] | null; napaka: string | null }>({ funkcije: null, napaka: null });
  useEffect(() => {
    let ziv = true;
    predpomnilnik ??= fetchAll<Funkcija>((from, to) => getSupabase().from("fos_funkcije").select("id, koda, ime, opis, obsega").eq("visible", true).order("vrstni_red").range(from, to));
    const p = predpomnilnik;
    p.then(
      (funkcije) => ziv && setStanje({ funkcije, napaka: null }),
      (e: Error) => {
        if (predpomnilnik === p) predpomnilnik = null;
        if (ziv) setStanje({ funkcije: null, napaka: e.message });
      },
    );
    return () => {
      ziv = false;
    };
  }, []);
  return stanje;
}

async function api<T>(metoda: "GET" | "POST", telo?: unknown): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const odg = await fetch("/api/pravice", {
    method: metoda,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: telo ? JSON.stringify(telo) : undefined,
  });
  const json = (await odg.json().catch(() => null)) as (T & { napaka?: string }) | null;
  if (!odg.ok || !json) throw new Error(json?.napaka ?? "Strežnik ni odgovoril.");
  return json;
}

export type Uporabnik = { id_zaposlenega: number; zadnja_prijava: string | null; ustvarjen: string };
export type Jaz = { id_zaposlenega: number | null; zasilni: boolean; funkcije: string[] };

/** Zaposleni z računom in čas zadnje prijave (Supabase Auth, prek strežnika). */
export const naloziUporabnike = () => api<{ uporabniki: Uporabnik[]; jaz: Jaz }>("GET");

export type SpremembaFunkcije = { id_zaposlenega: number; koda: string; vklop: boolean };

/** Shrani vklope / izklope funkcij (piše samo strežnik). */
export async function shraniFunkcije(spremembe: SpremembaFunkcije[]) {
  try {
    await api("POST", { spremembe });
  } finally {
    osveziZaposlene();
  }
}
