"use client";

/**
 * PDF -> slike strani (v brskalniku, pdf.js). Vsaka stran se izriše na širino 4K (3840 px) in shrani kot WebP -
 * TV potem kaže samo slike (ostro na 4K, brez pdf.js na TV-ju). Word / Excel: izvozi v PDF in naloži.
 */
const SIRINA = 3840;
/** Največ strani v enem PDF (daljši dokument ni za TV). */
export const NAJVEC_STRANI = 40;

/** Strani kot slike + razmerje vsake strani (višina / širina; > 1 = pokončna). */
export async function pdfVSlike(datoteka: Blob, napredek?: (stran: number, vseh: number) => void): Promise<{ slike: Blob[]; razmerja: number[] }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await datoteka.arrayBuffer()) }).promise;
  const vseh = Math.min(pdf.numPages, NAJVEC_STRANI);
  const slike: Blob[] = [];
  const razmerja: number[] = [];
  try {
    for (let i = 1; i <= vseh; i++) {
      napredek?.(i, vseh);
      const stran = await pdf.getPage(i);
      const osnova = stran.getViewport({ scale: 1 });
      const viewport = stran.getViewport({ scale: SIRINA / osnova.width });
      razmerja.push(Math.round((osnova.height / osnova.width) * 1000) / 1000);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await stran.render({ canvas, canvasContext: ctx, viewport }).promise;
      slike.push(await new Promise<Blob>((ok, ne) => canvas.toBlob((b) => (b ? ok(b) : ne(new Error("Strani ni mogoče shraniti."))), "image/webp", 0.9)));
      stran.cleanup();
    }
  } finally {
    await pdf.loadingTask.destroy();
  }
  return { slike, razmerja };
}

/** Dolžina videa (s) iz datoteke - trajanje okna z videom. */
export function dolzinaVidea(datoteka: Blob): Promise<number> {
  return new Promise((ok) => {
    const v = document.createElement("video");
    const u = URL.createObjectURL(datoteka);
    const konec = (s: number) => {
      URL.revokeObjectURL(u);
      ok(s);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () => konec(Number.isFinite(v.duration) ? Math.max(1, Math.round(v.duration)) : 10);
    v.onerror = () => konec(10);
    v.src = u;
  });
}
