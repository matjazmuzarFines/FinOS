"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll, getSupabase } from "./supabase";
import { preveriPrijavo } from "./prijavaZaposlenega";

/** Vrstica fos_oddelek. */
export type Oddelek = { id: number; ime_oddelka: string };

/** Vrstica fos_zaposleni. */
export type ZaposleniVrstica = {
  id: number;
  ime: string;
  priimek: string;
  st_kartice: string | null;
  id_oddelek: number | null;
  /** Prijava v FIN:ME (geslo je samo v Supabase Auth). */
  email: string | null;
  uporabnisko_ime: string | null;
  id_uporabnika: string | null;
};

/**
 * Zaposleni z razrešenim oddelkom in vodjo (za prikaz).
 * id_vodja = fos_vodje.id trenutnega vodje (ln_fos_zaposleni_vodja), vodja = ta vodja kot oseba,
 * id_kot_vodja = fos_vodje.id, če je zaposleni sam vodja.
 */
export type Zaposleni = ZaposleniVrstica & {
  oddelek: Oddelek | null;
  id_vodja: number | null;
  vodja: ZaposleniVrstica | null;
  id_kot_vodja: number | null;
};

/** Vodja za izbirna polja (fos_vodje.id + oseba). */
export type Vodja = { id: number; zaposleni: ZaposleniVrstica };

export type ZaposleniPodatki = { zaposleni: Zaposleni[]; oddelki: Oddelek[]; vodje: Vodja[]; poId: Map<number, Zaposleni> };

/** Vnosna polja zaposlenega (obrazec Dodaj in list zaposlenega). */
export type ZaposleniVnos = {
  ime: string;
  priimek: string;
  st_kartice: string;
  id_oddelek: number | null;
  id_vodja: number | null;
  je_vodja: boolean;
  email: string;
  uporabnisko_ime: string;
  /** Novo geslo (prazno = brez spremembe); nikoli se ne prebere iz baze. */
  geslo: string;
};

export const polnoIme = (z: Pick<ZaposleniVrstica, "ime" | "priimek">) => `${z.ime} ${z.priimek}`;
export const zacetnice = (z: Pick<ZaposleniVrstica, "ime" | "priimek">) => `${z.ime.charAt(0)}${z.priimek.charAt(0)}`.toUpperCase();
export const primerjajImena = (a: Pick<ZaposleniVrstica, "ime" | "priimek">, b: Pick<ZaposleniVrstica, "ime" | "priimek">) =>
  a.priimek.localeCompare(b.priimek, "sl") || a.ime.localeCompare(b.ime, "sl");

export const vnosIz = (z: Zaposleni): ZaposleniVnos => ({
  ime: z.ime,
  priimek: z.priimek,
  st_kartice: z.st_kartice ?? "",
  id_oddelek: z.id_oddelek,
  id_vodja: z.id_vodja,
  je_vodja: z.id_kot_vodja != null,
  email: z.email ?? "",
  uporabnisko_ime: z.uporabnisko_ime ?? "",
  geslo: "",
});
export const PRAZEN_VNOS: ZaposleniVnos = { ime: "", priimek: "", st_kartice: "", id_oddelek: null, id_vodja: null, je_vodja: false, email: "", uporabnisko_ime: "", geslo: "" };

async function nalozi(): Promise<ZaposleniPodatki> {
  const sb = getSupabase();
  const [vrstice, oddelki, vodjeVrstice, povezave] = await Promise.all([
    fetchAll<ZaposleniVrstica>((from, to) => sb.from("fos_zaposleni").select("id, ime, priimek, st_kartice, id_oddelek, email, uporabnisko_ime, id_uporabnika").eq("visible", true).order("id").range(from, to)),
    fetchAll<Oddelek>((from, to) => sb.from("fos_oddelek").select("id, ime_oddelka").eq("visible", true).order("ime_oddelka").range(from, to)),
    fetchAll<{ id: number; id_zaposlenega: number }>((from, to) => sb.from("fos_vodje").select("id, id_zaposlenega").eq("visible", true).order("id").range(from, to)),
    fetchAll<{ id_zaposlenega: number; id_vodja: number }>((from, to) =>
      sb.from("ln_fos_zaposleni_vodja").select("id_zaposlenega, id_vodja").eq("visible", true).order("id").range(from, to),
    ),
  ]);
  const oddelekPoId = new Map(oddelki.map((o) => [o.id, o]));
  const vrsticaPoId = new Map(vrstice.map((v) => [v.id, v]));
  // samo vodje, ki so vidni zaposleni
  const vodje = vodjeVrstice
    .filter((v) => vrsticaPoId.has(v.id_zaposlenega))
    .map((v) => ({ id: v.id, zaposleni: vrsticaPoId.get(v.id_zaposlenega)! }))
    .sort((a, b) => primerjajImena(a.zaposleni, b.zaposleni));
  const vodjaPoId = new Map(vodje.map((v) => [v.id, v]));
  const kotVodja = new Map(vodje.map((v) => [v.zaposleni.id, v.id]));
  const vodjaZaposlenega = new Map(povezave.map((l) => [l.id_zaposlenega, l.id_vodja]));

  const zaposleni = vrstice.map((v) => {
    const idVodja = vodjaZaposlenega.get(v.id) ?? null;
    return {
      ...v,
      oddelek: v.id_oddelek != null ? (oddelekPoId.get(v.id_oddelek) ?? null) : null,
      id_vodja: idVodja,
      vodja: idVodja != null ? (vodjaPoId.get(idVodja)?.zaposleni ?? null) : null,
      id_kot_vodja: kotVodja.get(v.id) ?? null,
    };
  });
  return { zaposleni, oddelki, vodje, poId: new Map(zaposleni.map((z) => [z.id, z])) };
}

