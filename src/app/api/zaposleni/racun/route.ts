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
  if (!klicatelj.user || !jeUrednik(klicatelj.user.email)) return napaka("Za urejanje prijave zaposlenih nimaš pravic.", 403);

  const telo = (await req.json().catch(() => null)) as (PrijavaVnos & { id_zaposlenega: number }) | null;
  if (!telo || typeof telo.id_zaposlenega !== "number") return napaka("Manjka zaposleni.");
  const v = preveriPrijavo(telo);
  if (typeof v === "string") return napaka(v);

  const { data: z, error: zNapaka } = await admin.from("fos_zaposleni").select("id, ime, priimek, id_uporabnika").eq("id", telo.id_zaposlenega).single();
  if (zNapaka || !z) return napaka("Zaposleni ne obstaja.", 404);

  const metapodatki = { app_metadata: { fos_vloga: "zaposleni", id_zaposlenega: z.id }, user_metadata: { ime: z.ime, priimek: z.priimek } };
  let idUporabnika: string | null = z.id_uporabnika;

  if (idUporabnika) {
    if (!v.email) return napaka("Zaposleni že ima račun - e-mail ne sme biti prazen.");
    const { error } = await admin.auth.admin.updateUserById(idUporabnika, { email: v.email, email_confirm: true, ...(v.geslo ? { password: v.geslo } : {}), ...metapodatki });
    if (error) return napaka(sporociloAuth(error.message));
  } else if (v.geslo) {
    if (!v.email) return napaka("Za račun FIN:ME vpiši e-mail.");
    const { data, error } = await admin.auth.admin.createUser({ email: v.email, password: v.geslo, email_confirm: true, ...metapodatki });
    if (error || !data.user) return napaka(sporociloAuth(error?.message ?? ""));
    idUporabnika = data.user.id;
  }

  const { error } = await admin.from("fos_zaposleni").update({ email: v.email, uporabnisko_ime: v.uporabnisko_ime, id_uporabnika: idUporabnika }).eq("id", z.id);
  if (error) {
    if (error.code === "23505") return napaka(/uporabnisko/.test(error.message) ? "To uporabniško ime že ima drug zaposleni." : "Ta e-mail že ima drug zaposleni.");
    return napaka(error.message, 500);
  }
  return NextResponse.json({ ok: true, ima_racun: idUporabnika != null });
}

function sporociloAuth(m: string) {
  if (/already.*registered|already exists/i.test(m)) return "Uporabnik s tem e-mailom že obstaja (Supabase Auth). Uporabi drug e-mail.";
  if (/password/i.test(m)) return `Geslo ni sprejeto: ${m}`;
  return m || "Računa ni bilo mogoče shraniti.";
}
