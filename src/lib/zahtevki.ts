"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CircleCheck, CircleSlash, CircleX, Hourglass, PencilLine, Trash2, type LucideIcon } from "lucide-react";
import { danVTednu, dodajDni, fmtCas, type DanPodatki, type Oznaka } from "./cas";
import { idDneva, imePraznika, type CasNastavitve, type Statistika, type Urnik } from "./casNastavitve";
import { dodajDogodek, osveziDogodke, spregledaj } from "./dogodki";
import { imaLastnost } from "./knjizenje";
import { fetchAll, getSupabase } from "./supabase";

/**
 * Zahtevki zaposlenih (FIN:ME): odsotnosti (cel dan / več dni), dovolilnice (del dneva: izhod med delom ali delo izven
 * urnika) in popravki dneva (predlog dogodkov, ki jih potrdi vodja). Baza: supabase/migrations/020_fin_me.sql
 * (fos_zahtevki, fos_zahtevki_postavke; pisanje prek funkcij fos_oddaj_zahtevek / fos_odloci_zahtevek / fos_preklici_zahtevek).
 *
 * Pravila (hierarhija iz FIN:OS): zaposleni odda zahtevek zase; vodja potrdi / zavrne zahtevke svojih (posrednih)
 * podrejenih - svojih ne more. Vodja, ki odda zahtevek za podrejenega, ga s tem že potrdi.
 * Potrjena odsotnost se na koledarju pokaže kot celodnevna odsotnost, potrjen popravek doda / spregleda dogodke.
 *
 * Dokler baze ni (osnutek), so zahtevki shranjeni v tem brskalniku (localStorage) - vir = "test".
 */

export type VrstaZahtevka = "odsotnost" | "dovolilnica" | "popravek";
export type StatusZahtevka = "oddano" | "potrjeno" | "zavrnjeno" | "preklicano" | "spremenjeno" | "izbrisano";
/**
 * nov = prvi zahtevek; sprememba = nadomesti zahtevek id_prejsnji (po potrditvi je star "spremenjeno");
 * izbris = prošnja za izbris potrjenega zahtevka id_prejsnji (po potrditvi je star "izbrisano").
 * Oboje gre v potrditev vodji; do potrditve star zahtevek velja naprej.
 */
export type AkcijaZahtevka = "nov" | "sprememba" | "izbris";
export type TipDovolilnice = "izhod" | "delo";

/** Postavka popravka dneva: dodaj dogodek, spreglej obstoječega ali cel dan v statistiki (dopust, bolniška ...). */
export type PostavkaPopravka =
  | { akcija: "dodaj"; datum: string; cas: number; id_tipke: number | null; komentar: string }
  | { akcija: "spreglej"; datum: string; cas: number; id_dogodka: string }
  | { akcija: "odsotnost"; datum: string; id_statistike: number };

export type Zahtevek = {
  id: number;
  vrsta: VrstaZahtevka;
  id_zaposlenega: number;
  datum_od: string;
  datum_do: string;
  /** Dovolilnica: minute od polnoči. */
  cas_od: number | null;
  cas_do: number | null;
  id_statistike: number | null;
  tip_dovolilnice: TipDovolilnice | null;
  opis: string;
  status: StatusZahtevka;
  akcija: AkcijaZahtevka;
  id_prejsnji: number | null;
  id_oddal: number | null;
  oddano_ob: string;
  id_odlocil: number | null;
  odloceno_ob: string | null;
  komentar_odlocitve: string;
  postavke: PostavkaPopravka[];
};

export type NovZahtevek = Pick<Zahtevek, "vrsta" | "id_zaposlenega" | "datum_od" | "datum_do" | "cas_od" | "cas_do" | "id_statistike" | "tip_dovolilnice" | "opis" | "postavke"> &
  Partial<Pick<Zahtevek, "akcija" | "id_prejsnji">>;

export const VRSTE: Record<VrstaZahtevka, { ime: string; mnozina: string }> = {
  odsotnost: { ime: "Odsotnost", mnozina: "Odsotnosti" },
  dovolilnica: { ime: "Dovolilnica", mnozina: "Dovolilnice" },
  popravek: { ime: "Popravek", mnozina: "Popravki" },
};

