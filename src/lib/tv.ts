"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchAll, getSupabase, supabaseConfigured } from "@/lib/supabase";
import { objavaIzVrstice, type ObjavaVira } from "@/lib/tvObjava";

/**
 * FIN:TV - zasloni (TV-ji), seznami predvajanja in okna (migracija 022_fin_tv.sql), komponente iz projektov
 * (migracija 023_fin_tv_komponente.sql - dokler ni zagnana, testni katalog TEST_VIRI brez objav).
 * Dokler 022 ni v bazi (ali Supabase ni nastavljen), vse dela v tem brskalniku: podatki v localStorage
 * (`fos_tv_test`), datoteke v IndexedDB - značka "Testni podatki" (vir = "test").
 * Branje: useTv() (skupen predpomnilnik), pisanje: async funkcije spodaj, po zapisu ponovno branje.
 */

export type VrstaOkna = "slika" | "video" | "pdf" | "obvestilo" | "vir";
export type Prehod = "brez" | "pojemanje" | "drsenje" | "povecava" | "zavesa";
export type Prilagoditev = "zapolni" | "celo";
export type BarvaObvestila = "fines" | "ok" | "nok" | "sync" | "warn";
/** Priloga obvestila (desno zgoraj): slika / video v okno.datoteka, PDF v okno.strani. */
export type PrilogaObvestila = "slika" | "video" | "pdf";
export type Obvestilo = { naslov: string; besedilo: string; barva: BarvaObvestila; ikona: string; priloga?: PrilogaObvestila | null };
export type VsebinaOkna = {
  prilagoditev?: Prilagoditev;
  obvestilo?: Obvestilo;
  /** PDF: višina / širina vsake strani (pokončna stran pri "Zapolni" se razreže na ležeče dele). */
  razmerja?: number[];
  /** Naslovna stran pred oknom (privzeto da, razen pri obvestilu). */
  uvod?: boolean;
};

export type TvOkno = {
  id: number;
  id_seznama: number;
  vrsta: VrstaOkna;
  naslov: string;
  vrstni_red: number;
  trajanje_s: number;
  prehod: Prehod;
  velja_od: string | null;
  velja_do: string | null;
  aktivno: boolean;
  datoteka: string | null;
  strani: string[];
  vsebina: VsebinaOkna;
  /** vrsta "vir": komponenta iz projekta (zadnja objava) */
  id_vira?: number | null;
  visible: boolean;
  updated_at?: string;
};

/** Predefinirana komponenta (fos_tv_viri) z zadnjo objavo. Doda se s programiranjem v projektu. */
export type TvVir = {
  id: number;
  koda: string;
  ime: string;
  opis: string;
  aplikacija: string;
  ikona: string;
  vklopljen: boolean;
  objava: ObjavaVira | null;
};

export { datumIso, obdobjaObjave, objavaIzVrstice, veljavneStrani, type ObjavaVira } from "@/lib/tvObjava";

export type TvZaslon = {
  id: number;
  ime: string;
  lokacija: string;
  id_seznama: number;
  zadnji_stik: string | null;
  trenutno: string | null;
  verzija: string | null;
  ukaz: "osvezi" | "ime" | null;
  ukaz_st: number;
  visible: boolean;
};

