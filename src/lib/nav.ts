import { Users, type LucideIcon } from "lucide-react";

/**
 * Navigacija FIN:OS - en vir za ploščice, drobtine in gumb nazaj.
 * Struktura: del aplikacije (Administracija) → ploščice (moduli) → seznam → list zapisa.
 */
export type Ploscica = { href: string; naslov: string; opis: string; hint: string; icon: LucideIcon };

export const ADMIN = { href: "/administracija", naslov: "Administracija" };

/** Ploščice na vstopu v Administracijo (mreža kvadratov). */
export const ADMIN_PLOSCICE: Ploscica[] = [
  {
    href: "/administracija/zaposleni",
    naslov: "Zaposleni",
    opis: "Seznam vseh zaposlenih z oddelki, vodji in karticami.",
    hint: "Odpri seznam vseh zaposlenih",
    icon: Users,
  },
];

export type Drobtina = { naslov: string; href?: string };

/** Nadrejena stran (gumb nazaj v glavi): /administracija/zaposleni/12 → /administracija/zaposleni. */
export function nadrejena(pot: string): { href: string; hint: string } | undefined {
  const deli = pot.split("/").filter(Boolean);
  if (!deli.length) return undefined;
  const href = "/" + deli.slice(0, -1).join("/");
  const ime = href === "/" ? "domača stran FIN:OS" : (ADMIN_PLOSCICE.find((p) => p.href === href)?.naslov ?? (href === ADMIN.href ? ADMIN.naslov : "prejšnja stran"));
  return { href, hint: `Nazaj: ${ime}` };
}
