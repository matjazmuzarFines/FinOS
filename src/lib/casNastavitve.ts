"use client";

import { useEffect, useSyncExternalStore } from "react";
import { praznik } from "./prazniki";
import { fetchAll, getSupabase } from "./supabase";
import {
  Award,
  Baby,
  BookOpen,
  Briefcase,
  Building,
  CalendarHeart,
  Car,
  Clock,
  Coffee,
  DoorOpen,
  Factory,
  Flame,
  Gift,
  GraduationCap,
  HeartPulse,
  Hourglass,
  House,
  Laptop,
  MapPin,
  Moon,
  Plane,
  Shield,
  Siren,
  Stethoscope,
  Sun,
  Thermometer,
  TreePalm,
  Truck,
  UserX,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Nastavitve registracije časa: statistike, urniki, intervali, posebni prazniki.
 *
 * BAZA: statistike in lastnosti (kvadratki) - 009_statistike.sql; dnevi, intervali, urniki, posebni prazniki in urniki
 * zaposlenih - 010_urniki.sql. Dokler tabel ni (migracija ni zagnana), so v brskalniku TESTNI podatki (značka na strani).
 * Šifranti (lastnosti, dnevi) so podatki, ne koda - nov vnos = nova vrstica.
 */

/** Lastnost statistike (kvadratek pri statistiki, fos_lastnosti): koda se uporablja v izračunih. */
export type Lastnost = { id: number; koda: string; ime: string; opis: string };
/** Statistika (fos_statistike): v katero statistiko gre štempljanje; barva in ikona za prikaz. */
export type Statistika = { id: number; koda: string; ime: string; opis: string; barva: string; ikona: string; lastnosti: number[]; visible: boolean };
/** Dan, na katerega velja interval (fos_dnevi): pon-ned in praznik. iso = 1 (pon) .. 7 (ned), praznik = null. */
export type Dan = { id: number; koda: string; ime: string; kratko: string; iso: number | null };
/**
 * Interval (fos_intervali): časovno okno OD-DO (npr. Prihod na delo 06:00-09:00) z obvezno eno statistiko -
 * kdor pride v tem oknu, dobi čas od prihoda do izhoda v to statistiko. Velja na izbrane dni in v obdobju veljavnosti.
 * cas_do < cas_od = okno čez polnoč (npr. 22:00-02:00). Čas se vedno šteje v dan ZAČETKA (prihoda).
 */
export type Interval = {
  id: number;
  ime: string;
  prikazno_ime: string;
  opis: string;
  cas_od: string;
  cas_do: string;
  velja_od: string | null;
  velja_do: string | null;
  dnevi: number[];
  /** Obvezno (null samo med vnosom novega intervala). */
  id_statistike: number | null;
  visible: boolean;
};
/** Urnik (fos_urniki): skupina, v katero je dodan vsak zaposleni; intervali prek ln_fos_urniki_intervali. */
export type Urnik = { id: number; ime: string; opis: string; intervali: number[]; visible: boolean };

export type CasNastavitve = {
  lastnosti: Lastnost[];
  statistike: Statistika[];
  dnevi: Dan[];
  intervali: Interval[];
  urniki: Urnik[];
  /** Posebni dela prosti dnevi (standardni so v prazniki.ts). */
  prazniki: PosebniPraznik[];
  /** Trenutni urnik zaposlenih (ln_fos_zaposleni_urniki, en viden zapis na zaposlenega). */
  zaposleniUrniki: ZaposleniUrnik[];
  /** Od kod so statistike: nalagam / baza / test (baza ni dosegljiva - napakaBaze). */
  vir: "nalagam" | "baza" | "test";
  napakaBaze: string | null;
  /** Od kod so urniki, intervali, prazniki (010). */
  virUrnikov: "nalagam" | "baza" | "test";
  napakaUrnikov: string | null;
};

export type ZaposleniUrnik = { id_zaposlenega: number; id_urnika: number; velja_od: string };

/** Poseben dela prost dan (npr. dan solidarnosti) - poleg standardnih praznikov po zakonu. */
export type PosebniPraznik = { id: number; datum: string; ime: string; opis: string; visible: boolean };

/** Ikone, ki jih lahko izbereš za statistiko (v bazi se hrani ime). */
export const IKONE_STATISTIK: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  factory: Factory,
  house: House,
  laptop: Laptop,
  plane: Plane,
  car: Car,
  truck: Truck,
  building: Building,
  "map-pin": MapPin,
  "door-open": DoorOpen,
  utensils: Utensils,
  coffee: Coffee,
  thermometer: Thermometer,
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  "tree-palm": TreePalm,
  sun: Sun,
  "calendar-heart": CalendarHeart,
  baby: Baby,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  award: Award,
  siren: Siren,
  flame: Flame,
  shield: Shield,
  wrench: Wrench,
  clock: Clock,
  hourglass: Hourglass,
  moon: Moon,
  "user-x": UserX,
};
export const ikonaStatistike = (ime: string | undefined): LucideIcon => (ime && IKONE_STATISTIK[ime]) || Clock;

