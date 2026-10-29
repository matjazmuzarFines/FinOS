"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut, ShieldX } from "lucide-react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { jeUrednik } from "@/lib/uredniki";
import { Prijava } from "./Prijava";
import { Button } from "./ui/Button";
import { PraznoStanje } from "./ui/PraznoStanje";

// undefined = še preverjam, null = ni prijave
const SejaKontekst = createContext<Session | null | undefined>(undefined);

/** Prijavljen uporabnik (Supabase Auth) ali null. Domača stran FIN:OS deluje tudi brez prijave. */
export function useSeja() {
  return useContext(SejaKontekst) ?? null;
}

export async function odjava() {
  await getSupabase().auth.signOut();
}

/** Seja za celo aplikacijo (root layout). Sama ne zaklene ničesar - zaklep je `Zaklep`. */
export function Seja({ children }: { children: ReactNode }) {
  const [seja, setSeja] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => setSeja(data.session));
    const { data } = sb.auth.onAuthStateChange((_dogodek, s) => setSeja(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return <SejaKontekst.Provider value={supabaseConfigured ? seja : null}>{children}</SejaKontekst.Provider>;
}

/**
 * Zaklep dela aplikacije (Administracija): brez prijave prijavno okno, prijavljen uporabnik brez
 * pravice (ni med NEXT_PUBLIC_FOS_UREDNIKI) dobi "Ni dostopa" z odjavo.
 */
export function Zaklep({ children, naslov }: { children: ReactNode; naslov: string }) {
  const seja = useContext(SejaKontekst);

  if (!supabaseConfigured)
    return <p className="grid min-h-dvh place-items-center p-6 text-center text-sm text-nok-500">Supabase ni nastavljen (manjkata NEXT_PUBLIC_SUPABASE_URL in NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>;
  if (seja === undefined) return null;
  if (!seja) return <Prijava naslov={naslov} />;
  if (!jeUrednik(seja.user.email))
    return (
      <div className="mx-auto w-full max-w-lg py-10">
        <PraznoStanje
          ton="napaka"
          icon={ShieldX}
          naslov={`Ni dostopa: ${naslov}`}
          opis={`Uporabnik ${seja.user.email ?? ""} nima dostopa do tega dela FIN:OS.`}
          akcija={
            <Button hint="Odjavi se in prijavi z drugim uporabnikom" variant="primary" icon={LogOut} onClick={odjava}>
              Odjava
            </Button>
          }
        />
      </div>
    );
  return <>{children}</>;
}
