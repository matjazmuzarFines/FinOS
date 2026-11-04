"use client";

import { Suspense } from "react";
import { RegistracijaCasa } from "@/components/cas/RegistracijaCasa";
import { useJaz } from "@/components/me/Jaz";

const DROBTINE = [{ naslov: "FIN:OS", href: "/" }, { naslov: "Moj Fines", href: "/moj-fines" }, { naslov: "Moj čas" }];

/** FIN:ME - Moj čas: isti pogled kot Registracija časa v Administraciji; obseg = jaz in moja ekipa (hierarhija). */
export default function MojCasStran() {
  const { jaz, vodja } = useJaz();
  return (
    <Suspense>
      <RegistracijaCasa
        obseg={{ nacin: "moji", idZaposlenega: jaz.id }}
        idJaz={jaz.id}
        naslov="Moj čas"
        drobtine={DROBTINE}
        opis={
          vodja
            ? "Tvoj čas in čas tvoje ekipe. Klik na dan = podrobnosti, desni klik = popravek ali odsotnost. Dneve ekipe lahko urejaš."
            : "Tvoji prihodi, odhodi in ure. Klik na dan = podrobnosti, desni klik = popravek ali odsotnost."
        }
      />
    </Suspense>
  );
}
