/**
 * FIN:TV - objava komponente (čiste funkcije, brez "use client": uporablja jih tudi /api/tv).
 * `velja_od` / `velja_do` = veljavnost vsake strani (datum "2026-11-16", oba vključno; prazno / null = vedno) - npr.
 * pregled plana za več tednov naprej: TV kaže samo strani tekočega tedna in v ponedeljek sam preklopi (025).
 */
export type ObjavaVira = {
  strani: string[];
  razmerja: number[];
  velja_od?: (string | null)[];
  velja_do?: (string | null)[];
  izvor: string;
  created_at: string;
};

/** Iz vrstice fos_tv_zadnje_objave (poti z imenom košare: "fos-tv-viri:pot"). Brez 025 ni veljavnosti. */
export const objavaIzVrstice = (o: { kosara: string; strani: unknown; razmerja: unknown; velja_od?: unknown; velja_do?: unknown; izvor: string; created_at: string }): ObjavaVira => ({
  strani: (o.strani as string[]).map((s) => `${o.kosara}:${s}`),
  razmerja: ((o.razmerja as number[]) ?? []).map(Number),
  velja_od: (o.velja_od as (string | null)[] | undefined) ?? [],
  velja_do: (o.velja_do as (string | null)[] | undefined) ?? [],
  izvor: o.izvor,
  created_at: o.created_at,
});

/** Lokalni datum "2026-11-16" (čas računalnika ob TV-ju). */
export const datumIso = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Indeksi strani objave, ki veljajo na dan `ms`. */
export const veljavneStrani = (o: ObjavaVira, ms: number) => {
  const dan = datumIso(ms);
  return o.strani.map((_, i) => i).filter((i) => (!o.velja_od?.[i] || o.velja_od[i]! <= dan) && (!o.velja_do?.[i] || o.velja_do[i]! >= dan));
};

/** Število različnih obdobij (tednov) v objavi - za opis "3 tedni". */
export const obdobjaObjave = (o: ObjavaVira) => new Set(o.strani.map((_, i) => `${o.velja_od?.[i] ?? ""}|${o.velja_do?.[i] ?? ""}`)).size;
