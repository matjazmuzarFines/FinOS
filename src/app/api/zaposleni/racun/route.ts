import { NextResponse } from "next/server";
import { adminKlient, BREZ_KLJUCA } from "@/lib/supabaseStreznik";
import { jeUrednik } from "@/lib/uredniki";
import { preveriPrijavo, type PrijavaVnos } from "@/lib/prijavaZaposlenega";

/**
 * Prijavni podatki zaposlenega za FIN:ME: e-mail, uporabniško ime, geslo.
 * Geslo gre samo v Supabase Auth (bcrypt), v fos_zaposleni se zapišejo e-mail, uporabniško ime in id računa.
 * Sme samo urednik (uredniki.ts), preverjeno z njegovim žetonom.
 */
export async function POST(req: Request) {
  const napaka = (sporocilo: string, status = 400) => NextResponse.json({ napaka: sporocilo }, { status });
  const admin = adminKlient();
  if (!admin) return napaka(BREZ_KLJUCA, 500);

  const zeton = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: klicatelj } = zeton ? await admin.auth.getUser(zeton) : { data: { user: null } };
  if (!klicatelj.user) return napaka("Za urejanje prijave zaposlenih nimaš pravic.", 403);
  const zasilni = jeUrednik(klicatelj.user.email);
  if (!zasilni) {
    const { data: sa } = await admin.from("fos_zaposleni").select("id").eq("id_uporabnika", klicatelj.user.id).eq("visible", true).eq("super_admin", true).maybeSingle();
    if (!sa) return napaka("Za urejanje prijave zaposlenih nimaš pravic.", 403);
  }

  const telo = (await req.json().catch(() => null)) as (PrijavaVnos & { id_zaposlenega: number; super_admin?: boolean }) | null;
  if (!telo || typeof telo.id_zaposlenega !== "number") return napaka("Manjka zaposleni.");
  const v = preveriPrijavo(telo);
  if (typeof v === "string") return napaka(v);

  const { data: z, error: zNapaka } = await admin.from("fos_zaposleni").select("id, ime, priimek, id_uporabnika, super_admin").eq("id", telo.id_zaposlenega).single();
  if (zNapaka || !z) return napaka("Zaposleni ne obstaja.", 404);
  const superAdmin = typeof telo.super_admin === "boolean" ? telo.super_admin : z.super_admin;
  if (!superAdmin && z.super_admin && z.id_uporabnika === klicatelj.user.id && !zasilni)
    return napaka("Sebi ne moreš odvzeti Super Admina - to naj naredi drug Super Admin.");

  const metapodatki = { app_metadata: { fos_vloga: "zaposleni", id_zaposlenega: z.id }, user_metadata: { ime: z.ime, priimek: z.priimek } };
  let idUporabnika: string | null = z.id_uporabnika;

  if (idUporabnika) {
    if (!v.email) return napaka("Zaposleni že ima račun - e-mail ne sme biti prazen.");
    const { error } = await admin.auth.admin.updateUserById(idUporabnika, { email: v.email, email_confirm: true, ...(v.geslo ? { password: v.geslo } : {}), ...metapodatki });
    if (error) return napaka(sporociloAuth(error.message));
  } else if (v.geslo || telo.super_admin) {
    if (!v.email) return napaka("Za račun vpiši e-mail.");
    // račun s tem e-mailom že obstaja (ista baza kot ostale Fines aplikacije) -> poveži ga z zaposlenim
    const obstojec = await najdiRacun(admin, v.email);
    if (obstojec) {
      const { error } = await admin.auth.admin.updateUserById(obstojec, { ...(v.geslo ? { password: v.geslo } : {}), ...metapodatki });
      if (error) return napaka(sporociloAuth(error.message));
      idUporabnika = obstojec;
    } else if (v.geslo) {
      const { data, error } = await admin.auth.admin.createUser({ email: v.email, password: v.geslo, email_confirm: true, ...metapodatki });
      if (error || !data.user) return napaka(sporociloAuth(error?.message ?? ""));
      idUporabnika = data.user.id;
    }
  }

  if (superAdmin && !idUporabnika) return napaka("Super Admin potrebuje račun: vpiši e-mail in geslo (Podatki → Prijava v FIN:ME).");

  const { error } = await admin.from("fos_zaposleni").update({ email: v.email, uporabnisko_ime: v.uporabnisko_ime, id_uporabnika: idUporabnika, super_admin: superAdmin }).eq("id", z.id);
  if (error) {
    if (error.code === "23505") return napaka(/uporabnisko/.test(error.message) ? "To uporabniško ime že ima drug zaposleni." : "Ta e-mail že ima drug zaposleni.");
    return napaka(error.message, 500);
  }
  return NextResponse.json({ ok: true, ima_racun: idUporabnika != null });
}

/** id obstoječega računa v Supabase Auth z danim e-mailom (ali null). */
async function najdiRacun(admin: NonNullable<ReturnType<typeof adminKlient>>, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const najden = data.users.find((u) => u.email?.toLowerCase() === email);
    if (najden) return najden.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

function sporociloAuth(m: string) {
  if (/already.*registered|already exists/i.test(m)) return "Uporabnik s tem e-mailom že obstaja (Supabase Auth). Uporabi drug e-mail.";
  if (/password/i.test(m)) return `Geslo ni sprejeto: ${m}`;
  return m || "Računa ni bilo mogoče shraniti.";
}
