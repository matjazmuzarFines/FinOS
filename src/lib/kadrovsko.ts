"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase";

/**
 * Kadrovski podatki zaposlenega (fos_zaposleni_kadrovsko, 007_kadrovsko.sql) - en vir za polja na listu zaposlenega.
 * Nov podatek = stolpec v 007 + vnos v RAZDELKI (polja se izrišejo sama, preverjanje v `preveri`).
 */
export type TipPolja = "besedilo" | "datum" | "stevilo" | "izbira";

export type Polje = {
  ime: string;
  naslov: string;
  tip: TipPolja;
  hint: string;
  placeholder?: string;
  moznosti?: { id: string; ime: string }[];
  /** Občutljiv podatek: prikazan skrit (zadnje 3 števke), oko ga pokaže. */
  obcutljivo?: boolean;
  mono?: boolean;
  /** Vrne besedilo napake ali null (vrednost je že obrezana, ni prazna). */
  preveri?: (v: string) => string | null;
  /** Širina v mreži (stolpcev od 4). */
  siroko?: 2 | 4;
  inputMode?: "numeric" | "decimal" | "tel" | "email";
};

export type Razdelek = { id: string; naslov: string; opis?: string; zavihek: "podatki" | "zaposlitev"; polja: Polje[] };

// ---------------------------------------------------------------------
// Preverjanje (kontrolne števke)
// ---------------------------------------------------------------------
const stevke = (v: string, n: number) => new RegExp(`^\\d{${n}}$`).test(v);

/** EMŠO: 13 števk, DDMMLLL..., kontrolna števka mod 11 (uteži 7 6 5 4 3 2). */
export function preveriEmso(v: string): string | null {
  if (!stevke(v, 13)) return "EMŠO ima 13 števk.";
  const u = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const s = u.reduce((a, w, i) => a + w * Number(v[i]), 0);
  const k = s % 11 === 0 ? 0 : 11 - (s % 11);
  if (k === 10 || k !== Number(v[12])) return "EMŠO ni pravilen (kontrolna števka se ne ujema).";
  if (!emsoPodatki(v)) return "EMŠO ni pravilen (datum rojstva ne obstaja).";
  return null;
}

/** Datum rojstva (YYYY-MM-DD) in spol iz EMŠO. */
export function emsoPodatki(v: string): { datum: string; spol: "M" | "Ž" } | null {
  if (!stevke(v, 13)) return null;
  const d = Number(v.slice(0, 2));
  const m = Number(v.slice(2, 4));
  const l3 = Number(v.slice(4, 7));
  const leto = l3 >= 800 ? 1000 + l3 : 2000 + l3;
  const datum = new Date(Date.UTC(leto, m - 1, d));
  if (datum.getUTCDate() !== d || datum.getUTCMonth() !== m - 1) return null;
  const st = Number(v.slice(9, 12));
  return { datum: datum.toISOString().slice(0, 10), spol: st < 500 ? "M" : "Ž" };
}

/** Davčna številka (SI): 8 števk, kontrolna števka mod 11 (uteži 8..2). */
export function preveriDavcno(v: string): string | null {
  if (!stevke(v, 8)) return "Davčna številka ima 8 števk.";
  const s = [8, 7, 6, 5, 4, 3, 2].reduce((a, w, i) => a + w * Number(v[i]), 0);
  const k = 11 - (s % 11);
  if (k === 11 || (k === 10 ? 0 : k) !== Number(v[7])) return "Davčna številka ni pravilna (kontrolna števka se ne ujema).";
  return null;
}

/** IBAN (mod 97); slovenski ima 19 znakov (SI56 ...). */
export function preveriIban(v: string): string | null {
  const iban = v.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban)) return "TRR vpiši kot IBAN, npr. SI56 0123 4567 8901 234.";
  if (iban.startsWith("SI") && iban.length !== 19) return "Slovenski IBAN ima 19 znakov (SI56 + 15 števk).";
  const preurejen = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let ostanek = 0;
  for (const z of preurejen) ostanek = (ostanek * 10 + Number(z)) % 97;
  return ostanek === 1 ? null : "TRR (IBAN) ni pravilen (kontrolni števki se ne ujemata).";
}

/** IBAN v skupinah po 4 znake. */
export const ibanZapis = (v: string) => v.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();

