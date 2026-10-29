"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

const MIN = 0.25;
const MAX = 1.6;
const KORAK = 1.2;
const KLJUC = "fos-hierarhija-povecava";
const omeji = (z: number) => Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));

/**
 * Platno za velike prikaze (hierarhija): kolešček = povečava okoli kazalca, vlečenje praznega ozadja = premik,
 * gumbi - / % / + / Prilagodi. Povečava je CSS `zoom` (postavitev se res pomanjša - drsniki in povleci-spusti
 * ostanejo točni). Brskalnik si zapomni zadnjo povečavo.
 */
export function Platno({ children }: { children: ReactNode }) {
  const okvir = useRef<HTMLDivElement>(null);
  const vsebina = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  const zRef = useRef(1);
  const premik = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  /** Nova povečava; točka (px, py) v okvirju ostane pod kazalcem. */
  const povecaj = useCallback((nova: number, px?: number, py?: number) => {
    const el = okvir.current;
    const stara = zRef.current;
    nova = omeji(nova);
    if (!el || nova === stara) return;
    const x = px ?? el.clientWidth / 2;
    const y = py ?? el.clientHeight / 2;
    const sl = ((el.scrollLeft + x) / stara) * nova - x;
    const st = ((el.scrollTop + y) / stara) * nova - y;
    zRef.current = nova;
    setZ(nova);
    requestAnimationFrame(() => {
      el.scrollLeft = sl;
      el.scrollTop = st;
    });
    try {
      localStorage.setItem(KLJUC, String(nova));
    } catch {}
  }, []);

  /** Celotna hierarhija na zaslon (največ 100 %). */
  const prilagodi = useCallback(() => {
    const el = okvir.current;
    const v = vsebina.current;
    if (!el || !v) return;
    // izmeri samo drevo (w-max), ne okvirja vsebine (ta je vsaj širok kot platno); getBoundingClientRect je že povečan
    const drevo = (v.firstElementChild as HTMLElement | null) ?? v;
    const r = drevo.getBoundingClientRect();
    const rob = 56;
    const sirina = r.width / zRef.current + rob;
    const visina = r.height / zRef.current + rob;
    // višina platna je po vsebini - prilagodi glede na največjo dovoljeno višino
    const najvecVisina = parseFloat(getComputedStyle(el).maxHeight) || el.clientHeight;
    const nova = omeji(Math.min(1, el.clientWidth / sirina, najvecVisina / visina));
    zRef.current = nova;
    setZ(nova);
    requestAnimationFrame(() => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = 0;
    });
    try {
      localStorage.setItem(KLJUC, String(nova));
    } catch {}
  }, []);

  // ob odprtju: zadnja povečava ali prilagodi na zaslon
  useEffect(() => {
    let shranjena: number | null = null;
    try {
      shranjena = Number(localStorage.getItem(KLJUC)) || null;
    } catch {}
    const id = requestAnimationFrame(() => {
      if (shranjena) {
        zRef.current = omeji(shranjena);
        setZ(zRef.current);
      } else prilagodi();
    });
    return () => cancelAnimationFrame(id);
  }, [prilagodi]);

  // kolešček (tudi stisk dveh prstov na sledilni ploščici = ctrl + kolešček); passive: false za preventDefault
  useEffect(() => {
    const el = okvir.current;
    if (!el) return;
    const kolo = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const faktor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      povecaj(zRef.current * faktor, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", kolo, { passive: false });
    return () => el.removeEventListener("wheel", kolo);
  }, [povecaj]);

  // premik z vlečenjem praznega ozadja (kartice in gumbi imajo svoje vlečenje / klik)
  const dol = (e: RPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.button !== 0 || t.closest("button, a, input, select, [data-kartica]")) return;
    const el = okvir.current!;
    premik.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const vleci = (e: RPointerEvent<HTMLDivElement>) => {
    const p = premik.current;
    const el = okvir.current;
    if (!p || !el) return;
    el.scrollLeft = p.sl - (e.clientX - p.x);
    el.scrollTop = p.st - (e.clientY - p.y);
  };
  const gor = () => (premik.current = null);

  return (
    <div className="relative ml-[calc(50%-50vw)] w-screen px-3 sm:px-6">
      {/* orodna vrstica povečave nad platnom (ne prekrije vsebine) */}
      <div className="mb-2 ml-auto flex w-max items-center gap-1 rounded-full border border-white/10 bg-ink-900/90 p-1 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl">
        <Gumb hint="Pomanjšaj prikaz hierarhije" onClick={() => povecaj(zRef.current / KORAK)} disabled={z <= MIN}>
          <Minus className="h-4 w-4" aria-hidden />
        </Gumb>
        <button
          type="button"
          title="Ponastavi povečavo na 100 %"
          onClick={() => povecaj(1)}
          className="h-8 min-w-14 rounded-full px-2 font-mono text-xs font-semibold tabular-nums text-ink-200 transition-colors hover:bg-white/10 hover:text-fines-300"
        >
          {Math.round(z * 100)} %
        </button>
        <Gumb hint="Povečaj prikaz hierarhije" onClick={() => povecaj(zRef.current * KORAK)} disabled={z >= MAX}>
          <Plus className="h-4 w-4" aria-hidden />
        </Gumb>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-white/10" />
        <Gumb hint="Prilagodi celotno hierarhijo zaslonu" onClick={prilagodi}>
          <Maximize className="h-4 w-4" aria-hidden />
        </Gumb>
      </div>
      <div
        ref={okvir}
        onPointerDown={dol}
        onPointerMove={vleci}
        onPointerUp={gor}
        onPointerCancel={gor}
        className="max-h-[max(280px,calc(100dvh-330px))] cursor-grab overflow-auto rounded-[24px] border border-white/10 bg-ink-950/30 active:cursor-grabbing"
        style={{ backgroundImage: "radial-gradient(var(--fos-grid-crta) 1.5px, transparent 1.5px)", backgroundSize: `${28 * z}px ${28 * z}px` }}
      >
        <div ref={vsebina} className="w-max min-w-full p-3 sm:p-4" style={{ zoom: z }}>
          {children}
        </div>
      </div>

    </div>
  );
}

function Gumb({ hint, onClick, disabled, children }: { hint: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={hint}
      aria-label={hint}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-full text-ink-200 transition-all hover:bg-fines-500/15 hover:text-fines-300 active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
