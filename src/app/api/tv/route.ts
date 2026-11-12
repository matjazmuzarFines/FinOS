import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { napakaApi } from "@/lib/klicatelj";
import { adminKlient, BREZ_KLJUCA } from "@/lib/supabaseStreznik";

/**
 * FIN:TV predvajalnik (/tv na računalniku ob TV-ju) -> FIN:OS. Prijava s ključem zaslona: ?k=tv_... ali
 * "Authorization: Bearer tv_...". Ključ ustvari Administracija (FIN:TV -> Dodaj zaslon), baza hrani samo sha256
 * (migracija 022_fin_tv.sql, komponente 023). Ključ zna samo BRATI vsebino svojega zaslona.
 *
 * GET ?v=<verzija>&trenutno=<kaj se vrti>
 *   -> { zaslon, cas, verzija, okna, viri, datoteke } ali { zaslon, cas, verzija, nespremenjeno: true }, če se verzija ujema
 *   (podpisane povezave do datotek veljajo 1 dan; TV jih shrani v svoj predpomnilnik in ne prenaša znova).
 *   Vsak klic = stik (zadnji_stik, trenutno, verzija predvajalnika iz glave X-Verzija).
 */
export const dynamic = "force-dynamic";

const KOSARA = "fos-tv";

export async function GET(req: Request) {
  const admin = adminKlient();
  if (!admin) return napakaApi(BREZ_KLJUCA, 500);
  const url = new URL(req.url);
  const kljuc = (url.searchParams.get("k") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "").trim();
  if (!kljuc.startsWith("tv_")) return napakaApi("Manjka ključ zaslona.", 401);
  const hash = createHash("sha256").update(kljuc).digest("hex");

  const { data: z, error } = await admin.from("fos_tv_zasloni").select("id, ime, lokacija, id_seznama, ukaz, ukaz_st, visible").eq("kljuc_hash", hash).maybeSingle();
  if (error) return napakaApi(error.message, 500);
  if (!z || !z.visible) return napakaApi("Ključ zaslona ni veljaven ali je zaslon onemogočen.", 401);

  await admin
    .from("fos_tv_zasloni")
    .update({ zadnji_stik: new Date().toISOString(), trenutno: url.searchParams.get("trenutno")?.slice(0, 200) ?? null, verzija: req.headers.get("x-verzija")?.slice(0, 40) ?? null })
    .eq("id", z.id);

  const { data: okna, error: e2 } = await admin.from("fos_tv_okna").select("*").eq("id_seznama", z.id_seznama).eq("visible", true).order("vrstni_red").order("id");
  if (e2) return napakaApi(e2.message, 500);

  // komponente (023) oken vrste "vir": zadnja objava; brez tabel (023 ni zagnan) brez komponent
  const idViri = [...new Set((okna ?? []).map((o) => o.id_vira as number | null).filter((x): x is number => !!x))];
  let viri: { id: number; koda: string; ime: string; opis: string; aplikacija: string; ikona: string; vklopljen: boolean; objava: { id: number; strani: string[]; razmerja: number[]; izvor: string; created_at: string } | null }[] = [];
  if (idViri.length) {
    const [v, ob] = await Promise.all([
      admin.from("fos_tv_viri").select("id, koda, ime, opis, aplikacija, ikona, vklopljen").in("id", idViri),
      admin.from("fos_tv_zadnje_objave").select("id, id_vira, kosara, strani, razmerja, izvor, created_at").in("id_vira", idViri),
    ]);
    if (!v.error && !ob.error) {
      viri = (v.data ?? []).map((x) => {
        const o = (ob.data ?? []).find((y) => y.id_vira === x.id);
        return { ...x, objava: o ? { id: o.id, strani: (o.strani as string[]).map((s) => `${o.kosara}:${s}`), razmerja: (o.razmerja as number[]).map(Number), izvor: o.izvor, created_at: o.created_at } : null };
      });
    }
  }

  // verzija vsebine: seznam + vsa okna (id, zadnja sprememba) + objave komponent - TV ob isti verziji ne prenaša ničesar
  const verzija = createHash("sha1")
    .update(`${z.id_seznama}|${(okna ?? []).map((o) => `${o.id}@${o.updated_at}`).join(",")}|${viri.map((v) => `${v.id}:${v.vklopljen}:${v.objava?.id ?? 0}`).join(",")}`)
    .digest("hex")
    .slice(0, 16);
  const zaslon = { id: z.id, ime: z.ime, lokacija: z.lokacija, ukaz: z.ukaz, ukaz_st: z.ukaz_st };
  const cas = new Date().toISOString();
  if (url.searchParams.get("v") === verzija) return NextResponse.json({ zaslon, cas, verzija, nespremenjeno: true });

  // poti: strani + datoteka oken (fos-tv) in strani objav ("kosara:pot")
  const poti = [...new Set([...(okna ?? []).flatMap((o) => [...((o.strani as string[]) ?? []), ...(o.datoteka ? [o.datoteka as string] : [])]), ...viri.flatMap((v) => v.objava?.strani ?? [])])];
  const poKosarah = new Map<string, string[]>();
  for (const p of poti) {
    const i = p.indexOf(":");
    const [k, pot] = i > 0 ? [p.slice(0, i), p.slice(i + 1)] : [KOSARA, p];
    poKosarah.set(k, [...(poKosarah.get(k) ?? []), pot]);
  }
  const datoteke: Record<string, string> = {};
  for (const [k, seznam] of poKosarah) {
    const { data, error: e3 } = await admin.storage.from(k).createSignedUrls(seznam, 86_400);
    if (e3) return napakaApi(e3.message, 500);
    for (const d of data ?? []) if (d.path && d.signedUrl) datoteke[k === KOSARA ? d.path : `${k}:${d.path}`] = d.signedUrl;
  }
  return NextResponse.json({ zaslon, cas, verzija, okna: okna ?? [], viri, datoteke });
}
