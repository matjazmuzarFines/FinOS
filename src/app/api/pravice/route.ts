import { NextResponse } from "next/server";
import { funkcijeZaposlenega, klicatelj, napakaApi } from "@/lib/klicatelj";

/**
 * Pravice in dostopi (Nastavitve). Funkcije zaposlenih (ln_fos_zaposleni_funkcije) piše samo ta pot.
 * GET  - uporabniki (zaposleni z računom) s časom zadnje prijave iz Supabase Auth
 * POST - { spremembe: [{ id_zaposlenega, koda, vklop }] }
 *
 * Pravila: dodeljuje Super Admin ali zasilni račun; Kadrovanje dodeli / odvzame samo, kdor ga ima (ali zasilni);
 * sebi Super Admina ne moreš odvzeti; funkcijo lahko dobi samo zaposleni z računom.
 */
export async function GET(req: Request) {
  const k = await klicatelj(req);
  if (k instanceof NextResponse) return k;

  const { data: zaposleni, error } = await k.admin.from("fos_zaposleni").select("id, id_uporabnika").eq("visible", true).not("id_uporabnika", "is", null);
  if (error) return napakaApi(error.message, 500);
  const iscem = new Map((zaposleni ?? []).map((z) => [z.id_uporabnika as string, z.id as number]));

  const uporabniki: { id_zaposlenega: number; zadnja_prijava: string | null; ustvarjen: string }[] = [];
  for (let page = 1; page <= 50 && iscem.size; page++) {
    const { data, error: e } = await k.admin.auth.admin.listUsers({ page, perPage: 200 });
    if (e) return napakaApi(e.message, 500);
    for (const u of data.users) {
      const id = iscem.get(u.id);
      if (id == null) continue;
      uporabniki.push({ id_zaposlenega: id, zadnja_prijava: u.last_sign_in_at ?? null, ustvarjen: u.created_at });
      iscem.delete(u.id);
    }
    if (data.users.length < 200) break;
  }
  return NextResponse.json({ uporabniki, jaz: { id_zaposlenega: k.idZaposlenega, zasilni: k.zasilni, funkcije: k.funkcije } });
}

type Sprememba = { id_zaposlenega: number; koda: string; vklop: boolean };

export async function POST(req: Request) {
  const k = await klicatelj(req);
  if (k instanceof NextResponse) return k;

  const telo = (await req.json().catch(() => null)) as { spremembe?: Sprememba[] } | null;
  const spremembe = (telo?.spremembe ?? []).filter((s) => typeof s?.id_zaposlenega === "number" && typeof s.koda === "string" && typeof s.vklop === "boolean");
  if (!spremembe.length) return napakaApi("Ni sprememb.");

  const { data: funkcije } = await k.admin.from("fos_funkcije").select("id, koda, ime").eq("visible", true);
  const poKodi = new Map((funkcije ?? []).map((f) => [f.koda as string, f as { id: number; koda: string; ime: string }]));
  const ids = [...new Set(spremembe.map((s) => s.id_zaposlenega))];
  const { data: zaposleni } = await k.admin.from("fos_zaposleni").select("id, ime, priimek, id_uporabnika").eq("visible", true).in("id", ids);
  const zPoId = new Map((zaposleni ?? []).map((z) => [z.id as number, z]));

  // najprej preveri vse, nato zapiši (brez delnih sprememb zaradi napake v pravilih)
  for (const s of spremembe) {
    const f = poKodi.get(s.koda);
    const z = zPoId.get(s.id_zaposlenega);
    if (!f) return napakaApi(`Funkcija ${s.koda} ne obstaja.`);
    if (!z) return napakaApi(`Zaposleni ${s.id_zaposlenega} ne obstaja.`, 404);
    const ime = `${z.ime} ${z.priimek}`;
    if (s.vklop && !z.id_uporabnika) return napakaApi(`${ime} nima računa - funkcijo lahko dobi samo uporabnik z e-mailom in geslom.`);
    if (s.koda === "kadrovanje" && !k.zasilni && !k.funkcije.includes("kadrovanje")) return napakaApi("Kadrovanje lahko dodeli ali odvzame samo uporabnik, ki ima Kadrovanje.", 403);
    if (s.koda === "super_admin" && !s.vklop && z.id === k.idZaposlenega && !k.zasilni) return napakaApi("Sebi ne moreš odvzeti Super Admina - to naj naredi drug Super Admin.");
  }

  for (const s of spremembe) {
    const f = poKodi.get(s.koda)!;
    const ima = (await funkcijeZaposlenega(k.admin, s.id_zaposlenega)).includes(s.koda);
    if (s.vklop && !ima) {
      const { error } = await k.admin.from("ln_fos_zaposleni_funkcije").insert({ id_zaposlenega: s.id_zaposlenega, id_funkcije: f.id });
      if (error) return napakaApi(error.message, 500);
    } else if (!s.vklop && ima) {
      const { error } = await k.admin.from("ln_fos_zaposleni_funkcije").update({ visible: false }).eq("id_zaposlenega", s.id_zaposlenega).eq("id_funkcije", f.id).eq("visible", true);
      if (error) return napakaApi(error.message, 500);
    }
  }
  return NextResponse.json({ ok: true });
}
