"use client";

import { Ploscice } from "@/components/admin/Ploscice";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { NASTAVITVE_RAZDELKI } from "@/lib/nav";
import { TABELE } from "@/lib/tabeleBaze";
import { useZaposleni } from "@/lib/zaposleni";

/** Nastavitve: splošne nastavitve adminov, ploščice po razdelkih (podmeni). */
export default function NastavitveStran() {
  const { podatki } = useZaposleni();
  const stevila: Record<string, number | undefined> = {
    "/administracija/nastavitve/podatki": TABELE.length,
    "/administracija/nastavitve/pravice": podatki?.zaposleni.filter((z) => z.id_uporabnika).length,
  };

  return (
    <>
      <GlavaStrani
        drobtine={[{ naslov: "FIN:OS", href: "/" }, { naslov: "Administracija", href: "/administracija" }, { naslov: "Nastavitve" }]}
        naslov="Nastavitve"
        opis="Splošne nastavitve FIN:OS za administratorje. Izberi področje."
      />
      {NASTAVITVE_RAZDELKI.map((r) => (
        <section key={r.naslov} className="flex flex-col gap-4">
          <NaslovRazdelka>{r.naslov}</NaslovRazdelka>
          <Ploscice ploscice={r.ploscice.map((p) => ({ ...p, stevilo: stevila[p.href] }))} />
        </section>
      ))}
    </>
  );
}