/** Statusi: barva, ikona, kratko ime in razlaga (hover). */
export const STATUSI: Record<StatusZahtevka, { ime: string; barva: string; ikona: LucideIcon; opis: string }> = {
  oddano: { ime: "Oddano", barva: "#f59e0b", ikona: Hourglass, opis: "Čaka, da vodja potrdi ali zavrne." },
  potrjeno: { ime: "Potrjeno", barva: "#22c55e", ikona: CircleCheck, opis: "Vodja je zahtevek potrdil." },
  zavrnjeno: { ime: "Zavrnjeno", barva: "#ef4444", ikona: CircleX, opis: "Vodja je zahtevek zavrnil." },
  preklicano: { ime: "Preklicano", barva: "#7c7c86", ikona: CircleSlash, opis: "Zaposleni je zahtevek umaknil, preden je bil potrjen." },
  spremenjeno: { ime: "Spremenjeno", barva: "#7c7c86", ikona: PencilLine, opis: "Nadomestila ga je potrjena sprememba." },
  izbrisano: { ime: "Izbrisano", barva: "#7c7c86", ikona: Trash2, opis: "Vodja je potrdil izbris." },
};

/** Zahtevek, ki čaka na spremembo / izbris (ni ga mogoče še enkrat urejati). */
export const cakaSprememba = (z: Zahtevek, vsi: Zahtevek[]) => vsi.find((x) => x.id_prejsnji === z.id && x.status === "oddano" && x.akcija !== "nov");

type Stanje = { vir: "nalagam" | "baza" | "test"; napaka: string | null; zahtevki: Zahtevek[] };
let stanje: Stanje = { vir: "nalagam", napaka: null, zahtevki: [] };
const poslusalci = new Set<() => void>();
const narocnina = (p: () => void) => {
  poslusalci.add(p);
  return () => poslusalci.delete(p);
};
const spremeni = (fn: (s: Stanje) => Stanje) => {
  stanje = fn(stanje);
  poslusalci.forEach((p) => p());
};

// ---------------------------------------------------------------------------------------------------------------
// Testni način (brskalnik)
// ---------------------------------------------------------------------------------------------------------------
const KLJUC = "fos_zahtevki_test";
const beriTest = (): Zahtevek[] => {
  try {
    // starejši testni zapisi nimajo akcije
    return ((JSON.parse(localStorage.getItem(KLJUC) ?? "[]") as Zahtevek[]) ?? []).map((z) => ({ ...z, akcija: z.akcija ?? "nov", id_prejsnji: z.id_prejsnji ?? null }));
  } catch {
    return [];
  }
};
const pisiTest = (z: Zahtevek[]) => {
  try {
    localStorage.setItem(KLJUC, JSON.stringify(z));
  } catch {}
};
const spremeniTest = (fn: (z: Zahtevek[]) => Zahtevek[]) => {
  const nova = fn(stanje.zahtevki);
  pisiTest(nova);
  spremeni((s) => ({ ...s, zahtevki: nova }));
};

// ---------------------------------------------------------------------------------------------------------------
// Baza
// ---------------------------------------------------------------------------------------------------------------
type VrsticaZ = Omit<Zahtevek, "cas_od" | "cas_do" | "postavke"> & { cas_od_min: number | null; cas_do_min: number | null };
type VrsticaP = { id_zahtevka: number; akcija: PostavkaPopravka["akcija"]; datum: string; cas_min: number | null; id_tipke: number | null; id_dogodka: number | null; id_statistike: number | null; komentar: string };

const vPostavko = (p: VrsticaP): PostavkaPopravka =>
  p.akcija === "dodaj"
    ? { akcija: "dodaj", datum: p.datum, cas: p.cas_min ?? 0, id_tipke: p.id_tipke, komentar: p.komentar }
    : p.akcija === "spreglej"
      ? { akcija: "spreglej", datum: p.datum, cas: p.cas_min ?? 0, id_dogodka: String(p.id_dogodka) }
      : { akcija: "odsotnost", datum: p.datum, id_statistike: p.id_statistike ?? 0 };

let nalaganje: Promise<void> | null = null;
async function nalozi() {
  const sb = getSupabase();
  try {
    const [vrstice, postavke] = await Promise.all([
      fetchAll<VrsticaZ>((from, to) =>
        sb
          .from("fos_zahtevki")
          .select("id, vrsta, akcija, id_prejsnji, id_zaposlenega, datum_od, datum_do, cas_od_min, cas_do_min, id_statistike, tip_dovolilnice, opis, status, id_oddal, oddano_ob, id_odlocil, odloceno_ob, komentar_odlocitve")
          .eq("visible", true)
          .order("id")
          .range(from, to),
      ),
      fetchAll<VrsticaP>((from, to) => sb.from("fos_zahtevki_postavke").select("id_zahtevka, akcija, datum, cas_min, id_tipke, id_dogodka, id_statistike, komentar").eq("visible", true).order("id").range(from, to)),
    ]);
    const po = new Map<number, PostavkaPopravka[]>();
    for (const p of postavke) po.set(p.id_zahtevka, [...(po.get(p.id_zahtevka) ?? []), vPostavko(p)]);
    spremeni(() => ({
      vir: "baza",
      napaka: null,
      zahtevki: vrstice.map(({ cas_od_min, cas_do_min, ...v }) => ({ ...v, cas_od: cas_od_min, cas_do: cas_do_min, komentar_odlocitve: v.komentar_odlocitve ?? "", postavke: po.get(v.id) ?? [] })),
    }));
  } catch (e) {
    spremeni(() => ({ vir: "test", napaka: (e as Error).message, zahtevki: beriTest() }));
  }
}

