"use client";

import { Ploscice } from "@/components/admin/Ploscice";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { Znak } from "@/components/Znak";
import { ADMIN_PLOSCICE } from "@/lib/nav";
import { useZaposleni } from "@/lib/zaposleni";

/** Vstop v Administracijo (FIN:OS Admin): mreža kvadratnih ploščic modulov. */
export default function AdministracijaStran() {
  const { podatki } = useZaposleni();
  const stevila: Record<string, number | undefined> = { "/administracija/zaposleni": podatki?.zaposleni.length };

  return (
    <>
      <GlavaStrani
        drobtine={[{ naslov: "FIN:OS", href: "/" }, { naslov: "Administracija" }]}
        naslov={
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            Administracija <Znak pripona="OS" className="text-xl sm:text-2xl" />
          </span>
        }
        opis="Vodje in kadrovska služba: zaposleni, evidence, dostopi in kartice. Izberi modul."
      />
      <section className="flex flex-col gap-4">
        <NaslovRazdelka>Moduli</NaslovRazdelka>
        <Ploscice ploscice={ADMIN_PLOSCICE.map((p) => ({ ...p, stevilo: stevila[p.href] }))} />
      </section>
    </>
  );
}
