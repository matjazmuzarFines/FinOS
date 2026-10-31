import { Suspense } from "react";
import { RegistracijaCasa } from "@/components/cas/RegistracijaCasa";
import type { Obseg } from "@/lib/zaposleni";

// Administracija vidi vse zaposlene (FIN:ME bo imel obseg "moji")
const OBSEG: Obseg = { nacin: "vsi" };
const DROBTINE = [{ naslov: "FIN:OS", href: "/" }, { naslov: "Administracija", href: "/administracija" }, { naslov: "Registracija časa" }];

export default function RegistracijaStran() {
  return (
    <Suspense>
      <RegistracijaCasa
        obseg={OBSEG}
        drobtine={DROBTINE}
        opis="Prisotnost zaposlenih po dnevih: prihodi in odhodi, odsotnosti, malice in prevozi. Klik na dan odpre podrobnosti."
        nastavitve="/administracija/registracija/nastavitve"
      />
    </Suspense>
  );
}
