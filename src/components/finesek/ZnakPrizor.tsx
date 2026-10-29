"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion } from "motion/react";
import { Znak } from "../Znak";
import { Finesek, PLATNO, type Pogled, type Poza } from "./Finesek";
import { useAnimacije } from "@/lib/animacije";

/**
 * Znak FIN:OS na domači strani s Finesekom (cikel 3 min):
 * FIN:OS ugasne → Finesek priteče z leve, potegne stikalo → FIN:OS zasveti (utripne, tok preleti spodaj)
 * → Finesek poskoči, se nasloni na znak in pomaha → steče naprej čez zaslon na desno → FIN:OS počasi ugasne.
 */
const CIKEL_MS = 180000;
const UGASNJEN = "grayscale(1) brightness(0.32) drop-shadow(0 0 0px rgba(238,122,58,0))";
const PRIZGAN = "grayscale(0) brightness(1) drop-shadow(0 0 26px rgba(238,122,58,0.55))";
// spodnji rob črk je nad spodnjim robom vrstice (delež višine znaka) - tam so "tla"
const TLA = 0.08;
const NAPOL ="grayscale(0.6) brightness(0.55) drop-shadow(0 0 6px rgba(238,122,58,0.2))";

type Mere = { s: number; zH: number; sw: number; sh: number; levo: number; sirina: number };

