import { isoDatum } from "./cas";
import type { Funkcija } from "./funkcije";
import { finMeZa, type FinMeNastavitve } from "./finme";
import { prenesiXlsx, type Celica } from "./xlsx";
import { polnoIme, type Zaposleni, type ZaposleniPodatki } from "./zaposleni";

/** Funkcije, če jih iz baze ni mogoče prebrati (008). */
const PRIVZETE: Pick<Funkcija, "koda" | "ime" | "opis">[] = [
  { koda: "super_admin", ime: "Super Admin", opis: "Dostop do FIN:OS Administracije." },
  { koda: "kadrovanje", ime: "Kadrovanje", opis: "Osebni podatki zaposlenih." },
];

/**
 * Izvoz pravic po uporabnikih (Excel): za vsakega prikazanega zaposlenega DA / NE za vse pravice in dostope -
 * račun FIN:ME, funkcije (Super Admin, Kadrovanje ...), FIN:ME nastavitve (virtualno beleženje), vodja (potrjuje
 * zahtevke ekipe) in vsaka aplikacija. Drugi list: opis vsake pravice.
 * Nova pravica = nov stolpec tukaj (funkcije in aplikacije se dodajo same iz baze).
 */
export function izvoziPravice(zaposleni: Zaposleni[], podatki: ZaposleniPodatki, funkcije: Pick<Funkcija, "koda" | "ime" | "opis">[] | null, finme: { po: Record<number, FinMeNastavitve> }) {
  const fn = funkcije?.length ? funkcije : PRIVZETE;
  const glava = [
    "ID",
    "Priimek",
    "Ime",
    "Oddelek",
    "Vodja",
    "E-mail",
    "Uporabniško ime",
    "Račun (prijava FIN:ME)",
    "Vodja ekipe (potrjuje zahtevke)",
    ...fn.map((f) => f.ime),
    "Virtualno beleženje (FIN:ME)",
    ...podatki.aplikacije.map((a) => `Aplikacija: ${a.ime}`),
  ];
  const vrstice: Celica[][] = zaposleni.map((z) => [
    z.id,
    z.priimek,
    z.ime,
    z.oddelek?.ime_oddelka ?? "",
    z.vodja ? polnoIme(z.vodja) : "",
    z.email ?? "",
    z.uporabnisko_ime ?? "",
    z.id_uporabnika != null,
    z.id_kot_vodja != null,
    ...fn.map((f) => z.funkcije.includes(f.koda)),
    finMeZa(finme, z.id).virtualno_belezenje,
    ...podatki.aplikacije.map((a) => z.aplikacije.includes(a.id)),
  ]);
  const opisi: Celica[][] = [
    ["Račun (prijava FIN:ME)", "Prijava", "Zaposleni ima e-mail / uporabniško ime in geslo - lahko se prijavi v Moj Fines."],
    ["Vodja ekipe (potrjuje zahtevke)", "Hierarhija", "Ima podrejene: v Mojem Finesu vidi in ureja njihov čas ter potrjuje njihove zahtevke."],
    ...fn.map((f): Celica[] => [f.ime, "Funkcija (Pravice in dostopi)", f.opis]),
    ["Virtualno beleženje (FIN:ME)", "FIN:ME nastavitev", "Sme štempljati v Mojem Finesu (Delovna ura) - vir online."],
    ...podatki.aplikacije.map((a): Celica[] => [`Aplikacija: ${a.ime}`, "Dostop do aplikacije", a.opis ?? ""]),
  ];
  prenesiXlsx(`pravice_po_uporabnikih_${isoDatum(new Date())}.xlsx`, [
    { ime: "Pravice po uporabnikih", glava, vrstice, zamrzni: 3, sirine: [7, 16, 14, 18, 22, 28, 18, ...glava.slice(7).map((g) => Math.min(Math.max(g.length * 0.75, 12), 24))] },
    { ime: "Opis pravic", glava: ["Pravica", "Vrsta", "Opis"], vrstice: opisi, sirine: [32, 28, 90] },
  ]);
}
