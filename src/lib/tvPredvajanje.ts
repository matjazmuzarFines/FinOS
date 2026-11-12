import { imaUvod, type TvOkno, type TvVir } from "@/lib/tv";

/**
 * FIN:TV - kaj se vrti zdaj (čista funkcija, brez React).
 *
 * Diapozitiv = en zaslon v krogu. Vsako okno ima pred seboj NASLOVNO STRAN (če je vklopljena):
 *   prehod 2 s -> naslov 4 s -> prehod 2 s -> vsebina (trajanje okna) ... skupaj 8 s prehoda.
 * Vsak diapozitiv se začne s prehodom (PREHOD_MS), zato je njegov čas = prehod + prikaz.
 * PDF / komponenta: vsaka stran svoj diapozitiv; POKONČNA stran pri "Zapolni zaslon" se razreže na ležeče dele
 * (širina zaslona, deli se malo prekrivajo) - med deli stran zdrsne navzgor (isti `prikaz`, brez prehoda).
 * Položaj v krogu se izračuna iz URE: čas mod skupno trajanje -> povezani zasloni kažejo isto ob istem času.
 */
export const PREHOD_MS = 2000;
export const NASLOV_MS = 4000;
/** Razmerje zaslona (višina / širina). */
const ZASLON = 1080 / 1920;
/** Prekrivanje sosednjih delov pokončne strani (del zaslona). */
const PREKRIVANJE = 0.12;

export type Diapozitiv = {
  kljuc: string;
  /** isti `prikaz` = isti element na zaslonu (deli iste strani: zdrsne, ni prehoda) */
  prikaz: string;
  okno: TvOkno;
  /** naslovna stran okna */
  naslovna?: boolean;
  /** pot slike strani (PDF, komponenta, priloga obvestila PDF) */
  stran?: string;
  stStrani?: number;
  /** del pokončne strani: odmik od vrha v delih višine slike (0 = vrh) in razmerje strani */
  pas?: { odmik: number; razmerje: number; i: number; n: number };
  trajanjeMs: number;
};

/** Okno velja zdaj: aktivno in v obdobju velja od-do. */
export const veljaZdaj = (o: Pick<TvOkno, "aktivno" | "velja_od" | "velja_do" | "visible">, zdaj: number) =>
  o.visible && o.aktivno && (!o.velja_od || new Date(o.velja_od).getTime() <= zdaj) && (!o.velja_do || new Date(o.velja_do).getTime() > zdaj);

/** Deli pokončne strani (odmiki od vrha, v delih višine strani). Ležeča stran = en del. */
export function deliStrani(razmerje: number | undefined): number[] {
  if (!razmerje || razmerje <= ZASLON * 1.15) return [0];
  const vidno = ZASLON / razmerje; // del višine strani, ki gre na zaslon
  const korak = vidno * (1 - PREKRIVANJE);
  const n = Math.ceil((1 - vidno) / korak) + 1;
  return Array.from({ length: n }, (_, i) => Math.min(i * korak, 1 - vidno));
}

/** Strani okna: PDF, komponenta (zadnja objava), priloga PDF pri obvestilu. */
export function straniOkna(o: TvOkno, viri: TvVir[]): { strani: string[]; razmerja: number[] } {
  if (o.vrsta === "vir") {
    const v = viri.find((x) => x.id === o.id_vira);
    return v?.vklopljen && v.objava ? { strani: v.objava.strani, razmerja: v.objava.razmerja } : { strani: [], razmerja: [] };
  }
  return { strani: o.strani, razmerja: o.vsebina.razmerja ?? [] };
}

export function diapozitivi(okna: TvOkno[], zdaj: number, viri: TvVir[] = []): Diapozitiv[] {
  const izid: Diapozitiv[] = [];
  for (const o of [...okna].sort((a, b) => a.vrstni_red - b.vrstni_red || a.id - b.id)) {
    if (!veljaZdaj(o, zdaj)) continue;
    const ms = PREHOD_MS + Math.max(1, o.trajanje_s) * 1000;
    const vsebina: Diapozitiv[] = [];
    const { strani, razmerja } = straniOkna(o, viri);
    if (o.vrsta === "pdf" || o.vrsta === "vir") {
      const zapolni = (o.vsebina.prilagoditev ?? "celo") === "zapolni";
      strani.forEach((s, i) => {
        const deli = zapolni ? deliStrani(razmerja[i]) : [0];
        deli.forEach((odmik, j) =>
          vsebina.push({
            kljuc: `${o.id}:${i}:${j}`,
            prikaz: `${o.id}:${i}`,
            okno: o,
            stran: s,
            stStrani: i + 1,
            ...(deli.length > 1 ? { pas: { odmik, razmerje: razmerja[i], i: j, n: deli.length } } : {}),
            trajanjeMs: ms,
          }),
        );
      });
    } else if (o.vrsta === "obvestilo") {
      if (o.vsebina.obvestilo?.priloga === "pdf" && strani.length)
        strani.forEach((s, i) => vsebina.push({ kljuc: `${o.id}:${i}`, prikaz: `${o.id}:${i}`, okno: o, stran: s, stStrani: i + 1, trajanjeMs: ms }));
      else vsebina.push({ kljuc: String(o.id), prikaz: String(o.id), okno: o, trajanjeMs: ms });
    } else if (o.datoteka) vsebina.push({ kljuc: String(o.id), prikaz: String(o.id), okno: o, trajanjeMs: ms });

    if (!vsebina.length) continue;
    if (imaUvod(o)) izid.push({ kljuc: `${o.id}:naslov`, prikaz: `${o.id}:naslov`, okno: o, naslovna: true, trajanjeMs: PREHOD_MS + NASLOV_MS });
    izid.push(...vsebina);
  }
  return izid;
}

/** Skupno trajanje kroga (ms). */
export const trajanjeKroga = (d: Diapozitiv[]) => d.reduce((s, x) => s + x.trajanjeMs, 0);

/** Kateri diapozitiv se vrti ob času `ms` (epoch): indeks, koliko ga je že minilo, številka kroga. */
export function polozaj(d: Diapozitiv[], ms: number): { i: number; odmikMs: number; krog: number } | null {
  const krog = trajanjeKroga(d);
  if (!d.length || krog <= 0) return null;
  let t = ((ms % krog) + krog) % krog;
  for (let i = 0; i < d.length; i++) {
    if (t < d[i].trajanjeMs) return { i, odmikMs: t, krog: Math.floor(ms / krog) };
    t -= d[i].trajanjeMs;
  }
  return { i: 0, odmikMs: 0, krog: Math.floor(ms / krog) };
}

/** 1:05 / 12:30 */
export const minSek = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Prvi diapozitiv okna za sličico / predogled (pokončna stran pri Zapolni = prvi del). */
export function prviDiapozitiv(o: TvOkno, viri: TvVir[]): Pick<Diapozitiv, "okno" | "stran" | "pas"> {
  const { strani, razmerja } = straniOkna(o, viri);
  const deli = (o.vsebina.prilagoditev ?? "celo") === "zapolni" && (o.vrsta === "pdf" || o.vrsta === "vir") ? deliStrani(razmerja[0]) : [0];
  return { okno: o, stran: strani[0], ...(deli.length > 1 ? { pas: { odmik: 0, razmerje: razmerja[0], i: 0, n: deli.length } } : {}) };
}
