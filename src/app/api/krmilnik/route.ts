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

async function naprava(req: Request) {
  const admin = adminKlient();
  if (!admin) return napakaApi(BREZ_KLJUCA, 500);
  const kljuc = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!kljuc || !kljuc.startsWith("fk_")) return napakaApi("Manjka ključ naprave.", 401);
  const hash = createHash("sha256").update(kljuc).digest("hex");
  const { data, error } = await admin.from("fos_krmilniki").select("id, ime, lokacija, visible").eq("kljuc_hash", hash).maybeSingle();
  if (error) return napakaApi(error.message, 500);
  if (!data || !data.visible) return napakaApi("Ključ naprave ni veljaven ali je naprava onemogočena.", 401);
  const verzija = req.headers.get("x-verzija")?.slice(0, 40) ?? null;
  await admin.from("fos_krmilniki").update({ zadnji_stik: new Date().toISOString(), ...(verzija ? { verzija } : {}) }).eq("id", data.id);
  return { admin, naprava: data as { id: number; ime: string; lokacija: string } };
}

export async function GET(req: Request) {
  const n = await naprava(req);
  if (n instanceof NextResponse) return n;
  const { data, error } = await n.admin.from("fos_tipke").select("tipka, besedilo, funkcija, prikaz").eq("visible", true).order("tipka");
  if (error) return napakaApi(error.message, 500);
  const tipke = (data ?? []).filter((t) => (t.prikaz as string[] | null)?.includes("krmilnik")).map((t) => ({ tipka: t.tipka, besedilo: t.besedilo, funkcija: t.funkcija }));
  return NextResponse.json({ naprava: { ime: n.naprava.ime, lokacija: n.naprava.lokacija }, cas: new Date().toISOString(), tipke });
}

type Zig = { lokalni_id: string; st_kartice: string; cas: string; tipka: number | null };

export async function POST(req: Request) {
  const n = await naprava(req);
  if (n instanceof NextResponse) return n;
  const telo = (await req.json().catch(() => null)) as { zigi?: Zig[] } | null;
  const zigi = Array.isArray(telo?.zigi) ? telo.zigi.slice(0, 200) : [];
  if (!zigi.length) return napakaApi("Ni žigov.");

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
  return NextResponse.json({ rezultati });
}