// Skupen predpomnilnik: seznam -> list zaposlenega -> nazaj brez ponovnega nalaganja
let predpomnilnik: Promise<ZaposleniPodatki> | null = null;
const poslusalci = new Set<() => void>();

/** Po spremembi v bazi: vse odprte strani znova preberejo zaposlene. */
export function osveziZaposlene() {
  predpomnilnik = null;
  poslusalci.forEach((p) => p());
}

type Stanje = { podatki: ZaposleniPodatki | null; napaka: string | null };

/** Zaposleni, oddelki in vodje iz baze (samo visible). */
export function useZaposleni() {
  const [stanje, setStanje] = useState<Stanje>({ podatki: null, napaka: null });

  const preberi = useCallback(() => {
    predpomnilnik ??= nalozi();
    const p = predpomnilnik;
    let ziv = true;
    p.then(
      (podatki) => ziv && setStanje({ podatki, napaka: null }),
      (e: Error) => {
        if (predpomnilnik === p) predpomnilnik = null;
        if (ziv) setStanje({ podatki: null, napaka: e.message });
      },
    );
    return () => {
      ziv = false;
    };
  }, []);

  useEffect(() => {
    let preklici = preberi();
    const p = () => {
      preklici();
      preklici = preberi();
    };
    poslusalci.add(p);
    return () => {
      preklici();
      poslusalci.delete(p);
    };
  }, [preberi]);

  return stanje;
}

/** Napaka iz baze v razumljivem besedilu. */
function napaka(e: { message: string; code?: string } | null, vnos?: ZaposleniVnos): Error | null {
  if (!e) return null;
  if (e.code === "23505" && /kartica/.test(e.message)) return new Error(`Kartica ${vnos?.st_kartice ?? ""} je že dodeljena drugemu zaposlenemu.`);
  return new Error(e.message);
}

function vrstica(v: ZaposleniVnos) {
  return { ime: v.ime.trim(), priimek: v.priimek.trim(), st_kartice: v.st_kartice.trim() || null, id_oddelek: v.id_oddelek };
}

/** Preveri obvezna polja in prijavo; vrne besedilo napake ali null. */
export function preveriVnos(v: ZaposleniVnos): string | null {
  if (!v.ime.trim()) return "Vpiši ime zaposlenega.";
  if (!v.priimek.trim()) return "Vpiši priimek zaposlenega.";
  const p = preveriPrijavo(v);
  return typeof p === "string" ? p : null;
}

const prijavaSpremenjena = (v: ZaposleniVnos, prej: ZaposleniVnos) =>
  v.geslo !== "" || v.email.trim().toLowerCase() !== prej.email.trim().toLowerCase() || v.uporabnisko_ime.trim().toLowerCase() !== prej.uporabnisko_ime.trim().toLowerCase();

/** E-mail, uporabniško ime in geslo shrani strežnik (/api/zaposleni/racun) - geslo gre samo v Supabase Auth. */
async function shraniPrijavo(id: number, v: ZaposleniVnos) {
  const { data } = await getSupabase().auth.getSession();
  const odg = await fetch("/api/zaposleni/racun", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ id_zaposlenega: id, email: v.email, uporabnisko_ime: v.uporabnisko_ime, geslo: v.geslo || null }),
  });
  if (!odg.ok) throw new Error(((await odg.json().catch(() => null)) as { napaka?: string } | null)?.napaka ?? "Prijave ni bilo mogoče shraniti.");
}

