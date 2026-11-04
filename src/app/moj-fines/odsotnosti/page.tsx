import { Suspense } from "react";
import { ZahtevkiStran } from "@/components/me/Zahtevki";

/** FIN:ME - Odsotnosti: moji zahtevki (nov + seznam) in za vodjo zahtevki ekipe. */
export default function OdsotnostiStran() {
  return (
    <Suspense>
      <ZahtevkiStran vrsta="odsotnost" />
    </Suspense>
  );
}
