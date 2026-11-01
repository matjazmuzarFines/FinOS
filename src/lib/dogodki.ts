"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isoDatum, izIso, type DanPodatki, type Oznaka, type Zig } from "./cas";
import { fetchAll, getSupabase } from "./supabase";

/**
 * Dogodki (štempljanja) iz baze (015_dogodki.sql, fos_dogodki). Dogodkov se NE briše in NE ureja: dodati se da ročni
 * dogodek (datum, čas, tipka, komentar; vir = ročni popravek) ali obstoječega spregledati (izračun ga ne upošteva,
 * prikaz prečrtan; fos_spreglej_dogodek zapiše kdo in kdaj).
 * Bere se po osebi in obdobju (naloziDogodke). Brez tabele (migracija ni zagnana): testna štempljanja (casTest.ts),
 * ročni dogodki in spregledi samo v brskalniku.
 */

type Rocni = { id_zaposlenega: number; datum: string; zig: Zig };
type Vrstica = { id: number; cas: string; datum: string; id_tipke: number | null; vir: Zig["vir"]; komentar: string; spregledan: boolean };
type Stanje = {
  vir: "nalagam" | "baza" | "test";
  napaka: string | null;
  /** Dogodki iz baze po "id_zaposlenega|datum". */
  dni: ReadonlyMap<string, Zig[]>;
  /** Naloženo obdobje po osebi (od-do). */
  nalozeno: ReadonlyMap<number, { od: string; do: string }>;
  /** Brez baze: ročni dogodki in spregledi samo v brskalniku. */
  rocni: Rocni[];
  spregledani: ReadonlySet<string>;
};

let stanje: Stanje = { vir: "nalagam", napaka: null, dni: new Map(), nalozeno: new Map(), rocni: [], spregledani: new Set() };
const poslusalci = new Set<() => void>();
const narocnina = (p: () => void) => {
  poslusalci.add(p);
  return () => poslusalci.delete(p);
};
const spremeni = (fn: (s: Stanje) => Stanje) => {
  stanje = fn(stanje);
  poslusalci.forEach((p) => p());
};
const kljuc = (id: number, datum: string) => `${id}|${datum}`;

/** Minute od polnoči dneva `datum` (čas naslednjega dne > 1440 - delo čez polnoč v dan prihoda). */
function minute(cas: string, datum: string) {
  const d = new Date(cas);
  const dni = Math.round((izIso(isoDatum(d)).getTime() - izIso(datum).getTime()) / 86_400_000);
  return dni * 1440 + d.getHours() * 60 + d.getMinutes();
}

const vZig = (v: Vrstica): Zig => ({ id: String(v.id), cas: minute(v.cas, v.datum), id_tipke: v.id_tipke, vir: v.vir, spregledan: v.spregledan, komentar: v.komentar || undefined });


/** Prebere dogodke osebe v obdobju (zamenja naložene dneve osebe v tem obdobju). */
async function naloziDogodke(id: number, od: string, doo: string) {
  try {
    const vrstice = await fetchAll<Vrstica>((from, to) =>
      getSupabase().from("fos_dogodki").select("id, cas, datum, id_tipke, vir, komentar, spregledan").eq("id_zaposlenega", id).eq("visible", true).gte("datum", od).lte("datum", doo).order("cas").range(from, to),
    );
    spremeni((s) => {
      const dni = new Map([...s.dni].filter(([k]) => !(k.startsWith(`${id}|`) && k.slice(k.indexOf("|") + 1) >= od && k.slice(k.indexOf("|") + 1) <= doo)));
      for (const v of vrstice) dni.set(kljuc(id, v.datum), [...(dni.get(kljuc(id, v.datum)) ?? []), vZig(v)]);
      const prej = s.nalozeno.get(id);
      const nalozeno = new Map(s.nalozeno).set(id, prej ? { od: od < prej.od ? od : prej.od, do: doo > prej.do ? doo : prej.do } : { od, do: doo });
      return { ...s, vir: "baza", napaka: null, dni, nalozeno };
    });
  } catch (e) {
    spremeni((s) => ({ ...s, vir: s.vir === "baza" ? "baza" : "test", napaka: (e as Error).message }));
  }
}

/**
 * Dogodki osebe za obdobje od-do (YYYY-MM-DD): ob prvem klicu in razširitvi obdobja se preberejo iz baze.
 * Vrne stanje (vir: nalagam / baza / test).
 */
