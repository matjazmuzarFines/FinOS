"use client";

import { naloziDatoteko } from "@/lib/tv";
import { dolzinaVidea, pdfVSlike } from "@/lib/pdfStrani";

/** Kaj FIN:TV sprejme (slika, video, PDF). Word / Excel: shrani kot PDF. */
export const SPREJME = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,application/pdf";
/** Opozorilo pri velikem videu (wifi, Supabase Storage). */
export const VELIK_VIDEO = 200 * 1024 * 1024;

export type VrstaDatoteke = "slika" | "video" | "pdf";
export const vrstaDatoteke = (f: File): VrstaDatoteke | null =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? "pdf" : f.type.startsWith("image/") ? "slika" : f.type.startsWith("video/") ? "video" : null;
export const brezKoncnice = (ime: string) => ime.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

export type Nalozeno = { vrsta: VrstaDatoteke; datoteka: string | null; strani: string[]; razmerja: number[]; trajanje_s: number | null };

/**
 * Naloži datoteko za TV: slika / video gre v košaro kot je (video: trajanje = dolžina), PDF se v brskalniku izriše
 * v slike strani 4K (+ razmerja strani - pokončne se na TV-ju razrežejo). `stanje` = besedilo napredka.
 */
export async function naloziZaTv(f: File, stanje: (s: string) => void): Promise<Nalozeno> {
  const vrsta = vrstaDatoteke(f);
  if (!vrsta) throw new Error("ni slika, video ali PDF.");
  if (vrsta === "pdf") {
    const { slike, razmerja } = await pdfVSlike(f, (i, n) => stanje(`Pripravljam stran ${i} / ${n}`));
    const strani: string[] = [];
    for (let i = 0; i < slike.length; i++) {
      stanje(`Nalagam stran ${i + 1} / ${slike.length}`);
      strani.push(await naloziDatoteko(slike[i], `stran-${i + 1}.webp`));
    }
    return { vrsta, datoteka: null, strani, razmerja, trajanje_s: null };
  }
  stanje("Nalagam ...");
  const trajanje_s = vrsta === "video" ? await dolzinaVidea(f) : null;
  return { vrsta, datoteka: await naloziDatoteko(f, f.name), strani: [], razmerja: [], trajanje_s };
}