export const VRSTE: Record<VrstaOkna, string> = { slika: "Slika", video: "Video", pdf: "PDF", obvestilo: "Obvestilo", vir: "Komponenta" };
export const PREHODI: Record<Prehod, { ime: string; opis: string }> = {
  brez: { ime: "Brez", opis: "Okno se zamenja takoj." },
  pojemanje: { ime: "Pojemanje", opis: "Staro okno pojema, novo se prikaže." },
  drsenje: { ime: "Drsenje", opis: "Novo okno pripelje z desne." },
  povecava: { ime: "Povečava", opis: "Novo okno se približa iz ozadja." },
  zavesa: { ime: "Zavesa", opis: "Novo okno se odgrne od leve proti desni." },
};
export const BARVE_OBVESTIL: Record<BarvaObvestila, { ime: string; barva: string }> = {
  fines: { ime: "Oranžna", barva: "#ee7a3a" },
  ok: { ime: "Zelena", barva: "#16a34a" },
  sync: { ime: "Modra", barva: "#2563eb" },
  warn: { ime: "Rumena", barva: "#f59e0b" },
  nok: { ime: "Rdeča", barva: "#dc2626" },
};
/** Privzeto trajanje novega okna (s). */
export const PRIVZETO_TRAJANJE: Record<VrstaOkna, number> = { slika: 10, video: 10, pdf: 10, obvestilo: 12, vir: 15 };
/** Naslovna stran pred oknom: privzeto da, pri obvestilu ne (ima svoj naslov). */
export const imaUvod = (o: Pick<TvOkno, "vrsta" | "vsebina">) => o.vsebina.uvod ?? o.vrsta !== "obvestilo";
/** TV je "na zvezi", če se je javil v zadnjih 2 min (javi se vsakih 20 s). */
export const NA_ZVEZI_MS = 2 * 60_000;

export const naZvezi = (z: Pick<TvZaslon, "zadnji_stik">, zdaj = Date.now()) => !!z.zadnji_stik && zdaj - new Date(z.zadnji_stik).getTime() < NA_ZVEZI_MS;

// ---------------------------------------------------------------------
// Skupen predpomnilnik
// ---------------------------------------------------------------------
type Stanje = { vir: "nalagam" | "baza" | "test"; napaka: string | null; zasloni: TvZaslon[]; okna: TvOkno[]; viri: TvVir[]; testniViri: boolean };
let stanje: Stanje = { vir: "nalagam", napaka: null, zasloni: [], okna: [], viri: [], testniViri: false };

/** Katalog brez baze 023: komponente, ki jih bo objavljal Production (še brez objav). */
export const TEST_VIRI: TvVir[] = [
  { id: -1, koda: "fp_plan_workflow", ime: "Delovni plan - workflow", opis: "Kaj je treba narediti: koraki po celicah. Objavi se ob Shrani plan.", aplikacija: "fp", ikona: "Workflow", vklopljen: true, objava: null },
  { id: -2, koda: "fp_plan_pregled", ime: "Delovni plan - pregled", opis: "Do kdaj: časovnica po celicah, od začetka do roka. Objavi se ob Shrani plan.", aplikacija: "fp", ikona: "CalendarRange", vklopljen: true, objava: null },
];
const poslusalci = new Set<() => void>();
const nastavi = (s: Partial<Stanje>) => {
  stanje = { ...stanje, ...s };
  poslusalci.forEach((p) => p());
};
let nalaganje: Promise<void> | null = null;

/** Tabela še ne obstaja (022 ni zagnan) -> testni podatki. */
const niTabele = (m: string) => /schema cache|does not exist|relation .* does not exist|Could not find/i.test(m);

// ---------------------------------------------------------------------
// Testni podatki (localStorage + IndexedDB)
// ---------------------------------------------------------------------
const TEST_KLJUC = "fos_tv_test";
type TestPodatki = { zasloni: TvZaslon[]; okna: TvOkno[]; naslednji: number };

