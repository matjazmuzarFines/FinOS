/** Verzije in spremembe (ikona "i" v glavi). Najnovejša na vrhu. */
export type Verzija = { verzija: string; datum: string; spremembe: string[] };

export const VERZIJE: Verzija[] = [
  {
    verzija: "1.01",
    datum: "29. 10. 2026",
    spremembe: [
      "Postavljen projekt FIN:OS (Next.js, Tailwind, Motion).",
      "Uvodna animacija, ki zloži napis FIN:OS, s sloganom People Bake for People.",
      "Začetna stran z gibljivim ozadjem, uro in vstopnima karticama Administracija (FIN:OS Admin) in Moj Fines (FIN:ME).",
      "Predogled prihajajočih modulov: delovni čas, dopusti, prosti čas, bolniška, FIN:DOOR, kartice.",
    ],
  },
];

export const APP_VERSION = VERZIJE[0].verzija;
