/**
 * FIN:TV - ANIMIRANE SCENE komponent (namesto slik strani PDF). Za delavce v proizvodnji: naslov, EN podatek in glava
 * Fineseka, ki pove, kako gre (počutje). Projekt (Production) objavi PODATKE (fos_tv_objave.podatki - en element = ena
 * "stran" z veljavnostjo), FIN:TV iz njih naredi scene in jih animirano izriše (src/components/tv/scene/).
 * Čiste funkcije (brez React, brez "use client"): počutje, razdelitev na scene in utripe, časi.
 *
 * Scena = en zaslon (npr. ena celica). Utrip = en podatek v sceni (npr. en krovni nalog): Finesek se odzove (zoom,
 * poskok / tresenje), pokaže se oznaka, vrednost (šteje navzgor) in kratek stavek. Trajanje scene = uvod + utripi.
 * Ton: "slab" obraz ni jezen, ampak zaskrbljen ("gremo!") - vedno za celico / ekipo, nikoli imena ljudi.
 */

/** Počutje Fineseka (glava v FinesekGlava.tsx). */
export type Razpolozenje = "navdusen" | "vesel" | "zadovoljen" | "zaskrbljen" | "ponosen";
export const RAZPOLOZENJA: Record<Razpolozenje, { ime: string; barva: string }> = {
  navdusen: { ime: "Navdušen", barva: "#22c55e" },
  vesel: { ime: "Vesel", barva: "#22c55e" },
  zadovoljen: { ime: "Zadovoljen", barva: "#ee7a3a" },
  zaskrbljen: { ime: "Zaskrbljen", barva: "#f97316" },
  ponosen: { ime: "Ponosen", barva: "#eab308" },
};

export type Ton = "zelena" | "rumena" | "oranzna" | "siva";
export const TONI: Record<Ton, string> = { zelena: "#22c55e", rumena: "#eab308", oranzna: "#f97316", siva: "#9a9aa1" };

export type Utrip = {
  kljuc: string;
  razpolozenje: Razpolozenje;
  /** veliko: številka krovnega / "Skupaj" */
  glava: string;
  /** pod glavo (naročnik) */
  pod?: string | null;
  /** čip nad glavo: "PRED PLANOM" */
  oznaka: string;
  ton: Ton;
  /** vrednost: število šteje navzgor, `predpona` / `pripona` okoli ("+30,5 h", "7,6 / 28 h") */
  vrednost: { st: number; predpona?: string; pripona?: string };
  /** trak napredka 0-1 (ure / plan), null = brez */
  trak?: number | null;
  stavek: string;
};

export type Scena = {
  kljuc: string;
  /** koda vira brez oddelka (fp_delo_vceraj) - ikona in nadnaslov */
  komponenta: string;
  nadnaslov: string;
  naslov: string;
  podnaslov: string;
  utripi: Utrip[];
  trajanjeMs: number;
};

/** Uvod scene (naslov, Finesek pride) in en utrip. */
export const UVOD_MS = 1200;
export const UTRIP_MS = 5500;
/** Največ utripov na sceno (najpomembnejši krovni) - scena ne sme biti predolga. */
export const MAX_UTRIPOV = 4;

/** Kateri utrip je na vrsti ob času `t` (ms od začetka scene; med prehodom negativno = prvi). */
export const utripOb = (s: Pick<Scena, "utripi">, t: number) => Math.max(0, Math.min(s.utripi.length - 1, Math.floor((t - UVOD_MS) / UTRIP_MS)));

const trajanje = (n: number) => UVOD_MS + Math.max(1, n) * UTRIP_MS;

/** 7,6 (ena decimalka, vejica); `kratko`: 28 namesto 28,0 */
export const ure = (x: number, kratko = false) => {
  const r = Math.round(x * 10) / 10;
  return kratko && Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
};

const DNEVI = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];
/** "torek, 17. 11." */
export const danIso = (iso: string) => {
  const [l, m, d] = iso.split("-").map(Number);
  if (!l || !m || !d) return iso;
  return `${DNEVI[new Date(l, m - 1, d).getDay()]}, ${d}. ${m}.`;
};

// ---------------------------------------------------------------------
// Delo - prejšnji dan (Production deloVceraj.ts -> DeloOddelka, ena objava = en oddelek)
// ---------------------------------------------------------------------
export type DeloKrovnega = { krovni: string; narocnik: string | null; plan: number; ure: number; izvenDneva: "pred" | "po" | null };
export type DeloCelice = { naziv: string; dodatno: boolean; plan: number; ure: number; izven: number; rezija: number; osebe: number; krovni: DeloKrovnega[] };
export type DeloOddelka = { koda: string; naziv: string; datum: string; celice: DeloCelice[] };

