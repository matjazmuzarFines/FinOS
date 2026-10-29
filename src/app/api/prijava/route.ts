import { NextResponse } from "next/server";
import { adminKlient, BREZ_KLJUCA, javniKlient } from "@/lib/supabaseStreznik";

/**
 * Prijava z uporabniškim imenom (FIN:ME): strežnik poišče e-mail zaposlenega in se prijavi v Supabase Auth.
 * E-mail se brskalniku ne razkrije; vrne samo žetona seje. Prijava z e-mailom gre neposredno iz brskalnika.
 */
export async function POST(req: Request) {
  const telo = (await req.json().catch(() => null)) as { uporabnik?: string; geslo?: string } | null;
  const uporabnik = telo?.uporabnik?.trim().toLowerCase();
  const geslo = telo?.geslo;
  const zavrni = () => NextResponse.json({ napaka: "Napačno uporabniško ime ali geslo." }, { status: 401 });
  if (!uporabnik || !geslo) return zavrni();

  const admin = adminKlient();
  if (!admin) return NextResponse.json({ napaka: BREZ_KLJUCA }, { status: 500 });
  const { data } = await admin.from("fos_zaposleni").select("email").eq("uporabnisko_ime", uporabnik).eq("visible", true).not("id_uporabnika", "is", null).maybeSingle();
  if (!data?.email) return zavrni();

  const { data: prijava, error } = await javniKlient().auth.signInWithPassword({ email: data.email, password: geslo });
  if (error || !prijava.session) return zavrni();
  return NextResponse.json({ access_token: prijava.session.access_token, refresh_token: prijava.session.refresh_token });
}
