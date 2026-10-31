/**
 * Slovenski dela prosti dnevi (Zakon o praznikih in dela prostih dnevih v RS).
 * Za zdaj izračun v aplikaciji (fiksni datumi + velika noč); ko bo potrjena baza, jih bo urejala tabela praznikov
 * (enkratni dela prosti dnevi, npr. dan solidarnosti) - ta seznam bo samo predlog za novo leto.
 */
const FIKSNI: [mesec: number, dan: number, ime: string][] = [
  [1, 1, "Novo leto"],
  [1, 2, "Novo leto"],
  [2, 8, "Prešernov dan"],
  [4, 27, "Dan upora proti okupatorju"],
  [5, 1, "Praznik dela"],
  [5, 2, "Praznik dela"],
  [6, 25, "Dan državnosti"],
  [8, 15, "Marijino vnebovzetje"],
  [10, 31, "Dan reformacije"],
  [11, 1, "Dan spomina na mrtve"],
  [12, 25, "Božič"],
  [12, 26, "Dan samostojnosti in enotnosti"],
];

/** Velikonočna nedelja (gregorijanski koledar, anonimni algoritem). */
function velikaNoc(leto: number): Date {
  const a = leto % 19;
  const b = Math.floor(leto / 100);
  const c = leto % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesec = Math.floor((h + l - 7 * m + 114) / 31);
  const dan = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(leto, mesec - 1, dan);
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const predpomnilnik = new Map<number, Map<string, string>>();

/** Dela prosti dnevi leta: datum (YYYY-MM-DD) -> ime praznika. */
export function prazniki(leto: number): Map<string, string> {
  let m = predpomnilnik.get(leto);
  if (m) return m;
  m = new Map(FIKSNI.map(([mes, dan, ime]) => [iso(new Date(leto, mes - 1, dan)), ime]));
  const vn = velikaNoc(leto);
  const zamik = (dni: number) => iso(new Date(vn.getFullYear(), vn.getMonth(), vn.getDate() + dni));
  m.set(zamik(0), "Velikonočna nedelja");
  m.set(zamik(1), "Velikonočni ponedeljek");
  m.set(zamik(49), "Binkoštna nedelja");
  predpomnilnik.set(leto, m);
  return m;
}

/** Ime praznika na datum (YYYY-MM-DD) ali null. */
export const praznik = (datum: string) => prazniki(Number(datum.slice(0, 4))).get(datum) ?? null;
