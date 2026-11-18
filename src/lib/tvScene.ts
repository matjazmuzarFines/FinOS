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

export type Ton = "zelena" | "rumena" | "oranzna" | "rdeca" | "siva";
export const TONI: Record<Ton, string> = { zelena: "#22c55e", rumena: "#eab308", oranzna: "#f97316", rdeca: "#ef4444", siva: "#9a9aa1" };

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
  /**
   * vrednost: število `st` šteje navzgor, `predpona` / `pripona` okoli ("+30,5 h", "7,6 / 28 h", "112 %"); `cela` = brez
   * decimalke; `besedilo` = namesto števila (npr. "Vse v hiši").
   */
  vrednost: { st?: number; besedilo?: string; predpona?: string; pripona?: string; cela?: boolean };
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

/** 112 (cela števila, za % in dni) */
export const celo = (x: number) => String(Math.round(x));

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

const KRATKI_DNEVI = ["ned", "pon", "tor", "sre", "čet", "pet", "sob"];
/** "sre 19. 11." */
export const kratekDan = (iso: string | null) => {
  const [l, m, d] = (iso ?? "").split("-").map(Number);
  if (!l || !m || !d) return "-";
  return `${KRATKI_DNEVI[new Date(l, m - 1, d).getDay()]} ${d}. ${m}.`;
};
const dni = (n: number) => (Math.abs(n) === 1 ? "dan" : Math.abs(n) === 2 ? "dneva" : "dni");
/** Dan `iso` + n dni */
const dodajDni = (iso: string, n: number) => {
  const [l, m, d] = iso.split("-").map(Number);
  const x = new Date(l, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------
// Zaključeni krovni (Production zakljuceniKrovni.ts -> ZakljuceniOddelka, ena objava = en oddelek)
// ---------------------------------------------------------------------
export type KrovniZakljucenTv = { krovni: string; zakljucen: string; normUre: number; ure: number; produktivnost: number | null };
export type ZakljuceniOddelkaTv = { koda: string; naziv: string; od: string; celice: { naziv: string; krovni: KrovniZakljucenTv[] }[] };

/** Produktivnost izven 50-150 % je za preverjanje (PREVERI_POD / PREVERI_NAD v Production) - na TV se ne pokaže. */
export const PRODUKTIVNOST_TV = { od: 0.5, do: 1.5 };

/** Počutje po produktivnosti (kot barve: >= 100 % zeleno, 85-99 % rumeno, < 85 % rdeče); >= 110 % navdušen. */
export function razpolozenjeProduktivnosti(p: number): Razpolozenje {
  return p >= 1.1 ? "navdusen" : p >= 1 ? "vesel" : p >= 0.85 ? "zadovoljen" : "zaskrbljen";
}
const tonProduktivnosti = (p: number): Ton => (p >= 1 ? "zelena" : p >= 0.85 ? "rumena" : "rdeca");

function utripZakljucenega(k: KrovniZakljucenTv): Utrip {
  const p = k.produktivnost!;
  const stavek = p >= 1.1 ? "Odlično - hitreje od normativa!" : p >= 1 ? "Bravo, v normativu!" : p >= 0.85 ? "Skoraj - še malo!" : "Pod normativom - naslednjič bolje!";
  return {
    kljuc: k.krovni,
    razpolozenje: razpolozenjeProduktivnosti(p),
    glava: k.krovni,
    pod: `zaključen ${kratekDan(k.zakljucen)}`,
    oznaka: "Produktivnost",
    ton: tonProduktivnosti(p),
    vrednost: { st: p * 100, pripona: " %", cela: true },
    trak: p,
    stavek,
  };
}

/** Scene oddelka: ena celica = ena scena (zadnji zaključeni krovni = utripi, na koncu skupna produktivnost celice). */
export function sceneZakljucenih(o: ZakljuceniOddelkaTv): Scena[] {
  const izid: Scena[] = [];
  for (const c of o.celice ?? []) {
    const veljavni = (c.krovni ?? [])
      .filter((k) => k.produktivnost != null && k.produktivnost >= PRODUKTIVNOST_TV.od && k.produktivnost <= PRODUKTIVNOST_TV.do)
      .sort((a, b) => b.zakljucen.localeCompare(a.zakljucen));
    if (!veljavni.length) continue;
    const utripi = veljavni.slice(0, MAX_UTRIPOV).map(utripZakljucenega);
    if (veljavni.length > 1) {
      const norm = veljavni.reduce((x, k) => x + k.normUre, 0);
      const ur = veljavni.reduce((x, k) => x + k.ure, 0);
      const p = ur > 0 ? norm / ur : 0;
      if (p > 0)
        utripi.push({
          kljuc: "skupaj",
          razpolozenje: p >= 1 ? "ponosen" : razpolozenjeProduktivnosti(p),
          glava: "Skupaj",
          pod: `${veljavni.length} zaključenih krovnih`,
          oznaka: "Produktivnost",
          ton: tonProduktivnosti(p),
          vrednost: { st: p * 100, pripona: " %", cela: true },
          trak: p,
          stavek: p >= 1 ? "Hvala - odlično delo celice!" : "Skupaj gremo naprej!",
        });
    }
    izid.push({
      kljuc: `${o.koda}:zakljuceni:${c.naziv}`,
      komponenta: "fp_zakljuceni_krovni",
      nadnaslov: "Zaključeni krovni",
      naslov: c.naziv,
      podnaslov: `${o.naziv} · zadnjih 30 dni`,
      utripi,
      trajanjeMs: trajanje(utripi.length),
    });
  }
  return izid;
}

// ---------------------------------------------------------------------
// Pripravljenost materiala (Production pripravljenostPodatki.ts -> krovni iz plana oddelka, ena objava = en oddelek)
// ---------------------------------------------------------------------
export type StanjeMateriala = "zaloga" | "pride" | "zapadel" | "prepozno" | "ni_naroceno";
export type KrovniMaterialTv = {
  krovni: string;
  /** celica najzgodnejše postavitve v oddelku */
  mesto: string;
  zacetek: string | null;
  /** najslabše stanje vrstic */
  stanje: StanjeMateriala;
  /** dan, ko je ves material v hiši (null = ni znano) */
  kompleten: string | null;
  /** dni od kompleten do začetka (+ rezerva, - zamuda) */
  rezerva: number | null;
  /** vrstic, ki niso na zalogi */
  manjkajocih: number;
  druzina: string | null;
};
export type MaterialOddelkaTv = { koda: string; naziv: string; danes: string; krovni: KrovniMaterialTv[] };

/**
 * Počutje (dogovor 2026-11-18): ni naročeno / pride prepozno / zamuja (rok mimo) = zaskrbljen; pride pravočasno ali
 * je na zalogi = vesel.
 */
export const razpolozenjeMateriala = (s: StanjeMateriala): Razpolozenje => (s === "zaloga" || s === "pride" ? "vesel" : "zaskrbljen");

const materialov = (n: number) => ({ st: n, pripona: n === 1 ? " material" : n === 2 ? " materiala" : n <= 4 ? " materiali" : " materialov", cela: true });

function utripMateriala(k: KrovniMaterialTv): Utrip {
  const osnova = { kljuc: k.krovni, razpolozenje: razpolozenjeMateriala(k.stanje), glava: k.krovni, pod: k.druzina };
  const zacetek = `začetek ${kratekDan(k.zacetek)}`;
  switch (k.stanje) {
    case "zaloga":
      return { ...osnova, oznaka: "Material je tu", ton: "zelena", vrednost: { besedilo: "Vse v hiši" }, stavek: `Lahko začnemo - ${zacetek}` };
    case "pride":
      return {
        ...osnova,
        oznaka: "Pride pravočasno",
        ton: "zelena",
        vrednost: k.rezerva != null ? { st: k.rezerva, predpona: "+", pripona: ` ${dni(k.rezerva)} rezerve`, cela: true } : { besedilo: kratekDan(k.kompleten) },
        stavek: `Material bo ${kratekDan(k.kompleten)}, ${zacetek}`,
      };
    case "prepozno":
      return {
        ...osnova,
        oznaka: "Pride prepozno",
        ton: "oranzna",
        vrednost: k.rezerva != null ? { st: Math.abs(k.rezerva), pripona: ` ${dni(k.rezerva)} zamude`, cela: true } : materialov(k.manjkajocih),
        stavek: `Material bo šele ${kratekDan(k.kompleten)}, ${zacetek}`,
      };
    case "zapadel":
      return { ...osnova, oznaka: "Dobava zamuja", ton: "oranzna", vrednost: materialov(k.manjkajocih), stavek: `Rok dobave je mimo, materiala še ni - ${zacetek}` };
    default:
      return { ...osnova, oznaka: "Ni naročeno", ton: "rdeca", vrednost: materialov(k.manjkajocih), stavek: `Material še ni naročen - ${zacetek}` };
  }
}

/** Krovni, ki se je že začel, se še pokaže 7 dni (material zanj je še pomemben). */
const MATERIAL_ZACET_DNI = 7;

/** Scene oddelka: ena celica = ena scena, utripi = prvi krovni po začetku. */
export function sceneMateriala(o: MaterialOddelkaTv): Scena[] {
  const meja = o.danes ? dodajDni(o.danes, -MATERIAL_ZACET_DNI) : "";
  const poCelicah = new Map<string, KrovniMaterialTv[]>();
  for (const k of o.krovni ?? []) {
    if (!k.zacetek || k.zacetek < meja) continue;
    const mesto = k.mesto || "Brez delovnega mesta";
    poCelicah.set(mesto, [...(poCelicah.get(mesto) ?? []), k]);
  }
  return [...poCelicah.entries()].map(([mesto, krovni]) => {
    const utripi = [...krovni]
      .sort((a, b) => (a.zacetek ?? "").localeCompare(b.zacetek ?? ""))
      .slice(0, MAX_UTRIPOV)
      .map(utripMateriala);
    return {
      kljuc: `${o.koda}:material:${mesto}`,
      komponenta: "fp_pripravljenost_mat",
      nadnaslov: "Pripravljenost materiala",
      naslov: mesto,
      podnaslov: `${o.naziv} · naslednji krovni`,
      utripi,
      trajanjeMs: trajanje(utripi.length),
    };
  });
}

// ---------------------------------------------------------------------
// Delovni plan (workflow) in Pregled (roki) - Production WorkflowPlan, en element = en teden (velja pon - ned)
// ---------------------------------------------------------------------
export type KorakPlanaTv = { krovni: string; narocnik: string | null; od: string; do: string; ure: number; brezKapacitete: number; prosta: boolean };
export type PlanTv = { oddelek: string; od: string; do: string; celice: { naziv: string; koraki: KorakPlanaTv[] }[] };

/** Delovni dnevi (pon - pet) od `od` (izključno) do `do` (vključno); 0 = isti dan ali prej. */
export function delovnihDni(od: string, doo: string) {
  let n = 0;
  for (let d = dodajDni(od, 1); d <= doo; d = dodajDni(d, 1)) {
    const [l, m, x] = d.split("-").map(Number);
    const t = new Date(l, m - 1, x).getDay();
    if (t !== 0 && t !== 6) n++;
  }
  return n;
}

/** Premalo ljudi (brez kapacitete) - zaskrbljen (dogovor 2026-11-18). */
const premaloLjudi = (k: KorakPlanaTv): Utrip | null =>
  k.brezKapacitete > 0.05
    ? {
        kljuc: k.krovni,
        razpolozenje: "zaskrbljen",
        glava: k.krovni,
        pod: k.narocnik,
        oznaka: "Premalo ljudi",
        ton: "oranzna",
        vrednost: { st: k.brezKapacitete, pripona: " h manjka" },
        stavek: `${kratekDan(k.od)} - ${kratekDan(k.do)}: potrebujemo pomoč.`,
      }
    : null;

/** Delovni plan: kaj delamo - po celici nedokončani koraki po vrsti, DANES označen. */
export function scenePlana(o: PlanTv, danes: string): Scena[] {
  const izid: Scena[] = [];
  for (const c of o.celice ?? []) {
    const koraki = (c.koraki ?? []).filter((k) => k.do >= danes).sort((a, b) => a.od.localeCompare(b.od));
    if (!koraki.length) continue;
    const utripi = koraki.slice(0, MAX_UTRIPOV).map((k): Utrip => {
      const zdaj = k.od <= danes;
      return (
        premaloLjudi(k) ?? {
          kljuc: k.krovni,
          razpolozenje: zdaj ? "vesel" : "zadovoljen",
          glava: k.krovni,
          pod: k.narocnik,
          oznaka: zdaj ? "Danes delamo" : `Od ${kratekDan(k.od)}`,
          ton: zdaj ? "zelena" : "siva",
          vrednost: { st: k.ure, pripona: " h" },
          stavek: k.od === k.do ? `Samo ${kratekDan(k.od)}` : `${kratekDan(k.od)} - ${kratekDan(k.do)}`,
        }
      );
    });
    izid.push({
      kljuc: `${o.oddelek}:plan:${o.od}:${c.naziv}`,
      komponenta: "fp_plan_workflow",
      nadnaslov: "Delovni plan",
      naslov: c.naziv,
      podnaslov: `${o.oddelek} · kaj delamo`,
      utripi,
      trajanjeMs: trajanje(utripi.length),
    });
  }
  return izid;
}

/**
 * Pregled - do kdaj: po celici nedokončani koraki po roku (konec v planu), odštevanje delovnih dni. Rok danes / jutri =
 * zaskrbljen (dogovor 2026-11-18), 2 dni zadovoljen, več vesel; premalo ljudi = zaskrbljen.
 */
export function scenePregleda(o: PlanTv, danes: string): Scena[] {
  const izid: Scena[] = [];
  for (const c of o.celice ?? []) {
    const koraki = (c.koraki ?? []).filter((k) => k.do >= danes).sort((a, b) => a.do.localeCompare(b.do));
    if (!koraki.length) continue;
    const utripi = koraki.slice(0, MAX_UTRIPOV).map((k): Utrip => {
      const ljudje = premaloLjudi(k);
      if (ljudje) return ljudje;
      const n = delovnihDni(danes, k.do);
      const osnova = { kljuc: k.krovni, glava: k.krovni, pod: k.narocnik, stavek: `Rok ${kratekDan(k.do)}` };
      if (n === 0) return { ...osnova, razpolozenje: "zaskrbljen", oznaka: "Rok danes", ton: "rdeca", vrednost: { besedilo: "Danes" }, stavek: "Danes ga zaključimo!" };
      if (n === 1) return { ...osnova, razpolozenje: "zaskrbljen", oznaka: "Rok jutri", ton: "oranzna", vrednost: { st: 1, predpona: "še ", pripona: " dan", cela: true } };
      return {
        ...osnova,
        razpolozenje: n === 2 ? "zadovoljen" : "vesel",
        oznaka: "Do roka",
        ton: n === 2 ? "rumena" : "zelena",
        vrednost: { st: n, predpona: "še ", pripona: n === 2 ? " dneva" : " dni", cela: true },
      };
    });
    izid.push({
      kljuc: `${o.oddelek}:pregled:${o.od}:${c.naziv}`,
      komponenta: "fp_plan_pregled",
      nadnaslov: "Do kdaj? Roki",
      naslov: c.naziv,
      podnaslov: `${o.oddelek} · delovni dnevi do roka`,
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

/** `danes` = lokalni datum "2026-11-18" (plan: kaj je danes / koliko dni do roka). */
export function sceneElementa(koda: string, podatek: unknown, danes: string): Scena[] {
  if (!jeObjekt(podatek)) return [];
  if (koda.startsWith("fp_delo_vceraj") && Array.isArray(podatek.celice)) return sceneDela(podatek as unknown as DeloOddelka);
  if (koda.startsWith("fp_zakljuceni_krovni") && Array.isArray(podatek.celice)) return sceneZakljucenih(podatek as unknown as ZakljuceniOddelkaTv);
  if (koda.startsWith("fp_pripravljenost_mat") && Array.isArray(podatek.krovni)) return sceneMateriala(podatek as unknown as MaterialOddelkaTv);
  if (koda.startsWith("fp_plan_workflow") && Array.isArray(podatek.celice)) return scenePlana(podatek as unknown as PlanTv, danes);
  if (koda.startsWith("fp_plan_pregled") && Array.isArray(podatek.celice)) return scenePregleda(podatek as unknown as PlanTv, danes);
  return [];
}
