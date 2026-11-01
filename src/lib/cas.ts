"use client";

import { useEffect, useState } from "react";
import { CalendarOff, CircleAlert, CircleDashed, LogOut, MessageSquare, Moon, Pencil, TriangleAlert, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { idDneva, ikonaStatistike, imePraznika as praznikNa, type CasNastavitve, type Interval, type Statistika, type Urnik } from "./casNastavitve";
import { imaLastnost, knjizi, type NapakaKnjizenja, type ZigKnjizen } from "./knjizenje";

/**
 * Registracija časa - izračun dneva za koledar (skupno Administraciji in FIN:ME).
 * Vhod: štempljanja (žigi) in celodnevne odsotnosti dneva; izhod: odseki časovne linije, ure, malice, prevozi, stanje.
 * Čas je v minutah od polnoči dneva prihoda; delo čez polnoč ima čase nad 1440 (npr. 22:00-01:00 = 1320-1500) in se
 * VEDNO šteje v dan začetka (prihoda), ne glede na datum konca.
 */

/**
 * Štempljanje: samo čas, tipka in vir - SMERI NI (določi jo knjizenje.ts: odsoten -> prihod, prisoten -> izhod).
 * id_tipke = tipka na krmilniku / v FIN:ME (fos_tipke): statistiko da interval urnika s to tipko (malica, poslovni,
 * privatni, delo od doma ...); null = brez tipke (prihod = začetek izmene, izhod = konec izmene).
 * Vir: krmilnik (čitalec na vhodu), online aplikacija (FIN:ME), ročni popravek.
 * Dogodkov se ne briše in ne ureja: spregledan = izračun ga ne upošteva (prečrtan); ročno se dodajo novi (komentar).
 */
export type Zig = { id: string; cas: number; id_tipke: number | null; vir: keyof typeof VIRI; spregledan?: boolean; komentar?: string };

/** Vir štempljanja (kasneje šifrant v bazi štempljanj). */
export const VIRI = { krmilnik: "Krmilnik", online: "Online aplikacija", rocno: "Ročni popravek", uvoz: "Uvoz (stari sistem)" } as const;
/** Dodatna oznaka dneva (ročni popravek, komentar ...) - ikona v vrstici dneva. */
export type Oznaka = { tip: keyof typeof OZNAKE; besedilo: string };
export type DanPodatki = {
  zigi: Zig[];
  /** Celodnevna odsotnost (bolniška, dopust ...) v okvirju pričakovanega delovnega časa. */
  odsotnost: { id_statistike: number; od: number; do: number } | null;
  oznake: Oznaka[];
};
export type Segment = { od: number; do: number; id_statistike: number; celodnevno?: boolean; odprt?: boolean };
export type StanjeDneva = { koda: string; ime: string; ikona: LucideIcon; barva: string; opis: string };
export type DanIzracun = {
  datum: string;
  /** 1 = ponedeljek ... 7 = nedelja */
  dan: number;
  praznik: string | null;
  /** Vikend ali praznik - prisotnost ni potrebna (kasneje po urniku zaposlenega). */
  prost: boolean;
  danes: boolean;
  prihodnji: boolean;
  podatki: DanPodatki;
  /** Žigi s samodejno smerjo in knjiženim časom (po pravilih intervala). */
  zigi: ZigKnjizen[];
  /** Interval prve izmene (pravila knjiženja) ali null. */
  interval: Interval | null;
  segmenti: Segment[];
  /** Knjižene minute, ki štejejo v delovno obveznost. */
  delo: number;
  /** Obveznost dneva po urniku (minute); null = brez urnika. */
  obveznost: number | null;
  /** Dnevni saldo = delo - obveznost; null = brez urnika, dan še teče ali še ni bil. */
  saldo: number | null;
  /** Presežek, ki ga pravilo intervala ni priznalo (minute). */
  nepriznano: number;
  /** Čas tipk nad seštetim trajanjem (npr. malica nad 30 min), ki je šel v statistiko prekoračitve. */
  prekoraceno: number;
  /** Oznake dneva: iz podatkov + izračunane (napake knjiženja, manjka odhod). */
  oznake: Oznaka[];
  /** Napake knjiženja (prihod / izhod izven okna ...) - kasneje jih izničijo Dovolilnice. */
  napake: NapakaKnjizenja[];
  malice: number;
  prevozi: number;
  stanje: StanjeDneva;
};

/** Pravila izračuna (kasneje v nastavitvah registracije časa). */
export const PRAVILA = {
  /** Ure za malico: od 4 h 1 malica, od 12 h 2. */
  malice: [
    { od: 4 * 60, stevilo: 1 },
    { od: 12 * 60, stevilo: 2 },
  ],
  /** Prevozi na dan s statistiko "Štej prevoze". */
  prevozovNaDan: 1,
};

/** Osnovna stanja dneva; ostala (bolniška, dopust, delo od doma ...) dajejo statistike s svojim imenom, ikono in barvo. */
export const STANJA = {
  prisoten: { koda: "prisoten", ime: "Prisoten", ikona: UserCheck, barva: "#22c55e", opis: "Prihod in odhod na čitalcu v podjetju." },
  na_delu: { koda: "na_delu", ime: "Na delu", ikona: UserCheck, barva: "#22c55e", opis: "Oseba je trenutno na delu." },
  odsoten: { koda: "odsoten", ime: "Odsoten", ikona: UserX, barva: "#ef4444", opis: "Danes še ni prihoda." },
  ni_vnosa: { koda: "ni_vnosa", ime: "Ni vnosa", ikona: CircleAlert, barva: "#f59e0b", opis: "Delovni dan je končan, oseba nima nič štempljano." },
  prost: { koda: "prost", ime: "Prost dan", ikona: Moon, barva: "#7c7c86", opis: "Vikend - prisotnost ni potrebna." },
  praznik: { koda: "praznik", ime: "Praznik", ikona: CalendarOff, barva: "#7c7c86", opis: "Dela prost dan - prisotnost ni potrebna." },
  prihodnji: { koda: "prihodnji", ime: "", ikona: CircleDashed, barva: "#6b6b72", opis: "Dan še ni bil." },
} satisfies Record<string, StanjeDneva>;

/** Oznake v vrstici dneva (prostor za ikone - popravki, komentarji, spremembe ...). */
export const OZNAKE = {
  popravek: { ime: "Ročni popravek", ikona: Pencil, barva: "#f59e0b" },
  komentar: { ime: "Komentar", ikona: MessageSquare, barva: "#60a5fa" },
  napaka: { ime: "Napaka", ikona: TriangleAlert, barva: "#ef4444" },
  manjka: { ime: "Manjka odhod", ikona: LogOut, barva: "#ef4444" },
} satisfies Record<string, { ime: string; ikona: LucideIcon; barva: string }>;

// ---------------------------------------------------------------------------------------------------------------
// Datumi (lokalni čas, oblika YYYY-MM-DD)
// ---------------------------------------------------------------------------------------------------------------

export const isoDatum = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const izIso = (s: string) => {
  const [l, m, d] = s.split("-").map(Number);
  return new Date(l, m - 1, d);
};
export const dodajDni = (s: string, dni: number) => {
  const d = izIso(s);
  d.setDate(d.getDate() + dni);
  return isoDatum(d);
};
/** 1 = ponedeljek ... 7 = nedelja */
export const danVTednu = (s: string) => izIso(s).getDay() || 7;
export const zacetekTedna = (s: string) => dodajDni(s, 1 - danVTednu(s));
export const zacetekMeseca = (s: string) => `${s.slice(0, 7)}-01`;
export const dodajMesece = (s: string, n: number) => {
  const d = izIso(zacetekMeseca(s));
  d.setMonth(d.getMonth() + n);
  return isoDatum(d);
};
/** Vsi datumi meseca, v katerem je datum. */
export function dneviMeseca(s: string): string[] {
  const d = izIso(zacetekMeseca(s));
  const out: string[] = [];
  for (const m = d.getMonth(); d.getMonth() === m; d.setDate(d.getDate() + 1)) out.push(isoDatum(d));
  return out;
}
export const dneviTedna = (s: string) => Array.from({ length: 7 }, (_, i) => dodajDni(zacetekTedna(s), i));
/** ISO številka tedna. */
export function stTedna(s: string) {
  const d = izIso(s);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const zacetek = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - zacetek.getTime()) / 864e5 + 1) / 7);
}

