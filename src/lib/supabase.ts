import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Skupen Supabase odjemalec (ista baza kot ostali Fines projekti, tabele fos_). */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error("Supabase ni nastavljen. Dodaj NEXT_PUBLIC_SUPABASE_URL in NEXT_PUBLIC_SUPABASE_ANON_KEY v .env.local.");
  }
  client ??= createClient(url!, key!);
  return client;
}

type Stran<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Prebere vse vrstice (Supabase vrne največ 1000 vrstic na zahtevo). */
export async function fetchAll<T>(stran: (from: number, to: number) => Stran<T>, velikost = 1000): Promise<T[]> {
  const vse: T[] = [];
  for (let from = 0; ; from += velikost) {
    const { data, error } = await stran(from, from + velikost - 1);
    if (error) throw new Error(error.message);
    vse.push(...(data ?? []));
    if (!data || data.length < velikost) return vse;
  }
}
