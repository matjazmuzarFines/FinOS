"use client";

import { useCallback, useEffect, useState } from "react";
import { AppWindow, Building2, type LucideIcon } from "lucide-react";
import { fetchAll, getSupabase } from "./supabase";
import { osveziZaposlene } from "./zaposleni";

/**
 * Podatki baze (Administracija -> Nastavitve -> Podatki baze): tabele, ki jih urejamo v aplikaciji.
 * Nova tabela = nov vnos v TABELE (stolpci, navodila za CSV, primeri). Sistemski stolpci (id, visible,
 * created_at, updated_at) so na vsaki tabeli in jih ne opisujemo.
 */
export type TipStolpca = "besedilo" | "stevilo" | "seznam" | "logicno";

export type Stolpec = {
  ime: string;
  naslov: string;
  tip: TipStolpca;
  /** Tip v Postgres (prikaz kot v Supabase). */
  pgTip: string;
  obvezno?: boolean;
  /** Vrednost je enolična (velike / male črke niso pomembne). */
  enolicno?: boolean;
  /** Prazna vrednost ob dodajanju (kot `default` v bazi). */
  privzeto?: string;
  opis: string;
  primer: string;
};

export type TabelaBaze = {
  ime: string;
  naslov: string;
  opis: string;
  icon: LucideIcon;
  /** Stolpec, po katerem uvoz CSV prepozna obstoječo vrstico (posodobi namesto doda). */
  kljuc: string;
  stolpci: Stolpec[];
  /** Vrstice v predlogi CSV (surove vrednosti kot v CSV). */
  primeri: Record<string, string>[];
  /** Pravila, ki jih mora poznati, kdor ureja tabelo. */
  opombe: string[];
};

export const TABELE: TabelaBaze[] = [
  {
    ime: "fos_oddelek",
    naslov: "Oddelki",
    opis: "Šifrant oddelkov za zaposlene (izbira oddelka, filtri, hierarhija).",
    icon: Building2,
    kljuc: "ime_oddelka",
    stolpci: [{ ime: "ime_oddelka", naslov: "Ime oddelka", tip: "besedilo", pgTip: "text", obvezno: true, enolicno: true, opis: "Ime, kot se prikaže v aplikaciji.", primer: "Proizvodnja" }],
    primeri: [{ ime_oddelka: "Proizvodnja" }, { ime_oddelka: "Montaža" }, { ime_oddelka: "Tehnična pomoč" }],
    opombe: [
      "Oddelek z istim imenom se ne doda drugič - uvoz ga posodobi (npr. ga znova prikaže z visible = true).",
      "Skrit oddelek (visible = false) se ne ponuja več pri izbiri; zaposleni, ki ga že imajo, ga obdržijo.",
    ],
  },
  {
    ime: "fos_aplikacije",
    naslov: "Aplikacije",
    opis: "Fines aplikacije, do katerih ima zaposleni lahko dostop (zaposleni -> Dostopi).",
    icon: AppWindow,
    kljuc: "koda",
    stolpci: [
      { ime: "koda", naslov: "Koda", tip: "besedilo", pgTip: "text", obvezno: true, enolicno: true, opis: "Kratka oznaka aplikacije, male črke brez presledkov. Po kodi uvoz prepozna obstoječo vrstico.", primer: "fp" },
      { ime: "ime", naslov: "Ime", tip: "besedilo", pgTip: "text", obvezno: true, opis: "Ime ob stikalu v Dostopih zaposlenega.", primer: "Fines - Production" },
      { ime: "opis", naslov: "Opis", tip: "besedilo", pgTip: "text", opis: "Kratek opis pod imenom.", primer: "Proizvodnja, skladišče, planiranje" },
      {
        ime: "predpone",
        naslov: "Predpone tabel",
        tip: "seznam",
        pgTip: "text[]",
        opis: "Predpone tabel aplikacije, ločene z |. Zaposleni z dostopom sme v vse tabele s temi predponami (tudi ln_<predpona>).",
        primer: "fp_|spl_",
      },
      { ime: "kosare", naslov: "Košare datotek", tip: "seznam", pgTip: "text[]", opis: "Imena košar v Supabase Storage, ločena z |.", primer: "fp-rutina-slike" },
      { ime: "vrstni_red", naslov: "Vrstni red", tip: "stevilo", pgTip: "int4", privzeto: "0", opis: "Celo število - vrstni red stikal v Dostopih (manjše prej).", primer: "1" },
    ],
    primeri: [
      { koda: "fp", ime: "Fines - Production", opis: "Proizvodnja, skladišče, planiranje, rutine", predpone: "fp_|spl_", kosare: "fp-rutina-slike", vrstni_red: "1" },
      { koda: "kp", ime: "Kontrolne točke", opis: "Kontrolni postopki in kontrolne točke", predpone: "kp_", kosare: "", vrstni_red: "2" },
    ],
    opombe: [
      "Predpone določajo dostop do podatkov: napačna predpona da zaposlenim dostop do tujih tabel ali ga vzame.",
      "Predpone fos_ ne vpisuj - FIN:OS tabele so samo za Super Admina.",
      "Skrita aplikacija (visible = false) izgine iz Dostopov in nihče več nima dostopa do njenih tabel.",
    ],
  },
];