/** Vsi zahtevki, ki jih uporabnik sme videti (v bazi to omeji RLS; v brskalniku vsi). */
export function useZahtevki() {
  useEffect(() => {
    nalaganje ??= nalozi();
  }, []);
  return useSyncExternalStore(narocnina, () => stanje, () => stanje);
}

const preveri = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};
const ponovno = async () => {
  nalaganje = nalozi();
  await nalaganje;
};

/** Potrjena sprememba / izbris v brskalniku: star zahtevek dobi status spremenjeno / izbrisano. */
const zakljuciPrejsnjega = (zz: Zahtevek[], z: Pick<Zahtevek, "akcija" | "id_prejsnji">) =>
  z.akcija === "nov" || z.id_prejsnji == null ? zz : zz.map((x) => (x.id === z.id_prejsnji ? { ...x, status: z.akcija === "izbris" ? ("izbrisano" as const) : ("spremenjeno" as const) } : x));

/** Potrjen popravek v brskalniku: dogodke doda / spregleda (v bazi to naredi fos_odloci_zahtevek). */
async function izvediPopravek(z: Zahtevek) {
  for (const p of z.postavke) {
    if (p.akcija === "dodaj") await dodajDogodek({ idZaposlenega: z.id_zaposlenega, datum: p.datum, cas: p.cas, idTipke: p.id_tipke, komentar: p.komentar || `Popravek #${z.id}` });
    if (p.akcija === "spreglej") await spregledaj(z.id_zaposlenega, p.id_dogodka, true);
  }
}

/**
 * Odda zahtevek. idOddal = kdo ga oddaja (FIN:ME: jaz). Vodja, ki oddaja za podrejenega (`potrdi`), ga hkrati potrdi.
 */
export async function oddajZahtevek(v: NovZahtevek, idOddal: number, potrdi: boolean) {
  const zdaj = new Date().toISOString();
  if (stanje.vir !== "baza") {
    const id = Math.max(0, ...stanje.zahtevki.map((z) => z.id)) + 1;
    const z: Zahtevek = { ...v, akcija: v.akcija ?? "nov", id_prejsnji: v.id_prejsnji ?? null, id, status: potrdi ? "potrjeno" : "oddano", id_oddal: idOddal, oddano_ob: zdaj, id_odlocil: potrdi ? idOddal : null, odloceno_ob: potrdi ? zdaj : null, komentar_odlocitve: "" };
    spremeniTest((zz) => {
      // sprememba še nepotrjenega zahtevka: star se umakne takoj
      const prej = zz.find((x) => x.id === z.id_prejsnji);
      const brez = prej?.status === "oddano" ? zz.map((x) => (x.id === prej.id ? { ...x, status: "preklicano" as const } : x)) : zz;
      return potrdi ? zakljuciPrejsnjega([...brez, z], z) : [...brez, z];
    });
    if (potrdi && z.vrsta === "popravek") await izvediPopravek(z);
    return id;
  }
  const { data, error } = await getSupabase().rpc("fos_oddaj_zahtevek", {
    p_vrsta: v.vrsta,
    p_akcija: v.akcija ?? "nov",
    p_id_prejsnji: v.id_prejsnji ?? null,
    p_id_zaposlenega: v.id_zaposlenega,
    p_datum_od: v.datum_od,
    p_datum_do: v.datum_do,
    p_cas_od_min: v.cas_od,
    p_cas_do_min: v.cas_do,
    p_id_statistike: v.id_statistike,
    p_tip_dovolilnice: v.tip_dovolilnice,
    p_opis: v.opis,
    p_postavke: v.postavke.map((p) => ({
      akcija: p.akcija,
      datum: p.datum,
      cas_min: p.akcija === "odsotnost" ? null : p.cas,
      id_tipke: p.akcija === "dodaj" ? p.id_tipke : null,
      id_dogodka: p.akcija === "spreglej" ? Number(p.id_dogodka) : null,
      id_statistike: p.akcija === "odsotnost" ? p.id_statistike : null,
      komentar: p.akcija === "dodaj" ? p.komentar : "",
    })),
  });
  if (error) throw new Error(error.message);
  await ponovno();
  if (potrdi && v.vrsta === "popravek") await osveziDogodke(v.id_zaposlenega);
  return data as number;
}

