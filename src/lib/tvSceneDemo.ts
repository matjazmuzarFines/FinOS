import { datumIso } from "@/lib/tvObjava";
import type { DeloOddelka, MaterialOddelkaTv, PlanTv, ZakljuceniOddelkaTv } from "@/lib/tvScene";

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
        { krovni: "2337", narocnik: "Pekarna Grosuplje", od: dan(-1), do: dan(0), ure: 36, brezKapacitete: 0, prosta: false },
        { krovni: "2390", narocnik: "Mlinotest", od: dan(1), do: dan(1), ure: 16, brezKapacitete: 0, prosta: false },
        { krovni: "2401", narocnik: "Don Don", od: dan(2), do: dan(6), ure: 64, brezKapacitete: 12, prosta: false },
      ],
    },
    {
      naziv: "Montaža 2",
      koraki: [
        { krovni: "2412", narocnik: "Žito d.o.o.", od: dan(0), do: dan(3), ure: 48, brezKapacitete: 0, prosta: false },
        { krovni: "2415", narocnik: "Pekarna Pečjak", od: dan(4), do: dan(9), ure: 40, brezKapacitete: 0, prosta: false },
      ],
    },
  ],
});
