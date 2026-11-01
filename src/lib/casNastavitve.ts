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
 * Tipke krmilnika (fos_tipke, fos_intervali.id_tipke) - 013_krmilnik.sql; brez njih urniki delajo naprej, tipke so testne.
 * Šifranti (lastnosti, dnevi) so podatki, ne koda - nov vnos = nova vrstica.
 */

/** Lastnost statistike (kvadratek pri statistiki, fos_lastnosti): koda se uporablja v izračunih. */
export type Lastnost = { id: number; koda: string; ime: string; opis: string };
/** Statistika (fos_statistike): v katero statistiko gre štempljanje; barva in ikona za prikaz. */
export type Statistika = { id: number; koda: string; ime: string; opis: string; barva: string; ikona: string; lastnosti: number[]; visible: boolean };
/** Dan, na katerega velja interval (fos_dnevi): pon-ned in praznik. iso = 1 (pon) .. 7 (ned), praznik = null. */
export type Dan = { id: number; koda: string; ime: string; kratko: string; iso: number | null };
/** Zaokroževanje knjiženega časa (null = brez). */
export type Zaokrozevanje = "gor" | "dol" | "najblizje";
/**
 * Pravila knjiženja intervala (011_pravila_obveznost.sql): krmilnik vedno zapiše dejanski čas, pravila določijo KNJIŽEN čas (izračun v
 * knjizenje.ts). Veljajo po vrsti intervala: prihod = začetek izmene, izhod = konec izmene in presežek nad dnevno
 * obveznostjo (saldo), tipka = seštevek trajanja (prekoračitev v drugo statistiko).
 */
export type PravilaIntervala = {
  /** Prihod: "ne prej kot" (npr. 06:30 - prej se knjiži 06:30); null = dejanski čas. */
  zacetek_ne_prej: string | null;
  zacetek_zaokrozi: Zaokrozevanje | null;
  zacetek_korak: number;
  /** Izhod: "ne pozneje kot"; null = dejanski čas. */
  konec_ne_pozneje: string | null;
  konec_zaokrozi: Zaokrozevanje | null;
  konec_korak: number;
  /** Izhod: presežek nad obveznostjo - šteje ves / zaokroži navzdol na presezek_korak / ne šteje. */
  presezek: "steje" | "zaokrozi" | "ne_steje";
  presezek_korak: number;
  /** Tipka: največ minut na dan (vsi odseki tipke skupaj, npr. malica 30); null = brez omejitve. */
  trajanje_max: number | null;
  /** Tipka: statistika za čas nad trajanje_max (npr. Zamuda); obvezna, ko je trajanje omejeno. */
  id_statistike_prekoracitve: number | null;
};
export const PRAVILA_DEJANSKO: PravilaIntervala = {
  zacetek_ne_prej: null,
  zacetek_zaokrozi: null,
  zacetek_korak: 15,
  konec_ne_pozneje: null,
  konec_zaokrozi: null,
  konec_korak: 15,
  presezek: "steje",
  presezek_korak: 15,
  trajanje_max: null,
  id_statistike_prekoracitve: null,
};
export const POLJA_PRAVIL = Object.keys(PRAVILA_DEJANSKO) as (keyof PravilaIntervala)[];

/** Kje se tipka pokaže (fos_tipke.prikaz); nobeno = nikjer. */
export const MESTA_TIPK = { krmilnik: "Krmilnik", fin_me: "FIN:ME" } as const;
export type MestoTipke = keyof typeof MESTA_TIPK;
/** Sistemska funkcija tipke na krmilniku (namesto intervala). */
export const FUNKCIJE_TIPK = { info: "Info - stanje in saldo", preklici: "Prekliči zadnji pritisk" } as const;
export type FunkcijaTipke = keyof typeof FUNKCIJE_TIPK;

/**
 * Tipka (fos_tipke): številka (1, 2, 3 ...) in besedilo, ki se izpiše ob žigu s to tipko; prikaz = kje se pokaže.
 * Tipka s funkcijo (Info, Prekliči) ni za interval.
 */
export type Tipka = { id: number; tipka: number; besedilo: string; prikaz: MestoTipke[]; funkcija: FunkcijaTipke | null; visible: boolean };