/** Vodja potrdi ali zavrne zahtevek podrejenega (komentar = razlog, obvezen pri zavrnitvi). */
export async function odlociZahtevek(z: Zahtevek, status: "potrjeno" | "zavrnjeno", komentar: string, idOdlocil: number) {
  if (stanje.vir !== "baza") {
    const zdaj = new Date().toISOString();
    spremeniTest((zz) => {
      const nova = zz.map((x) => (x.id === z.id ? { ...x, status, id_odlocil: idOdlocil, odloceno_ob: zdaj, komentar_odlocitve: komentar.trim() } : x));
      return status === "potrjeno" ? zakljuciPrejsnjega(nova, z) : nova;
    });
    if (status === "potrjeno" && z.vrsta === "popravek") await izvediPopravek(z);
    return;
  }
  preveri(await getSupabase().rpc("fos_odloci_zahtevek", { p_id: z.id, p_status: status, p_komentar: komentar.trim() }));
  await ponovno();
  if (status === "potrjeno" && z.vrsta === "popravek") await osveziDogodke(z.id_zaposlenega);
}

/** Zaposleni umakne svoj oddan (še ne potrjen) zahtevek. */
export async function prekliciZahtevek(z: Zahtevek) {
  if (stanje.vir !== "baza") return spremeniTest((zz) => zz.map((x) => (x.id === z.id && x.status === "oddano" ? { ...x, status: "preklicano" } : x)));
  preveri(await getSupabase().rpc("fos_preklici_zahtevek", { p_id: z.id }));
  await ponovno();
}

// ---------------------------------------------------------------------------------------------------------------
// Razlogi (iz statistik - kvadratki v Statistikah; brez njih privzete kode)
// ---------------------------------------------------------------------------------------------------------------
const poLastnosti = (n: CasNastavitve, koda: string, privzete: string[]) => {
  const vidne = n.statistike.filter((s) => s.visible);
  const z = vidne.filter((s) => imaLastnost(s, koda, n));
  return z.length ? z : privzete.map((k) => vidne.find((s) => s.koda === k)).filter((s): s is Statistika => !!s);
};
/** Razlogi celodnevne odsotnosti (statistike s kvadratkom "Celodnevna odsotnost"). */
export const razlogiOdsotnosti = (n: CasNastavitve) => poLastnosti(n, "celodnevna_odsotnost", ["DOP", "LDOP", "BOL", "IZD", "OCE", "POR", "KUR", "SLP", "IZS"]);
/** Razlogi izhoda z dovolilnico (statistike s kvadratkom "Razlog dovolilnice"). */
export const razlogiDovolilnice = (n: CasNastavitve) => poLastnosti(n, "dovolilnica", ["SLO", "ZAS"]);
export const jeLetniDopust = (s: Statistika | undefined, n: CasNastavitve) => !!s && (imaLastnost(s, "letni_dopust", n) || (!n.lastnosti.some((l) => l.koda === "letni_dopust") && s.koda === "DOP"));
export const jeLanskiDopust = (s: Statistika | undefined, n: CasNastavitve) => imaLastnost(s, "lanski_dopust", n);

// ---------------------------------------------------------------------------------------------------------------
// Dnevi
// ---------------------------------------------------------------------------------------------------------------
/** Obveznost dneva po urniku (min); brez urnika 8 h ob delavnikih. 0 = prost dan. */
export function obveznostDne(datum: string, n: CasNastavitve, urnik: Urnik | null) {
  const praznik = !!imePraznika(datum, n);
  if (!urnik) return danVTednu(datum) >= 6 || praznik ? 0 : 480;
  const id = idDneva(danVTednu(datum), praznik, n);
  return id != null ? (urnik.obveznost[id] ?? 0) : 0;
}

/** Delovni dnevi v obdobju (vikendi, prazniki in prosti dnevi urnika se ne štejejo). */
export function delovniDnevi(od: string, doo: string, n: CasNastavitve, urnik: Urnik | null) {
  const out: string[] = [];
  for (let d = od, k = 0; d <= doo && k < 400; d = dodajDni(d, 1), k++) if (obveznostDne(d, n, urnik) > 0) out.push(d);
  return out;
}

