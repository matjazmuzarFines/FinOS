"use client";

import { useEffect, useRef, useState } from "react";
import { brskalnik, izklopi } from "@/lib/tvMeritev";

/**
 * Diagnostika FIN:TV (?meri=1): izpis zgoraj med naslovom in uro. Meri SAM BRSKALNIK, na katerem teče (televizor).
 *   - sličice na sekundo (zadnji 2 s) in najdaljši premor med sličicama (ms) - gladko pri 50 Hz = 50 sl./s, premor ~20 ms;
 *   - dolga opravila JavaScripta (longtask > 50 ms: število in najdaljše) - če so, zatika JavaScript, sicer risanje;
 *   - po diapozitivih (zadnjih 6): najdaljši premor v prvih 4 s (začetek = prehod + začetek scene), povprečje sl./s;
 *   - zaslon (CSS px × devicePixelRatio), brskalnik, podpora color-mix(), vklopljeni izklopi (&brez=).
 * Izpis se osveži enkrat na sekundo (majhen element, ne moti meritve).
 */

type Zapis = { ime: string; zacetekMax: number; povprecje: number; slicic: number; trajanje: number };

export function Meritev({ ime, kljuc }: { ime: string; kljuc: string }) {
  const [izpis, setIzpis] = useState({ fps: 0, premor: 0, dolga: 0, dolgaMax: 0 });
  const [zapisi, setZapisi] = useState<Zapis[]>([]);
  const zdaj = useRef<{ ime: string; zacetek: number; max: number; n: number }>({ ime, zacetek: 0, max: 0, n: 0 });
  const dolga = useRef({ n: 0, max: 0 });

  // nov diapozitiv: zaključi prejšnjega
  useEffect(() => {
    const t = performance.now();
    const z = zdaj.current;
    if (z.zacetek && z.n > 1) {
      const trajanje = t - z.zacetek;
      const zapis = { ime: z.ime, zacetekMax: Math.round(z.max), povprecje: Math.round((z.n * 1000) / trajanje), slicic: z.n, trajanje: Math.round(trajanje / 1000) };
      setZapisi((s) => [zapis, ...s].slice(0, 6));
    }
    zdaj.current = { ime, zacetek: t, max: 0, n: 0 };
  }, [kljuc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let id = 0;
    let prej = performance.now();
    const okno: number[] = []; // časi sličic zadnji 2 s
    const premori: number[] = [];
    const tik = (t: number) => {
      const dt = t - prej;
      prej = t;
      okno.push(t);
      premori.push(dt);
      while (okno.length && t - okno[0] > 2000) {
        okno.shift();
        premori.shift();
      }
      const z = zdaj.current;
      z.n++;
      if (t - z.zacetek < 4000 && z.n > 1) z.max = Math.max(z.max, dt);
      id = requestAnimationFrame(tik);
    };
    id = requestAnimationFrame(tik);

    let opazovalec: PerformanceObserver | null = null;
    try {
      opazovalec = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          dolga.current.n++;
          dolga.current.max = Math.max(dolga.current.max, e.duration);
        }
      });
      opazovalec.observe({ entryTypes: ["longtask"] });
    } catch {
      // longtask ni podprt
    }

    const izpisi = setInterval(() => {
      const fps = okno.length > 1 ? ((okno.length - 1) * 1000) / (okno[okno.length - 1] - okno[0]) : 0;
      setIzpis({ fps: Math.round(fps), premor: Math.round(Math.max(0, ...premori.slice(1))), dolga: dolga.current.n, dolgaMax: Math.round(dolga.current.max) });
    }, 1000);
    return () => {
      cancelAnimationFrame(id);
      clearInterval(izpisi);
      opazovalec?.disconnect();
    };
  }, []);

  const [okolje] = useState(() =>
    typeof window === "undefined"
      ? ""
      : `${window.innerWidth} × ${window.innerHeight} · dpr ${window.devicePixelRatio} · ${brskalnik(navigator.userAgent)} · color-mix ${typeof CSS !== "undefined" && CSS.supports?.("color", "color-mix(in srgb, red 50%, white)") ? "DA" : "NE"}`,
  );
  const [ua] = useState(() => (typeof navigator === "undefined" ? "" : navigator.userAgent));
  const izklop = izklopi();
  const barva = (fps: number) => (fps >= 45 ? "#4ade80" : fps >= 25 ? "#facc15" : "#f87171");
  const barvaPremora = (ms: number) => (ms <= 40 ? "#4ade80" : ms <= 100 ? "#facc15" : "#f87171");

  return (
    <div className="pointer-events-none absolute left-[770px] top-[16px] z-[50] w-[750px] rounded-[16px] bg-black/85 px-5 py-3 font-mono text-[18px] leading-[1.35] text-white">
      <div className="flex flex-wrap gap-x-8">
        <span>
          sl./s <b style={{ color: barva(izpis.fps) }}>{izpis.fps}</b>
        </span>
        <span>
          najdaljši premor <b style={{ color: barvaPremora(izpis.premor) }}>{izpis.premor} ms</b>
        </span>
        <span>
          JS &gt;50 ms <b>{izpis.dolga}</b> (najdlje {izpis.dolgaMax} ms)
        </span>
      </div>
      <div className="text-[#b5b5bb]">{okolje}</div>
      {izklop.length > 0 && <div className="text-[#facc15]">brez: {izklop.join(", ")}</div>}
      <div className="mt-2 text-[#9a9aa1]">zdaj: {ime}</div>
      {zapisi.map((z, j) => (
        <div key={j} className="truncate">
          <span style={{ color: barvaPremora(z.zacetekMax) }}>začetek {z.zacetekMax} ms</span> · <span style={{ color: barva(z.povprecje) }}>{z.povprecje} sl./s</span> · {z.trajanje} s · {z.ime}
        </div>
      ))}
      <div className="mt-1 break-all text-[13px] text-[#6b6b72]">{ua}</div>
    </div>
  );
}
