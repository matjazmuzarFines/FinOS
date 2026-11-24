import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { napakaApi } from "@/lib/klicatelj";
import { adminKlient, BREZ_KLJUCA } from "@/lib/supabaseStreznik";

/**
 * Krmilnik (Raspberry Pi, mapa krmilnik/) -> FIN:OS. Prijava s ključem naprave: "Authorization: Bearer fk_...".
 * Ključ ustvari Administracija (Nastavitve -> Krmilnik -> Naprave), baza hrani samo sha256 (021_krmilnik_naprave.sql).
 *
 * GET   nastavitve: ime naprave, čas strežnika, tipke s prikazom "krmilnik"
 * POST  { zigi: [{ lokalni_id, st_kartice, cas (ISO), tipka (številka ali null) }] }  -> { rezultati: [...] }
 *       žigi s krmilnika (tudi zaostali iz čakalne vrste po izpadu wifija); isti lokalni_id se zapiše samo enkrat.
 * Glava "X-Verzija" = verzija programa na krmilniku (vidna v Nastavitvah).
 */
export const dynamic = "force-dynamic";

/** `stik` = zapiši zadnji stik in verzijo (GET vsako minuto). Pri POST ga ne čakamo - fos_krmilnik_zig ga zapiše sam. */
async function naprava(req: Request, stik: boolean) {
  const admin = adminKlient();
  if (!admin) return napakaApi(BREZ_KLJUCA, 500);
  const kljuc = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!kljuc || !kljuc.startsWith("fk_")) return napakaApi("Manjka ključ naprave.", 401);
  const hash = createHash("sha256").update(kljuc).digest("hex");
  const { data, error } = await admin.from("fos_krmilniki").select("id, ime, lokacija, visible").eq("kljuc_hash", hash).maybeSingle();
  if (error) return napakaApi(error.message, 500);
  if (!data || !data.visible) return napakaApi("Ključ naprave ni veljaven ali je naprava onemogočena.", 401);
  const verzija = req.headers.get("x-verzija")?.slice(0, 40) ?? null;
  if (stik) await admin.from("fos_krmilniki").update({ zadnji_stik: new Date().toISOString(), ...(verzija ? { verzija } : {}) }).eq("id", data.id);
  return { admin, naprava: data as { id: number; ime: string; lokacija: string } };
}

export async function GET(req: Request) {
  const n = await naprava(req, true);
  if (n instanceof NextResponse) return n;
  const { data, error } = await n.admin.from("fos_tipke").select("tipka, besedilo, funkcija, prikaz").eq("visible", true).order("tipka");
  if (error) return napakaApi(error.message, 500);
  const tipke = (data ?? []).filter((t) => (t.prikaz as string[] | null)?.includes("krmilnik")).map((t) => ({ tipka: t.tipka, besedilo: t.besedilo, funkcija: t.funkcija }));
  return NextResponse.json({ naprava: { ime: n.naprava.ime, lokacija: n.naprava.lokacija }, cas: new Date().toISOString(), tipke });
}

type Zig = { lokalni_id: string; st_kartice: string; cas: string; tipka: number | null };
type Dnevnik = { lokalni_id: string; cas: string; vrsta: string; st_kartice?: string | null; tipka?: number | null; id_ziga?: string | null; uspeh?: boolean | null; sporocilo?: string | null; trajanje_ms?: number | null; podatki?: unknown };

const besedilo = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n));
const celo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/** Dnevnik krmilnika (033) - isti lokalni_id samo enkrat. Brez tabele vrne ok: false (krmilnik poskusi kasneje). */
async function shraniDnevnik(admin: NonNullable<ReturnType<typeof adminKlient>>, idKrmilnika: number, verzija: string | null, vnosi: Dnevnik[]) {
  const vrstice = vnosi
    .filter((d) => d?.lokalni_id && d.vrsta && !Number.isNaN(new Date(d.cas).getTime()))
    .map((d) => ({
      id_krmilnika: idKrmilnika,
      lokalni_id: String(d.lokalni_id).slice(0, 64),
      cas: new Date(d.cas).toISOString(),
      vrsta: String(d.vrsta).slice(0, 30),
      st_kartice: besedilo(d.st_kartice, 40),
      tipka: celo(d.tipka),
      id_ziga: besedilo(d.id_ziga, 64),
      uspeh: typeof d.uspeh === "boolean" ? d.uspeh : null,
      sporocilo: besedilo(d.sporocilo, 1000),
      trajanje_ms: celo(d.trajanje_ms),
      podatki: d.podatki && typeof d.podatki === "object" ? d.podatki : {},
      verzija,
    }));
  if (!vrstice.length) return { ok: true, shranjenih: 0 };
  const { error } = await admin.from("fos_krmilnik_dnevnik").upsert(vrstice, { onConflict: "id_krmilnika,lokalni_id", ignoreDuplicates: true });
  return error ? { ok: false, napaka: error.message } : { ok: true, shranjenih: vrstice.length };
}

export async function POST(req: Request) {
  const zacetek = Date.now();
  const n = await naprava(req, false);
  if (n instanceof NextResponse) return n;
  const telo = (await req.json().catch(() => null)) as { zigi?: Zig[]; dnevnik?: Dnevnik[] } | null;
  const zigi = Array.isArray(telo?.zigi) ? telo.zigi.slice(0, 200) : [];
  const vnosi = Array.isArray(telo?.dnevnik) ? telo.dnevnik.slice(0, 500) : [];
  if (!zigi.length && !vnosi.length) return napakaApi("Ni žigov.");
  const dnevnik = vnosi.length ? await shraniDnevnik(n.admin, n.naprava.id, req.headers.get("x-verzija")?.slice(0, 40) ?? null, vnosi) : undefined;

  const rezultati = [];
  for (const z of zigi) {
    const cas = new Date(z.cas);
    const kartica = String(z.st_kartice ?? "").trim();
    if (!z.lokalni_id || !kartica || Number.isNaN(cas.getTime())) {
      rezultati.push({ lokalni_id: z.lokalni_id, ok: false, trajno: true, napaka: "Nepopoln žig." });
      continue;
    }
    // žig iz prihodnosti (napačna ura na krmilniku) - velja čas strežnika
    const casZiga = cas.getTime() > Date.now() + 2 * 60_000 ? new Date() : cas;
    const { data, error } = await n.admin.rpc("fos_krmilnik_zig", {
      p_id_krmilnika: n.naprava.id,
      p_lokalni_id: String(z.lokalni_id).slice(0, 64),
      p_st_kartice: kartica.slice(0, 40),
      p_cas: casZiga.toISOString(),
      p_tipka: z.tipka == null ? null : Number(z.tipka),
    });
    rezultati.push(error ? { lokalni_id: z.lokalni_id, ok: false, napaka: error.message } : { lokalni_id: z.lokalni_id, ...(data as object), trajno: true });
  }
  // ms = čas obdelave na strežniku (dnevnik krmilnika: koliko je strežnik, koliko pot)
  return NextResponse.json({ rezultati, ...(dnevnik ? { dnevnik } : {}), ms: Date.now() - zacetek });
}
