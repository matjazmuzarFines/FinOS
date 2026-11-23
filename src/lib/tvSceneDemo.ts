import { datumIso } from "@/lib/tvObjava";
import type { DeloOddelka, MaterialOddelkaTv, PlanTv, PrioriteteOddelkaTv, ZakljuceniOddelkaTv } from "@/lib/tvScene";

/**
 * Testni podatki animiranih scen (/tv/scena) - enaka oblika, kot jo objavi Production (tvObjava.ts). Datumi plana in
 * materiala so od danes naprej (scene računajo DANES in dni do roka).
 * Montaža 1 pri Delu = primer iz dogovora 2026-11-18: 2337 v planu 7,6 / 28 h (zaskrbljen), 2386 pred planom 30,5 h
 * (navdušen), skupaj nad planom (nadure - ponosen).
 */
const dan = (n: number) => datumIso(Date.now() + n * 86_400_000);

export const DEMO_DELO: DeloOddelka = {
  koda: "M",
  naziv: "Montaža",
  datum: "2026-11-17",
  celice: [
    {
      naziv: "Montaža 1",
      dodatno: false,
      plan: 32,
      ure: 40.6,
      izven: 30.5,
      rezija: 2.5,
      osebe: 5,
      krovni: [
        { krovni: "2337", druzine: [{ d: "OCB", kos: 4 }, { d: "OCA", kos: 2 }], plan: 28, ure: 7.6, izvenDneva: null },
        { krovni: "2386", druzine: [{ d: "ROT", kos: 2 }], plan: 0, ure: 30.5, izvenDneva: "pred" },
      ],
    },
    {
      naziv: "Montaža 2",
      dodatno: false,
      plan: 40,
      ure: 39.2,
      izven: 6,
      rezija: 1,
      osebe: 5,
      krovni: [
        { krovni: "2341", druzine: [{ d: "OCA", kos: 6 }, { d: "PUL", kos: 1 }], plan: 24, ure: 25, izvenDneva: null },
        { krovni: "2350", druzine: [{ d: "KOM", kos: 3 }, { d: "OCB", kos: 1 }], plan: 16, ure: 14.2, izvenDneva: null },
        { krovni: "2299", druzine: [{ d: "OCB", kos: 8 }], plan: 0, ure: 6, izvenDneva: "po" },
      ],
    },
  ],
};

export const demoZakljuceni = (): ZakljuceniOddelkaTv => ({
  koda: "M",
  naziv: "Montaža",
  od: dan(-30),
  celice: [
    {
      naziv: "Montaža 1",
      krovni: [
        { krovni: "2310", zakljucen: dan(-2), normUre: 112, ure: 98, produktivnost: 112 / 98 },
        { krovni: "2298", zakljucen: dan(-6), normUre: 80, ure: 84, produktivnost: 80 / 84 },
        { krovni: "2285", zakljucen: dan(-12), normUre: 64, ure: 61, produktivnost: 64 / 61 },
      ],
    },
    {
      naziv: "Montaža 2",
      krovni: [{ krovni: "2302", zakljucen: dan(-4), normUre: 50, ure: 66, produktivnost: 50 / 66 }],
    },
  ],
});

export const demoMaterial = (): MaterialOddelkaTv => ({
  koda: "M",
  naziv: "Montaža",
  danes: dan(0),
  krovni: [
    { krovni: "2337", mesto: "Montaža 1", zacetek: dan(1), stanje: "zaloga", kompleten: dan(0), rezerva: 1, manjkajocih: 0, druzina: "Etažna peč" },
    { krovni: "2390", mesto: "Montaža 1", zacetek: dan(3), stanje: "pride", kompleten: dan(1), rezerva: 2, manjkajocih: 4, druzina: "Rotacijska peč" },
    { krovni: "2401", mesto: "Montaža 1", zacetek: dan(5), stanje: "prepozno", kompleten: dan(8), rezerva: -3, manjkajocih: 2, druzina: "Komora" },
    { krovni: "2412", mesto: "Montaža 2", zacetek: dan(2), stanje: "ni_naroceno", kompleten: null, rezerva: null, manjkajocih: 3, druzina: "Etažna peč" },
    { krovni: "2415", mesto: "Montaža 2", zacetek: dan(4), stanje: "zapadel", kompleten: dan(0), rezerva: null, manjkajocih: 1, druzina: "Pult" },
  ],
});