/**
 * Počutje pri krovnem (dogovor 2026-11-18): ure se gledajo NA PLAN (8 ur posameznik vedno štempla - važno je kje).
 * Delan PRED planom = navdušen; ZA planom (po planiranem koncu) = zaskrbljen; planiran ta dan: ure / plan >= 1 vesel,
 * >= 0,85 zadovoljen, sicer zaskrbljen (npr. 7,6 / 28 h).
 */
export function razpolozenjeKrovnega(k: Pick<DeloKrovnega, "plan" | "ure" | "izvenDneva">): Razpolozenje {
  if (k.izvenDneva === "pred") return "navdusen";
  if (k.izvenDneva === "po") return "zaskrbljen";
  if (k.plan <= 0.05) return "zadovoljen";
  const r = k.ure / k.plan;
  return r >= 1 ? "vesel" : r >= 0.85 ? "zadovoljen" : "zaskrbljen";
}

/** Nadure: celica je skupaj štempljala več, kot je imela plana -> Finesek je ponosen (hvala). */
export const nadureCelice = (c: Pick<DeloCelice, "plan" | "ure">) => (c.plan > 0.05 && c.ure > c.plan + 0.25 ? c.ure - c.plan : 0);

function utripKrovnega(k: DeloKrovnega): Utrip {
  const razpolozenje = razpolozenjeKrovnega(k);
  const osnova = { kljuc: k.krovni, razpolozenje, glava: k.krovni, pod: k.narocnik };
  if (k.izvenDneva === "pred")
    return { ...osnova, oznaka: "Pred planom", ton: "zelena", vrednost: { st: k.ure, predpona: "+", pripona: " h" }, stavek: "Delali ste že naprej - odlično!" };
  if (k.izvenDneva === "po")
    return { ...osnova, oznaka: "Za planom", ton: "oranzna", vrednost: { st: k.ure, pripona: " h" }, stavek: "Zamuja - dajmo ga zaključiti." };
  if (k.plan <= 0.05) return { ...osnova, oznaka: "Delo", ton: "siva", vrednost: { st: k.ure, pripona: " h" }, stavek: "Delo izven plana dneva." };
  const r = k.ure / k.plan;
  const manjka = k.plan - k.ure;
  const vrednost = { st: k.ure, pripona: ` / ${ure(k.plan, true)} h` };
  if (r >= 1) return { ...osnova, oznaka: "Plan dosežen", ton: "zelena", vrednost, trak: r, stavek: "Bravo, po planu!" };
  if (r >= 0.85) return { ...osnova, oznaka: "Skoraj po planu", ton: "rumena", vrednost, trak: r, stavek: `Manjka samo še ${ure(manjka)} h.` };
  return { ...osnova, oznaka: "Zaostajamo", ton: "oranzna", vrednost, trak: r, stavek: `Manjka ${ure(manjka)} h - gremo!` };
}

/** Scene oddelka: ena celica = ena scena (krovni = utripi, nadure = zadnji utrip). */
export function sceneDela(o: DeloOddelka): Scena[] {
  const izid: Scena[] = [];
  for (const c of o.celice ?? []) {
    if (c.plan < 0.05 && c.ure < 0.05) continue;
    const utripi = (c.krovni ?? [])
      .filter((k) => k.plan > 0.05 || k.ure >= 0.25)
      .slice(0, MAX_UTRIPOV)
      .map(utripKrovnega);
    const nadure = nadureCelice(c);
    if (nadure)
      utripi.push({
        kljuc: "nadure",
        razpolozenje: "ponosen",
        glava: "Skupaj",
        oznaka: "Hvala za nadure",
        ton: "rumena",
        vrednost: { st: nadure, predpona: "+", pripona: " h" },
        stavek: `Skupaj ${ure(c.ure)} h, plan ${ure(c.plan, true)} h.`,
      });
    if (!utripi.length)
      utripi.push({ kljuc: "skupaj", razpolozenje: "zadovoljen", glava: "Skupaj", oznaka: "Delo", ton: "siva", vrednost: { st: c.ure, pripona: " h" }, stavek: "Štempljane ure celice." });
    izid.push({
      kljuc: `${o.koda}:${o.datum}:${c.naziv}`,
      komponenta: "fp_delo_vceraj",
      nadnaslov: "Delo - prejšnji dan",
      naslov: c.naziv,
      podnaslov: `${o.naziv} · ${danIso(o.datum)}`,
      utripi,
      trajanjeMs: trajanje(utripi.length),
    });
  }
  return izid;
}

// ---------------------------------------------------------------------
// Vstop: koda vira + en element objave -> scene. Nova animirana komponenta = nova veja tukaj.
// ---------------------------------------------------------------------
const jeObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

export function sceneElementa(koda: string, podatek: unknown): Scena[] {
  if (!jeObjekt(podatek)) return [];
  if (koda.startsWith("fp_delo_vceraj") && Array.isArray(podatek.celice)) return sceneDela(podatek as unknown as DeloOddelka);
  return [];
}