/** Vrsta intervala (014): prihod in izhod brez tipke (samodejno ob prislonu kartice), tipka = izhod / odsotnost s tipko. */
export const VRSTE_INTERVALOV = {
  prihod: { ime: "Prihod", okno: "Prihod", opis: "Okno prihoda - začne izmeno. Brez tipke = samodejno ob prislonu kartice; s tipko (npr. Izredno) = drug prihod, ki ga izbere tipka." },
  izhod: { ime: "Izhod", okno: "Izhod", opis: "Okno izhoda - konča izmeno. Brez tipke = samodejno ob prislonu kartice; s tipko (npr. Izredno) = drug izhod, ki ga izbere tipka." },
  tipka: { ime: "Tipka", okno: "Žig", opis: "Izhod s tipko (malica, odmor, poslovni ...) - oba žiga morata biti v oknu." },
} as const;
export type VrstaIntervala = keyof typeof VRSTE_INTERVALOV;

/**
 * Interval (fos_intervali): časovno okno OD-DO z obvezno eno statistiko in vrsto. Prihod: kdor pride v oknu, dobi čas od
 * prihoda do izhoda v statistiko intervala. Izhod: okno izhoda. Tipka: čas od žiga s tipko do vrnitve gre v statistiko.
 * Velja vedno, na izbrane dni (neuporaben interval se izbriše). cas_do < cas_od = okno čez polnoč (npr. 22:00-02:00).
 * Čas se vedno šteje v dan ZAČETKA (prihoda).
 */
export type Interval = {
  id: number;
  ime: string;
  prikazno_ime: string;
  opis: string;
  vrsta: VrstaIntervala;
  cas_od: string;
  cas_do: string;
  dnevi: number[];
  /** Obvezno (null samo med vnosom novega intervala). */
  id_statistike: number | null;
  /** Tipka (fos_tipke): obvezna pri vrsti tipka; pri prihodu / izhodu neobvezna (drug prihod / izhod s tipko, 016). */
  id_tipke: number | null;
  visible: boolean;
} & PravilaIntervala;
/**
 * Urnik (fos_urniki): skupina, v katero je dodan vsak zaposleni; intervali prek ln_fos_urniki_intervali.
 * obveznost = delovna obveznost v minutah po id dneva (fos_dnevi, ln_fos_urniki_dnevi); manjkajoč dan = 0.
 */
export type Urnik = { id: number; ime: string; opis: string; intervali: number[]; obveznost: Record<number, number>; visible: boolean };

