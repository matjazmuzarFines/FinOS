import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { adminKlient, BREZ_KLJUCA } from "./supabaseStreznik";
import { jeUrednik } from "./uredniki";

/**
 * Kdo kliče API (samo strežnik): uporabnik iz žetona, ali je na zasilnem seznamu (NEXT_PUBLIC_FOS_UREDNIKI)
 * in katere funkcije ima (ln_fos_zaposleni_funkcije, 008).
 */
export type Klicatelj = { admin: SupabaseClient; uporabnik: User; zasilni: boolean; idZaposlenega: number | null; funkcije: string[] };

export const napakaApi = (sporocilo: string, status = 400) => NextResponse.json({ napaka: sporocilo }, { status });

/** Klicatelj, ki sme v Administracijo (Super Admin ali zasilni seznam), ali odgovor z napako. */
export async function klicatelj(req: Request): Promise<Klicatelj | NextResponse> {
  const admin = adminKlient();
  if (!admin) return napakaApi(BREZ_KLJUCA, 500);
  const zeton = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data } = zeton ? await admin.auth.getUser(zeton) : { data: { user: null } };
  if (!data.user) return napakaApi("Nisi prijavljen.", 401);

  const { data: z } = await admin.from("fos_zaposleni").select("id").eq("id_uporabnika", data.user.id).eq("visible", true).maybeSingle();
  const funkcije = z ? await funkcijeZaposlenega(admin, z.id) : [];
  const k: Klicatelj = { admin, uporabnik: data.user, zasilni: jeUrednik(data.user.email), idZaposlenega: z?.id ?? null, funkcije };
  if (!k.zasilni && !k.funkcije.includes("super_admin")) return napakaApi("Za to nimaš pravic (potrebuješ funkcijo Super Admin).", 403);
  return k;
}

/** Kode vidnih funkcij zaposlenega. */
export async function funkcijeZaposlenega(admin: SupabaseClient, idZaposlenega: number): Promise<string[]> {
  const { data } = await admin.from("ln_fos_zaposleni_funkcije").select("fos_funkcije!inner(koda, visible)").eq("id_zaposlenega", idZaposlenega).eq("visible", true).eq("fos_funkcije.visible", true);
  return (data ?? []).flatMap((r) => {
    const f = r.fos_funkcije as unknown as { koda: string } | { koda: string }[];
    return Array.isArray(f) ? f.map((x) => x.koda) : [f.koda];
  });
}
