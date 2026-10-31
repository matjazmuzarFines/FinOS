"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut, ShieldX } from "lucide-react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { jeUrednik, urednikiNastavljeni } from "@/lib/uredniki";
import { Prijava } from "./Prijava";
import { Button } from "./ui/Button";
import { PraznoStanje } from "./ui/PraznoStanje";

// undefined = še preverjam, null = ni prijave
const SejaKontekst = createContext<Session | null | undefined>(undefined);
// dostop do Administracije: undefined = še preverjam
const DostopKontekst = createContext<boolean | undefined>(undefined);
// funkcije prijavljenega uporabnika (008: super_admin, kadrovanje ...)
const FunkcijeKontekst = createContext<string[]>([]);

/** Prijavljen uporabnik (Supabase Auth) ali null. Domača stran FIN:OS deluje tudi brez prijave. */
export function useSeja() {
  return useContext(SejaKontekst) ?? null;
}

/** true = prijavljen uporabnik sme v Administracijo in ureja (NEXT_PUBLIC_FOS_UREDNIKI ali Super Admin). */
export function useDostop() {
  return useContext(DostopKontekst) === true;
}

/** true = prijavljen uporabnik ima funkcijo (Nastavitve -> Pravice in dostopi). Zasilni račun nima nobene. */
export function useFunkcija(koda: string) {
  return useContext(FunkcijeKontekst).includes(koda);
}

export async function odjava() {
  await getSupabase().auth.signOut();
}

/** Seja za celo aplikacijo (root layout). Sama ne zaklene ničesar - zaklep je `Zaklep`. */
export function Seja({ children }: { children: ReactNode }) {
  const [seja, setSeja] = useState<Session | null | undefined>(undefined);
  const [funkcije, setFunkcije] = useState<{ uporabnik: string; kode: string[] } | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => setSeja(data.session));
    const { data } = sb.auth.onAuthStateChange((_dogodek, s) => setSeja(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // funkcije (ln_fos_zaposleni_funkcije) - preveri baza za prijavljenega uporabnika
  const idUporabnika = seja?.user.id;
  useEffect(() => {
    if (!idUporabnika) return;
    let ziv = true;
    const sb = getSupabase();
    sb.rpc("fos_moje_funkcije").then(async ({ data, error }) => {
      // pred 008 je samo Super Admin (stolpec)
      const kode = !error ? ((data as string[] | null) ?? []) : (await sb.rpc("fos_je_super_admin")).data === true ? ["super_admin"] : [];
      if (ziv) setFunkcije({ uporabnik: idUporabnika, kode });
    });
    return () => {
      ziv = false;
    };
  }, [idUporabnika]);

  const kode = funkcije && funkcije.uporabnik === seja?.user.id ? funkcije.kode : undefined;
  const dostop = !seja ? false : jeUrednik(seja.user.email) ? true : kode ? kode.includes("super_admin") : undefined;

  return (
    <SejaKontekst.Provider value={supabaseConfigured ? seja : null}>
      <DostopKontekst.Provider value={dostop}>
        <FunkcijeKontekst.Provider value={(seja && kode) || []}>{children}</FunkcijeKontekst.Provider>
      </DostopKontekst.Provider>
    </SejaKontekst.Provider>
  );
}

/**
 * Zaklep dela aplikacije (Administracija): brez prijave prijavno okno, prijavljen uporabnik brez
 * dostopa (ni Super Admin in ni na zasilnem seznamu NEXT_PUBLIC_FOS_UREDNIKI) dobi "Ni dostopa" z odjavo.
 */
export function Zaklep({ children, naslov }: { children: ReactNode; naslov: string }) {
  const seja = useContext(SejaKontekst);
  const dostop = useContext(DostopKontekst);

  if (!supabaseConfigured)
    return <p className="grid min-h-dvh place-items-center p-6 text-center text-sm text-nok-500">Supabase ni nastavljen (manjkata NEXT_PUBLIC_SUPABASE_URL in NEXT_PUBLIC_SUPABASE_ANON_KEY).</p>;
  if (seja === undefined) return null;
  if (!seja) return <Prijava naslov={naslov} />;
  if (dostop === undefined) return null;
  if (!dostop)
    return (
      <div className="mx-auto w-full max-w-lg py-10">
        <PraznoStanje
          ton="napaka"
          icon={ShieldX}
          naslov={`Ni dostopa: ${naslov}`}
          opis={
            urednikiNastavljeni
              ? `Uporabnik ${seja.user.email ?? ""} nima dostopa do tega dela FIN:OS (ni Super Admin).`
              : `Uporabnik ${seja.user.email ?? ""} ni Super Admin. (Zasilni seznam NEXT_PUBLIC_FOS_UREDNIKI na strežniku ni nastavljen.)`
          }
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
