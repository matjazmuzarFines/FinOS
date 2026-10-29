"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Eye, EyeOff, LogIn, XCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Button } from "./ui/Button";
import { POLJE, PoljeNaslov } from "./ui/Polje";
import { Znak } from "./Znak";
import { SLOGAN } from "./Intro";

/** Prijavno okno za zaklenjen del (Administracija, FIN:ME) - v okvirju podstrani. Prijava z e-mailom ali uporabniškim imenom. */
export function Prijava({ naslov }: { naslov: string }) {
  const [email, setEmail] = useState("");
  const [geslo, setGeslo] = useState("");
  const [pokaziGeslo, setPokaziGeslo] = useState(false);
  const [napaka, setNapaka] = useState<string | null>(null);
  const [prijavljam, setPrijavljam] = useState(false);

  async function potrdi(e: FormEvent) {
    e.preventDefault();
    setNapaka(null);
    setPrijavljam(true);
    const sb = getSupabase();
    const uporabnik = email.trim();
    let sporocilo: string | null = null;
    if (uporabnik.includes("@")) {
      const { error } = await sb.auth.signInWithPassword({ email: uporabnik, password: geslo });
      if (error) sporocilo = error.message === "Invalid login credentials" ? "Napačen e-mail ali geslo." : error.message;
    } else {
      // uporabniško ime: e-mail poišče strežnik
      const odg = await fetch("/api/prijava", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uporabnik, geslo }) });
      const telo = (await odg.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; napaka?: string };
      if (odg.ok && telo.access_token && telo.refresh_token) {
        const { error } = await sb.auth.setSession({ access_token: telo.access_token, refresh_token: telo.refresh_token });
        if (error) sporocilo = error.message;
      } else sporocilo = telo.napaka ?? "Prijava ni uspela.";
    }
    if (sporocilo) {
      setNapaka(sporocilo);
      setPrijavljam(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <motion.form
          onSubmit={potrdi}
          className="fos-glass relative flex w-full max-w-sm flex-col gap-4 overflow-hidden rounded-[24px] p-6 sm:p-8"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8f380b,#ca5010_30%,#ee7a3a_60%,#ca5010)]" />
          <span className="self-center rounded-xl bg-snow px-3.5 py-2 shadow-[0_6px_20px_-8px_rgb(0_0_0/0.5)]">
            <Image src="/fines-logo.png" alt="FINES d.o.o. logotip" width={136} height={36} priority className="h-auto w-[110px]" />
          </span>
          <div className="flex flex-col items-center gap-1 text-center">
            <Znak className="text-4xl" />
            <p className="font-display text-lg font-bold text-white">{naslov}</p>
            <p className="text-xs text-ink-400">{SLOGAN}</p>
          </div>

          <PoljeNaslov naslov="E-mail ali uporabniško ime">
            <input autoComplete="username" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} title="Vpiši e-mail ali uporabniško ime" className={POLJE} />
          </PoljeNaslov>
          <PoljeNaslov naslov="Geslo">
            <div className="relative">
              <input
                type={pokaziGeslo ? "text" : "password"}
                autoComplete="current-password"
                required
                value={geslo}
                onChange={(e) => setGeslo(e.target.value)}
                title="Vpiši geslo"
                className={`${POLJE} pr-10`}
              />
              <button
                type="button"
                title={pokaziGeslo ? "Skrij vpisano geslo" : "Pokaži vpisano geslo"}
                aria-label={pokaziGeslo ? "Skrij vpisano geslo" : "Pokaži vpisano geslo"}
                onClick={() => setPokaziGeslo(!pokaziGeslo)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-400 transition-colors hover:text-fines-300"
              >
                {pokaziGeslo ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </PoljeNaslov>

          {napaka && (
            <p className="flex items-center gap-2 rounded-[10px] border border-nok-500/40 bg-nok-500/10 px-3 py-2 text-sm text-nok-500">
              <XCircle className="h-4 w-4 shrink-0" aria-hidden />
              {napaka}
            </p>
          )}
          <Button type="submit" hint="Prijavi se v FIN:OS" icon={LogIn} size="lg" disabled={prijavljam} className="mt-1">
            {prijavljam ? "Prijavljam ..." : "Prijava"}
          </Button>
        </motion.form>
      </div>
    </>
  );
}
