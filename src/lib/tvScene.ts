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
  // --- podatki za posamezne svete (izris komponente) ---
  /** merilnik (Delo): štempljane ure in plan (null = brez plana) */
  meter?: { vrednost: number; plan: number | null };
  /** tekoči trak (Material): stanje materiala */
  material?: StanjeMateriala;
  /** kdaj (datum / obdobje): postaja poti, list koledarja, pride */
  kdaj?: string | null;
  /** pot (Plan): korak teče danes */
  danes?: boolean;
  /** koledar (Pregled): delovni dnevi do roka */
  dni?: number;
  /** tabla odprem (Prioritete krovnih): vrstice te strani seznama in katera stran je (1 / 2) */
  odpreme?: VrsticaOdpreme[];
  stran?: { i: number; n: number };
};

/** Svet = postavitev in animacija komponente (vsaka komponenta svoj svet, da TV ni vedno enak). */
export type Svet = "merilnik" | "podij" | "trak" | "pot" | "koledar" | "odpreme";
export const SVETI: Record<string, { svet: Svet; barva: string }> = {
  fp_delo_vceraj: { svet: "merilnik", barva: "#3b82f6" },
  fp_zakljuceni_krovni: { svet: "podij", barva: "#eab308" },
  fp_pripravljenost_mat: { svet: "trak", barva: "#a855f7" },
  fp_plan_workflow: { svet: "pot", barva: "#14b8a6" },
  fp_plan_pregled: { svet: "koledar", barva: "#f43f5e" },
  fp_prioritete_krovnih: { svet: "odpreme", barva: "#0ea5e9" },
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
  /** trajanje enega utripa, če ni UTRIP_MS (npr. tabla odprem - več vrstic za branje) */
  utripMs?: number;
};

/** Uvod scene (naslov, Finesek pride) in en utrip. */
export const UVOD_MS = 1200;
export const UTRIP_MS = 5500;
/** Največ utripov na sceno (najpomembnejši krovni) - scena ne sme biti predolga. */
export const MAX_UTRIPOV = 4;

/** Kateri utrip je na vrsti ob času `t` (ms od začetka scene; med prehodom negativno = prvi). */
export const utripOb = (s: Pick<Scena, "utripi" | "utripMs">, t: number) =>
  Math.max(0, Math.min(s.utripi.length - 1, Math.floor((t - UVOD_MS) / (s.utripMs ?? UTRIP_MS))));

const trajanje = (n: number, utripMs = UTRIP_MS) => UVOD_MS + Math.max(1, n) * utripMs;

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

/** Glavna družina in kosi (OCB 4) - krovni ima lahko naloge več naročnikov, zato na TV družine, ne naročnik. */
export type DruzinaKosov = { d: string; kos: number };
/** "OCB 4 kos · OCA 2 kos" (največ 3 družine, nato "+2"); prazno = null. */
export function besediloDruzin(dr: DruzinaKosov[] | undefined | null): string | null {
  if (!dr?.length) return null;
  const t = dr.slice(0, 3).map((x) => (x.kos > 0 ? `${x.d} ${x.kos} kos` : x.d));
  return dr.length > 3 ? `${t.join(" · ")} · +${dr.length - 3}` : t.join(" · ");
}

