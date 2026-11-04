import { Suspense } from "react";
import { ZahtevkiStran } from "@/components/me/Zahtevki";

/** FIN:ME - Popravki: moji zahtevki (nov + seznam) in za vodjo zahtevki ekipe. */
export default function PopravkiStran() {
  return (
    <Suspense>
      <ZahtevkiStran vrsta="popravek" />
    </Suspense>
  );
}
