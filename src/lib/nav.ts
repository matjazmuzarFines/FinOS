import { CalendarClock, CalendarRange, Database, KeyRound, Settings, Tags, Users, type LucideIcon } from "lucide-react";

/**
 * Navigacija FIN:OS - en vir za ploščice, drobtine in gumb nazaj.
 * Struktura: del aplikacije (Administracija) → ploščice (moduli) → seznam → list zapisa.
 */
export type Ploscica = {
  href: string;
  naslov: string;
  opis: string;
  hint: string;
  icon: LucideIcon;
  /** Zobnik desno zgoraj na ploščici -> nastavitve modula (klik drugam na ploščici odpre modul). */
  nastavitve?: { href: string; hint: string };
};

export const ADMIN = { href: "/administracija", naslov: "Administracija" };

/** Ploščice na vstopu v Administracijo (mreža kvadratov). */
export const ADMIN_PLOSCICE: Ploscica[] = [
  {
    href: "/administracija/registracija",
    naslov: "Registracija časa",
    opis: "Koledar prisotnosti po dnevih: prihodi, odhodi, odsotnosti, malice in prevozi.",
    hint: "Odpri koledar registracije časa",
    icon: CalendarClock,
    nastavitve: { href: "/administracija/registracija/nastavitve", hint: "Nastavitve registracije časa: urniki, statistike" },
  },
  {
    href: "/administracija/zaposleni",
    naslov: "Zaposleni",
    opis: "Seznam vseh zaposlenih z oddelki, vodji in karticami.",
    hint: "Odpri seznam vseh zaposlenih",
    icon: Users,
  },
  {
    href: "/administracija/nastavitve",
    naslov: "Nastavitve",
    opis: "Splošne nastavitve adminov: podatki baze, pravice in dostopi.",
    hint: "Odpri splošne nastavitve FIN:OS",
    icon: Settings,
  },
];

/** Podmeni Nastavitve: ploščice po razdelkih. Nova nastavitev = nova ploščica v ustreznem razdelku. */
export const NASTAVITVE_RAZDELKI: { naslov: string; ploscice: Ploscica[] }[] = [
  {
    naslov: "Sistem",
    ploscice: [
      {
        href: "/administracija/nastavitve/podatki",
        naslov: "Podatki baze",
        opis: "Urejanje tabel v Supabase: dodaj vrstico, uvoz iz CSV, navodila.",
        hint: "Odpri urejanje tabel baze",
        icon: Database,
      },
      {
        href: "/administracija/nastavitve/pravice",
        naslov: "Pravice in dostopi",
        opis: "Uporabniki FIN:OS in FIN:ME ter njihove funkcije: Super Admin, Kadrovanje.",
        hint: "Odpri pravice in funkcije uporabnikov",
        icon: KeyRound,
      },
    ],
  },
];

/** Nastavitve registracije časa (zobnik na ploščici Registracija časa). */
export const REGISTRACIJA_NASTAVITVE: { naslov: string; ploscice: Ploscica[] }[] = [
  {
    naslov: "Urnik",
    ploscice: [
      {
        href: "/administracija/registracija/nastavitve/urniki",
        naslov: "Urniki",
        opis: "Skupine urnikov in intervali: čas od-do, dnevi, veljavnost, prazniki.",
        hint: "Odpri urejanje urnikov in intervalov",
        icon: CalendarRange,
      },
      {
        href: "/administracija/registracija/nastavitve/statistike",
        naslov: "Statistike",
        opis: "V katero statistiko gre štempljanje: delo, delo od doma, dopust, bolniška ...",
        hint: "Odpri urejanje statistik",
        icon: Tags,
      },
    ],
  },
];

export type Drobtina = { naslov: string; href?: string };

/** Nadrejena stran (gumb nazaj v glavi): /administracija/zaposleni/12 → /administracija/zaposleni. */
export function nadrejena(pot: string): { href: string; hint: string } | undefined {
  const deli = pot.split("/").filter(Boolean);
  if (!deli.length) return undefined;
  const href = "/" + deli.slice(0, -1).join("/");
  const vse = [
    ...ADMIN_PLOSCICE,
    ...[...NASTAVITVE_RAZDELKI, ...REGISTRACIJA_NASTAVITVE].flatMap((r) => r.ploscice),
    { href: "/administracija/registracija/nastavitve", naslov: "Nastavitve registracije časa" },
  ];
  const ime = href === "/" ? "domača stran FIN:OS" : (vse.find((p) => p.href === href)?.naslov ?? (href === ADMIN.href ? ADMIN.naslov : "prejšnja stran"));
  return { href, hint: `Nazaj: ${ime}` };
}
