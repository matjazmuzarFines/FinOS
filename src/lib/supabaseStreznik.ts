import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase na strežniku (API poti). NIKOLI ne uvozi v komponento za brskalnik:
 * SUPABASE_SERVICE_ROLE_KEY obide RLS in ne sme v brskalnik (ni NEXT_PUBLIC_, samo .env.local in Vercel).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKljuc = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKljuc = process.env.SUPABASE_SERVICE_ROLE_KEY;

const brezSeje = { auth: { persistSession: false, autoRefreshToken: false } };

/** Odjemalec s ključem service_role (upravljanje računov) ali null, če ključ manjka. */
export function adminKlient(): SupabaseClient | null {
  return url && serviceKljuc ? createClient(url, serviceKljuc, brezSeje) : null;
}

/** Odjemalec z javnim ključem brez shranjevanja seje (prijava na strežniku). */
export function javniKlient(): SupabaseClient {
  return createClient(url!, anonKljuc!, brezSeje);
}

export const BREZ_KLJUCA = "Na strežniku manjka SUPABASE_SERVICE_ROLE_KEY (.env.local / Vercel).";