const KRATKO = ["NED", "PON", "TOR", "SRE", "ČET", "PET", "SOB"];
export const MESECI = ["januar", "februar", "marec", "april", "maj", "junij", "julij", "avgust", "september", "oktober", "november", "december"];
/** "31.10, SOB" */
export const oznakaDneva = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}, ${KRATKO[izIso(s).getDay()]}`;
/** "31.10" in "SOB" (datum v dveh vrsticah) */
export const datumKratko = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`;
export const danKratko = (s: string) => KRATKO[izIso(s).getDay()];
export const imeMeseca = (s: string) => `${MESECI[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
export const kratekDatum = (s: string) => `${Number(s.slice(8, 10))}. ${Number(s.slice(5, 7))}.`;

/** 485 -> "08:05"; čez polnoč (1500) -> "01:00 +1" (naslednji dan) */
export const fmtCas = (min: number) => {
  const m = min % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m) % 60).padStart(2, "0")}${min >= 1440 ? " +1" : ""}`;
};
/** Saldo s predznakom: 15 -> "+0:15", -7 -> "-0:07", 0 -> "0:00" */
export const fmtSaldo = (min: number) => `${min > 0 ? "+" : min < 0 ? "-" : ""}${fmtTrajanje(Math.abs(min), true)}`;
/** 485 -> "8 h 05 min" (kratko: "8:05") */
export const fmtTrajanje = (min: number, kratko = false) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return kratko ? `${h}:${String(m).padStart(2, "0")}` : m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
};
/**
 * Ure iz vnosa: "8", "8:00", "7:30", "7,5" -> minute; prazno = 0; neveljavno = null. Z negativno = true še predznak
 * (+12:30, -3:15) za saldo. Največ 24 h, razen pri saldu.
 */
