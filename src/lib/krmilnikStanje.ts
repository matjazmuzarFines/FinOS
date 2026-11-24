/**
 * Krmilnik: vloga vsakega današnjega žiga in trenutno stanje zaposlenega (za potrdilo žiga in Info na krmilniku).
 * Čista funkcija - enako pravilo kot knjizenje.ts (smer po STANJU odsoten / prisoten / na odsotnosti; žig s tipko je
 * prihod / izhod, če ima tipka interval te vrste (npr. Izredno), sicer odsotnost - naslednja kartica brez tipke ali
 * ista tipka še enkrat je njen konec = povratek; druga tipka odsotnosti začne novo odsotnost; tipka odsotnosti brez
 * prisotnosti = prihod z opozorilom; Izredno = prihod / izhod s tipko kot delo od doma) in DelovnaUra
 * (Na delu od / Odmor od / Odšel ob). Uporablja /api/krmilnik; brez tega krmilnik pokaže osnovno potrdilo.
 */
export type VrstaTipke = "prihod" | "izhod" | "tipka";
export type ZigDneva = { id?: string | null; cas: string; tipka: string | null; vrste: VrstaTipke[] };
export type Vloga = "prihod" | "odhod" | "zacetek" | "konec";
export type VlogaZiga = { id?: string | null; cas: string; ura: string; vloga: Vloga; tipka: string | null; oznaka: string; trajanje_min?: number; opozorilo?: string };
export type StanjeDneva = { stanje: "prisoten" | "odsoten" | "odsel" | "ni"; naslov: string; od: string | null; tipka: string | null };

const CAS = new Intl.DateTimeFormat("sl-SI", { timeZone: "Europe/Ljubljana", hour: "2-digit", minute: "2-digit", hour12: false });
export const uraLj = (iso: string) => CAS.format(new Date(iso));
const DATUM = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" });
/** Datum (YYYY-MM-DD) v Ljubljani. */
export const datumLj = (d: Date) => DATUM.format(d);

/** Odmor / malica - prizor malice na krmilniku. */
export const JE_ODMOR = /odmor|malic|kosil|obrok|pavz/i;

/**
 * Oznaka konca odsotnosti. Tipke so prosto besedilo: znane dobijo pravi sklon ("Konec odmora"), ostale obliko brez
 * sklanjanja ("Zdravnik - konec"). Nova pogosta tipka = nova vrstica.
 */
const KONEC: [RegExp, string][] = [
  [/^odmor$/i, "Konec odmora"],
  [/^malica$/i, "Konec malice"],
  [/^kosilo$/i, "Konec kosila"],
  [/^poslovn(i izhod|o)$/i, "Konec poslovnega izhoda"],
  [/^služben(i izhod|o)$/i, "Konec službenega izhoda"],
  [/^privatn(i izhod|o)$/i, "Konec privatnega izhoda"],
  [/^zasebn(i izhod|o)$/i, "Konec zasebnega izhoda"],
  [/^izredn(i izhod|o)$/i, "Konec izrednega izhoda"],
];
export const oznakaKonca = (tipka: string) => KONEC.find(([r]) => r.test(tipka.trim()))?.[1] ?? `${tipka.trim()} - konec`;

/** Vloge žigov enega dne (žigi v poljubnem vrstnem redu, brez spregledanih). */
export function vlogeDneva(zigi: ZigDneva[]): VlogaZiga[] {
  const urejeni = [...zigi].sort((a, b) => new Date(a.cas).getTime() - new Date(b.cas).getTime());
  const izhod: VlogaZiga[] = [];
  // smer po STANJU, ne po parnosti (enako kot knjizi v knjizenje.ts)
  let prisoten = false;
  let odprta: VlogaZiga | null = null; // začeta odsotnost
  for (const z of urejeni) {
    const ura = uraLj(z.cas);
    const osnova = { id: z.id, cas: z.cas, ura, tipka: z.tipka };
    const zacetek = (): VlogaZiga => ({ ...osnova, vloga: "zacetek", oznaka: z.tipka! });
    const odhod = (): VlogaZiga => ({ ...osnova, vloga: "odhod", oznaka: z.tipka ? `Odhod · ${z.tipka}` : "Odhod" });
    let v: VlogaZiga;
    if (odprta) {
      // na odsotnosti: kartica brez tipke ali ista tipka = konec; tipka z Izhodom = odhod; druga odsotnost = nova
      if (z.tipka && z.tipka !== odprta.tipka && z.vrste.includes("izhod")) v = odhod();
      else if (z.tipka && z.tipka !== odprta.tipka && z.vrste.includes("tipka")) v = zacetek();
      else {
        const min = Math.round((new Date(z.cas).getTime() - new Date(odprta.cas).getTime()) / 60000);
        v = { ...osnova, vloga: "konec", tipka: odprta.tipka, oznaka: oznakaKonca(odprta.tipka ?? "Odsotnost"), trajanje_min: min };
      }
    } else if (prisoten) {
      // tipka brez intervala Izhod = odsotnost (kot knjizenje)
      v = z.tipka && !z.vrste.includes("izhod") ? zacetek() : odhod();
    } else {
      // odsoten: prihod; s tipko Izredno / delo od doma (interval Prihod) = prihod s tipko. Tipka odsotnosti (malica,
      // poslovni, privatni) brez prisotnosti NI mogoča - šteje kot prihod z opozorilom (knjizenje: napaka)
      const sPrihodom = !!z.tipka && z.vrste.includes("prihod");
      v = { ...osnova, vloga: "prihod", tipka: sPrihodom ? z.tipka : null, oznaka: sPrihodom ? `Prihod · ${z.tipka}` : "Prihod" };
      if (z.tipka && !sPrihodom) v.opozorilo = `${z.tipka} brez prihoda - zabeleženo kot prihod`;
    }
    odprta = v.vloga === "zacetek" ? v : null;
    prisoten = v.vloga === "prihod" || v.vloga === "konec";
    izhod.push(v);
  }
  return izhod;
}

/** Trenutno stanje po žigih dneva: Prisoten od (začetek izmene) / {tipka} od / Odšel ob / Danes še ni prihoda. */
export function stanjeDneva(vloge: VlogaZiga[]): StanjeDneva {
  const zadnji = vloge.at(-1);
  if (!zadnji) return { stanje: "ni", naslov: "Danes še ni prihoda", od: null, tipka: null };
  if (zadnji.vloga === "zacetek") return { stanje: "odsoten", naslov: zadnji.tipka ?? "Odsoten", od: zadnji.ura, tipka: zadnji.tipka };
  if (zadnji.vloga === "odhod") return { stanje: "odsel", naslov: "Odšel", od: zadnji.ura, tipka: null };
  const zacetek = [...vloge].reverse().find((v) => v.vloga === "prihod");
  return { stanje: "prisoten", naslov: "Prisoten", od: zacetek?.ura ?? zadnji.ura, tipka: null };
}