/** Sistemski stolpci (na vsaki tabeli, samo za branje - razen visible). */
export const SISTEMSKI = ["id", "visible", "created_at", "updated_at"] as const;

export type Vrstica = Record<string, unknown> & { id: number; visible: boolean; created_at: string; updated_at: string };

export const tabela = (ime: string | null) => TABELE.find((t) => t.ime === ime);

const LOGICNO_DA = ["true", "da", "1", "yes", "t", "x"];
const LOGICNO_NE = ["false", "ne", "0", "no", "f", ""];

/** Vrednost iz vnosa / celice CSV v vrednost za bazo; napaka = besedilo za uporabnika. */
export function pretvori(s: Stolpec, surovo: string): { vrednost: unknown } | { napaka: string } {
  const v = surovo.trim();
  if (s.tip === "seznam") {
    // a|b, a,b ali {a,b} (zapis iz Postgres)
    return { vrednost: [...new Set(v.replace(/^\{|\}$/g, "").split(/[|,]/).map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean))] };
  }
  if (!v) {
    if (s.privzeto != null) return pretvori(s, s.privzeto);
    return s.obvezno ? { napaka: `${s.naslov} je obvezen podatek.` } : { vrednost: null };
  }
  if (s.tip === "stevilo") {
    const n = Number(v.replace(",", "."));
    return Number.isInteger(n) ? { vrednost: n } : { napaka: `${s.naslov}: "${v}" ni celo število.` };
  }
  if (s.tip === "logicno") {
    const m = v.toLowerCase();
    if (LOGICNO_DA.includes(m)) return { vrednost: true };
    if (LOGICNO_NE.includes(m)) return { vrednost: false };
    return { napaka: `${s.naslov}: "${v}" ni da / ne (true / false).` };
  }
  return { vrednost: v };
}

/** Vrednost iz baze v besedilo za vnosno polje / CSV. */
export function vBesedilo(s: Pick<Stolpec, "tip">, v: unknown): string {
  if (v == null) return "";
  if (s.tip === "seznam") return Array.isArray(v) ? v.join("|") : String(v);
  if (s.tip === "logicno") return v ? "true" : "false";
  return String(v);
}

const enako = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const normaliziraj = (v: unknown) => String(v ?? "").trim().toLocaleLowerCase("sl");

/** Vrstica z isto vrednostjo enoličnega stolpca (razen vrstice `razen`). */
export function podvojena(t: TabelaBaze, vrstice: Vrstica[], podatki: Record<string, unknown>, razen?: number): string | null {
  for (const s of t.stolpci.filter((s) => s.enolicno)) {
    const n = normaliziraj(podatki[s.ime]);
    const ista = vrstice.find((v) => v.id !== razen && normaliziraj(v[s.ime]) === n);
    if (ista) return `${s.naslov} "${String(podatki[s.ime])}" že obstaja (ID ${ista.id}${ista.visible ? "" : ", skrita vrstica"}).`;
  }
  return null;
}

/** Napaka iz baze v razumljivem besedilu. */
function napakaBaze(e: { message: string; code?: string }, t: TabelaBaze): Error {
  if (e.code === "23505") return new Error(`Vrednost enoličnega stolpca (${t.stolpci.filter((s) => s.enolicno).map((s) => s.naslov).join(", ")}) že obstaja.`);
  if (e.code === "42501") return new Error("Ni pravice za pisanje v to tabelo.");
  return new Error(e.message);
}

// ---------------------------------------------------------------------
// Branje
// ---------------------------------------------------------------------
const poslusalci = new Set<() => void>();

