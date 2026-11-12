import { BadgeCheck, CalendarClock, CalendarPlus, CalendarRange, Clock, ClockPlus, Database, DoorOpen, EyeOff, FilePenLine, Hourglass, Keyboard, KeyRound, LogIn, MousePointerClick, Scale, Settings, Stethoscope, Tags, TicketCheck, TreePalm, Tv, Users, type LucideIcon } from "lucide-react";

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
    nastavitve: { href: "/administracija/registracija/nastavitve", hint: "Nastavitve registracije časa: urniki, statistike, krmilnik" },
  },
  {
    href: "/administracija/zaposleni",
    naslov: "Zaposleni",
    opis: "Seznam vseh zaposlenih z oddelki, vodji in karticami.",
    hint: "Odpri seznam vseh zaposlenih",
    icon: Users,
  },
  {
    href: "/administracija/tv",
    naslov: "FIN:TV",
    opis: "Televizorji v proizvodnji: zasloni, slike, videi, PDF in obvestila.",
    hint: "Odpri FIN:TV - vsebina televizorjev",
    icon: Tv,
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
        opis: "Skupine urnikov in intervali: okno prihoda, dnevi, pravila knjiženja, prazniki.",
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
      {
        href: "/administracija/registracija/nastavitve/obveznost",
        naslov: "Delovna obveznost",
        opis: "Koliko ur na dan mora opraviti zaposleni v urniku - osnova za dnevni saldo.",
        hint: "Odpri delovno obveznost urnikov",
        icon: Hourglass,
      },
    ],
  },
  {
    naslov: "Naprave",
    ploscice: [
      {
        href: "/administracija/registracija/nastavitve/krmilnik",
        naslov: "Krmilnik",
        opis: "Tipke na krmilniku in besedilo ob žigu. Prihod in izhod brez tipke - samodejno.",
        hint: "Odpri tipke krmilnika",
        icon: Keyboard,
      },
    ],
  },
];

/**
 * Sekcije z menijem levo: tam, kjer je mreža več nastavitev (ploščice), se na tej strani in na vseh njenih podstraneh
 * pokaže zložljiv meni sekcije (MeniSekcije), vsebina strani je desno. Drugje (Registracija časa, Zaposleni, FIN:TV)
 * menija ni. Nova sekcija z mrežo nastavitev = nov vnos (koren = stran z mrežo) + layout.tsx s SekcijaZMenijem.
 */
export type Sekcija = { koren: string; naslov: string; razdelki: { naslov: string; ploscice: Ploscica[] }[] };
export const SEKCIJE: Sekcija[] = [
  { koren: "/administracija/registracija/nastavitve", naslov: "Nastavitve registracije", razdelki: REGISTRACIJA_NASTAVITVE },
  { koren: "/administracija/nastavitve", naslov: "Nastavitve", razdelki: NASTAVITVE_RAZDELKI },
];
export const sekcijaPoti = (pot: string) => SEKCIJE.find((s) => pot === s.koren || pot.startsWith(`${s.koren}/`));

export const MOJ_FINES = { href: "/moj-fines", naslov: "Moj Fines" };

/**
 * Vstopi v FIN:ME (Moj Fines): velike kartice za preprostega uporabnika - malo besed, jasne ikone. Ob hoverju se nad
 * kartico pokaže oblaček s ključnimi besedami (kaj tu narediš). Nov razdelek = nov vnos.
 */
export type MeVstop = { href: string; naslov: string; opis: string; hint: string; icon: LucideIcon; kljucne: { ikona: LucideIcon; besedilo: string }[] };
export const ME_VSTOPI: MeVstop[] = [
  {
    href: "/moj-fines/cas",
    naslov: "Moj čas",
    opis: "Kdaj si prišel in odšel ter koliko ur imaš.",
    hint: "Odpri pregled svojega delovnega časa",
    icon: CalendarClock,
    kljucne: [
      { ikona: LogIn, besedilo: "Prihodi in odhodi po dnevih" },
      { ikona: Scale, besedilo: "Saldo ur: plus ali minus" },
      { ikona: TreePalm, besedilo: "Koliko dopusta ti ostane" },
      { ikona: MousePointerClick, besedilo: "Desni klik na dan = popravek" },
    ],
  },
  {
    href: "/moj-fines/odsotnosti",
    naslov: "Odsotnosti",
    opis: "Dopust, bolniška in drugi celi dnevi.",
    hint: "Odpri odsotnosti: najava in pregled",
    icon: CalendarPlus,
    kljucne: [
      { ikona: TreePalm, besedilo: "Dopust in lanski dopust" },
      { ikona: Stethoscope, besedilo: "Bolniška, očetovski, koriščenje ur" },
      { ikona: CalendarRange, besedilo: "En dan ali več dni skupaj" },
      { ikona: BadgeCheck, besedilo: "Vodja potrdi ali zavrne" },
    ],
  },
  {
    href: "/moj-fines/dovolilnice",
    naslov: "Dovolilnice",
    opis: "Izhod med delom ali delo izven urnika.",
    hint: "Odpri dovolilnice: izhod ali nadure",
    icon: TicketCheck,
    kljucne: [
      { ikona: DoorOpen, besedilo: "Grem ven med delom" },
      { ikona: ClockPlus, besedilo: "Nadure - delo izven urnika" },
      { ikona: Clock, besedilo: "En dan, od ure do ure" },
      { ikona: BadgeCheck, besedilo: "Vodja potrdi ali zavrne" },
    ],
  },
  {
    href: "/moj-fines/popravki",
    naslov: "Popravki",
    opis: "Pozabil si žig? Predlagaj popravek.",
    hint: "Odpri popravke delovnega časa",
    icon: FilePenLine,
    kljucne: [
      { ikona: LogIn, besedilo: "Manjka prihod ali odhod" },
      { ikona: EyeOff, besedilo: "Žig, ki ne velja" },
      { ikona: MousePointerClick, besedilo: "Desni klik na dan v Mojem času" },
      { ikona: BadgeCheck, besedilo: "Vodja potrdi ali zavrne" },
    ],
  },
];

/**
 * Strani z veliko podatki in nastavitvami: vsebina čez celo širino zaslona (do roba z odmikom), ne standardnih 1280 px.
 * Nova taka stran = nov vnos. SIROKE_STRANI veljajo tudi za podstrani, SIROKE_TOCNO samo za to pot (npr. registracija -
 * njene nastavitve s ploščicami ostanejo standardne).
 */
const SIROKE_STRANI = ["/administracija/tv", "/administracija/registracija/nastavitve/urniki", "/administracija/registracija/nastavitve/statistike", "/administracija/registracija/nastavitve/krmilnik", "/administracija/registracija/nastavitve/obveznost"];
const SIROKE_TOCNO = ["/administracija/registracija", "/moj-fines/cas"];
export const jeSiroka = (pot: string) => SIROKE_TOCNO.includes(pot) || SIROKE_STRANI.some((s) => pot === s || pot.startsWith(`${s}/`));
/** Širina vsebine in glave: standardna ali čez celo širino z odmikom od roba. */
export const sirinaStrani = (pot: string) => (jeSiroka(pot) ? "max-w-none sm:px-8 2xl:px-10" : "max-w-7xl");

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
    MOJ_FINES,
    ...ME_VSTOPI,
  ];
  const ime = href === "/" ? "domača stran FIN:OS" : (vse.find((p) => p.href === href)?.naslov ?? (href === ADMIN.href ? ADMIN.naslov : "prejšnja stran"));
  return { href, hint: `Nazaj: ${ime}` };
}
