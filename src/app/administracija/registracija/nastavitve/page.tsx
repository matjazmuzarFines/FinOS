"use client";

import { Ploscice } from "@/components/admin/Ploscice";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { useCasNastavitve } from "@/lib/casNastavitve";
import { REGISTRACIJA_NASTAVITVE } from "@/lib/nav";

/** Nastavitve registracije časa (zobnik na ploščici): urniki, statistike ... */
export default function NastavitveRegistracijeStran() {
  const n = useCasNastavitve();
  const stevila: Record<string, number> = {
    "/administracija/registracija/nastavitve/urniki": n.urniki.filter((u) => u.visible).length,
    "/administracija/registracija/nastavitve/statistike": n.statistike.filter((s) => s.visible).length,
    "/administracija/registracija/nastavitve/krmilnik": n.tipke.filter((t) => t.visible).length,
  };

  return (
    <>
      <GlavaStrani
        drobtine={[
          { naslov: "FIN:OS", href: "/" },
          { naslov: "Administracija", href: "/administracija" },
          { naslov: "Registracija časa", href: "/administracija/registracija" },
          { naslov: "Nastavitve" },
        ]}
        naslov="Nastavitve registracije časa"
        opis="Vse, kar potrebuje izračun delovnega časa: urniki z intervali in statistike, v katere gre štempljanje."
      />
      {REGISTRACIJA_NASTAVITVE.map((r) => (
        <section key={r.naslov} className="flex flex-col gap-4">
          <NaslovRazdelka>{r.naslov}</NaslovRazdelka>
          <Ploscice ploscice={r.ploscice.map((p) => ({ ...p, stevilo: stevila[p.href] }))} />
        </section>
      ))}
    </>
  );
}