function beriTest(): TestPodatki {
  try {
    const s = localStorage.getItem(TEST_KLJUC);
    if (s) return JSON.parse(s) as TestPodatki;
  } catch {}
  // prvi zagon: dva zaslona (kot v proizvodnji) z enim obvestilom
  const zdaj = new Date().toISOString();
  return {
    naslednji: 10,
    zasloni: [
      { id: 1, ime: "Montaža", lokacija: "Hala 1, ob liniji", id_seznama: 1, zadnji_stik: null, trenutno: null, verzija: null, ukaz: null, ukaz_st: 0, visible: true },
      { id: 2, ime: "Varjenje", lokacija: "Hala 2", id_seznama: 2, zadnji_stik: null, trenutno: null, verzija: null, ukaz: null, ukaz_st: 0, visible: true },
    ],
    okna: [
      {
        id: 3,
        id_seznama: 1,
        vrsta: "obvestilo",
        naslov: "Dobrodošli",
        vrstni_red: 1,
        trajanje_s: 12,
        prehod: "pojemanje",
        velja_od: null,
        velja_do: null,
        aktivno: true,
        datoteka: null,
        strani: [],
        vsebina: { obvestilo: { naslov: "People Bake for People", besedilo: "Dobrodošli na FIN:TV.\nTu bodo plan montaže, obvestila in novice.", barva: "fines", ikona: "PartyPopper" } },
        visible: true,
        updated_at: zdaj,
      },
    ],
  };
}
function pisiTest(p: TestPodatki) {
  try {
    localStorage.setItem(TEST_KLJUC, JSON.stringify(p));
  } catch {}
  nastavi({ vir: "test", zasloni: p.zasloni, okna: p.okna.filter((o) => o.visible), viri: stanje.testniViri || !stanje.viri.length ? TEST_VIRI : stanje.viri, testniViri: true });
}
function urediTest(fn: (p: TestPodatki) => void) {
  const p = beriTest();
  fn(p);
  pisiTest(p);
  return p;
}

const IDB = "fos_tv_test";
function idb(): Promise<IDBDatabase> {
  return new Promise((ok, ne) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("datoteke");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ne(r.error);
  });
}
async function idbPisi(pot: string, blob: Blob) {
  const db = await idb();
  await new Promise<void>((ok, ne) => {
    const t = db.transaction("datoteke", "readwrite");
    t.objectStore("datoteke").put(blob, pot);
    t.oncomplete = () => ok();
    t.onerror = () => ne(t.error);
  });
}
async function idbBeri(pot: string): Promise<Blob | null> {
  const db = await idb();
  return new Promise((ok, ne) => {
    const r = db.transaction("datoteke").objectStore("datoteke").get(pot);
    r.onsuccess = () => ok((r.result as Blob | undefined) ?? null);
    r.onerror = () => ne(r.error);
  });
}

// ---------------------------------------------------------------------
// Branje
// ---------------------------------------------------------------------
const STOLPCI_ZASLONA = "id, ime, lokacija, id_seznama, zadnji_stik, trenutno, verzija, ukaz, ukaz_st, visible";

async function preberi() {
  if (!supabaseConfigured) return pisiTest(beriTest());
  try {
    const sb = getSupabase();
    const [zasloni, okna] = await Promise.all([
      fetchAll<TvZaslon>((f, t) => sb.from("fos_tv_zasloni").select(STOLPCI_ZASLONA).order("id").range(f, t)),
      fetchAll<TvOkno>((f, t) => sb.from("fos_tv_okna").select("*").eq("visible", true).order("vrstni_red").order("id").range(f, t)),
    ]);
    nastavi({ vir: "baza", napaka: null, zasloni, okna, ...(await preberiVire()) });
  } catch (e) {
    const m = (e as Error).message;
    if (niTabele(m)) {
      stanje.napaka = m;
      return pisiTest(beriTest());
    }
    nastavi({ napaka: m, vir: stanje.vir === "nalagam" ? "baza" : stanje.vir });
  }
}

/** Komponente in zadnje objave (023); brez tabel testni katalog. */
async function preberiVire(): Promise<Pick<Stanje, "viri" | "testniViri">> {
  const sb = getSupabase();
  const [v, o] = await Promise.all([
    sb.from("fos_tv_viri").select("id, koda, ime, opis, aplikacija, ikona, vklopljen").eq("visible", true).order("vrstni_red"),
    sb.from("fos_tv_zadnje_objave").select("*"), // * = deluje z in brez 025 (velja_od / velja_do)
  ]);
  if (v.error || o.error) return { viri: TEST_VIRI, testniViri: true };
  const objave = new Map((o.data ?? []).map((x) => [x.id_vira as number, x]));
  return {
    testniViri: false,
    viri: (v.data ?? []).map((x) => {
      const ob = objave.get(x.id);
      return {
        ...(x as Omit<TvVir, "objava">),
        // pot z imenom košare (fos-tv-viri:pot) - urljiDatotek jo podpiše v pravi košari
        objava: ob ? objavaIzVrstice(ob) : null,
      };
    }),
  };
}