export function useDogodki(idZaposlenega: number | null, od: string, doo: string): Stanje {
  const s = useSyncExternalStore(narocnina, () => stanje, () => stanje);
  const n = idZaposlenega != null ? s.nalozeno.get(idZaposlenega) : undefined;
  const pokrito = !!n && n.od <= od && n.do >= doo;
  useEffect(() => {
    if (idZaposlenega == null || pokrito || stanje.vir === "test") return;
    naloziDogodke(idZaposlenega, od, doo);
  }, [idZaposlenega, od, doo, pokrito]);
  return s;
}

/** Ponovno branje naloženega obdobja osebe (po ročnem dogodku / spregledu). */
const osvezi = (id: number) => {
  const n = stanje.nalozeno.get(id);
  return n ? naloziDogodke(id, n.od, n.do) : Promise.resolve();
};

let zaporedje = 0;
export type NovDogodek = { idZaposlenega: number; datum: string; cas: number; idTipke: number | null; komentar: string };

/** Doda ročni dogodek (vir: ročni popravek). Čas v minutah od polnoči izbranega dne. */
export async function dodajDogodek(v: NovDogodek) {
  if (stanje.vir !== "baza") {
    const z: Rocni = { id_zaposlenega: v.idZaposlenega, datum: v.datum, zig: { id: `rocno|${Date.now()}|${++zaporedje}`, cas: v.cas, id_tipke: v.idTipke, vir: "rocno", komentar: v.komentar.trim() || undefined } };
    return spremeni((s) => ({ ...s, rocni: [...s.rocni, z] }));
  }
  const cas = izIso(v.datum);
  cas.setMinutes(v.cas);
  const { error } = await getSupabase()
    .from("fos_dogodki")
    .insert({ id_zaposlenega: v.idZaposlenega, cas: cas.toISOString(), datum: v.datum, id_tipke: v.idTipke, vir: "rocno", komentar: v.komentar.trim() });
  if (error) throw new Error(error.message);
  await osvezi(v.idZaposlenega);
}

/** Spregleda dogodek (ali prekliče spregled). Dogodek ostane, izračun ga ne upošteva. */
export async function spregledaj(idZaposlenega: number, id: string, da: boolean) {
  if (stanje.vir !== "baza") {
    const s = new Set(stanje.spregledani);
    if (da) s.add(id);
    else s.delete(id);
    return spremeni((st) => ({ ...st, spregledani: s }));
  }
  const { error } = await getSupabase().rpc("fos_spreglej_dogodek", { p_id: Number(id), p_spregledan: da });
  if (error) throw new Error(error.message);
  await osvezi(idZaposlenega);
}

/** Oznaka dneva z ročnim popravkom ali spregledom (ikona v vrstici koledarja). */
function oznakePopravkov(zigi: Zig[]): Oznaka[] {
  const rocni = zigi.filter((z) => z.vir === "rocno").length;
  const spregledani = zigi.filter((z) => z.spregledan).length;
  if (!rocni && !spregledani) return [];
  return [{ tip: "popravek", besedilo: `Ročni popravek: ${[rocni && `dodanih ${rocni}`, spregledani && `spregledanih ${spregledani}`].filter(Boolean).join(", ")}.` }];
}

/**
 * Podatki dneva: iz baze (dogodki osebe na dan) ali - brez baze - testna štempljanja z ročnimi dogodki in spregledi
 * iz brskalnika. Vse v časovnem zaporedju; spregledani ostanejo (prikaz), izračun jih izpusti.
 */
export function podatkiDne(idZaposlenega: number, datum: string, testni: () => DanPodatki, s: Stanje): DanPodatki {
  if (s.vir === "nalagam") return { zigi: [], odsotnost: null, oznake: [] };
  if (s.vir === "baza") {
    const zigi = s.dni.get(kljuc(idZaposlenega, datum)) ?? [];
    return { zigi, odsotnost: null, oznake: oznakePopravkov(zigi) };
  }
  const podatki = testni();
  const rocni = s.rocni.filter((z) => z.id_zaposlenega === idZaposlenega && z.datum === datum);
  if (!rocni.length && !s.spregledani.size) return podatki;
  const zigi = [...podatki.zigi, ...rocni.map((r) => r.zig)].sort((a, b) => a.cas - b.cas).map((z) => (s.spregledani.has(z.id) ? { ...z, spregledan: true } : z));
  return { ...podatki, zigi, oznake: [...podatki.oznake, ...oznakePopravkov(rocni.map((r) => r.zig))] };
}
