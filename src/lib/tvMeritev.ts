/**
 * FIN:TV - diagnostika na televizorju (naslov strani, brez nove objave):
 *   ?meri=1             izpis v kotu: sličice na sekundo, najdaljši premor, velikost zaslona, brskalnik, zadnji diapozitivi
 *   &brez=a,b,...       izklopi del slike, da se najde krivec (kar po izklopu teče gladko, je drago):
 *       animacije  scene brez vseh animacij (mirna slika)
 *       prehod     brez prehoda med okni (takojšnja menjava)
 *       glava      brez glave Fineseka
 *       sence      brez senc, sijev in filtrov (box-shadow, text-shadow, filter)
 *       ozadje     brez ozadja scene (prelivi, mreža z masko)
 *       svet       brez sveta komponente (merilnik, stolpci, trak, pot, koledar)
 *       ura        brez žive ure
 * Velja za /tv?k=KLJUČ in /tv/scena. Prebere se enkrat (ob nalaganju strani).
 */

export type Izklop = "animacije" | "prehod" | "glava" | "sence" | "ozadje" | "svet" | "ura";

let prebrano: { meri: boolean; brez: Set<string> } | null = null;

function preberi() {
  if (prebrano) return prebrano;
  if (typeof window === "undefined") return { meri: false, brez: new Set<string>() };
  const q = new URLSearchParams(window.location.search);
  prebrano = {
    meri: q.get("meri") === "1",
    brez: new Set(
      (q.get("brez") ?? "")
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  };
  return prebrano;
}

export const meriVklop = () => preberi().meri;
export const brez = (x: Izklop) => preberi().brez.has(x);
export const izklopi = () => [...preberi().brez];

/** Kratka oznaka brskalnika: "Chrome 94 · Tizen 6.5" (iz navigator.userAgent). */
export function brskalnik(ua: string) {
  const chrome = ua.match(/Chrome\/(\d+)/)?.[1];
  const tizen = ua.match(/Tizen\s?([\d.]+)/)?.[1];
  const samsung = ua.match(/SamsungBrowser\/([\d.]+)/)?.[1];
  const deli = [chrome ? `Chrome ${chrome}` : null, samsung ? `Samsung ${samsung}` : null, tizen ? `Tizen ${tizen}` : null].filter(Boolean);
  return deli.length ? deli.join(" · ") : ua.slice(0, 60);
}