export function osveziTv() {
  nalaganje = preberi().finally(() => (nalaganje = null));
  return nalaganje;
}

/** Zasloni in okna (skupno vsem komponentam). `osvezevanje` = ponovno branje vsakih N ms (stanje "na zvezi"). */
export function useTv(osvezevanje?: number) {
  const s = useSyncExternalStore(
    (p) => {
      poslusalci.add(p);
      return () => poslusalci.delete(p);
    },
    () => stanje,
    () => stanje,
  );
  useEffect(() => {
    if (stanje.vir === "nalagam" && !nalaganje) osveziTv();
    // testni podatki iz drugega zavihka (urejevalnik <-> predvajalnik)
    const ob = (e: StorageEvent) => e.key === TEST_KLJUC && stanje.vir === "test" && pisiTest(beriTest());
    window.addEventListener("storage", ob);
    const t = osvezevanje ? setInterval(() => !nalaganje && osveziTv(), osvezevanje) : undefined;
    return () => {
      window.removeEventListener("storage", ob);
      if (t) clearInterval(t);
    };
  }, [osvezevanje]);
  return s;
}

/** Okna seznama po vrstnem redu. */
export const oknaSeznama = (okna: TvOkno[], idSeznama: number) => okna.filter((o) => o.id_seznama === idSeznama && o.visible).sort((a, b) => a.vrstni_red - b.vrstni_red || a.id - b.id);
/** Zasloni, ki kažejo isti seznam (povezani). */
export const zasloniSeznama = (zasloni: TvZaslon[], idSeznama: number) => zasloni.filter((z) => z.id_seznama === idSeznama && z.visible);

// ---------------------------------------------------------------------
// Pisanje
// ---------------------------------------------------------------------
const test = () => stanje.vir === "test";
async function rpc<T>(ime: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(ime, args);
  if (error) throw new Error(error.message);
  return data as T;
}
const preveri = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};

/** Nov zaslon (z lastnim seznamom); vrne ključ - pokaže se samo enkrat. */
export async function dodajZaslon(ime: string, lokacija: string): Promise<string> {
  if (test()) {
    urediTest((p) => {
      const id = p.naslednji++;
      p.zasloni.push({ id, ime, lokacija, id_seznama: p.naslednji++, zadnji_stik: null, trenutno: null, verzija: null, ukaz: null, ukaz_st: 0, visible: true });
    });
    return "tv_testni_kljuc_samo_v_tem_brskalniku";
  }
  const k = await rpc<string>("fos_tv_nov_zaslon", { p_ime: ime, p_lokacija: lokacija });
  await osveziTv();
  return k;
}

export async function novKljucZaslona(id: number): Promise<string> {
  if (test()) return "tv_testni_kljuc_samo_v_tem_brskalniku";
  return rpc<string>("fos_tv_nov_kljuc", { p_id: id });
}

export async function urediZaslon(id: number, p: Partial<Pick<TvZaslon, "ime" | "lokacija" | "visible">>) {
  if (test()) return void urediTest((d) => (d.zasloni = d.zasloni.map((z) => (z.id === id ? { ...z, ...p } : z))));
  preveri(await getSupabase().from("fos_tv_zasloni").update(p).eq("id", id));
  await osveziTv();
}

/** Poveži: zaslon `id` (in vsi, ki so že povezani z njim) kaže seznam zaslona `z` - vsebina `id` se ne kaže več. */
export async function poveziZaslon(id: number, z: number) {
  if (test()) {
    return void urediTest((d) => {
      const cilj = d.zasloni.find((x) => x.id === z)!.id_seznama;
      const star = d.zasloni.find((x) => x.id === id)!.id_seznama;
      d.zasloni = d.zasloni.map((x) => (x.id_seznama === star ? { ...x, id_seznama: cilj } : x));
    });
  }
  await rpc("fos_tv_povezi", { p_id: id, p_z: z });
  await osveziTv();
}

