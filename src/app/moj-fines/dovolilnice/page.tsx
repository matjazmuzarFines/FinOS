import { Suspense } from "react";
import { ZahtevkiStran } from "@/components/me/Zahtevki";

/** FIN:ME - Dovolilnice: moji zahtevki (nov + seznam) in za vodjo zahtevki ekipe. */
export default function DovolilniceStran() {
  return (
    <Suspense>
      <ZahtevkiStran vrsta="dovolilnica" />
    </Suspense>
  );
}
