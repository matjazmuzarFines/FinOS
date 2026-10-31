"use client";

import { useEffect, useState } from "react";
import { CalendarOff, CircleAlert, CircleDashed, MessageSquare, Moon, Pencil, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { ikonaStatistike, imePraznika as praznikNa, type CasNastavitve, type Statistika } from "./casNastavitve";

/**
 * Registracija časa - izračun dneva za koledar (skupno Administraciji in FIN:ME).
 * Vhod: štempljanja (žigi) in celodnevne odsotnosti dneva; izhod: odseki časovne linije, ure, malice, prevozi, stanje.
 * Čas je v minutah od polnoči dneva prihoda; delo čez polnoč ima čase nad 1440 (npr. 22:00-01:00 = 1320-1500) in se
 * VEDNO šteje v dan začetka (prihoda), ne glede na datum konca.
 */

/**
 * Štempljanje: prihod / odhod; pri odhodu statistika pove razlog izhoda (zasebni, službeni ...), brez nje = konec dela.
 * Vir: krmilnik (čitalec na vhodu), online aplikacija (FIN:ME), ročni popravek.
 */
export type Zig = { cas: number; smer: "prihod" | "odhod"; id_statistike: number | null; vir: keyof typeof VIRI };

/** Vir štempljanja (kasneje šifrant v bazi štempljanj). */
export const VIRI = { krmilnik: "Krmilnik", online: "Online aplikacija", rocno: "Ročni popravek" } as const;
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
  segmenti: Segment[];
  /** Minute, ki štejejo v delovno obveznost. */
  delo: number;
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
/** 485 -> "8 h 05 min" (kratko: "8:05") */
export const fmtTrajanje = (min: number, kratko = false) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return kratko ? `${h}:${String(m).padStart(2, "0")}` : m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
};
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

/** Odseki časovne linije: prihod -> naslednji žig = prisotnost; odhod z razlogom -> vrnitev = odsotnost z razlogom. */
export function segmenti(p: DanPodatki, zdajMin: number | null): Segment[] {
  const out: Segment[] = [];
  if (p.odsotnost) out.push({ od: p.odsotnost.od, do: p.odsotnost.do, id_statistike: p.odsotnost.id_statistike, celodnevno: true });
  const zigi = [...p.zigi].sort((a, b) => a.cas - b.cas);
  zigi.forEach((z, i) => {
    if (z.id_statistike == null) return;
    const naslednji = zigi[i + 1];
    const konec = naslednji?.cas ?? zdajMin;
    if (konec == null || konec <= z.cas) return;
    out.push({ od: z.cas, do: konec, id_statistike: z.id_statistike, odprt: !naslednji });
  });
  return out;
}

const imaLastnost = (s: Statistika | undefined, koda: string, n: CasNastavitve) => !!s && s.lastnosti.some((id) => n.lastnosti.find((l) => l.id === id)?.koda === koda);
const stanjeStatistike = (s: Statistika): StanjeDneva => ({ koda: `stat:${s.koda}`, ime: s.ime, ikona: ikonaStatistike(s.ikona), barva: s.barva, opis: s.opis });

/** Izračun dneva za prikaz (danes = YYYY-MM-DD, zdajMin = minute od polnoči). */
export function izracunajDan(datum: string, podatki: DanPodatki, n: CasNastavitve, danes: string, zdajMin: number): DanIzracun {
  const dan = danVTednu(datum);
  const imePraznika = praznikNa(datum, n);
  const prost = dan >= 6 || !!imePraznika;
  const jeDanes = datum === danes;
  const prihodnji = datum > danes;
  const seg = segmenti(podatki, jeDanes ? zdajMin : null);
  const stat = (id: number) => n.statistike.find((s) => s.id === id);

  let delo = 0;
  let zaMalico = 0;
  let prevoz = false;
  for (const x of seg) {
    const s = stat(x.id_statistike);
    const min = x.do - x.od;
    if (imaLastnost(s, "delovna_obveznost", n)) delo += min;
    if (imaLastnost(s, "malice", n)) zaMalico += min;
    if (imaLastnost(s, "prevozi", n) && !x.celodnevno) prevoz = true;
  }
  const malice = PRAVILA.malice.reduce((st, p) => (zaMalico >= p.od ? p.stevilo : st), 0);

  let stanje: StanjeDneva;
  const zadnji = [...podatki.zigi].sort((a, b) => a.cas - b.cas).at(-1);
  if (podatki.odsotnost && stat(podatki.odsotnost.id_statistike)) stanje = stanjeStatistike(stat(podatki.odsotnost.id_statistike)!);
  else if (zadnji) {
    if (jeDanes && zadnji.smer === "prihod") stanje = STANJA.na_delu;
    else if (jeDanes && zadnji.id_statistike != null && stat(zadnji.id_statistike)) stanje = stanjeStatistike(stat(zadnji.id_statistike)!);
    else if (podatki.zigi.some((z) => z.smer === "prihod" && z.vir !== "online")) stanje = STANJA.prisoten;
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

  return { datum, dan, praznik: imePraznika, prost, danes: jeDanes, prihodnji, podatki, segmenti: seg, delo, malice, prevozi: prevoz ? PRAVILA.prevozovNaDan : 0, stanje };
}
