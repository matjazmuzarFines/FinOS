import { NextResponse } from "next/server";
import { adminKlient } from "@/lib/supabaseStreznik";
import { klicatelj, napakaApi as napaka } from "@/lib/klicatelj";
import { preveriPrijavo, type PrijavaVnos } from "@/lib/prijavaZaposlenega";

/**
 * Prijavni podatki zaposlenega za FIN:ME: e-mail, uporabniško ime, geslo.
 * Geslo gre samo v Supabase Auth (bcrypt), v fos_zaposleni se zapišejo e-mail, uporabniško ime in id računa.
 * Sme Super Admin ali zasilni račun (klicatelj.ts), preverjeno z njegovim žetonom.
 * Funkcije (Super Admin, Kadrovanje) niso tu - ureja jih /api/pravice.
 */
export async function POST(req: Request) {
  const k = await klicatelj(req);
  if (k instanceof NextResponse) return k;
  const { admin } = k;

  const telo = (await req.json().catch(() => null)) as (PrijavaVnos & { id_zaposlenega: number }) | null;
  if (!telo || typeof telo.id_zaposlenega !== "number") return napaka("Manjka zaposleni.");
  const v = preveriPrijavo(telo);
  if (typeof v === "string") return napaka(v);

  const { data: z, error: zNapaka } = await admin.from("fos_zaposleni").select("id, ime, priimek, id_uporabnika").eq("id", telo.id_zaposlenega).single();
  if (zNapaka || !z) return napaka("Zaposleni ne obstaja.", 404);

  // dostop do aplikacij ureja FIN:OS (006, zaposleni -> Dostopi); v računu je samo povezava z zaposlenim
  const nov = { app_metadata: { id_zaposlenega: z.id }, user_metadata: { ime: z.ime, priimek: z.priimek } };
  const obstojeci = async (id: string) => {
    const { data } = await admin.auth.admin.getUserById(id);
    return { app_metadata: { ...(data.user?.app_metadata ?? {}), id_zaposlenega: z.id } };
  };
  let idUporabnika: string | null = z.id_uporabnika;

  if (idUporabnika) {
    if (!v.email) return napaka("Zaposleni že ima račun - e-mail ne sme biti prazen.");
    const { error } = await admin.auth.admin.updateUserById(idUporabnika, { email: v.email, email_confirm: true, ...(v.geslo ? { password: v.geslo } : {}), ...(await obstojeci(idUporabnika)) });
    if (error) return napaka(sporociloAuth(error.message));
  } else if (v.geslo) {
    if (!v.email) return napaka("Za račun vpiši e-mail.");
    // račun s tem e-mailom že obstaja (ista baza kot ostale Fines aplikacije) -> poveži ga z zaposlenim
    const obstojec = await najdiRacun(admin, v.email);
    if (obstojec) {
      const { error } = await admin.auth.admin.updateUserById(obstojec, { ...(v.geslo ? { password: v.geslo } : {}), ...(await obstojeci(obstojec)) });
      if (error) return napaka(sporociloAuth(error.message));
      idUporabnika = obstojec;
      // obstoječi račun je do zdaj imel dostop do vseh aplikacij - po povezavi z zaposlenim ga obdrži
      const [{ data: apl }, { data: imajo }] = await Promise.all([
        admin.from("fos_aplikacije").select("id").eq("visible", true),
        admin.from("ln_fos_zaposleni_aplikacije").select("id_aplikacije").eq("id_zaposlenega", z.id).eq("visible", true),
      ]);
      const manjka = (apl ?? []).filter((a) => !(imajo ?? []).some((i) => i.id_aplikacije === a.id));
      if (manjka.length) await admin.from("ln_fos_zaposleni_aplikacije").insert(manjka.map((a) => ({ id_zaposlenega: z.id, id_aplikacije: a.id })));
    } else if (v.geslo) {
      const { data, error } = await admin.auth.admin.createUser({ email: v.email, password: v.geslo, email_confirm: true, ...nov });
      if (error || !data.user) return napaka(sporociloAuth(error?.message ?? ""));
      idUporabnika = data.user.id;
    }
  }

  const { error } = await admin.from("fos_zaposleni").update({ email: v.email, uporabnisko_ime: v.uporabnisko_ime, id_uporabnika: idUporabnika }).eq("id", z.id);
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