const cakaj = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ZnakPrizor({ className = "" }: { className?: string }) {
  const okvir = useRef<HTMLDivElement>(null);
  const znak = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const rocica = useRef<HTMLSpanElement>(null);
  const lucka = useRef<HTMLSpanElement>(null);
  const tok = useRef<HTMLSpanElement>(null);
  const mere = useRef<Mere | null>(null);

  const [m, setM] = useState<Mere | null>(null);
  const [pogled, setPogled] = useState<Pogled>("stran");
  const [poza, setPoza] = useState<Poza>("tek");
  const [iskre, setIskre] = useState(0);
  const animacije = useAnimacije();

  // mere: velikost Fineseka in stikala glede na velikost znaka
  useEffect(() => {
    const izmeri = () => {
      const o = okvir.current?.getBoundingClientRect();
      if (!o) return;
      const ozko = window.innerWidth < 640;
      const zH = o.height;
      const visina = zH * (ozko ? 1 : 1.12); // vidna višina Fineseka (640 enot)
      const sw = zH * 0.24;
      // ob stikalu mora biti ves na zaslonu (na telefonu je levo od znaka malo prostora)
      const prostor = (o.left - sw - 12 - 8) / (PLATNO.teloDesno - 20);
      const nm = { s: Math.min(visina / 640, prostor), zH, sw, sh: zH * 0.42, levo: o.left, sirina: window.innerWidth };
      mere.current = nm;
      setM(nm);
    };
    izmeri();
    const ro = new ResizeObserver(izmeri);
    if (okvir.current) ro.observe(okvir.current);
    window.addEventListener("resize", izmeri);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", izmeri);
    };
  }, []);

  // potek prizora
  useEffect(() => {
    const prizgi = () => znak.current && animate(znak.current, { filter: PRIZGAN, opacity: 1 }, { duration: 0.4 });
    // brez dodatnih animacij: ni Fineseka, FIN:OS ostane prižgan
    if (!animacije || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      prizgi();
      return;
    }
    let ziv = true;

    const pozicije = () => {
      const mm = mere.current!;
      const sirinaRig = PLATNO.w * mm.s;
      return {
        zacetek: -mm.levo - sirinaRig - 40,
        stikalo: -mm.sw - 8 - 4 - PLATNO.teloDesno * mm.s,
        konec: mm.sirina - mm.levo + 60,
      };
    };

    const stikalo = (vklop: boolean, trajanje = 0.18) => {
      if (rocica.current) animate(rocica.current, { rotate: vklop ? 38 : -38 }, { duration: trajanje, ease: "backOut" });
      if (lucka.current)
        animate(
          lucka.current,
          { backgroundColor: vklop ? "#ee7a3a" : "#3a3a3f", boxShadow: vklop ? "0 0 10px 2px rgba(238,122,58,0.9)" : "0 0 0 0 rgba(0,0,0,0)" },
          { duration: trajanje },
        );
    };

    const cikel = async (prvi: boolean) => {
      if (prvi) {
        await cakaj(2600);
        if (!ziv || !znak.current) return;
        await animate(znak.current, { filter: UGASNJEN, opacity: 0.6 }, { duration: 2.2, ease: "easeIn" });
        stikalo(false, 0.01);
        await cakaj(500);
      }
      const z = znak.current;
      const r = rig.current;
      if (!ziv || !z || !r || !mere.current) return;

      // 1) priteče z leve do stikala
      let p = pozicije();
      setPogled("stran");
      setPoza("tek");
      r.style.visibility = "visible";
      animate(r, { x: p.zacetek, y: 0, rotate: 0 }, { duration: 0 });
      await animate(r, { x: p.stikalo }, { duration: 2.1, ease: [0.2, 0, 0.45, 1] });
      if (!ziv) return;

      // 2) obrne se in potegne stikalo
      setPogled("spredaj");
      setPoza("stoji");
      await cakaj(380);
      setPoza("seze");
      await cakaj(480);
      if (!ziv) return;
      setPoza("vlece");
      stikalo(true);
      await cakaj(120);

      // 3) FIN:OS zasveti (utripanje kot neon) + tok + iskre
      setIskre((n) => n + 1);
      if (tok.current) animate(tok.current, { scaleX: [0, 1, 1], opacity: [1, 1, 0] }, { duration: 1.1, times: [0, 0.55, 1], ease: "easeOut" });
      await animate(
        z,
        { filter: [UGASNJEN, PRIZGAN, NAPOL, PRIZGAN, UGASNJEN, PRIZGAN], opacity: [0.6, 1, 0.8, 1, 0.65, 1] },
        { duration: 0.95, times: [0, 0.15, 0.3, 0.5, 0.62, 1], ease: "linear" },
      );
      if (!ziv) return;

      // 4) veselje, nasloni se na znak in pomaha
      setPoza("veselje");
      await animate(r, { y: [0, -70 * mere.current!.s, 0] }, { duration: 0.5, ease: "easeOut" });
      if (!ziv) return;
      setPoza("maha");
      animate(r, { rotate: 7, x: pozicije().stikalo + 6 * mere.current!.s }, { duration: 0.45, ease: "easeOut" });
      await cakaj(3900);
      if (!ziv) return;
      await animate(r, { rotate: 0 }, { duration: 0.25 });

      // 5) steče naprej čez zaslon na desno
      setPoza("stoji");
      await cakaj(200);
      setPogled("stran");
      setPoza("tek");
      p = pozicije();
      const pot = p.konec - p.stikalo;
      await animate(r, { x: p.konec }, { duration: Math.max(1.6, pot / 520), ease: [0.4, 0, 1, 1] });
      r.style.visibility = "hidden";
      if (!ziv) return;

      // 6) FIN:OS počasi ugasne (na koncu še malo pomežikne)
      await cakaj(3000);
      if (!ziv) return;
      await animate(z, { filter: NAPOL, opacity: 0.8 }, { duration: 8, ease: "easeIn" });
      if (!ziv) return;
      await animate(z, { filter: [NAPOL, PRIZGAN, NAPOL, UGASNJEN], opacity: [0.8, 0.95, 0.75, 0.6] }, { duration: 0.9, times: [0, 0.2, 0.45, 1] });
      stikalo(false, 0.3);
    };

    (async () => {
      let prvi = true;
      while (ziv) {
        const t0 = Date.now();
        await cikel(prvi);
        prvi = false;
        await cakaj(Math.max(0, CIKEL_MS - (Date.now() - t0)));
      }
    })();
    return () => {
      ziv = false;
      prizgi();
    };
  }, [animacije]);

  return (
    <div ref={okvir} className={`relative inline-block ${className}`}>
      <div ref={znak} style={{ filter: PRIZGAN }}>
        <Znak zlozi zamik={0.1} />
      </div>

      {/* tok, ki preleti pod znakom ob vklopu */}
      <span
        ref={tok}
        aria-hidden
        className="pointer-events-none absolute -bottom-2 left-0 h-[3px] w-full origin-left rounded-full bg-[linear-gradient(90deg,#ee7a3a,#fff_50%,#ee7a3a)] opacity-0 shadow-[0_0_18px_4px_rgb(238_122_58/0.8)]"
      />

      {m && animacije && (
        <>
          {/* stikalo levo ob znaku */}
          <div
            title="Stikalo za FIN:OS - prižge ga Finesek"
            className="absolute rounded-[0.25em] border border-white/15 bg-[linear-gradient(160deg,#4d4d53,#1c1c1f)] shadow-[0_8px_20px_-6px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.15)]"
            style={{ left: -m.sw - 8, bottom: m.zH * TLA, width: m.sw, height: m.sh, fontSize: m.sw }}
          >
            <span ref={lucka} className="absolute left-1/2 top-[12%] h-[0.16em] w-[0.16em] -translate-x-1/2 rounded-full bg-ink-700" />
            <span className="absolute left-1/2 top-[58%] h-[0.34em] w-[0.34em] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-950 shadow-[inset_0_1px_2px_rgb(0_0_0/0.8)]" />
            <motion.span
              ref={rocica}
              className="absolute top-[58%] h-[0.62em] w-[0.12em] rounded-full bg-[linear-gradient(90deg,#9a9aa1,#eeeef0,#9a9aa1)]"
              style={{ left: "calc(50% - 0.06em)", transformOrigin: "50% 0%", rotate: -38 }}
            >
              <span className="fos-fines-fill absolute -bottom-[0.1em] left-1/2 h-[0.22em] w-[0.22em] -translate-x-1/2 rounded-full" />
            </motion.span>
            {/* iskre */}
            {iskre > 0 &&
              Array.from({ length: 10 }, (_, i) => {
                const kot = (i / 10) * Math.PI * 2;
                return (
                  <motion.span
                    key={`${iskre}-${i}`}
                    aria-hidden
                    className="absolute left-1/2 top-[70%] h-[0.08em] w-[0.08em] rounded-full bg-fines-200 shadow-[0_0_6px_2px_rgb(238_122_58/0.9)]"
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: Math.cos(kot) * m.sw * 1.4, y: Math.sin(kot) * m.sw * 1.4 - m.sw * 0.4, opacity: 0, scale: 0.3 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                );
              })}
          </div>

          {/* Finesek */}
          <div
            ref={rig}
            title="Finesek - maskota Fines"
            className="pointer-events-auto absolute z-10"
            style={{ left: 0, bottom: m.zH * TLA - (PLATNO.h - 748) * m.s, visibility: "hidden", transformOrigin: `${PLATNO.teloDesno * m.s}px 100%` }}
          >
            <Finesek s={m.s} pogled={pogled} poza={poza} />
          </div>
        </>
      )}
    </div>
  );
}