/** Začetek celodnevne odsotnosti na časovni liniji (prikaz): 06:30 (uradni delovni čas 6:30-14:30), trajanje = obveznost dneva. */
const ZACETEK_ODSOTNOSTI = 6 * 60 + 30;

/**
 * Podatki dneva z zahtevki: potrjena odsotnost (ali popravek "cel dan v statistiki") na delovni dan brez štempljanj =
 * celodnevna odsotnost; oddan zahtevek in potrjena dovolilnica = oznaka na dnevu.
 */
export function zZahtevki(idZaposlenega: number, datum: string, podatki: DanPodatki, zahtevki: Zahtevek[], n: CasNastavitve, urnik: Urnik | null): DanPodatki {
  const dneva = zahtevki.filter((z) => z.id_zaposlenega === idZaposlenega && z.datum_od <= datum && z.datum_do >= datum && (z.status === "oddano" || z.status === "potrjeno"));
  if (!dneva.length) return podatki;
  const oznake: Oznaka[] = [];
  let odsotnost = podatki.odsotnost;
  const obveznost = obveznostDne(datum, n, urnik);
  const brezZigov = !podatki.zigi.some((z) => !z.spregledan);
  for (const z of dneva) {
    const s = (id: number | null) => n.statistike.find((x) => x.id === id);
    if (z.akcija === "izbris") {
      if (z.status === "oddano") oznake.push({ tip: "zahtevek", besedilo: `Izbris (${VRSTE[z.vrsta].ime.toLowerCase()}) čaka na potrditev.` });
      continue;
    }
    if (z.status === "oddano") {
      oznake.push({ tip: "zahtevek", besedilo: `${z.akcija === "sprememba" ? "Sprememba - " : ""}${VRSTE[z.vrsta].ime} čaka na potrditev${z.id_statistike ? `: ${s(z.id_statistike)?.ime ?? ""}` : ""}${z.cas_od != null ? ` (${fmtCas(z.cas_od)} - ${fmtCas(z.cas_do ?? 0)})` : ""}.` });
      continue;
    }
    if (z.vrsta === "dovolilnica")
      oznake.push({ tip: "dovolilnica", besedilo: `Dovolilnica ${z.tip_dovolilnice === "delo" ? "za delo izven urnika" : `za izhod${z.id_statistike ? ` (${s(z.id_statistike)?.ime ?? ""})` : ""}`}: ${fmtCas(z.cas_od ?? 0)} - ${fmtCas(z.cas_do ?? 0)}.` });
    const idStat = z.vrsta === "odsotnost" ? z.id_statistike : z.vrsta === "popravek" ? (z.postavke.find((p) => p.akcija === "odsotnost" && p.datum === datum) as Extract<PostavkaPopravka, { akcija: "odsotnost" }> | undefined)?.id_statistike : null;
    if (idStat && !odsotnost && brezZigov && obveznost > 0) odsotnost = { id_statistike: idStat, od: ZACETEK_ODSOTNOSTI, do: ZACETEK_ODSOTNOSTI + obveznost };
  }
  return { ...podatki, odsotnost, oznake: [...podatki.oznake, ...oznake] };
}

// ---------------------------------------------------------------------------------------------------------------
// Prikaz
// ---------------------------------------------------------------------------------------------------------------
const kratko = (d: string) => `${Number(d.slice(8))}. ${Number(d.slice(5, 7))}.`;
/** "5. 11. 2026" ali "5. 11. - 7. 11. 2026". */
export const fmtObdobje = (od: string, doo: string) => (od === doo ? `${kratko(od)} ${od.slice(0, 4)}` : `${kratko(od)}${od.slice(0, 4) !== doo.slice(0, 4) ? ` ${od.slice(0, 4)}` : ""} - ${kratko(doo)} ${doo.slice(0, 4)}`);
/** "4. 11. ob 16:20" iz ISO časa. */
export const fmtTrenutek = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ob ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
/** Opis postavke popravka (npr. "Dodaj žig 07:02 · Malica"). */
export function opisPostavke(p: PostavkaPopravka, n: CasNastavitve) {
  if (p.akcija === "odsotnost") return `Cel dan: ${n.statistike.find((s) => s.id === p.id_statistike)?.ime ?? "statistika"}`;
  if (p.akcija === "spreglej") return `Ne upoštevaj žiga ${fmtCas(p.cas)}`;
  const t = n.tipke.find((x) => x.id === p.id_tipke);
  return `Dodaj žig ${fmtCas(p.cas)}${t ? ` · ${t.besedilo}` : ""}${p.komentar ? ` („${p.komentar}“)` : ""}`;
}
