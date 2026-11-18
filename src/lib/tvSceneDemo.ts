import type { DeloOddelka } from "@/lib/tvScene";

/**
 * Testni podatki animiranih scen (/tv/scena) - enaka oblika, kot jo bo objavil Production (deloVceraj.ts -> DeloOddelka).
 * Montaža 1 = primer iz dogovora 2026-11-18: 2337 v planu 7,6 / 28 h (zaskrbljen), 2386 pred planom 30,5 h (navdušen),
 * skupaj nad planom (nadure - ponosen).
 */
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
        { krovni: "2337", narocnik: "Pekarna Grosuplje", plan: 28, ure: 7.6, izvenDneva: null },
        { krovni: "2386", narocnik: "Žito d.o.o.", plan: 0, ure: 30.5, izvenDneva: "pred" },
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
        { krovni: "2341", narocnik: "Mlinotest", plan: 24, ure: 25, izvenDneva: null },
        { krovni: "2350", narocnik: "Don Don", plan: 16, ure: 14.2, izvenDneva: null },
        { krovni: "2299", narocnik: "Pekarna Pečjak", plan: 0, ure: 6, izvenDneva: "po" },
      ],
    },
  ],
};