// ---------------------------------------------------------------------
// Delo - prejšnji dan (Production deloVceraj.ts -> DeloOddelka, ena objava = en oddelek)
// ---------------------------------------------------------------------
export type DeloKrovnega = { krovni: string; plan: number; ure: number; izvenDneva: "pred" | "po" | null; druzine?: DruzinaKosov[] };
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
  const osnova = { kljuc: k.krovni, razpolozenje, glava: k.krovni, pod: besediloDruzin(k.druzine), meter: { vrednost: k.ure, plan: k.plan > 0.05 ? k.plan : null } };
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
        meter: { vrednost: c.ure, plan: c.plan },
        razpolozenje: "ponosen",
        glava: "Skupaj",
        oznaka: "Hvala za nadure",
        ton: "rumena",
        vrednost: { st: nadure, predpona: "+", pripona: " h" },
        stavek: `Skupaj ${ure(c.ure)} h, plan ${ure(c.plan, true)} h.`,
      });
    if (!utripi.length)
      utripi.push({ kljuc: "skupaj", meter: { vrednost: c.ure, plan: c.plan > 0.05 ? c.plan : null }, razpolozenje: "zadovoljen", glava: "Skupaj", oznaka: "Delo", ton: "siva", vrednost: { st: c.ure, pripona: " h" }, stavek: "Štempljane ure celice." });
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
  const osnova = { kljuc: k.krovni, razpolozenje: razpolozenjeMateriala(k.stanje), glava: k.krovni, pod: k.druzina, material: k.stanje, kdaj: k.kompleten ? kratekDan(k.kompleten) : null };
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
export type KorakPlanaTv = { krovni: string; druzine?: DruzinaKosov[]; od: string; do: string; ure: number; brezKapacitete: number; prosta: boolean };
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
        pod: besediloDruzin(k.druzine),
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
      const kdaj = k.od === k.do ? kratekDan(k.od) : `${kratekDan(k.od)} - ${kratekDan(k.do)}`;
      const ljudje = premaloLjudi(k);
      if (ljudje) return { ...ljudje, kdaj, danes: zdaj };
      return (
        {
          kdaj,
          danes: zdaj,
          kljuc: k.krovni,
          razpolozenje: zdaj ? "vesel" : "zadovoljen",
          glava: k.krovni,
          pod: besediloDruzin(k.druzine),
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
      const n = delovnihDni(danes, k.do);
      const ljudje = premaloLjudi(k);
      if (ljudje) return { ...ljudje, dni: n, kdaj: kratekDan(k.do) };
      const osnova = { kljuc: k.krovni, glava: k.krovni, pod: besediloDruzin(k.druzine), stavek: `Rok ${kratekDan(k.do)}`, dni: n, kdaj: kratekDan(k.do) };
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
// Prioritete krovnih (Production prioriteteTv.ts -> PrioriteteOddelkaTv, ena objava = en oddelek)
// Ista razdelitev naročil kot stran Prioritete (potrjena naročila, FIFO po datumu odpreme). Za VSAK krovni iz plana
// oddelka VSE odpreme - nič se ne odreže: daljši seznam gre čez več utripov (ODPREM_NA_STRAN vrstic na utrip).
// ---------------------------------------------------------------------
export type OdpremaTv = {
  /** dan odpreme (null = naročilo brez datuma) */
  datum: string | null;
  kos: number;
  /** kratko ime kupca (kratkoIme v Production) */
  kupec: string | null;
  narocilo: string;
  /** glavne družine izdelkov odpreme (ODC, OCB) */
  druzina: string | null;
  /** nalog, ki pokrije odpremo, ima rok izdelave po odpremi (status ZAMUJA na Prioritetah) */
  zamuja: boolean;
};
export type PrioritetaKrovnegaTv = {
  krovni: string;
  /** celica najzgodnejše postavitve v oddelku */
  mesto: string;
  zacetek: string | null;
  /** odprti kosi krovnega po družinah (vsi nalogi, tudi za zalogo) */
  druzine?: DruzinaKosov[];
  /** odprti kosi v krovnem */
  kosov: number;
  /** od tega naročenih (dodeljenih naročilom) */
  naroceno: number;
  /** različnih naročil */
  narocil: number;
  odpreme: OdpremaTv[];
};
export type PrioriteteOddelkaTv = { koda: string; naziv: string; danes: string; krovni: PrioritetaKrovnegaTv[] };

/** Vrstic na tabli odprem v enem utripu (več = naslednji utrip). */
export const ODPREM_NA_STRAN = 6;
/** Utrip table odprem (do 6 vrstic za branje - dlje kot en podatek). */
export const UTRIP_ODPREM_MS = 9500;

/** Koledarski dnevi od `od` do `do` (negativno = do je prej). */
const razlikaDni = (od: string, doo: string) => {
  const ms = (iso: string) => {
    const [l, m, d] = iso.split("-").map(Number);
    return Date.UTC(l, m - 1, d);
  };
  return Math.round((ms(doo) - ms(od)) / 86_400_000);
};

/** Vrstica table odprem (izračunano za danes). */
export type VrsticaOdpreme = { kljuc: string; dan: string; kos: number; druzina: string | null; kupec: string | null; stanje: string; ton: Ton; naslednja: boolean };

const kosov = (n: number) => `${celo(n)} kos`;
const narocil = (n: number) => `${n} ${n === 1 ? "naročilo" : n === 2 ? "naročili" : n <= 4 ? "naročila" : "naročil"}`;

/** Stanje odpreme za danes (koledarski dnevi): zamuja (dan mimo), danes, nalog prepozen, jutri, čez N dni. */
export function stanjeOdpreme(o: Pick<OdpremaTv, "datum" | "zamuja">, danes: string): { stanje: string; ton: Ton } {
  if (!o.datum) return { stanje: "Brez datuma", ton: "siva" };
  const n = razlikaDni(danes, o.datum);
  if (n < 0) return { stanje: `Zamuja ${-n} ${dni(n)}`, ton: "rdeca" };
  if (n === 0) return { stanje: "Danes", ton: "oranzna" };
  if (o.zamuja) return { stanje: "Nalog zamuja", ton: "oranzna" };
  if (n === 1) return { stanje: "Jutri", ton: "rumena" };
  return { stanje: `Čez ${n} ${dni(n)}`, ton: n <= 3 ? "rumena" : "zelena" };
}

const poDatumu = (a: OdpremaTv, b: OdpremaTv) => (a.datum ?? "9999").localeCompare(b.datum ?? "9999") || a.narocilo.localeCompare(b.narocilo);

/**
 * Počutje krovnega (po najslabši / prvi odpremi): odprema zamuja (dan mimo), danes / jutri ali nalog prepozen =
 * zaskrbljen; v 3 delovnih dneh zadovoljen; kasneje vesel; brez naročil (za zalogo) zadovoljen.
 */
function povzetekKrovnega(k: PrioritetaKrovnegaTv, odpreme: OdpremaTv[], danes: string): Pick<Utrip, "razpolozenje" | "oznaka" | "ton" | "stavek"> {
  if (!odpreme.length) return { razpolozenje: "zadovoljen", oznaka: "Za zalogo", ton: "siva", stavek: `Ni naročil - ${kosov(k.kosov)} delamo na zalogo.` };
  const zaZalogo = k.kosov > k.naroceno ? ` · ${kosov(k.kosov - k.naroceno)} za zalogo` : "";
  const osnova = `${narocil(k.narocil)}${zaZalogo}`;
  if (odpreme.some((o) => o.datum && o.datum < danes)) return { razpolozenje: "zaskrbljen", oznaka: "Odprema zamuja", ton: "rdeca", stavek: `${osnova} - najprej ta!` };
  const prva = odpreme[0];
  const n = prva.datum ? razlikaDni(danes, prva.datum) : null;
  if (n === 0) return { razpolozenje: "zaskrbljen", oznaka: "Odprema danes", ton: "oranzna", stavek: `${osnova} - prva gre ven danes!` };
  if (odpreme.some((o) => o.zamuja)) return { razpolozenje: "zaskrbljen", oznaka: "Nalog zamuja", ton: "oranzna", stavek: `${osnova} - rok naloga je po odpremi.` };
  if (n === null) return { razpolozenje: "zadovoljen", oznaka: "Odpreme", ton: "siva", stavek: osnova };
  if (n === 1) return { razpolozenje: "zaskrbljen", oznaka: "Odprema jutri", ton: "oranzna", stavek: `${osnova} - prva gre ven jutri.` };
  if (n <= 3) return { razpolozenje: "zadovoljen", oznaka: "Odprema kmalu", ton: "rumena", stavek: `${osnova} - prva ${kratekDan(prva.datum)}` };
  return { razpolozenje: "vesel", oznaka: "Prva odprema", ton: "zelena", stavek: `${osnova} - prva ${kratekDan(prva.datum)}` };
}

/** Scene oddelka: EN krovni = ENA scena (po prvi odpremi - najnujnejši najprej), strani table odprem = utripi. */
export function scenePrioritet(o: PrioriteteOddelkaTv, danes: string): Scena[] {
  const krovni = (o.krovni ?? [])
    .filter((k) => k.kosov > 0 || k.odpreme?.length)
    .map((k) => ({ k, odpreme: [...(k.odpreme ?? [])].sort(poDatumu) }));
  const prvaOdprema = (x: { odpreme: OdpremaTv[] }) => x.odpreme[0]?.datum ?? "9999";
  return krovni
    .sort((a, b) => prvaOdprema(a).localeCompare(prvaOdprema(b)) || (a.k.zacetek ?? "").localeCompare(b.k.zacetek ?? "") || a.k.krovni.localeCompare(b.k.krovni, "sl", { numeric: true }))
    .map(({ k, odpreme }) => {
      // naslednja = prva odprema, ki še ni zamujena (zamujene so nad njo in rdeče)
      const iNaslednje = odpreme.findIndex((x) => !x.datum || x.datum >= danes);
      const vrstice: VrsticaOdpreme[] = odpreme.map((x, j) => ({
        kljuc: `${x.narocilo}:${x.datum ?? "-"}:${j}`,
        dan: x.datum ? kratekDan(x.datum) : "brez datuma",
        kos: x.kos,
        druzina: x.druzina,
        kupec: x.kupec,
        ...stanjeOdpreme(x, danes),
        naslednja: j === iNaslednje,
      }));
      const strani = Math.max(1, Math.ceil(vrstice.length / ODPREM_NA_STRAN));
      const povzetek = povzetekKrovnega(k, odpreme, danes);
      const utripi: Utrip[] = Array.from({ length: strani }, (_, s) => ({
        kljuc: `${k.krovni}:${s}`,
        ...povzetek,
        glava: k.krovni,
        pod: besediloDruzin(k.druzine),
        vrednost: { st: k.naroceno, pripona: " kos", cela: true },
        trak: k.kosov > 0 ? Math.min(1, k.naroceno / k.kosov) : null,
        odpreme: vrstice.slice(s * ODPREM_NA_STRAN, (s + 1) * ODPREM_NA_STRAN),
        stran: { i: s + 1, n: strani },
      }));
      return {
        kljuc: `${o.koda}:prioritete:${k.krovni}`,
        komponenta: "fp_prioritete_krovnih",
        nadnaslov: "Prioritete krovnih",
        naslov: `Krovni ${k.krovni}`,
        podnaslov: [k.mesto || o.naziv, besediloDruzin(k.druzine)].filter(Boolean).join(" · "),
        utripi,
        utripMs: UTRIP_ODPREM_MS,
        trajanjeMs: trajanje(utripi.length, UTRIP_ODPREM_MS),
      };
    });
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
  if (koda.startsWith("fp_prioritete_krovnih") && Array.isArray(podatek.krovni)) return scenePrioritet(podatek as unknown as PrioriteteOddelkaTv, danes);
  return [];
}