/** Po spremembi: odprte strani znova preberejo tabele; oddelki in aplikacije so tudi v podatkih zaposlenih. */
function osvezi() {
  poslusalci.forEach((p) => p());
  osveziZaposlene();
}

type Stanje = { vrstice: Vrstica[] | null; napaka: string | null };

/** Vse vrstice tabele (tudi skrite), urejene po ID. */
export function useTabela(t: TabelaBaze) {
  const [stanje, setStanje] = useState<Stanje & { ime: string }>({ ime: t.ime, vrstice: null, napaka: null });

  const preberi = useCallback(() => {
    let ziv = true;
    fetchAll<Vrstica>((from, to) => getSupabase().from(t.ime).select("*").order("id").range(from, to)).then(
      (vrstice) => ziv && setStanje({ ime: t.ime, vrstice, napaka: null }),
      (e: Error) => ziv && setStanje({ ime: t.ime, vrstice: null, napaka: e.message }),
    );
    return () => {
      ziv = false;
    };
  }, [t.ime]);

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

  // ob menjavi tabele ne pokaži vrstic prejšnje
  return stanje.ime === t.ime ? stanje : { vrstice: null, napaka: null };
}

/** Število vidnih vrstic na tabelo (meni tabel). */
export function useStevila() {
  const [stevila, setStevila] = useState<Record<string, number>>({});
  useEffect(() => {
    let ziv = true;
    const preberi = () =>
      Promise.all(
        TABELE.map(async (t) => {
          const { count } = await getSupabase().from(t.ime).select("id", { count: "exact", head: true }).eq("visible", true);
          return [t.ime, count ?? 0] as const;
        }),
      ).then((s) => ziv && setStevila(Object.fromEntries(s)));
    preberi();
    poslusalci.add(preberi);
    return () => {
      ziv = false;
      poslusalci.delete(preberi);
    };
  }, []);
  return stevila;
}

// ---------------------------------------------------------------------
// Pisanje (brez brisanja - skrivanje z visible)
// ---------------------------------------------------------------------
export async function dodajVrstico(t: TabelaBaze, podatki: Record<string, unknown>): Promise<number> {
  const { data, error } = await getSupabase().from(t.ime).insert(podatki).select("id").single();
  if (error) throw napakaBaze(error, t);
  osvezi();
  return data.id as number;
}

/** Shrani samo spremenjene stolpce. */
export async function shraniVrstico(t: TabelaBaze, prej: Vrstica, podatki: Record<string, unknown>) {
  const spremembe = Object.fromEntries(Object.entries(podatki).filter(([k, v]) => !enako(prej[k], v)));
  if (!Object.keys(spremembe).length) return;
  const { error } = await getSupabase().from(t.ime).update(spremembe).eq("id", prej.id);
  if (error) throw napakaBaze(error, t);
  osvezi();
}

// ---------------------------------------------------------------------
// Uvoz CSV
// ---------------------------------------------------------------------
export type UvozVrstica = {
  /** Številka vrstice v datoteki (glava = 1). */
  st: number;
  podatki: Record<string, unknown>;
  stanje: "nova" | "posodobi" | "enaka" | "napaka";
  sporocilo?: string;
  obstojeca?: Vrstica;
};

export type UvozPriprava = { napake: string[]; opozorila: string[]; stolpci: string[]; vrstice: UvozVrstica[] };

/**
 * Prebere CSV glede na opis tabele: preveri glavo (obvezni stolpci, neznani se prezrejo), pretvori vrednosti
 * in vsako vrstico razvrsti: nova / posodobi (isti ključ že obstaja) / enaka / napaka.
 */