export function izUr(t: string, negativno = false): number | null {
  let s = t.trim().replace(",", ".");
  if (!s) return 0;
  let znak = 1;
  if (negativno && /^[+-]/.test(s)) {
    znak = s[0] === "-" ? -1 : 1;
    s = s.slice(1).trim();
  }
  const m = /^(\d{1,4})(?::(\d{1,2}))?$/.exec(s);
  let min = NaN;
  if (m && Number(m[2] ?? 0) < 60) min = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if (/^\d{1,4}\.\d+$/.test(s)) min = Math.round(Number(s) * 60);
  if (!Number.isFinite(min) || (!negativno && min > 1440)) return null;
  return znak * min;
}
export const izCasa = (cas: string) => {
  const [h, m] = cas.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Trenutni čas (osveži se vsako minuto). */
export function useZdaj() {
  const [zdaj, setZdaj] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setZdaj(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return zdaj;
}

// ---------------------------------------------------------------------------------------------------------------
// Izračun dneva
// ---------------------------------------------------------------------------------------------------------------

/** Besedilo napake knjiženja (oznaka dneva, razpis dogodkov). */
export const opisNapake = ({ tip, cas, interval: iv, tipka }: NapakaKnjizenja) =>
  ({
    prihod: `Napaka: prihod ob ${fmtCas(cas)} je izven okna prihoda ${iv?.cas_od}-${iv?.cas_do} (${iv?.ime}) - knjižen je dejanski čas.`,
    izhod: `Napaka: izhod ob ${fmtCas(cas)} je izven okna izhoda ${iv?.cas_od}-${iv?.cas_do} (${iv?.ime}) - knjižen je dejanski čas.`,
    brez_intervala: `Napaka: prihod ob ${fmtCas(cas)} na dan, ko urnik nima intervala prihoda - knjižen je dejanski čas.`,
    tipka_okno: `Napaka: žig ob ${fmtCas(cas)} (tipka ${tipka}) je izven okna ${iv?.cas_od}-${iv?.cas_do} (${iv?.ime}) - oba žiga morata biti v oknu.`,
    tipka_brez_intervala: `Napaka: tipka ${tipka ?? "?"} ob ${fmtCas(cas)} - urnik nima intervala s to tipko (čas ni razvrščen).`,
  })[tip];

const stanjeStatistike = (s: Statistika): StanjeDneva => ({ koda: `stat:${s.koda}`, ime: s.ime, ikona: ikonaStatistike(s.ikona), barva: s.barva, opis: s.opis });

/**
 * Izračun dneva za prikaz (danes = YYYY-MM-DD, zdajMin = minute od polnoči). Knjiženje po pravilih intervalov urnika
 * (knjizenje.ts), obveznost in prost dan po urniku (Delovna obveznost); brez urnika vikend / praznik = prost dan.
 */
export function izracunajDan(datum: string, podatki: DanPodatki, n: CasNastavitve, danes: string, zdajMin: number, urnik: Urnik | null): DanIzracun {
  const dan = danVTednu(datum);
  const imePraznika = praznikNa(datum, n);
  const jeDanes = datum === danes;
  const prihodnji = datum > danes;
  const idDne = idDneva(dan, !!imePraznika, n);
  const obveznost = urnik ? (idDne != null ? (urnik.obveznost[idDne] ?? 0) : 0) : null;
  const prost = obveznost != null ? obveznost === 0 : dan >= 6 || !!imePraznika;
  // spregledani dogodki ostanejo v podatkih (prikaz prečrtano), izračun jih ne vidi
  const k = knjizi(podatki.zigi.filter((z) => !z.spregledan), { urnik, idDneva: idDne, obveznost, odsotnost: podatki.odsotnost, zdajMin: jeDanes ? zdajMin : null, danes: jeDanes, n });
  const seg = k.segmenti;
  const stat = (id: number) => n.statistike.find((s) => s.id === id);

  let zaMalico = 0;
  let prevoz = false;
  for (const x of seg) {
    const s = stat(x.id_statistike);
    const min = x.do - x.od;
    if (imaLastnost(s, "malice", n)) zaMalico += min;
    if (imaLastnost(s, "prevozi", n) && !x.celodnevno) prevoz = true;
  }
  const malice = PRAVILA.malice.reduce((st, p) => (zaMalico >= p.od ? p.stevilo : st), 0);

  let stanje: StanjeDneva;
  const zadnji = k.zigi.at(-1);
  if (podatki.odsotnost && stat(podatki.odsotnost.id_statistike)) stanje = stanjeStatistike(stat(podatki.odsotnost.id_statistike)!);
  else if (zadnji) {
    if (jeDanes && zadnji.smer === "prihod") stanje = STANJA.na_delu;
    else if (jeDanes && zadnji.id_statistike != null && stat(zadnji.id_statistike)) stanje = stanjeStatistike(stat(zadnji.id_statistike)!);
    else if (k.zigi.some((z) => z.smer === "prihod" && z.vir !== "online")) stanje = STANJA.prisoten;
    else {
      // samo štempljanje prek FIN:ME (npr. delo od doma): stanje = statistika z največ časa
      const po = new Map<number, number>();
      for (const x of seg) po.set(x.id_statistike, (po.get(x.id_statistike) ?? 0) + x.do - x.od);
      const glavna = [...po].sort((a, b) => b[1] - a[1])[0];
      stanje = glavna && stat(glavna[0]) ? stanjeStatistike(stat(glavna[0])!) : STANJA.prisoten;
    }
  } else if (prihodnji) stanje = STANJA.prihodnji;
  else if (prost) stanje = imePraznika ? { ...STANJA.praznik, opis: `${imePraznika} - prisotnost ni potrebna.` } : STANJA.prost;
  else stanje = jeDanes ? STANJA.odsoten : STANJA.ni_vnosa;

  // saldo: samo zaključen dan (danes šele po izhodu; brez urnika ga ni)
  const zakljucen = !prihodnji && (!jeDanes || (!k.odprt && (k.zigi.length > 0 || !!podatki.odsotnost)));
  const saldo = obveznost != null && zakljucen ? k.delo - obveznost : null;
  const oznake: Oznaka[] = [
    ...podatki.oznake,
    ...k.napake.map((x): Oznaka => ({ tip: "napaka", besedilo: opisNapake(x) })),
    ...(k.manjkaOdhod ? [{ tip: "manjka", besedilo: "Dan se konča s prihodom - manjka odhod (zadnji odsek se ne šteje)." } as Oznaka] : []),
  ];

  return {
    datum,
    dan,
    praznik: imePraznika,
    prost,
    danes: jeDanes,
    prihodnji,
    podatki,
    zigi: k.zigi,
    interval: k.interval,
    segmenti: seg,
    delo: k.delo,
    obveznost,
    saldo,
    nepriznano: k.nepriznano,
    prekoraceno: k.prekoraceno,
    oznake,
    napake: k.napake,
    malice,
    prevozi: prevoz ? PRAVILA.prevozovNaDan : 0,
    stanje,
  };
}