/** Odveži: zaslon dobi svoj seznam s kopijo skupnih oken. */
export async function odveziZaslon(id: number) {
  if (test()) {
    return void urediTest((d) => {
      const zaslon = d.zasloni.find((x) => x.id === id)!;
      if (d.zasloni.filter((x) => x.id_seznama === zaslon.id_seznama && x.visible).length < 2) return;
      const nov = d.naslednji++;
      const kopije = d.okna.filter((o) => o.id_seznama === zaslon.id_seznama && o.visible).map((o) => ({ ...o, id: d.naslednji++, id_seznama: nov }));
      d.okna.push(...kopije);
      zaslon.id_seznama = nov;
    });
  }
  await rpc("fos_tv_odvezi", { p_id: id });
  await osveziTv();
}

/** Ukaz TV-ju: osvezi (ponovno naloži) / ime (10 s pokaže ime zaslona). */
export async function ukazZaslonu(id: number, ukaz: "osvezi" | "ime") {
  if (test()) return void urediTest((d) => (d.zasloni = d.zasloni.map((z) => (z.id === id ? { ...z, ukaz, ukaz_st: z.ukaz_st + 1 } : z))));
  await rpc("fos_tv_ukaz", { p_id: id, p_ukaz: ukaz });
  await osveziTv();
}

export type NovoOkno = Omit<TvOkno, "id" | "vrstni_red" | "visible" | "updated_at">;

/** Doda okna na konec seznama. */
export async function dodajOkna(okna: NovoOkno[]) {
  if (!okna.length) return;
  const zadnji = (id: number) => Math.max(0, ...stanje.okna.filter((o) => o.id_seznama === id).map((o) => o.vrstni_red));
  const vrstni = new Map<number, number>();
  const zVrstnim = okna.map((o) => {
    const r = (vrstni.get(o.id_seznama) ?? zadnji(o.id_seznama)) + 1;
    vrstni.set(o.id_seznama, r);
    return { ...o, vrstni_red: r };
  });
  if (test()) return void urediTest((d) => d.okna.push(...zVrstnim.map((o) => ({ ...o, id: d.naslednji++, visible: true, updated_at: new Date().toISOString() }))));
  preveri(await getSupabase().from("fos_tv_okna").insert(zVrstnim));
  await osveziTv();
}

export async function shraniOkno(id: number, p: Partial<NovoOkno>) {
  if (test()) return void urediTest((d) => (d.okna = d.okna.map((o) => (o.id === id ? { ...o, ...p, updated_at: new Date().toISOString() } : o))));
  preveri(await getSupabase().from("fos_tv_okna").update(p).eq("id", id));
  await osveziTv();
}

/** Odstrani okno (skrije - brez brisanja). */
export async function odstraniOkno(id: number) {
  if (test()) return void urediTest((d) => (d.okna = d.okna.map((o) => (o.id === id ? { ...o, visible: false } : o))));
  preveri(await getSupabase().from("fos_tv_okna").update({ visible: false }).eq("id", id));
  await osveziTv();
}

/** Nov vrstni red oken (id-ji po vrsti). Takoj v predpomnilnik (brez skoka pri povleci in spusti), nato v bazo. */
export async function preurediOkna(ids: number[]) {
  const red = new Map(ids.map((id, i) => [id, i + 1]));
  nastavi({ okna: stanje.okna.map((o) => (red.has(o.id) ? { ...o, vrstni_red: red.get(o.id)! } : o)) });
  if (test()) return void urediTest((d) => (d.okna = d.okna.map((o) => (red.has(o.id) ? { ...o, vrstni_red: red.get(o.id)! } : o))));
  const sb = getSupabase();
  const rez = await Promise.all(ids.map((id, i) => sb.from("fos_tv_okna").update({ vrstni_red: i + 1 }).eq("id", id)));
  rez.forEach(preveri);
  await osveziTv();
}

