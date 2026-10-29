"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, UserRound } from "lucide-react";
import { Intro, SLOGAN } from "./Intro";
import { Ozadje } from "./Ozadje";
import { Glava } from "./Glava";
import { Znak } from "./Znak";
import { Ura } from "./Ura";
import { VstopKartica } from "./VstopKartica";
import { Moduli, Trak } from "./Moduli";
import { APP_VERSION } from "@/lib/verzije";

/** Začetna stran FIN:OS: uvodna animacija → glava, znak, slogan, ura, vstopni kartici, moduli. */
export function Domov() {
  const [pripravljeno, setPripravljeno] = useState(false);

  return (
    <>
      <Ozadje />
      <Intro onKonec={() => setPripravljeno(true)} />

      {pripravljeno && (
        <div className="flex min-h-dvh flex-col overflow-x-clip">
          <Glava />

          <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center gap-12 px-4 pb-10 pt-12 sm:gap-16 sm:px-6 sm:pt-20">
            <section className="flex flex-col items-center text-center">
              <motion.span
                className="fos-glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-ink-200"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fines-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-fines-400" />
                </span>
                Fines Operating System
              </motion.span>

              <Znak zlozi zamik={0.1} className="text-[clamp(4rem,15vw,10rem)]" />

              <motion.p
                className="mt-5 font-display text-2xl font-medium text-white sm:text-4xl"
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.7, duration: 0.6 }}
              >
                {SLOGAN.split(" ").map((b, i) => (
                  <span key={i} className={b === "Bake" ? "fos-text-fines font-bold" : ""}>
                    {i > 0 && " "}
                    {b}
                  </span>
                ))}
              </motion.p>
              <motion.p
                className="mt-3 max-w-xl text-sm text-ink-300 sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
              >
                En prostor za ljudi v Finesu - delovni čas, odsotnosti, dostopi in kartice.
              </motion.p>
              <motion.div className="mt-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.05, type: "spring" }}>
                <Ura />
              </motion.div>
            </section>

            <nav aria-label="Vstop v aplikacijo" className="grid w-full gap-5 md:grid-cols-2 lg:gap-8">
              <VstopKartica
                naslov="Administracija"
                pripona="OS"
                opis="Upravljanje zaposlenih, evidenc, dostopov in kartic za vodje in kadrovsko službo."
                hint="Odpri administracijo FIN:OS Admin (kmalu)"
                icon={ShieldCheck}
                funkcije={["Zaposleni", "Delovni čas", "Odsotnosti", "FIN:DOOR", "Kartice"]}
                zamik={0.5}
              />
              <VstopKartica
                naslov="Moj Fines"
                pripona="ME"
                opis="Tvoj osebni prostor: ure, dopusti, prosti dnevi in bolniška na enem mestu."
                hint="Odpri osebni portal FIN:ME (kmalu)"
                icon={UserRound}
                funkcije={["Moje ure", "Dopust", "Prosti čas", "Bolniška", "Moja kartica"]}
                zamik={0.65}
              />
            </nav>

            <Moduli zamik={0.9} />
          </main>

          <Trak />
          <footer className="border-t border-white/5 py-4 text-center text-xs text-ink-500">
            FINES d.o.o. | FIN:OS | Verzija {APP_VERSION}
          </footer>
        </div>
      )}
    </>
  );
}
