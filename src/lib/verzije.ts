/** Verzije in spremembe (ikona "i" v glavi). Najnovejša na vrhu. */
export type Verzija = { verzija: string; datum: string; spremembe: string[] };

export const VERZIJE: Verzija[] = [
  {
    verzija: "2.10",
    datum: "29. 10. 2026",
    spremembe: [
      "Dostopi zaposlenega: stikala za aplikacije (Fines - Production, Kontrolne točke, Rabljena oprema), FIN:OS prek Super Admina.",
      "Baza sama zaščiti vsako novo tabelo - ob novih tabelah ni treba ničesar ponavljati.",
      "Seznam zaposlenih: Super Admini imajo ikono ščita pred kvadratkom z začetnicami.",
    ],
  },
  {
    verzija: "2.08",
    datum: "29. 10. 2026",
    spremembe: [
      "Nastavitve zaposlenega: stikalo Super Admin - z njim ima zaposleni s svojim računom dostop do Administracije.",
      "Zaposlenega z že obstoječim računom (ista prijava kot druge Fines aplikacije) se poveže z njegovim računom.",
    ],
  },
  {
    verzija: "2.07",
    datum: "29. 10. 2026",
    spremembe: [
      "Hierarhija: platno je visoko po vsebini, \"Brez vodje\" je tik pod njim - vse je hkrati na zaslonu.",
      "Spuščanje kartic je natančnejše pri vsaki povečavi in premiku platna.",
    ],
  },
  {
    verzija: "2.06",
    datum: "29. 10. 2026",
    spremembe: [
      "Hierarhija na platnu: kolešček miške poveča / pomanjša (okoli kazalca), vlečenje ozadja premakne pogled.",
      "Gumbi za povečavo: -, +, 100 % in Prilagodi (celotna hierarhija na zaslon).",
    ],
  },
  {
    verzija: "2.05",
    datum: "29. 10. 2026",
    spremembe: [
      "Hierarhija: lestvice so okna drug ob drugem (vodoravno, čez celo širino zaslona).",
      "Vsak vodja ima svoje okno z imenom oddelka, ki ga vodi, in številom ljudi v ekipi.",
    ],
  },
  {
    verzija: "2.04",
    datum: "29. 10. 2026",
    spremembe: [
      "Prikaz hierarhije (gumb na Zaposlenih): vse lestvice vodij kot drevesa s povezavami.",
      "Prazna mesta s +: dodaj novega ali obstoječega zaposlenega pod vodjo ali v novo lestvico.",
      "Povleci in spusti: zaposleni (s podrejenimi) gre k drugemu vodji, v novo lestvico ali med Brez vodje.",
      "Hierarhija ne dovoli krogov (vodja ne more biti podrejen svojemu zaposlenemu).",
    ],
  },
  {
    verzija: "2.03",
    datum: "29. 10. 2026",
    spremembe: [
      "Začetna stran FIN:OS je brez prijave; prijava je potrebna samo za Administracijo (za zdaj samo fines@fines.si).",
      "Zaposleni ima e-mail, uporabniško ime in geslo za prijavo v FIN:ME (razdelek Podatki na listu zaposlenega).",
      "Geslo se shrani zaščiteno v Supabase Auth in ga ni mogoče prebrati - lahko ga samo zamenjaš.",
      "Prijava z e-mailom ali uporabniškim imenom.",
    ],
  },
  {
    verzija: "2.02",
    datum: "29. 10. 2026",
    spremembe: [
      "Dodaj zaposlenega: okno z vsemi podatki (ime, priimek, kartica, oddelek, vodja, je vodja).",
      "List zaposlenega se ureja (razen ID), spremembe se shranijo s Shrani v spodnji vrstici.",
      "Vodje so v svoji tabeli; ob izbiri vodje se zapiše povezava zaposleni - vodja (z zgodovino).",
      "Gumb Nazaj je v vrsti s potjo do strani ob desnem robu; gumba Osveži ni več.",
      "Puščica na ploščici ne prekrije več opisa.",
    ],
  },
  {
    verzija: "2.01",
    datum: "29. 10. 2026",
    spremembe: [
      "Prijava z e-mailom in geslom (Supabase Auth); Izhod = odjava, e-mail uporabnika v glavi.",
      "Svetla in temna tema: gumb s soncem / luno desno zgoraj, izbira se zapomni v brskalniku.",
      "Administracija: mreža ploščic modulov, prvi modul Zaposleni.",
      "Seznam zaposlenih: iskanje, filter po oddelkih in vodji, razvrščanje po imenu, priimku in oddelku.",
      "List zaposlenega z razdelki: podatki, oddelek in vodja (s podrejenimi), dostopi, nastavitve.",
      "Gumb nazaj in pot do strani (drobtine) na vseh podstraneh.",
      "Prizor s Finesekom teče vsake 3 minute (prej 30 s); uvod se ne ponovi ob vrnitvi na domačo stran.",
    ],
  },
  {
    verzija: "1.03",
    datum: "29. 10. 2026",
    spremembe: [
      "Stikalo Animacije levo zgoraj: ustavi dodatne animacije (Finesek, uvod, ozadje, trak, bleščice) in zmanjša porabo.",
      "Gumbi, okna in prehodi delajo naprej; izbira se zapomni v brskalniku.",
    ],
  },
  {
    verzija: "1.02",
    datum: "29. 10. 2026",
    spremembe: [
      "Maskota Finesek na začetni strani: sestavljen iz delov (telo spredaj in s strani, roke, noge), z animiranim tekom in mahanjem.",
      "Prizor vsakih 30 s: Finesek priteče, potegne stikalo, FIN:OS zasveti, Finesek pomaha in steče naprej; FIN:OS nato počasi ugasne.",
    ],
  },
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