/** Predlagane barve v urejevalniku (barvo lahko izbereš tudi prosto). */
export const BARVE = ["#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#ef4444", "#b91c1c", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#64748b", "#a8a29e"];

// ---------------------------------------------------------------------------------------------------------------
// Testni podatki
// ---------------------------------------------------------------------------------------------------------------

const LASTNOSTI: Lastnost[] = [
  { id: 1, koda: "delovna_obveznost", ime: "Štej v delovno obveznost", opis: "Čas v tej statistiki se šteje kot opravljen delovni čas (kot da si na delu)." },
  { id: 2, koda: "prevozi", ime: "Štej prevoze", opis: "Dan s to statistiko prinese povračilo za prevoz na delo (1 na delovni dan v podjetju)." },
  { id: 3, koda: "malice", ime: "Štej malice", opis: "Čas v tej statistiki se šteje v ure za malico (nad 4 h 1 malica, nad 12 h 2)." },
  { id: 4, koda: "lanski_dopust", ime: "Štej lanski dopust", opis: "Odsotnost se najprej odšteje od lanskega (prenesenega) dopusta." },
];

const s = (id: number, koda: string, ime: string, barva: string, ikona: string, lastnosti: number[], opis: string): Statistika => ({ id, koda, ime, opis, barva, ikona, lastnosti, visible: true });
const STATISTIKE: Statistika[] = [
  s(1, "DELO", "Delo po urniku", "#22c55e", "briefcase", [1, 2, 3], "Standardni prihod in odhod na delo v podjetju."),
  s(2, "DOM", "Delo od doma", "#14b8a6", "house", [1, 3], "Delo od doma - štempljanje prek FIN:ME, brez prevoza."),
  s(3, "SLP", "Službena pot", "#3b82f6", "plane", [1, 3], "Službena pot po potnem nalogu."),
  s(4, "SLO", "Službena odsotnost", "#8b5cf6", "building", [1, 2, 3], "Službeni izhod med delovnim časom (stranka, banka, pošta ...)."),
  s(5, "ZAS", "Zasebna odsotnost", "#ef4444", "door-open", [], "Zasebni izhod med delovnim časom - ne šteje v delovni čas."),
  s(6, "MAL", "Malica", "#eab308", "utensils", [1, 3], "Odmor za malico (plačan, šteje v delovni čas)."),
  s(7, "BOL", "Bolniška", "#b91c1c", "thermometer", [1], "Bolniška odsotnost (nadomestilo plače)."),
  s(8, "DOP", "Redni dopust", "#0ea5e9", "tree-palm", [1], "Letni dopust tekočega leta."),
  s(9, "LDOP", "Lanski dopust", "#38bdf8", "sun", [1, 4], "Preneseni dopust iz prejšnjega leta."),
  s(10, "IZD", "Izredni dopust", "#f59e0b", "calendar-heart", [1], "Izredni plačani dopust (poroka, selitev, smrt v družini ...)."),
  s(11, "POR", "Porodniški dopust", "#ec4899", "baby", [], "Porodniški in starševski dopust."),
  s(12, "IZS", "Izredno stanje", "#f97316", "siren", [1], "Izredne razmere (naravna nesreča, višja sila)."),
];

const DNEVI: Dan[] = [
  { id: 1, koda: "pon", ime: "Ponedeljek", kratko: "Pon", iso: 1 },
  { id: 2, koda: "tor", ime: "Torek", kratko: "Tor", iso: 2 },
  { id: 3, koda: "sre", ime: "Sreda", kratko: "Sre", iso: 3 },
  { id: 4, koda: "cet", ime: "Četrtek", kratko: "Čet", iso: 4 },
  { id: 5, koda: "pet", ime: "Petek", kratko: "Pet", iso: 5 },
  { id: 6, koda: "sob", ime: "Sobota", kratko: "Sob", iso: 6 },
  { id: 7, koda: "ned", ime: "Nedelja", kratko: "Ned", iso: 7 },
  { id: 8, koda: "praznik", ime: "Prazniki", kratko: "Praz", iso: null },
];

const i = (id: number, ime: string, prikazno_ime: string, cas_od: string, cas_do: string, dnevi: number[], stat: number, opis = "", velja_od: string | null = "2026-01-01", velja_do: string | null = null): Interval => ({
  id,
  ime,
  prikazno_ime,
  opis,
  cas_od,
  cas_do,
  velja_od,
  velja_do,
  dnevi,
  id_statistike: stat,
  visible: true,
});

const INTERVALI: Interval[] = [
  i(1, "PRIHOD_PISARNA", "Prihod", "06:00", "09:00", [1, 2, 3, 4, 5], 1, "Gibljiv prihod v pisarno."),
  i(2, "PRIHOD_PISARNA_PET", "Prihod", "06:00", "08:00", [5], 1, "Poletni petek - prihod do 8:00.", "2026-06-01", "2026-08-31"),
  i(3, "PRIHOD_JUTRANJA", "Prihod", "05:30", "06:30", [1, 2, 3, 4, 5], 1, "Proizvodnja - fiksen prihod do 6:30."),
  i(4, "PRIHOD_POPOLDANSKA", "Prihod", "13:30", "14:30", [1, 2, 3, 4, 5], 1, "Proizvodnja - druga izmena."),
  i(5, "PRIHOD_SOBOTA", "Prihod", "05:30", "06:30", [6], 1, "Dodatna sobotna izmena po potrebi."),
  i(6, "DEZURSTVO_SERVIS", "Dežurstvo", "07:00", "09:00", [6, 7, 8], 1, "Dežurni serviser ob vikendih in praznikih."),
  i(7, "PRIHOD_TEREN", "Prihod", "07:00", "09:00", [1, 2, 3, 4, 5], 1, "Serviserji na terenu."),
  i(8, "PRIHOD_NOCNI", "Prihod", "21:00", "01:00", [1, 2, 3, 4, 5], 1, "Npr. programer: prihod 22:00, odhod 01:00 - vse šteje v dan prihoda."),
];

const URNIKI: Urnik[] = [
  { id: 1, ime: "Pisarna", opis: "Uprava, prodaja, računovodstvo - gibljiv delovni čas.", intervali: [1, 2], visible: true },
  { id: 2, ime: "Proizvodnja - 2 izmeni", opis: "Izmensko delo v proizvodnji - fiksen prihod.", intervali: [3, 4, 5], visible: true },
  { id: 3, ime: "Servis", opis: "Serviserji na terenu z dežurstvom.", intervali: [7, 6], visible: true },
];

const PRAZNIKI: PosebniPraznik[] = [{ id: 1, datum: "2023-08-14", ime: "Dan solidarnosti", opis: "Enkraten dela prost dan po poplavah.", visible: true }];

// ---------------------------------------------------------------------------------------------------------------
// Shramba (v brskalniku)
// ---------------------------------------------------------------------------------------------------------------

let stanje: CasNastavitve = {
  lastnosti: LASTNOSTI,
  statistike: STATISTIKE,
  dnevi: DNEVI,
  intervali: INTERVALI,
  urniki: URNIKI,
  prazniki: PRAZNIKI,
  zaposleniUrniki: [],
  vir: "nalagam",
  napakaBaze: null,
  virUrnikov: "nalagam",
  napakaUrnikov: null,
};
const poslusalci = new Set<() => void>();
const narocnina = (p: () => void) => {
  poslusalci.add(p);
  return () => poslusalci.delete(p);
};
const spremeni = (fn: (s: CasNastavitve) => CasNastavitve) => {
  stanje = fn(stanje);
  poslusalci.forEach((p) => p());
};
const novId = (seznam: { id: number }[]) => Math.max(0, ...seznam.map((x) => x.id)) + 1;

/** Vse nastavitve registracije časa (skupne vsem stranem; skriti zapisi so v seznamih z visible = false). */
export function useCasNastavitve(): CasNastavitve {
  useEffect(() => {
    nalaganje ??= naloziStatistike();
    nalaganjeUrnikov ??= naloziUrnike();
  }, []);
  return useSyncExternalStore(narocnina, () => stanje, () => stanje);
}

// ---------------------------------------------------------------------------------------------------------------
// Statistike iz baze (009)
// ---------------------------------------------------------------------------------------------------------------

let nalaganje: Promise<void> | null = null;
/** Testni intervali kažejo na testne statistike - ob prvem branju iz baze se preslikajo po kodi. */
const kodaTestne = new Map(STATISTIKE.map((x) => [x.id, x.koda]));
let preslikano = false;

async function naloziStatistike() {
  const sb = getSupabase();
  try {
    const [lastnosti, statistike, povezave] = await Promise.all([
      fetchAll<Lastnost>((from, to) => sb.from("fos_lastnosti").select("id, koda, ime, opis").eq("visible", true).order("vrstni_red").range(from, to)),
      fetchAll<Omit<Statistika, "lastnosti">>((from, to) => sb.from("fos_statistike").select("id, koda, ime, opis, barva, ikona, visible").order("vrstni_red").order("id").range(from, to)),
      fetchAll<{ id_statistike: number; id_lastnosti: number }>((from, to) => sb.from("ln_fos_statistike_lastnosti").select("id_statistike, id_lastnosti").eq("visible", true).order("id").range(from, to)),
    ]);
    const zLastnostmi = statistike.map((x) => ({ ...x, lastnosti: povezave.filter((p) => p.id_statistike === x.id).map((p) => p.id_lastnosti).sort((a, b) => a - b) }));
    const poKodi = new Map(zLastnostmi.filter((x) => x.visible).map((x) => [x.koda, x.id]));
    spremeni((st) => ({
      ...st,
      vir: "baza",
      napakaBaze: null,
      lastnosti,
      statistike: zLastnostmi,
      // testni intervali (baza 010 še ni) kažejo na testne statistike
      intervali: preslikano || st.virUrnikov === "baza" ? st.intervali : st.intervali.map((iv) => ({ ...iv, id_statistike: poKodi.get(kodaTestne.get(iv.id_statistike ?? -1) ?? "") ?? null })),
    }));
    preslikano = true;
  } catch (e) {
    nalaganje = null;
    spremeni((st) => ({ ...st, vir: "test", napakaBaze: (e as Error).message }));
  }
}

/** Po spremembi: znova preberi statistike iz baze. */
const osvezi = () => {
  nalaganje = naloziStatistike();
  return nalaganje;
};
const napakaBaze = (e: { message: string; code?: string } | null, v?: StatistikaVnos) => {
  if (!e) return null;
  if (e.code === "23505") return new Error(`Koda ${v?.koda ?? ""} že obstaja.`);
  return new Error(e.message);
};
export const casNastavitve = () => stanje;

export type StatistikaVnos = Omit<Statistika, "id" | "visible">;
export const PRAZNA_STATISTIKA: StatistikaVnos = { koda: "", ime: "", opis: "", barva: BARVE[0], ikona: "briefcase", lastnosti: [] };

/** Napaka vnosa statistike ali null (koda: velike črke, številke, _; enolična med prikazanimi). */
export function preveriStatistiko(v: StatistikaVnos, id?: number): Partial<Record<keyof StatistikaVnos, string>> {
  const n: Partial<Record<keyof StatistikaVnos, string>> = {};
  if (!v.koda.trim()) n.koda = "Vpiši kodo.";
  else if (!/^[A-Z0-9_]{1,12}$/.test(v.koda)) n.koda = "Samo velike črke, številke in _ (največ 12 znakov).";
  else if (stanje.statistike.some((x) => x.visible && x.id !== id && x.koda === v.koda)) n.koda = `Koda ${v.koda} že obstaja.`;
  if (!v.ime.trim()) n.ime = "Vpiši ime statistike.";
  if (!/^#[0-9a-f]{6}$/i.test(v.barva)) n.barva = "Barva mora biti v obliki #RRGGBB.";
  return n;
}

/** Doda ali shrani statistiko in njene kvadratke (dodani = nov zapis, odvzeti = skrit). Brez baze: samo v brskalniku. */
export async function shraniStatistiko(v: StatistikaVnos, id?: number): Promise<number> {
  const vrstica = { koda: v.koda.trim(), ime: v.ime.trim(), opis: v.opis.trim(), barva: v.barva.toLowerCase(), ikona: v.ikona };
  if (stanje.vir !== "baza") {
    const nov = id ?? novId(stanje.statistike);
    const zapis = { ...vrstica, lastnosti: v.lastnosti, id: nov, visible: true };
    spremeni((st) => ({ ...st, statistike: id ? st.statistike.map((x) => (x.id === id ? zapis : x)) : [...st.statistike, zapis] }));
    return nov;
  }
  const sb = getSupabase();
  let idStat = id;
  try {
    if (id) {
      const { error } = await sb.from("fos_statistike").update(vrstica).eq("id", id);
      if (error) throw napakaBaze(error, v);
    } else {
      const { data, error } = await sb.from("fos_statistike").insert({ ...vrstica, vrstni_red: stanje.statistike.length + 1 }).select("id").single();
      if (error) throw napakaBaze(error, v);
      idStat = data.id as number;
    }
    const stare = id ? (stanje.statistike.find((x) => x.id === id)?.lastnosti ?? []) : [];
    const dodaj = v.lastnosti.filter((l) => !stare.includes(l));
    const odvzemi = stare.filter((l) => !v.lastnosti.includes(l));
    if (dodaj.length) {
      const { error } = await sb.from("ln_fos_statistike_lastnosti").insert(dodaj.map((l) => ({ id_statistike: idStat, id_lastnosti: l })));
      if (error) throw napakaBaze(error);
    }
    if (odvzemi.length) {
      const { error } = await sb.from("ln_fos_statistike_lastnosti").update({ visible: false }).eq("id_statistike", idStat!).eq("visible", true).in("id_lastnosti", odvzemi);
      if (error) throw napakaBaze(error);
    }
  } finally {
    await osvezi();
  }
  return idStat!;
}

/** Brez brisanja: statistika se skrije (intervali jo obdržijo, dokler je ne zamenjaš). */
export async function skrijStatistiko(id: number) {
  if (stanje.vir !== "baza") return spremeni((st) => ({ ...st, statistike: st.statistike.map((x) => (x.id === id ? { ...x, visible: false } : x)) }));
  try {
    const { error } = await getSupabase().from("fos_statistike").update({ visible: false }).eq("id", id);
    if (error) throw napakaBaze(error);
  } finally {
    await osvezi();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Urniki, intervali, prazniki, urniki zaposlenih iz baze (010). Brez baze (tabele še niso narejene): testni podatki.
// ---------------------------------------------------------------------------------------------------------------

let nalaganjeUrnikov: Promise<void> | null = null;
const cas = (t: string) => t.slice(0, 5); // "06:00:00" -> "06:00"

async function naloziUrnike() {
  const sb = getSupabase();
  try {
    const [dnevi, intervali, dneviIntervalov, urniki, intervaliUrnikov, zaposleniUrniki, prazniki] = await Promise.all([
      fetchAll<{ id: number; koda: string; ime: string; kratko: string; iso_dan: number | null }>((from, to) => sb.from("fos_dnevi").select("id, koda, ime, kratko, iso_dan").eq("visible", true).order("vrstni_red").range(from, to)),
      fetchAll<Omit<Interval, "dnevi">>((from, to) =>
        sb.from("fos_intervali").select("id, ime, prikazno_ime, opis, cas_od, cas_do, velja_od, velja_do, id_statistike, visible").eq("visible", true).order("vrstni_red").order("id").range(from, to),
      ),
      fetchAll<{ id_intervala: number; id_dneva: number }>((from, to) => sb.from("ln_fos_intervali_dnevi").select("id_intervala, id_dneva").eq("visible", true).order("id").range(from, to)),
      fetchAll<Omit<Urnik, "intervali">>((from, to) => sb.from("fos_urniki").select("id, ime, opis, visible").eq("visible", true).order("vrstni_red").order("ime").range(from, to)),
      fetchAll<{ id_urnika: number; id_intervala: number }>((from, to) => sb.from("ln_fos_urniki_intervali").select("id_urnika, id_intervala").eq("visible", true).order("id").range(from, to)),
      fetchAll<ZaposleniUrnik>((from, to) => sb.from("ln_fos_zaposleni_urniki").select("id_zaposlenega, id_urnika, velja_od").eq("visible", true).order("id").range(from, to)),
      fetchAll<PosebniPraznik>((from, to) => sb.from("fos_prazniki").select("id, datum, ime, opis, visible").eq("visible", true).order("datum").range(from, to)),
    ]);
    spremeni((st) => ({
      ...st,
      virUrnikov: "baza",
      napakaUrnikov: null,
      dnevi: dnevi.map((d) => ({ id: d.id, koda: d.koda, ime: d.ime, kratko: d.kratko, iso: d.iso_dan })),
      intervali: intervali.map((i) => ({ ...i, cas_od: cas(i.cas_od), cas_do: cas(i.cas_do), dnevi: dneviIntervalov.filter((d) => d.id_intervala === i.id).map((d) => d.id_dneva).sort((a, b) => a - b) })),
      urniki: urniki.map((u) => ({ ...u, intervali: intervaliUrnikov.filter((l) => l.id_urnika === u.id).map((l) => l.id_intervala) })),
      zaposleniUrniki,
      prazniki,
    }));
  } catch (e) {
    nalaganjeUrnikov = null;
    spremeni((st) => ({ ...st, virUrnikov: "test", napakaUrnikov: (e as Error).message }));
  }
}

const osveziUrnike = () => {
  nalaganjeUrnikov = naloziUrnike();
  return nalaganjeUrnikov;
};
const vBazi = () => stanje.virUrnikov === "baza";
const napakaUrnikov = (e: { message: string; code?: string } | null, enolicno = "Zapis s tem imenom že obstaja.") => {
  if (!e) return null;
  if (e.code === "23505") return new Error(enolicno);
  return new Error(e.message);
};
/** Zapis v bazo, nato ponovno branje (tudi ob napaki, da je prikaz enak bazi). */
async function vBazo(fn: (sb: ReturnType<typeof getSupabase>) => Promise<void>) {
  try {
    await fn(getSupabase());
  } finally {
    await osveziUrnike();
  }
}
const preveri = ({ error }: { error: { message: string; code?: string } | null }, enolicno?: string) => {
  if (error) throw napakaUrnikov(error, enolicno);
};

export type UrnikVnos = Pick<Urnik, "ime" | "opis">;
export async function shraniUrnik(v: UrnikVnos, id?: number): Promise<number> {
  const vrstica = { ime: v.ime.trim(), opis: v.opis.trim() };
  if (!vBazi()) {
    const nov = id ?? novId(stanje.urniki);
    spremeni((s) => ({ ...s, urniki: id ? s.urniki.map((x) => (x.id === id ? { ...x, ...vrstica } : x)) : [...s.urniki, { id: nov, ...vrstica, intervali: [], visible: true }] }));
    return nov;
  }
  let nov = id;
  await vBazo(async (sb) => {
    if (id) return preveri(await sb.from("fos_urniki").update(vrstica).eq("id", id), "Urnik s tem imenom že obstaja.");
    const r = await sb.from("fos_urniki").insert({ ...vrstica, vrstni_red: stanje.urniki.length + 1 }).select("id").single();
    preveri(r, "Urnik s tem imenom že obstaja.");
    nov = r.data!.id as number;
  });
  return nov!;
}

/** Vrstni red urnikov (povleci in spusti v seznamu levo). Prikaz takoj, baza v ozadju. */
export async function preurediUrnike(od: number, na: number) {
  const a = [...stanje.urniki];
  const i = a.findIndex((x) => x.id === od);
  const j = a.findIndex((x) => x.id === na);
  if (i < 0 || j < 0) return;
  a.splice(j, 0, a.splice(i, 1)[0]);
  spremeni((st) => ({ ...st, urniki: a }));
  if (!vBazi()) return;
  await vBazo(async (sb) => {
    const rez = await Promise.all(a.map((x, k) => sb.from("fos_urniki").update({ vrstni_red: k + 1 }).eq("id", x.id)));
    rez.forEach((r) => preveri(r));
  });
}

/** Skrije urnik; zaposleni v njem ostanejo brez urnika (njihov zapis se skrije - zgodovina). */
export async function skrijUrnik(id: number) {
  if (!vBazi()) return spremeni((s) => ({ ...s, urniki: s.urniki.map((x) => (x.id === id ? { ...x, visible: false } : x)), zaposleniUrniki: s.zaposleniUrniki.filter((z) => z.id_urnika !== id) }));
  await vBazo(async (sb) => {
    preveri(await sb.from("fos_urniki").update({ visible: false }).eq("id", id));
    preveri(await sb.from("ln_fos_zaposleni_urniki").update({ visible: false }).eq("id_urnika", id).eq("visible", true));
  });
}

/** Poveže intervale z urnikom (ln_fos_urniki_intervali) ali odveže enega (skrit zapis). */
export async function povezi(idUrnika: number, ids: number[]) {
  const novi = ids.filter((x) => !stanje.urniki.find((u) => u.id === idUrnika)?.intervali.includes(x));
  if (!novi.length) return;
  if (!vBazi()) return spremeni((s) => ({ ...s, urniki: s.urniki.map((u) => (u.id === idUrnika ? { ...u, intervali: [...u.intervali, ...novi] } : u)) }));
  await vBazo(async (sb) => preveri(await sb.from("ln_fos_urniki_intervali").insert(novi.map((id_intervala) => ({ id_urnika: idUrnika, id_intervala })))));
}
export async function odvezi(idUrnika: number, idIntervala: number) {
  if (!vBazi()) return spremeni((s) => ({ ...s, urniki: s.urniki.map((u) => (u.id === idUrnika ? { ...u, intervali: u.intervali.filter((x) => x !== idIntervala) } : u)) }));
  await vBazo(async (sb) => preveri(await sb.from("ln_fos_urniki_intervali").update({ visible: false }).eq("id_urnika", idUrnika).eq("id_intervala", idIntervala).eq("visible", true)));
}

export type IntervalVnos = Omit<Interval, "id" | "visible">;
export const PRAZEN_INTERVAL: IntervalVnos = { ime: "", prikazno_ime: "", opis: "", cas_od: "06:00", cas_do: "08:00", velja_od: null, velja_do: null, dnevi: [1, 2, 3, 4, 5], id_statistike: null };

const CAS = /^\d{2}:\d{2}$/;
export function preveriInterval(v: IntervalVnos, id?: number): Partial<Record<keyof IntervalVnos, string>> {
  const n: Partial<Record<keyof IntervalVnos, string>> = {};
  if (!v.ime.trim()) n.ime = "Vpiši ime intervala.";
  else if (stanje.intervali.some((x) => x.visible && x.id !== id && x.ime.trim().toLowerCase() === v.ime.trim().toLowerCase())) n.ime = "Interval s tem imenom že obstaja.";
  if (!CAS.test(v.cas_od)) n.cas_od = "Vpiši začetek intervala.";
  if (!CAS.test(v.cas_do)) n.cas_do = "Vpiši konec intervala.";
  else if (v.cas_do === v.cas_od) n.cas_do = "Konec mora biti drugačen od začetka.";
  if (v.velja_od && v.velja_do && v.velja_do < v.velja_od) n.velja_do = "Konec veljavnosti je pred začetkom.";
  if (!v.dnevi.length) n.dnevi = "Izberi vsaj en dan.";
  if (v.id_statistike == null) n.id_statistike = "Izberi statistiko - interval ima obvezno eno.";
  return n;
}

/** Shrani interval in njegove dneve (ln_fos_intervali_dnevi: dodani = nov zapis, odvzeti = skrit). Nov gre na konec seznama. */
export async function shraniInterval(v: IntervalVnos, id?: number): Promise<number> {
  const vrstica = { ime: v.ime.trim(), prikazno_ime: v.prikazno_ime.trim(), opis: v.opis.trim(), cas_od: v.cas_od, cas_do: v.cas_do, velja_od: v.velja_od, velja_do: v.velja_do, id_statistike: v.id_statistike };
  if (!vBazi()) {
    const nov = id ?? novId(stanje.intervali);
    const zapis: Interval = { ...vrstica, dnevi: v.dnevi, id: nov, visible: true };
    spremeni((s) => ({ ...s, intervali: id ? s.intervali.map((x) => (x.id === id ? zapis : x)) : [...s.intervali, zapis] }));
    return nov;
  }
  let nov = id;
  await vBazo(async (sb) => {
    if (id) preveri(await sb.from("fos_intervali").update(vrstica).eq("id", id), "Interval s tem imenom že obstaja.");
    else {
      const r = await sb.from("fos_intervali").insert({ ...vrstica, vrstni_red: stanje.intervali.length + 1 }).select("id").single();
      preveri(r, "Interval s tem imenom že obstaja.");
      nov = r.data!.id as number;
    }
    const stari = id ? (stanje.intervali.find((x) => x.id === id)?.dnevi ?? []) : [];
    const dodaj = v.dnevi.filter((d) => !stari.includes(d));
    const odvzemi = stari.filter((d) => !v.dnevi.includes(d));
    if (dodaj.length) preveri(await sb.from("ln_fos_intervali_dnevi").insert(dodaj.map((id_dneva) => ({ id_intervala: nov, id_dneva }))));
    if (odvzemi.length) preveri(await sb.from("ln_fos_intervali_dnevi").update({ visible: false }).eq("id_intervala", nov!).eq("visible", true).in("id_dneva", odvzemi));
  });
  return nov!;
}

/** Vrstni red intervalov (povleci in spusti): interval "od" gre na mesto intervala "na". Prikaz takoj, baza v ozadju. */
export async function preurediIntervale(od: number, na: number) {
  const a = [...stanje.intervali];
  const i = a.findIndex((x) => x.id === od);
  const j = a.findIndex((x) => x.id === na);
  if (i < 0 || j < 0) return;
  a.splice(j, 0, a.splice(i, 1)[0]);
  spremeni((st) => ({ ...st, intervali: a }));
  if (!vBazi()) return;
  const [zac, kon] = [Math.min(i, j), Math.max(i, j)];
  await vBazo(async (sb) => {
    const rez = await Promise.all(a.slice(zac, kon + 1).map((x, k) => sb.from("fos_intervali").update({ vrstni_red: zac + k + 1 }).eq("id", x.id)));
    rez.forEach((r) => preveri(r));
  });
}

/** Skrije interval in ga odveže od vseh urnikov. */
export async function skrijInterval(id: number) {
  if (!vBazi())
    return spremeni((s) => ({ ...s, intervali: s.intervali.map((x) => (x.id === id ? { ...x, visible: false } : x)), urniki: s.urniki.map((u) => ({ ...u, intervali: u.intervali.filter((x) => x !== id) })) }));
  await vBazo(async (sb) => {
    preveri(await sb.from("fos_intervali").update({ visible: false }).eq("id", id));
    preveri(await sb.from("ln_fos_urniki_intervali").update({ visible: false }).eq("id_intervala", id).eq("visible", true));
  });
}

/** Ali interval velja na datum (YYYY-MM-DD) - brez meja = vedno. */
export const veljaNa = (iv: Pick<Interval, "velja_od" | "velja_do">, datum: string) => (!iv.velja_od || iv.velja_od <= datum) && (!iv.velja_do || iv.velja_do >= datum);

/** Ime dela prostega dne na datum: poseben (tabela) ali standarden (zakon) - ali null. */
export const imePraznika = (datum: string, n: Pick<CasNastavitve, "prazniki">) => n.prazniki.find((p) => p.visible && p.datum === datum)?.ime ?? praznik(datum);

export async function dodajPraznik(v: Pick<PosebniPraznik, "datum" | "ime" | "opis">) {
  const vrstica = { datum: v.datum, ime: v.ime.trim(), opis: v.opis.trim() };
  if (!vBazi()) return spremeni((s) => ({ ...s, prazniki: [...s.prazniki, { ...vrstica, id: novId(s.prazniki), visible: true }] }));
  await vBazo(async (sb) => preveri(await sb.from("fos_prazniki").insert(vrstica), "Na ta dan je že praznik."));
}
export async function skrijPraznik(id: number) {
  if (!vBazi()) return spremeni((s) => ({ ...s, prazniki: s.prazniki.map((p) => (p.id === id ? { ...p, visible: false } : p)) }));
  await vBazo(async (sb) => preveri(await sb.from("fos_prazniki").update({ visible: false }).eq("id", id)));
}

/** Urnik zaposlenega (trenuten) ali null. */
export const urnikZaposlenega = (idZaposlenega: number, n: Pick<CasNastavitve, "zaposleniUrniki" | "urniki">) => {
  const z = n.zaposleniUrniki.find((x) => x.id_zaposlenega === idZaposlenega);
  return (z && n.urniki.find((u) => u.id === z.id_urnika && u.visible)) ?? null;
};

/** Urniki zaposlenih (okno "Urniki zaposlenih"): star zapis se skrije, nov velja od danes (fos_nastavi_urnik). */
export async function nastaviUrnike(spremembe: { id_zaposlenega: number; id_urnika: number | null }[]) {
  if (!spremembe.length) return;
  if (!vBazi()) {
    const danes = new Date().toISOString().slice(0, 10);
    return spremeni((s) => ({
      ...s,
      zaposleniUrniki: [
        ...s.zaposleniUrniki.filter((z) => !spremembe.some((x) => x.id_zaposlenega === z.id_zaposlenega)),
        ...spremembe.filter((x) => x.id_urnika != null).map((x) => ({ id_zaposlenega: x.id_zaposlenega, id_urnika: x.id_urnika!, velja_od: danes })),
      ],
    }));
  }
  await vBazo(async (sb) => {
    for (const x of spremembe) preveri(await sb.rpc("fos_nastavi_urnik", { p_id_zaposlenega: x.id_zaposlenega, p_id_urnika: x.id_urnika }));
  });
}

/** Okno intervala prečka polnoč (konec je naslednji dan). */
export const cezPolnoc = (iv: Pick<Interval, "cas_od" | "cas_do">) => iv.cas_do < iv.cas_od;
