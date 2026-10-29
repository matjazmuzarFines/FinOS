"use client";

import { TEMA_KLJUC } from "./animacijeSkripta";
import { ustvariNastavitev } from "./nastavitev";

/**
 * Svetla / temna tema (gumb desno zgoraj v glavi). Privzeto temna.
 * Atribut: <html data-tema="svetla"> - v globals.css zamenja žetone (ink, white, steklo, prelivi).
 * Pravilo: finos_stil.txt → 13.
 */
export type Tema = "temna" | "svetla";

const tema = ustvariNastavitev<Tema>(TEMA_KLJUC, "tema", "temna", ["temna", "svetla"]);

export const nastaviTemo = tema.nastavi;
export const useTema = tema.useVrednost;