/** Shrani vodjo in "je vodja" (ln_fos_zaposleni_vodja, fos_vodje) prek funkcij v bazi. */
async function shraniVodjo(id: number, v: ZaposleniVnos, prej?: ZaposleniVnos) {
  const sb = getSupabase();
  if (!prej || prej.je_vodja !== v.je_vodja) {
    const { error } = await sb.rpc("fos_nastavi_je_vodja", { p_id_zaposlenega: id, p_je_vodja: v.je_vodja });
    if (error) throw napaka(error);
  }
  if (!prej || prej.id_vodja !== v.id_vodja) {
    const { error } = await sb.rpc("fos_nastavi_vodjo", { p_id_zaposlenega: id, p_id_vodja: v.id_vodja });
    if (error) throw napaka(error);
  }
}

/** Doda zaposlenega (fos_zaposleni) in njegovega vodjo; vrne nov id. */
export async function dodajZaposlenega(v: ZaposleniVnos): Promise<number> {
  const { data, error } = await getSupabase().from("fos_zaposleni").insert(vrstica(v)).select("id").single();
  if (error) throw napaka(error, v);
  await shraniVodjo(data.id, v, { ...PRAZEN_VNOS });
  try {
    if (prijavaSpremenjena(v, PRAZEN_VNOS)) await shraniPrijavo(data.id, v);
  } finally {
    osveziZaposlene();
  }
  return data.id;
}

/** Shrani spremembe zaposlenega (samo spremenjene dele). */
export async function shraniZaposlenega(id: number, v: ZaposleniVnos, prej: ZaposleniVnos) {
  const nova = vrstica(v);
  const stara = vrstica(prej);
  if (JSON.stringify(nova) !== JSON.stringify(stara)) {
    const { error } = await getSupabase().from("fos_zaposleni").update(nova).eq("id", id);
    if (error) throw napaka(error, v);
  }
  await shraniVodjo(id, v, prej);
  try {
    if (prijavaSpremenjena(v, prej)) await shraniPrijavo(id, v);
  } finally {
    osveziZaposlene();
  }
}

/** fos_vodje.id zaposlenega; če še ni vodja, ga doda med vodje. */
export async function zagotoviVodjo(z: Zaposleni): Promise<number> {
  if (z.id_kot_vodja != null) return z.id_kot_vodja;
  const { data, error } = await getSupabase().rpc("fos_nastavi_je_vodja", { p_id_zaposlenega: z.id, p_je_vodja: true });
  if (error) throw napaka(error);
  return data as number;
}

/**
 * Premik v hierarhiji (Prikaz hierarhije): zaposleni dobi novega vodjo (nadrejeni postane vodja, če še ni).
 * nadrejeni = null: brez vodje; `novaLestvica` = ostane na vrhu kot vodja svoje lestvice.
 */
export async function premakniZaposlenega(z: Zaposleni, nadrejeni: Zaposleni | null, novaLestvica = false) {
  const sb = getSupabase();
  try {
    const idVodja = nadrejeni ? await zagotoviVodjo(nadrejeni) : null;
    const { error } = await sb.rpc("fos_nastavi_vodjo", { p_id_zaposlenega: z.id, p_id_vodja: idVodja });
    if (error) throw napaka(error);
    if (novaLestvica && z.id_kot_vodja == null) await zagotoviVodjo(z);
  } finally {
    osveziZaposlene();
  }
}

/** Drevo hierarhije: lestvice (vrh = vodja brez vodje), podrejeni po vodji, nerazporejeni (brez vodje in podrejenih). */
export function hierarhija(zaposleni: Zaposleni[]) {
  const podrejeni = new Map<number, Zaposleni[]>();
  for (const z of zaposleni) if (z.vodja) podrejeni.set(z.vodja.id, [...(podrejeni.get(z.vodja.id) ?? []), z]);
  for (const s of podrejeni.values()) s.sort(primerjajImena);
  const brezVodje = zaposleni.filter((z) => !z.vodja).sort(primerjajImena);
  const vrhovi = brezVodje.filter((z) => z.id_kot_vodja != null || podrejeni.has(z.id));
  const nerazporejeni = brezVodje.filter((z) => z.id_kot_vodja == null && !podrejeni.has(z.id));
  /** id-ji vseh (posrednih) podrejenih - tja zaposlenega ne smeš spustiti (krog). */
  const potomci = (id: number): Set<number> => {
    const out = new Set<number>();
    const sklad = [id];
    while (sklad.length)
      for (const p of podrejeni.get(sklad.pop()!) ?? []) {
        if (out.has(p.id)) continue;
        out.add(p.id);
        sklad.push(p.id);
      }
    return out;
  };
  return { vrhovi, nerazporejeni, podrejeni, potomci };
}
