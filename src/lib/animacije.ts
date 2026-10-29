"use client";

import { ANIMACIJE_KLJUC } from "./animacijeSkripta";
import { ustvariNastavitev } from "./nastavitev";

/**
 * Stikalo "dodatne animacije" (levo zgoraj v glavi).
 * Izklopljene = ustavijo se vse ponavljajoče dekorativne animacije, ki porabljajo CPU
 * (Finesek, delci in prelivi v ozadju, trak, lebdenje, bleščice, uvod). Animacije gumbov,
 * oken, hoverja in prehodov ostanejo. Pravilo: finos_stil.txt → 12.
 * Atribut: <html data-animacije="off">.
 */
const animacije = ustvariNastavitev(ANIMACIJE_KLJUC, "animacije", "on", ["on", "off"] as const);

export function nastaviAnimacije(vklop: boolean) {
  animacije.nastavi(vklop ? "on" : "off");
}

/** true = dodatne animacije so vklopljene. */
export function useAnimacije(): boolean {
  return animacije.useVrednost() === "on";
}