export const demoPlan = (): PlanTv => ({
  oddelek: "Montaža",
  od: dan(-2),
  do: dan(12),
  celice: [
    {
      naziv: "Montaža 1",
      koraki: [
        { krovni: "2337", druzine: [{ d: "OCB", kos: 4 }, { d: "OCA", kos: 2 }], od: dan(-1), do: dan(0), ure: 36, brezKapacitete: 0, prosta: false },
        { krovni: "2390", druzine: [{ d: "ROT", kos: 2 }], od: dan(1), do: dan(1), ure: 16, brezKapacitete: 0, prosta: false },
        { krovni: "2401", druzine: [{ d: "OCA", kos: 6 }, { d: "PUL", kos: 1 }], od: dan(2), do: dan(6), ure: 64, brezKapacitete: 12, prosta: false },
      ],
    },
    {
      naziv: "Montaža 2",
      koraki: [
        { krovni: "2412", druzine: [{ d: "KOM", kos: 3 }, { d: "OCB", kos: 1 }], od: dan(0), do: dan(3), ure: 48, brezKapacitete: 0, prosta: false },
        { krovni: "2415", druzine: [{ d: "OCB", kos: 8 }], od: dan(4), do: dan(9), ure: 40, brezKapacitete: 0, prosta: false },
      ],
    },
  ],
});

/**
 * Prioritete krovnih: 2351 = primer iz dogovora 2026-11-23 (ODC, 9 kos naročenih v 6 naročilih, ostalo za zalogo; prva
 * odprema zamuja, dolgi nazivi v dveh vrsticah), 2360 ima 8 odprem (več strani table), 2372 samo za zalogo.
 */
const ODC = { ident: "100-305.1101", naziv: "Peč etažna ODC 6.80 3 etaže, 400 V, s parno napravo in kamnito ploščo" };
const ODC2 = { ident: "100-305.1104", naziv: "Peč etažna ODC 4.60" };
export const demoPrioritete = (): PrioriteteOddelkaTv => ({
  koda: "M",
  naziv: "Montaža",
  danes: dan(0),
  krovni: [
    {
      krovni: "2351",
      mesto: "Montaža 1",
      zacetek: dan(-2),
      druzine: [{ d: "ODC", kos: 24 }],
      kosov: 24,
      naroceno: 9,
      narocil: 6,
      odpreme: [
        { datum: dan(-1), ...ODC, nalog: "2601240", kos: 1, kupec: "Pekarna Kaučič", lokacija: "Ljubljana", narocilo: "26-0412", zamuja: false },
        { datum: dan(1), ...ODC2, nalog: "2601241", kos: 2, kupec: "Tim Zip", lokacija: "Celje", narocilo: "26-0418", zamuja: false },
        { datum: dan(4), ...ODC, nalog: "2601240", kos: 1, kupec: "Mlinotest", lokacija: "Ajdovščina", narocilo: "26-0431", zamuja: false },
        { datum: dan(8), ...ODC2, nalog: "2601242", kos: 2, kupec: "Spar Slovenija", lokacija: "Ljubljana Črnuče", narocilo: "26-0440", zamuja: true },
        { datum: dan(12), ...ODC, nalog: "2601240", kos: 1, kupec: "Pekarna Pečjak", lokacija: "Škofljica", narocilo: "26-0447", zamuja: false },
        { datum: dan(19), ...ODC2, nalog: "2601242", kos: 2, kupec: "Žito", lokacija: null, narocilo: "26-0452", zamuja: false },
      ],
    },
    {
      krovni: "2360",
      mesto: "Montaža 2",
      zacetek: dan(1),
      druzine: [{ d: "OCB", kos: 10 }, { d: "OCA", kos: 4 }],
      kosov: 14,
      naroceno: 12,
      narocil: 8,
      odpreme: Array.from({ length: 8 }, (_, j) => ({
        datum: dan(3 + j * 2),
        ident: j % 2 ? "100-301.2002" : "100-301.2001",
        naziv: j % 2 ? "Peč konvekcijska OCA 10 GN" : "Peč konvekcijska HTB-5 NEW",
        nalog: j % 2 ? "2601302" : "2601301",
        kos: j % 3 === 0 ? 2 : 1,
        kupec: ["Bäckerei Huber", "Pekarna Grosuplje", "Lidl", "Hofer", "Pekarna Blatnik", "Mercator", "Bäko", "Tuš"][j],
        lokacija: ["Graz", "Grosuplje", null, "Maribor", "Vrhnika", null, "Wien", "Celje"][j],
        narocilo: `26-05${10 + j}`,
        zamuja: false,
      })),
    },
    { krovni: "2372", mesto: "Montaža 1", zacetek: dan(6), druzine: [{ d: "PUL", kos: 6 }], kosov: 6, naroceno: 0, narocil: 0, odpreme: [] },
  ],
});