const preveriTelefon = (v: string) => (/^\+?[\d\s/()-]{6,20}$/.test(v) ? null : "Telefon vpiši s števkami, npr. 041 123 456 ali +386 41 123 456.");
const preveriEmail = (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail ni pravilen.");

/** Poštna številka: v Sloveniji 4 števke (1000-9999). */
const preveriPostno = (v: string) => (/^\d{4}$/.test(v) || !/^\d+$/.test(v) ? null : "Slovenska poštna številka ima 4 števke.");

const DRZAVA_PRIVZETO = "Slovenija";

const naslovPolja = (p: "stalno" | "zacasno"): Polje[] => [
  { ime: `${p}_ulica`, naslov: "Ulica", tip: "besedilo", hint: "Ulica ali naselje (brez hišne številke)", placeholder: "Kidričeva ulica", siroko: 2 },
  { ime: `${p}_hisna_st`, naslov: "Hišna številka", tip: "besedilo", hint: "Hišna številka z dodatkom, npr. 12a", placeholder: "12a" },
  { ime: `${p}_postna_st`, naslov: "Poštna številka", tip: "besedilo", hint: "Poštna številka (v Sloveniji 4 števke)", placeholder: "1000", mono: true, inputMode: "numeric", preveri: preveriPostno },
  { ime: `${p}_posta`, naslov: "Pošta", tip: "besedilo", hint: "Ime pošte, npr. Ljubljana", placeholder: "Ljubljana" },
  { ime: `${p}_drzava`, naslov: "Država", tip: "besedilo", hint: "Država prebivališča", placeholder: DRZAVA_PRIVZETO },
  {
    ime: `${p}_km_do_dela`,
    naslov: "Kilometri do dela",
    tip: "stevilo",
    hint: `Razdalja od ${p === "stalno" ? "stalnega" : "začasnega"} prebivališča do dela v eno smer (km, za povračilo stroškov prevoza)`,
    placeholder: "12,5",
    inputMode: "decimal",
    preveri: (v) => (Number(v) < 0 ? "Kilometri ne morejo biti negativni." : Number(v) > 500 ? "Več kot 500 km do dela - preveri vpis." : null),
  },
];

export const VRSTE_POGODBE = [
  { id: "nedolocen", ime: "Nedoločen čas" },
  { id: "dolocen", ime: "Določen čas" },
  { id: "studentsko", ime: "Študentsko delo" },
  { id: "podjemna", ime: "Podjemna pogodba" },
  { id: "avtorska", ime: "Avtorska pogodba" },
  { id: "prakticno", ime: "Praktično usposabljanje" },
];

/** Ravni izobrazbe (SOK / Klasius). */
const RAVNI = ["I", "II", "III", "IV", "V", "VI/1", "VI/2", "VII", "VIII/1", "VIII/2"].map((r) => ({ id: r, ime: `${r}. raven` }));

export const RAZDELKI: Razdelek[] = [
  {
    id: "osebno",
    naslov: "Osebni podatki",
    zavihek: "podatki",
    polja: [
      { ime: "emso", naslov: "EMŠO", tip: "besedilo", hint: "Enotna matična številka občana (13 števk) - izpolni tudi datum rojstva in spol", obcutljivo: true, mono: true, inputMode: "numeric", preveri: preveriEmso },
      { ime: "davcna_stevilka", naslov: "Davčna številka", tip: "besedilo", hint: "Davčna številka (8 števk)", obcutljivo: true, mono: true, inputMode: "numeric", preveri: preveriDavcno },
      {
        ime: "st_zzzs",
        naslov: "Št. zdravstvenega zavarovanja",
        tip: "besedilo",
        hint: "Številka zavarovane osebe ZZZS (9 števk, na kartici zdravstvenega zavarovanja)",
        obcutljivo: true,
        mono: true,
        inputMode: "numeric",
        preveri: (v) => (stevke(v, 9) ? null : "Številka zdravstvenega zavarovanja ima 9 števk."),
      },
      { ime: "datum_rojstva", naslov: "Datum rojstva", tip: "datum", hint: "Datum rojstva (izpolni se iz EMŠO)" },
      { ime: "kraj_rojstva", naslov: "Kraj rojstva", tip: "besedilo", hint: "Kraj rojstva", placeholder: "Ljubljana" },
      {
        ime: "spol",
        naslov: "Spol",
        tip: "izbira",
        hint: "Spol (izpolni se iz EMŠO)",
        moznosti: [
          { id: "M", ime: "Moški" },
          { id: "Ž", ime: "Ženski" },
        ],
      },
      { ime: "drzavljanstvo", naslov: "Državljanstvo", tip: "besedilo", hint: "Državljanstvo", placeholder: "slovensko" },
      { ime: "telefon", naslov: "Osebni telefon", tip: "besedilo", hint: "Osebna telefonska številka", placeholder: "041 123 456", inputMode: "tel", preveri: preveriTelefon },
      { ime: "osebni_email", naslov: "Osebni e-mail", tip: "besedilo", hint: "Osebni e-mail (ni nujno enak e-mailu za prijavo)", placeholder: "ime@gmail.com", inputMode: "email", preveri: preveriEmail, siroko: 2 },
    ],
  },
  { id: "stalno", naslov: "Stalno prebivališče", zavihek: "podatki", polja: naslovPolja("stalno") },
  {
    id: "zacasno",
    naslov: "Začasno prebivališče",
    opis: "Izpolni samo, če ga zaposleni ima. Prevoz iz = prebivališče, iz katerega zaposleni prihaja na delo (prazno = stalno) - po njem se obračunajo kilometri.",
    zavihek: "podatki",
    polja: [
      ...naslovPolja("zacasno"),
      {
        ime: "prevoz_iz",
        naslov: "Prevoz iz",
        tip: "izbira",
        hint: "Iz katerega prebivališča zaposleni prihaja na delo",
        moznosti: [
          { id: "stalno", ime: "Stalnega prebivališča" },
          { id: "zacasno", ime: "Začasnega prebivališča" },
        ],
      },
    ],
  },
  {
    id: "izplacilo",
    naslov: "Izplačilo",
    zavihek: "podatki",
    polja: [
      { ime: "trr", naslov: "TRR (IBAN)", tip: "besedilo", hint: "Transakcijski račun za izplačilo plače (IBAN)", placeholder: "SI56 0000 0000 0000 000", obcutljivo: true, mono: true, preveri: preveriIban, siroko: 2 },
      { ime: "banka", naslov: "Banka", tip: "besedilo", hint: "Banka, pri kateri je račun", placeholder: "NLB d.d.", siroko: 2 },
    ],
  },
  {
    id: "kontakt",
    naslov: "Kontakt v sili",
    zavihek: "podatki",
    polja: [
      { ime: "kontakt_ime", naslov: "Ime in priimek", tip: "besedilo", hint: "Koga obvestiti v primeru nesreče ali bolezni", siroko: 2 },
      { ime: "kontakt_odnos", naslov: "Odnos", tip: "besedilo", hint: "Odnos do zaposlenega, npr. partner, starš", placeholder: "partner" },
      { ime: "kontakt_telefon", naslov: "Telefon", tip: "besedilo", hint: "Telefon kontaktne osebe", placeholder: "041 123 456", inputMode: "tel", preveri: preveriTelefon },
    ],
  },
  {
    id: "pogodba",
    naslov: "Pogodba",
    zavihek: "zaposlitev",
    polja: [
      { ime: "datum_zaposlitve", naslov: "Datum zaposlitve", tip: "datum", hint: "Prvi delovni dan v Fines" },
      { ime: "vrsta_pogodbe", naslov: "Vrsta pogodbe", tip: "izbira", hint: "Vrsta pogodbe o zaposlitvi ali delu", moznosti: VRSTE_POGODBE },
      { ime: "pogodba_do", naslov: "Pogodba do", tip: "datum", hint: "Zadnji dan pogodbe za določen čas (sicer prazno)" },
      { ime: "delovno_mesto", naslov: "Delovno mesto", tip: "besedilo", hint: "Delovno mesto po pogodbi / sistemizaciji", placeholder: "Monter" },
    ],
  },
  {
    id: "cas",
    naslov: "Delovni čas in dopust",
    opis: "Osnova za beleženje delovnega časa in dopustov.",
    zavihek: "zaposlitev",
    polja: [
      { ime: "tedenske_ure", naslov: "Tedenske ure", tip: "stevilo", hint: "Pogodbeni delovni čas v urah na teden (polni čas = 40)", placeholder: "40", inputMode: "decimal", preveri: (v) => (Number(v) > 0 && Number(v) <= 60 ? null : "Tedenske ure so med 0 in 60.") },
      { ime: "letni_dopust", naslov: "Letni dopust (dni)", tip: "stevilo", hint: "Dni letnega dopusta na leto po pogodbi", placeholder: "20", inputMode: "numeric", preveri: (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? null : "Dnevi dopusta so celo število.") },
      { ime: "delovna_doba_prej", naslov: "Delovna doba prej (mesecev)", tip: "stevilo", hint: "Delovna doba pred zaposlitvijo v Fines, v mesecih", placeholder: "0", inputMode: "numeric", preveri: (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? null : "Delovna doba je celo število mesecev.") },
    ],
  },
  {
    id: "izobrazba",
    naslov: "Izobrazba",
    zavihek: "zaposlitev",
    polja: [
      { ime: "raven_izobrazbe", naslov: "Raven izobrazbe", tip: "izbira", hint: "Raven izobrazbe (SOK)", moznosti: RAVNI },
      { ime: "izobrazba", naslov: "Naziv izobrazbe", tip: "besedilo", hint: "Pridobljeni strokovni naziv", placeholder: "strojni tehnik", siroko: 2 },
    ],
  },
];

export const KADROVSKA_POLJA = RAZDELKI.flatMap((r) => r.polja);

/** Vnos: vsako polje kot besedilo ("" = prazno). */
export type KadrovskoVnos = Record<string, string>;
/** ids = id zapisa po tabeli (null = še ni zapisa); kadrovanje = osebni podatki so prebrani (funkcija Kadrovanje). */
export type Kadrovsko = { ids: Record<string, number | null>; vnos: KadrovskoVnos; kadrovanje: boolean };

export const PRAZNO_KADROVSKO: KadrovskoVnos = Object.fromEntries(KADROVSKA_POLJA.map((p) => [p.ime, ""]));

const izBaze = (p: Polje, v: unknown) => (v == null ? "" : p.ime === "trr" ? ibanZapis(String(v)) : p.tip === "stevilo" ? String(v).replace(".", ",") : String(v));

/** Vrednost za bazo. */
function vBazo(p: Polje, v: string): string | number | null {
  const t = v.trim();
  if (!t) return null;
  if (p.tip === "stevilo") return Number(t.replace(",", "."));
  if (p.ime === "trr") return t.replace(/\s+/g, "").toUpperCase();
  if (p.obcutljivo) return t.replace(/\s+/g, "");
  return t;
}

/** Napake po poljih (ime -> besedilo). */
export function preveriKadrovsko(v: KadrovskoVnos): Record<string, string> {
  const napake: Record<string, string> = {};
  for (const p of KADROVSKA_POLJA) {
    const t = (v[p.ime] ?? "").trim();
    if (!t) continue;
    const surovo = p.obcutljivo ? t.replace(/\s+/g, "") : t;
    if (p.tip === "stevilo" && !Number.isFinite(Number(surovo.replace(",", ".")))) napake[p.ime] = `${p.naslov}: vpiši število.`;
    else {
      const n = p.preveri?.(p.tip === "stevilo" ? surovo.replace(",", ".") : surovo);
      if (n) napake[p.ime] = n;
    }
  }
  if (v.pogodba_do && v.datum_zaposlitve && v.pogodba_do < v.datum_zaposlitve) napake.pogodba_do = "Pogodba ne more poteči pred datumom zaposlitve.";
  if (v.vrsta_pogodbe === "nedolocen" && v.pogodba_do) napake.pogodba_do = "Pogodba za nedoločen čas nima datuma konca.";
  if (v.prevoz_iz === "zacasno" && !v.zacasno_ulica?.trim()) napake.prevoz_iz = "Začasno prebivališče ni vpisano.";
  if (v.zacasno_km_do_dela?.trim() && !v.zacasno_ulica?.trim()) napake.zacasno_km_do_dela = "Najprej vpiši začasno prebivališče.";
  return napake;
}

/** Število spremenjenih polj. */
export const spremembKadrovsko = (v: KadrovskoVnos, prej: KadrovskoVnos) => KADROVSKA_POLJA.filter((p) => (v[p.ime] ?? "").trim() !== (prej[p.ime] ?? "").trim()).length;

// ---------------------------------------------------------------------
// Branje / pisanje
// ---------------------------------------------------------------------
/**
 * Tabela zavihka: Podatki = osebni podatki (fos_zaposleni_kadrovsko, samo s funkcijo Kadrovanje - RLS, 008),
 * Zaposlitev = fos_zaposleni_zaposlitev (Super Admin).
 */
export const TABELA: Record<Razdelek["zavihek"], string> = { podatki: "fos_zaposleni_kadrovsko", zaposlitev: "fos_zaposleni_zaposlitev" };
const POLJA_TABELE = (Object.keys(TABELA) as Razdelek["zavihek"][]).map((z) => ({ zavihek: z, tabela: TABELA[z], polja: RAZDELKI.filter((r) => r.zavihek === z).flatMap((r) => r.polja) }));

type Stanje = { podatki: Kadrovsko | null; napaka: string | null; manjkaTabela: boolean };

/**
 * Kadrovski podatki enega zaposlenega (ni zapisa = prazen vnos). Brez Kadrovanja se osebni podatki sploh ne berejo
 * (baza jih tudi ne bi vrnila) - polja ostanejo prazna, zavihek Podatki jih pokaže zaklenjene.
 */
export function useKadrovsko(idZaposlenega: number, kadrovanje: boolean) {
  const [stanje, setStanje] = useState<Stanje & { kljuc: string }>({ kljuc: "", podatki: null, napaka: null, manjkaTabela: false });
  const [verzija, setVerzija] = useState(0);
  const kljuc = `${idZaposlenega}-${kadrovanje}`;

  useEffect(() => {
    let ziv = true;
    const sb = getSupabase();
    Promise.all(
      POLJA_TABELE.filter((t) => kadrovanje || t.zavihek !== "podatki").map(async (t) => {
        const { data, error } = await sb.from(t.tabela).select("*").eq("id_zaposlenega", idZaposlenega).eq("visible", true).maybeSingle();
        return { t, data: data as Record<string, unknown> | null, error };
      }),
    ).then((rezultati) => {
      if (!ziv) return;
      const napaka = rezultati.find((r) => r.error)?.error;
      const manjka = !!napaka && /relation|does not exist|schema cache/i.test(napaka.message);
      if (napaka && !manjka) return setStanje({ kljuc, podatki: null, napaka: napaka.message, manjkaTabela: false });
      const vnos: KadrovskoVnos = { ...PRAZNO_KADROVSKO };
      const ids: Record<string, number | null> = {};
      for (const r of rezultati) {
        ids[r.t.tabela] = (r.data?.id as number | undefined) ?? null;
        for (const p of r.t.polja) vnos[p.ime] = izBaze(p, r.data?.[p.ime]);
      }
      setStanje({ kljuc, podatki: { ids, vnos, kadrovanje }, napaka: manjka ? napaka.message : null, manjkaTabela: manjka });
    });
    return () => {
      ziv = false;
    };
  }, [idZaposlenega, kadrovanje, kljuc, verzija]);

  const osvezi = useCallback(() => setVerzija((v) => v + 1), []);
  const s = stanje.kljuc === kljuc ? stanje : { podatki: null, napaka: null, manjkaTabela: false };
  return { ...s, osvezi };
}

/** Shrani spremenjena polja po tabelah (nov zapis, če ga še ni). Osebnih podatkov brez Kadrovanja ne piše. */
export async function shraniKadrovsko(idZaposlenega: number, k: Kadrovsko, v: KadrovskoVnos) {
  for (const t of POLJA_TABELE) {
    if (t.zavihek === "podatki" && !k.kadrovanje) continue;
    const spremembe = Object.fromEntries(t.polja.filter((p) => (v[p.ime] ?? "").trim() !== (k.vnos[p.ime] ?? "").trim()).map((p) => [p.ime, vBazo(p, v[p.ime] ?? "")]));
    if (!Object.keys(spremembe).length) continue;
    const id = k.ids[t.tabela];
    const sb = getSupabase().from(t.tabela);
    const { error } = id != null ? await sb.update(spremembe).eq("id", id) : await sb.insert({ id_zaposlenega: idZaposlenega, ...spremembe });
    if (!error) continue;
    if (error.code === "23505" && /emso/.test(error.message)) throw new Error("Ta EMŠO ima že drug zaposleni.");
    if (error.code === "23505" && /davcna/.test(error.message)) throw new Error("To davčno številko ima že drug zaposleni.");
    if (error.code === "42501") throw new Error("Za osebne podatke potrebuješ funkcijo Kadrovanje.");
    throw new Error(`Kadrovskih podatkov ni bilo mogoče shraniti: ${error.message}`);
  }
}