/** Kopija okna na konec drugega seznama (iste datoteke). */
export async function kopirajOkno(o: TvOkno, idSeznama: number) {
  const { vrsta, naslov, trajanje_s, prehod, velja_od, velja_do, aktivno, datoteka, strani, vsebina, id_vira } = o;
  await dodajOkna([{ id_seznama: idSeznama, vrsta, naslov, trajanje_s, prehod, velja_od, velja_do, aktivno, datoteka, strani, vsebina, ...(id_vira ? { id_vira } : {}) }]);
}

// ---------------------------------------------------------------------
// Datoteke (košara fos-tv / testno IndexedDB)
// ---------------------------------------------------------------------
const KOSARA = "fos-tv";
const koncnica = (tip: string, ime?: string) => ime?.match(/\.([a-z0-9]{2,5})$/i)?.[1].toLowerCase() ?? ({ "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "video/mp4": "mp4" } as Record<string, string>)[tip] ?? "bin";

/** Naloži datoteko, vrne pot (v košari ali testno). */
export async function naloziDatoteko(blob: Blob, ime?: string): Promise<string> {
  const pot = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${koncnica(blob.type, ime)}`;
  if (test()) {
    await idbPisi(pot, blob);
    return pot;
  }
  const { error } = await getSupabase().storage.from(KOSARA).upload(pot, blob, { contentType: blob.type || undefined, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Nalaganje ni uspelo: ${error.message}`);
  return pot;
}

const testniUrlji = new Map<string, string>();

/** Povezave za prikaz datotek: podpisane (1 dan) ali testne (blob iz IndexedDB). */
export async function urljiDatotek(poti: string[]): Promise<Record<string, string>> {
  const edinstvene = [...new Set(poti.filter(Boolean))];
  const izid: Record<string, string> = {};
  if (!edinstvene.length) return izid;
  if (test()) {
    for (const p of edinstvene) {
      if (!testniUrlji.has(p)) {
        const b = await idbBeri(p).catch(() => null);
        if (b) testniUrlji.set(p, URL.createObjectURL(b));
      }
      const u = testniUrlji.get(p);
      if (u) izid[p] = u;
    }
    return izid;
  }
  // pot "kosara:pot" = datoteka komponente v drugi košari (fos-tv-viri), sicer fos-tv
  const poKosarah = new Map<string, string[]>();
  for (const p of edinstvene) {
    const [k, pot] = p.includes(":") ? [p.slice(0, p.indexOf(":")), p.slice(p.indexOf(":") + 1)] : [KOSARA, p];
    poKosarah.set(k, [...(poKosarah.get(k) ?? []), pot]);
  }
  for (const [k, poti] of poKosarah) {
    const { data, error } = await getSupabase().storage.from(k).createSignedUrls(poti, 86_400);
    if (error) throw new Error(error.message);
    for (const d of data ?? []) if (d.path && d.signedUrl) izid[k === KOSARA ? d.path : `${k}:${d.path}`] = d.signedUrl;
  }
  return izid;
}

/** Vse poti datotek okna (slika / video / strani PDF, priloga obvestila, zadnja objava komponente). */
export const potiOkna = (o: Pick<TvOkno, "datoteka" | "strani" | "vrsta" | "id_vira">, viri: TvVir[] = []) =>
  o.vrsta === "vir" ? (viri.find((v) => v.id === o.id_vira)?.objava?.strani ?? []) : [...o.strani, ...(o.datoteka ? [o.datoteka] : [])];

/** Vklop / izklop komponente (na vseh TV-jih). */
export async function vklopVira(v: TvVir, vklop: boolean) {
  if (stanje.testniViri) return nastavi({ viri: stanje.viri.map((x) => (x.id === v.id ? { ...x, vklopljen: vklop } : x)) });
  const { error } = await getSupabase().rpc("fos_tv_vklop_vira", { p_koda: v.koda, p_vklop: vklop });
  if (error) throw new Error(error.message);
  await osveziTv();
}