export function pripraviUvoz(t: TabelaBaze, glava: string[], celice: string[][], obstojece: Vrstica[]): UvozPriprava {
  const napake: string[] = [];
  const opozorila: string[] = [];
  const znani = new Map<string, string>([...t.stolpci.map((s) => [s.ime, s.ime] as const), ["visible", "visible"]]);
  const indeks = new Map<string, number>();
  glava.forEach((g, i) => {
    const ime = znani.get(g.toLowerCase());
    if (!g) return;
    if (!ime) opozorila.push(`Stolpec "${g}" ni v tabeli ${t.ime} - prezrt.`);
    else if (indeks.has(ime)) napake.push(`Stolpec "${g}" je v glavi dvakrat.`);
    else indeks.set(ime, i);
  });
  for (const s of t.stolpci) if (s.obvezno && !indeks.has(s.ime)) napake.push(`Manjka obvezen stolpec "${s.ime}".`);
  if (!indeks.has(t.kljuc)) napake.push(`Manjka stolpec "${t.kljuc}", po katerem se prepozna obstoječa vrstica.`);
  if (!celice.length) napake.push("Datoteka nima vrstic s podatki (prva vrstica je glava).");
  if (napake.length) return { napake, opozorila, stolpci: [...indeks.keys()], vrstice: [] };

  const visible: Stolpec = { ime: "visible", naslov: "visible", tip: "logicno", pgTip: "bool", opis: "", primer: "" };
  const poKljucu = new Map(obstojece.map((v) => [normaliziraj(v[t.kljuc]), v]));
  const vDatoteki = new Map<string, number>();

  const vrstice = celice.map((c, i): UvozVrstica => {
    const st = i + 2;
    const podatki: Record<string, unknown> = {};
    const tezave: string[] = [];
    for (const s of [...t.stolpci, visible]) {
      const k = indeks.get(s.ime);
      if (k == null) continue;
      const surovo = c[k] ?? "";
      // prazen visible = brez spremembe (nova vrstica dobi true)
      if (s === visible && !surovo.trim()) continue;
      const r = pretvori(s, surovo);
      if ("napaka" in r) tezave.push(r.napaka);
      else podatki[s.ime] = r.vrednost;
    }
    if (tezave.length) return { st, podatki, stanje: "napaka", sporocilo: tezave.join(" ") };

    const kljuc = normaliziraj(podatki[t.kljuc]);
    const prejsnja = vDatoteki.get(kljuc);
    if (prejsnja != null) return { st, podatki, stanje: "napaka", sporocilo: `${t.kljuc} "${String(podatki[t.kljuc])}" je že v vrstici ${prejsnja}.` };
    vDatoteki.set(kljuc, st);

    const obstojeca = poKljucu.get(kljuc);
    if (!obstojeca) {
      const dvojnik = podvojena(t, obstojece, podatki);
      return dvojnik ? { st, podatki, stanje: "napaka", sporocilo: dvojnik } : { st, podatki, stanje: "nova" };
    }
    const dvojnik = podvojena(t, obstojece, podatki, obstojeca.id);
    if (dvojnik) return { st, podatki, stanje: "napaka", sporocilo: dvojnik, obstojeca };
    const spremenjeno = Object.entries(podatki).some(([k, v]) => !enako(obstojeca[k], v));
    return { st, podatki, stanje: spremenjeno ? "posodobi" : "enaka", obstojeca };
  });
  return { napake, opozorila, stolpci: [...indeks.keys()], vrstice };
}

/** Zapiše pripravljene vrstice: nove v paketih, obstoječe posamično (samo spremenjene stolpce). */
export async function uvozi(t: TabelaBaze, vrstice: UvozVrstica[], posodobi: boolean): Promise<{ dodanih: number; posodobljenih: number }> {
  const sb = getSupabase();
  const nove = vrstice.filter((v) => v.stanje === "nova").map((v) => v.podatki);
  const spremenjene = posodobi ? vrstice.filter((v) => v.stanje === "posodobi") : [];
  let dodanih = 0;
  let posodobljenih = 0;
  try {
    for (let i = 0; i < nove.length; i += 500) {
      const { error } = await sb.from(t.ime).insert(nove.slice(i, i + 500));
      if (error) throw napakaBaze(error, t);
      dodanih += Math.min(500, nove.length - i);
    }
    for (const v of spremenjene) {
      const spremembe = Object.fromEntries(Object.entries(v.podatki).filter(([k, x]) => !enako(v.obstojeca![k], x)));
      const { error } = await sb.from(t.ime).update(spremembe).eq("id", v.obstojeca!.id);
      if (error) throw new Error(`Vrstica ${v.st}: ${napakaBaze(error, t).message}`);
      posodobljenih++;
    }
  } catch (e) {
    throw new Error(`${(e as Error).message} Zapisanih pred napako: ${dodanih} dodanih, ${posodobljenih} posodobljenih.`);
  } finally {
    osvezi();
  }
  return { dodanih, posodobljenih };
}

/** Glava predloge / izvoza: stolpci tabele + visible. */
export const glavaCsv = (t: TabelaBaze) => [...t.stolpci.map((s) => s.ime), "visible"];

export const imeDatoteke = (t: TabelaBaze, vrsta: string) => `${t.ime}_${vrsta}.csv`;