export type CasNastavitve = {
  lastnosti: Lastnost[];
  statistike: Statistika[];
  dnevi: Dan[];
  tipke: Tipka[];
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
  /** Od kod so pravila intervalov in delovna obveznost (011_pravila_obveznost.sql); test = samo v brskalniku. */
  virPravil: "nalagam" | "baza" | "test";
  napakaPravil: string | null;
  /** Od kod so tipke krmilnika in vrsta intervala (013, 014); test = samo v brskalniku. */
  virTipk: "nalagam" | "baza" | "test";
  napakaTipk: string | null;
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

const t = (id: number, tipka: number, besedilo: string, prikaz: MestoTipke[] = ["krmilnik"], funkcija: FunkcijaTipke | null = null): Tipka => ({ id, tipka, besedilo, prikaz, funkcija, visible: true });
const TIPKE: Tipka[] = [
  t(1, 1, "Poslovni izhod"),
  t(2, 2, "Privatni izhod"),
  t(3, 4, "Info", ["krmilnik"], "info"),
  t(4, 5, "Odmor"),
  t(5, 9, "Prekliči", ["krmilnik"], "preklici"),
  t(6, 101, "Delo od doma", ["fin_me"]),
  t(7, 3, "Izredno"),
];

const i = (id: number, vrsta: VrstaIntervala, ime: string, prikazno_ime: string, cas_od: string, cas_do: string, dnevi: number[], stat: number, opis = "", dodatno: Partial<Interval> = {}): Interval => ({
  ...PRAVILA_DEJANSKO,
  id,
  ime,
  prikazno_ime,
  opis,
  vrsta,
  cas_od,
  cas_do,
  dnevi,
  id_statistike: stat,
  id_tipke: null,
  visible: true,
  ...dodatno,
});

const VSI_DNEVI = [1, 2, 3, 4, 5, 6, 7, 8];
const PON_PET = [1, 2, 3, 4, 5];
const PON_SOB = [1, 2, 3, 4, 5, 6];
const INTERVALI: Interval[] = [
  i(1, "prihod", "PRIHOD_PISARNA", "Prihod", "06:00", "09:00", PON_PET, 1, "Gibljiv prihod v pisarno."),
  i(2, "prihod", "PRIHOD_PROIZVODNJA", "Prihod", "00:00", "06:30", PON_SOB, 1, "Proizvodnja 1 izmena - prihod do 6:30 (kasneje = napaka)."),
  i(3, "tipka", "POSLOVNI_IZHOD", "Poslovni izhod", "00:00", "23:59", VSI_DNEVI, 4, "Poslovni izhod - šteje v delovni čas.", { id_tipke: 1 }),
  i(4, "tipka", "PRIVATNI_IZHOD", "Privatni izhod", "00:00", "23:59", VSI_DNEVI, 5, "Privatni izhod - ne šteje v delovni čas.", { id_tipke: 2 }),
  i(5, "tipka", "ODMOR_PISARNA", "Odmor", "00:00", "23:59", VSI_DNEVI, 6, "Odmor kadarkoli, skupaj 30 min na dan; več gre v zasebno odsotnost.", { id_tipke: 4, trajanje_max: 30, id_statistike_prekoracitve: 5 }),
  i(6, "tipka", "ODMOR_PROIZVODNJA", "Odmor", "09:55", "10:35", PON_SOB, 6, "Odmor med 9:55 in 10:35 (oba žiga), skupaj 30 min.", { id_tipke: 4, trajanje_max: 30, id_statistike_prekoracitve: 5 }),
  i(7, "tipka", "DELO_OD_DOMA", "Delo od doma", "00:00", "23:59", PON_PET, 2, "Prihod s tipko v FIN:ME.", { id_tipke: 6 }),
  i(8, "izhod", "IZHOD_PISARNA", "Izhod", "00:00", "23:59", PON_PET, 1, "Izhod kadarkoli; presežek nad obveznostjo se zaokroži navzdol na 15 min.", { presezek: "zaokrozi" }),
  i(9, "izhod", "IZHOD_PROIZVODNJA", "Izhod", "14:30", "23:59", PON_SOB, 1, "Izhod po 14:30 se knjiži 14:30; prej = napaka.", { konec_ne_pozneje: "14:30" }),
  i(10, "prihod", "IZREDNO_PRIHOD", "Izredno", "00:00", "23:59", PON_SOB, 1, "Nadure (do Dovolilnic): prihod s tipko Izredno - dejanski čas, brez napake.", { id_tipke: 7 }),
  i(11, "izhod", "IZREDNO_IZHOD", "Izredno", "00:00", "23:59", PON_SOB, 1, "Nadure (do Dovolilnic): izhod s tipko Izredno - dejanski čas, presežek zaokrožen na 15 min.", { id_tipke: 7, presezek: "zaokrozi" }),
];

/** Privzeta obveznost urnika: 8 h od ponedeljka do petka. */
const privzetaObveznost = (dnevi: Dan[]): Record<number, number> => Object.fromEntries(dnevi.filter((d) => d.iso != null && d.iso <= 5).map((d) => [d.id, 480]));
const URNIKI: Urnik[] = [
  { id: 1, ime: "Pisarna", opis: "Uprava, prodaja, računovodstvo - gibljiv delovni čas.", intervali: [1, 3, 4, 5, 7, 8], obveznost: privzetaObveznost(DNEVI), visible: true },
  { id: 2, ime: "Proizvodnja - 1 izmena", opis: "Fiksen prihod do 6:30, odmor 9:55-10:35, izhod po 14:30.", intervali: [2, 3, 4, 6, 9, 10, 11], obveznost: privzetaObveznost(DNEVI), visible: true },
];

const PRAZNIKI: PosebniPraznik[] = [{ id: 1, datum: "2023-08-14", ime: "Dan solidarnosti", opis: "Enkraten dela prost dan po poplavah.", visible: true }];

// ---------------------------------------------------------------------------------------------------------------
// Shramba (v brskalniku)
// ---------------------------------------------------------------------------------------------------------------

let stanje: CasNastavitve = {
  lastnosti: LASTNOSTI,
  statistike: STATISTIKE,
  dnevi: DNEVI,
  tipke: TIPKE,
  intervali: INTERVALI,
  urniki: URNIKI,
  prazniki: PRAZNIKI,
  zaposleniUrniki: [],
  vir: "nalagam",
  napakaBaze: null,
  virUrnikov: "nalagam",
  napakaUrnikov: null,
  virPravil: "nalagam",
  napakaPravil: null,
  virTipk: "nalagam",
  napakaTipk: null,
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
      intervali:
        preslikano || st.virUrnikov === "baza"
          ? st.intervali
          : st.intervali.map((iv) => ({ ...iv, id_statistike: poKodi.get(kodaTestne.get(iv.id_statistike ?? -1) ?? "") ?? null, id_statistike_prekoracitve: poKodi.get(kodaTestne.get(iv.id_statistike_prekoracitve ?? -1) ?? "") ?? null })),
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
/** Pravila in obveznost, dokler 011 ni v bazi: samo v brskalniku (do osvežitve strani). */
const lokalnaPravila = new Map<number, PravilaIntervala>();
const lokalnaObveznost = new Map<number, Record<number, number>>();
/** Vrsta in tipka intervalov, dokler 013 / 014 nista v bazi: samo v brskalniku. */
const lokalneVrste = new Map<number, Pick<Interval, "vrsta" | "id_tipke">>();
type PravilaVrstica = PravilaIntervala & { id: number };
type ObveznostVrstica = { id_urnika: number; id_dneva: number; obveznost_min: number };

/** Pravila (011) posebej: brez stolpcev v bazi urniki delajo naprej, pravila in obveznost so testni. */
async function naloziPravila(sb: ReturnType<typeof getSupabase>) {
  try {
    const [pravila, obveznosti] = await Promise.all([
      fetchAll<PravilaVrstica>((from, to) =>
        sb
          .from("fos_intervali")
          .select("id, zacetek_ne_prej, zacetek_zaokrozi, zacetek_korak, konec_ne_pozneje, konec_zaokrozi, konec_korak, presezek, presezek_korak, trajanje_max, id_statistike_prekoracitve")
          .eq("visible", true)
          .order("id")
          .range(from, to),
      ),
      fetchAll<ObveznostVrstica>((from, to) => sb.from("ln_fos_urniki_dnevi").select("id_urnika, id_dneva, obveznost_min").eq("visible", true).order("id").range(from, to)),
    ]);
    return { pravila, obveznosti, napaka: null };
  } catch (e) {
    return { pravila: null, obveznosti: null, napaka: (e as Error).message };
  }
}
type VrstaVrstica = { id: number; id_tipke: number | null; vrsta: VrstaIntervala; ime: string; prikazno_ime: string };
/** Vrsta brez stolpca (014 ni zagnan): kot v migraciji - s tipko = tipka, ime "Izhod..." = izhod, sicer prihod. */
const ugibajVrsto = (x: Omit<VrstaVrstica, "vrsta">): VrstaIntervala => (x.id_tipke != null ? "tipka" : /^izhod/i.test(x.ime) || /^izhod/i.test(x.prikazno_ime) ? "izhod" : "prihod");

/**
 * Tipke in vrsta intervalov (013, 014) posebej: brez 014 se prebere 013 (vrsta ugibana, vir test), brez 013 so tipke
 * testne - urniki delajo naprej v vseh primerih.
 */
async function naloziTipke(sb: ReturnType<typeof getSupabase>) {
  // stolpci kot spremenljivka: tip vrstice določi fetchAll
  const beri = (tipke: string, intervali: string) =>
    Promise.all([
      fetchAll<Tipka>((from, to) => sb.from("fos_tipke").select(tipke as "*").eq("visible", true).order("tipka").range(from, to)),
      fetchAll<VrstaVrstica>((from, to) => sb.from("fos_intervali").select(intervali as "*").eq("visible", true).order("id").range(from, to)),
    ]);
  try {
    const [tipke, intervali] = await beri("id, tipka, besedilo, prikaz, funkcija, visible", "id, id_tipke, vrsta, ime, prikazno_ime");
    return { tipke, intervali, vir: "baza" as const, napaka: null };
  } catch (e) {
    try {
      const [tipke, intervali] = await beri("id, tipka, besedilo, visible", "id, id_tipke, ime, prikazno_ime");
      return {
        tipke: tipke.map((x) => ({ ...x, prikaz: ["krmilnik"] as MestoTipke[], funkcija: null })),
        intervali: intervali.map((x) => ({ ...x, vrsta: lokalneVrste.get(x.id)?.vrsta ?? ugibajVrsto(x) })),
        vir: "test" as const,
        napaka: `Migracija 014 še ni zagnana (${(e as Error).message})`,
      };
    } catch (e2) {
      return { tipke: null, intervali: null, vir: "test" as const, napaka: (e2 as Error).message };
    }
  }
}

const izVrstice = ({ id: _, ...p }: PravilaVrstica): PravilaIntervala => ({
  ...p,
  zacetek_ne_prej: p.zacetek_ne_prej && cas(p.zacetek_ne_prej),
  konec_ne_pozneje: p.konec_ne_pozneje && cas(p.konec_ne_pozneje),
});

async function naloziUrnike() {
  const sb = getSupabase();
  try {
    const [dnevi, intervali, dneviIntervalov, urniki, intervaliUrnikov, zaposleniUrniki, prazniki] = await Promise.all([
      fetchAll<{ id: number; koda: string; ime: string; kratko: string; iso_dan: number | null }>((from, to) => sb.from("fos_dnevi").select("id, koda, ime, kratko, iso_dan").eq("visible", true).order("vrstni_red").range(from, to)),
      fetchAll<Omit<Interval, "dnevi" | "id_tipke" | "vrsta" | keyof PravilaIntervala>>((from, to) =>
        sb.from("fos_intervali").select("id, ime, prikazno_ime, opis, cas_od, cas_do, id_statistike, visible").eq("visible", true).order("vrstni_red").order("id").range(from, to),
      ),
      fetchAll<{ id_intervala: number; id_dneva: number }>((from, to) => sb.from("ln_fos_intervali_dnevi").select("id_intervala, id_dneva").eq("visible", true).order("id").range(from, to)),
      fetchAll<Omit<Urnik, "intervali" | "obveznost">>((from, to) => sb.from("fos_urniki").select("id, ime, opis, visible").eq("visible", true).order("vrstni_red").order("ime").range(from, to)),
      fetchAll<{ id_urnika: number; id_intervala: number }>((from, to) => sb.from("ln_fos_urniki_intervali").select("id_urnika, id_intervala").eq("visible", true).order("id").range(from, to)),
      fetchAll<ZaposleniUrnik>((from, to) => sb.from("ln_fos_zaposleni_urniki").select("id_zaposlenega, id_urnika, velja_od").eq("visible", true).order("id").range(from, to)),
      fetchAll<PosebniPraznik>((from, to) => sb.from("fos_prazniki").select("id, datum, ime, opis, visible").eq("visible", true).order("datum").range(from, to)),
    ]);
    const [p, t] = await Promise.all([naloziPravila(sb), naloziTipke(sb)]);
    const vrstaIntervala = (iv: { id: number; ime: string; prikazno_ime: string }): Pick<Interval, "vrsta" | "id_tipke"> => {
      const lokalno = t.vir === "test" ? lokalneVrste.get(iv.id) : undefined;
      if (lokalno) return lokalno;
      const v = t.intervali?.find((x) => x.id === iv.id);
      return v ? { vrsta: v.vrsta, id_tipke: v.id_tipke } : { vrsta: ugibajVrsto({ ...iv, id_tipke: null }), id_tipke: null };
    };
    const dneviApp: Dan[] = dnevi.map((d) => ({ id: d.id, koda: d.koda, ime: d.ime, kratko: d.kratko, iso: d.iso_dan }));
    const pravilaIntervala = (id: number) => {
      const v = p.pravila?.find((x) => x.id === id);
      return v ? izVrstice(v) : (lokalnaPravila.get(id) ?? PRAVILA_DEJANSKO);
    };
    const obveznostUrnika = (id: number) =>
      p.obveznosti ? Object.fromEntries(p.obveznosti.filter((x) => x.id_urnika === id).map((x) => [x.id_dneva, x.obveznost_min])) : (lokalnaObveznost.get(id) ?? privzetaObveznost(dneviApp));
    spremeni((st) => ({
      ...st,
      virUrnikov: "baza",
      napakaUrnikov: null,
      virPravil: p.pravila ? "baza" : "test",
      napakaPravil: p.napaka,
      virTipk: t.vir,
      napakaTipk: t.napaka,
      tipke: t.tipke ?? st.tipke,
      dnevi: dneviApp,
      intervali: intervali.map((i) => ({
        ...i,
        ...pravilaIntervala(i.id),
        ...vrstaIntervala(i),
        cas_od: cas(i.cas_od),
        cas_do: cas(i.cas_do),
        dnevi: dneviIntervalov.filter((d) => d.id_intervala === i.id).map((d) => d.id_dneva).sort((a, b) => a - b),
      })),
      urniki: urniki.map((u) => ({ ...u, intervali: intervaliUrnikov.filter((l) => l.id_urnika === u.id).map((l) => l.id_intervala), obveznost: obveznostUrnika(u.id) })),
      zaposleniUrniki,
      prazniki,
    }));
  } catch (e) {
    nalaganjeUrnikov = null;
    const napaka = (e as Error).message;
    spremeni((st) => ({ ...st, virUrnikov: "test", napakaUrnikov: napaka, virPravil: "test", napakaPravil: napaka, virTipk: "test", napakaTipk: napaka }));
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
    spremeni((s) => ({ ...s, urniki: id ? s.urniki.map((x) => (x.id === id ? { ...x, ...vrstica } : x)) : [...s.urniki, { id: nov, ...vrstica, intervali: [], obveznost: privzetaObveznost(s.dnevi), visible: true }] }));
    return nov;
  }
  let nov = id;
  await vBazo(async (sb) => {
    if (id) return preveri(await sb.from("fos_urniki").update(vrstica).eq("id", id), "Urnik s tem imenom že obstaja.");
    const r = await sb.from("fos_urniki").insert({ ...vrstica, vrstni_red: stanje.urniki.length + 1 }).select("id").single();
    preveri(r, "Urnik s tem imenom že obstaja.");
    nov = r.data!.id as number;
    // nov urnik dobi privzeto delovno obveznost (8 h pon-pet, sicer 0) - brez nje bi bilo vse delo presežek
    if (stanje.virPravil === "baza") {
      const privzeta = privzetaObveznost(stanje.dnevi);
      for (const d of stanje.dnevi) preveri(await sb.rpc("fos_nastavi_obveznost", { p_id_urnika: nov, p_id_dneva: d.id, p_minute: privzeta[d.id] ?? 0 }));
    }
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
export const PRAZEN_INTERVAL: IntervalVnos = { ime: "", prikazno_ime: "", opis: "", vrsta: "prihod", cas_od: "06:00", cas_do: "08:00", dnevi: [1, 2, 3, 4, 5], id_statistike: null, id_tipke: null, ...PRAVILA_DEJANSKO };

const CAS = /^\d{2}:\d{2}$/;
export function preveriInterval(v: IntervalVnos, id?: number): Partial<Record<keyof IntervalVnos, string>> {
  const n: Partial<Record<keyof IntervalVnos, string>> = {};
  if (!v.ime.trim()) n.ime = "Vpiši ime intervala.";
  else if (stanje.intervali.some((x) => x.visible && x.id !== id && x.ime.trim().toLowerCase() === v.ime.trim().toLowerCase())) n.ime = "Interval s tem imenom že obstaja.";
  if (!CAS.test(v.cas_od)) n.cas_od = "Vpiši začetek intervala.";
  if (!CAS.test(v.cas_do)) n.cas_do = "Vpiši konec intervala.";
  else if (v.cas_do === v.cas_od) n.cas_do = "Konec mora biti drugačen od začetka.";
  if (!v.dnevi.length) n.dnevi = "Izberi vsaj en dan.";
  if (v.id_statistike == null) n.id_statistike = "Izberi statistiko - interval ima obvezno eno.";
  if (v.vrsta === "tipka" && v.id_tipke == null) n.id_tipke = "Izberi tipko - interval vrste Tipka jo ima obvezno.";
  if (v.zacetek_ne_prej != null && !CAS.test(v.zacetek_ne_prej)) n.zacetek_ne_prej = "Vpiši čas.";
  if (v.konec_ne_pozneje != null && !CAS.test(v.konec_ne_pozneje)) n.konec_ne_pozneje = "Vpiši čas.";
  if (v.trajanje_max != null && !(v.trajanje_max >= 1 && v.trajanje_max <= 1440)) n.trajanje_max = "Vpiši trajanje, npr. 00:30.";
  if (v.trajanje_max != null && v.id_statistike_prekoracitve == null) n.id_statistike_prekoracitve = "Izberi, kam gre čas nad trajanjem (npr. Zamuda).";
  for (const k of ["zacetek_korak", "konec_korak", "presezek_korak"] as const) if (!(v[k] >= 1 && v[k] <= 240)) n[k] = "Korak je 1-240 min.";
  return n;
}

/** Pravila, ki ne veljajo za vrsto intervala, se ob shranjevanju ponastavijo (v bazi ne ostanejo skrite vrednosti). */
function pravilaVrste(v: IntervalVnos): PravilaIntervala {
  const p = Object.fromEntries(POLJA_PRAVIL.map((k) => [k, v[k]])) as PravilaIntervala;
  const d = PRAVILA_DEJANSKO;
  if (v.vrsta !== "prihod") Object.assign(p, { zacetek_ne_prej: d.zacetek_ne_prej, zacetek_zaokrozi: d.zacetek_zaokrozi });
  if (v.vrsta !== "izhod") Object.assign(p, { konec_ne_pozneje: d.konec_ne_pozneje, konec_zaokrozi: d.konec_zaokrozi, presezek: d.presezek });
  if (v.vrsta !== "tipka") Object.assign(p, { trajanje_max: d.trajanje_max, id_statistike_prekoracitve: d.id_statistike_prekoracitve });
  return p;
}

/** Shrani interval in njegove dneve (ln_fos_intervali_dnevi: dodani = nov zapis, odvzeti = skrit). Nov gre na konec seznama. */
export async function shraniInterval(v: IntervalVnos, id?: number): Promise<number> {
  const vrstica = { ime: v.ime.trim(), prikazno_ime: v.prikazno_ime.trim(), opis: v.opis.trim(), cas_od: v.cas_od, cas_do: v.cas_do, id_statistike: v.id_statistike };
  const pravila = pravilaVrste(v);
  const vrsta = { vrsta: v.vrsta, id_tipke: v.id_tipke };
  if (!vBazi()) {
    const nov = id ?? novId(stanje.intervali);
    const zapis: Interval = { ...vrstica, ...pravila, ...vrsta, dnevi: v.dnevi, id: nov, visible: true };
    spremeni((s) => ({ ...s, intervali: id ? s.intervali.map((x) => (x.id === id ? zapis : x)) : [...s.intervali, zapis] }));
    return nov;
  }
  let nov = id;
  // brez 011 / 014 v bazi gredo pravila / vrsta in tipka samo v brskalnik
  const zPravili = stanje.virPravil === "baza";
  const zVrsto = stanje.virTipk === "baza";
  const zapis = { ...vrstica, ...(zPravili ? pravila : {}), ...(zVrsto ? vrsta : {}) };
  await vBazo(async (sb) => {
    if (id) preveri(await sb.from("fos_intervali").update(zapis).eq("id", id), "Interval s tem imenom že obstaja.");
    else {
      const r = await sb.from("fos_intervali").insert({ ...zapis, vrstni_red: stanje.intervali.length + 1 }).select("id").single();
      preveri(r, "Interval s tem imenom že obstaja.");
      nov = r.data!.id as number;
    }
    if (!zPravili) lokalnaPravila.set(nov!, pravila);
    if (!zVrsto) lokalneVrste.set(nov!, vrsta);
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

export type TipkaVnos = { id?: number; tipka: number | null; besedilo: string; prikaz: MestoTipke[]; funkcija: FunkcijaTipke | null };

/** Intervali, ki uporabljajo tipko (vidni). */
export const intervaliTipke = (idTipke: number, n: Pick<CasNastavitve, "intervali">) => n.intervali.filter((x) => x.visible && x.id_tipke === idTipke);

/**
 * Napake vnosa tipk po vrsticah (indeks): številka 1 ali več in enolična, besedilo obvezno; tipka, ki jo uporablja
 * interval, ne more dobiti funkcije (Info, Prekliči) - interval mora imeti navadno tipko.
 */
export function preveriTipke(vnosi: TipkaVnos[]): Record<number, { tipka?: string; besedilo?: string; funkcija?: string }> {
  const n: Record<number, { tipka?: string; besedilo?: string; funkcija?: string }> = {};
  vnosi.forEach((v, k) => {
    const e: { tipka?: string; besedilo?: string; funkcija?: string } = {};
    if (v.tipka == null || !Number.isInteger(v.tipka) || v.tipka < 1) e.tipka = "Številka 1 ali več.";
    else if (vnosi.some((x, j) => j !== k && x.tipka === v.tipka)) e.tipka = `Tipka ${v.tipka} je že v seznamu.`;
    if (!v.besedilo.trim()) e.besedilo = "Vpiši besedilo.";
    if (v.funkcija && v.id != null && intervaliTipke(v.id, stanje).length) e.funkcija = "Tipko uporablja interval - funkcija ni mogoča.";
    if (e.tipka || e.besedilo || e.funkcija) n[k] = e;
  });
  return n;
}

/**
 * Shrani seznam tipk (stran Krmilnik): spremenjene se posodobijo, nove dodajo, odstranjene skrijejo (tipke, ki jo
 * uporablja interval, ni mogoče odstraniti - Krmilnik to prepreči). Obstoječe s spremenjeno številko gredo najprej na
 * začasno številko, da zamenjava (1 <-> 2) ne trči ob enoličnost.
 */
export async function shraniTipke(vnosi: TipkaVnos[], skrite: number[]) {
  const vrstica = (v: TipkaVnos) => ({ tipka: v.tipka!, besedilo: v.besedilo.trim(), prikaz: v.prikaz, funkcija: v.funkcija });
  if (stanje.virTipk !== "baza") {
    let nov = novId(stanje.tipke);
    const tipke = [
      ...stanje.tipke.filter((t) => !t.visible || skrite.includes(t.id)).map((t) => ({ ...t, visible: false })),
      ...vnosi.map((v) => ({ ...vrstica(v), id: v.id ?? nov++, visible: true })),
    ].sort((a, b) => a.tipka - b.tipka);
    return spremeni((s) => ({ ...s, tipke }));
  }
  const spremenjene = vnosi.filter((v) => {
    const t = v.id != null && stanje.tipke.find((x) => x.id === v.id);
    return !t || t.tipka !== v.tipka || t.besedilo !== v.besedilo.trim() || t.funkcija !== v.funkcija || [...t.prikaz].sort().join() !== [...v.prikaz].sort().join();
  });
  await vBazo(async (sb) => {
    if (skrite.length) preveri(await sb.from("fos_tipke").update({ visible: false }).in("id", skrite));
    const premik = spremenjene.filter((v) => v.id != null && stanje.tipke.find((t) => t.id === v.id)?.tipka !== v.tipka);
    const zacasno = Math.max(0, ...stanje.tipke.map((t) => t.tipka), ...vnosi.map((v) => v.tipka ?? 0)) + 1;
    for (const [k, v] of premik.entries()) preveri(await sb.from("fos_tipke").update({ tipka: zacasno + k }).eq("id", v.id!));
    for (const v of spremenjene.filter((x) => x.id != null)) preveri(await sb.from("fos_tipke").update(vrstica(v)).eq("id", v.id!), `Tipka ${v.tipka} že obstaja.`);
    const nove = spremenjene.filter((v) => v.id == null);
    if (nove.length) preveri(await sb.from("fos_tipke").insert(nove.map(vrstica)), "Tipka s to številko že obstaja.");
  });
}

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

/** Delovna obveznost urnikov (stran Delovna obveznost): minute po dnevih. Brez 011 v bazi samo v brskalniku. */
export async function shraniObveznost(spremembe: { id_urnika: number; obveznost: Record<number, number> }[]) {
  if (!spremembe.length) return;
  if (stanje.virPravil !== "baza") {
    for (const x of spremembe) lokalnaObveznost.set(x.id_urnika, x.obveznost);
    return spremeni((s) => ({ ...s, urniki: s.urniki.map((u) => ({ ...u, obveznost: spremembe.find((x) => x.id_urnika === u.id)?.obveznost ?? u.obveznost })) }));
  }
  await vBazo(async (sb) => {
    for (const x of spremembe) {
      const staro = stanje.urniki.find((u) => u.id === x.id_urnika)?.obveznost ?? {};
      for (const [dan, min] of Object.entries(x.obveznost)) {
        if ((staro[Number(dan)] ?? 0) !== min) preveri(await sb.rpc("fos_nastavi_obveznost", { p_id_urnika: x.id_urnika, p_id_dneva: Number(dan), p_minute: min }));
      }
    }
  });
}

/** Id dneva (fos_dnevi) za dan v tednu (1 = pon ... 7 = ned) ali praznik. */
export const idDneva = (iso: number, jePraznik: boolean, n: Pick<CasNastavitve, "dnevi">) => (jePraznik ? n.dnevi.find((d) => d.iso == null) : n.dnevi.find((d) => d.iso === iso))?.id ?? null;

/** Okno intervala prečka polnoč (konec je naslednji dan). */
export const cezPolnoc = (iv: Pick<Interval, "cas_od" | "cas_do">) => iv.cas_do < iv.cas_od;
