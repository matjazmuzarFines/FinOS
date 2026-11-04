"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Building2, Hourglass, UserRound, Users } from "lucide-react";
import { Znak } from "@/components/Znak";
import { MePrizor, type VrstaPrizora } from "@/components/finesek/MePrizori";
import { useAnimacije } from "@/lib/animacije";
import type { MeVstop } from "@/lib/nav";
import { polnoIme } from "@/lib/zaposleni";
import type { Jaz } from "./Jaz";

/** Značka ob ikoni: čaka (moji oddani zahtevki) ali za potrditev (vodja). */
export type Znacka = {
  stevilo: number;
  besedilo: string;
  hint: string;
  ton: "caka" | "potrdi";
};

/** Ikone na krogu: diagonalno (zgoraj levo, zgoraj desno, spodaj desno, spodaj levo) - enakomeren razmik. */
const KOTI = [-135, -45, 45, 135];
const PRIZOR: Record<string, VrstaPrizora> = {
  "/moj-fines/cas": "cas",
  "/moj-fines/odsotnosti": "odsotnosti",
  "/moj-fines/dovolilnice": "dovolilnice",
  "/moj-fines/popravki": "popravki",
};
/** Oblaček ikone: širina in odmiki (px). Ob strani ikone, nikoli navzdol čez zaslon. */
const OBLACEK = 240;
const ROB = 8;
const GLAVA = 76;
type Mesto = {
  levo: number;
  vrh?: number;
  dno?: number;
  stran: "levo" | "desno";
  zgoraj: boolean;
};

/**
 * Mesto oblačka: desne ikone (Odsotnosti, Dovolilnice) desno od ikone in naslova, leve (Moj čas, Popravki) levo;
 * zgornje poravnane navzgor (rastejo navzdol), spodnje poravnane na dno (rastejo navzgor) - brez drsenja strani.
 * Če na želeni strani ni prostora, gre na drugo stran.
 */
function izracunajMesto(r: DOMRect, levo: boolean, zgoraj: boolean): Mesto {
  const W = window.innerWidth;
  const prostorL = r.left - 16 - ROB;
  const prostorD = W - r.right - 16 - ROB;
  let stran: Mesto["stran"] = levo ? "levo" : "desno";
  if (stran === "levo" && prostorL < OBLACEK && prostorD > prostorL)
    stran = "desno";
  if (stran === "desno" && prostorD < OBLACEK && prostorL > prostorD)
    stran = "levo";
  const x = Math.max(
    ROB,
    Math.min(
      stran === "levo" ? r.left - 16 - OBLACEK : r.right + 16,
      W - OBLACEK - ROB,
    ),
  );
  return zgoraj
    ? { levo: x, vrh: Math.max(GLAVA, r.top - 6), stran, zgoraj }
    : {
        levo: x,
        dno: Math.max(ROB, window.innerHeight - r.bottom - 6),
        stran,
        zgoraj,
      };
}

const TRESI = {
  scale: 1.18,
  rotate: [0, -9, 8, -5, 3, 0],
  transition: {
    rotate: { duration: 0.55 },
    scale: { type: "spring" as const, stiffness: 400, damping: 14 },
  },
};

/**
 * Vstop FIN:ME: velik krog s tanko prekinjeno črto, na sredini znak FIN:ME, na krožnici ikone strani z naslovom.
 * Hover na ikono: ikona se strese in poveča, ob njej oblaček s ključnimi besedami, na sredini (namesto znaka) prizor
 * Fineseka za to stran (samo z vklopljenimi animacijami). Hover na znak: znak se strese, oblaček s podatki o meni.
 */
export function MeKrog({
  vstopi,
  znacke,
  j,
  stevci,
  zacetno = null,
}: {
  vstopi: MeVstop[];
  znacke: (href: string) => Znacka[];
  j: Jaz;
  stevci: { moji: number; ekipa: number };
  /** Samo za preizkus prikaza. */ zacetno?: string | null;
}) {
  const [aktiven, setAktiven] = useState<string | null>(zacetno);
  const [mesto, setMesto] = useState<Mesto | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // samo za preizkus prikaza (zacetno): oblaček izbrane ikone ob nalaganju
  useEffect(() => {
    if (!zacetno) return;
    const i = vstopi.findIndex((v) => v.href === zacetno);
    const el = document.querySelector(`[data-vstop="${zacetno}"]`);
    const kot = (KOTI[i % KOTI.length] * Math.PI) / 180;
    const t = setTimeout(() => el && setMesto(izracunajMesto(el.getBoundingClientRect(), Math.cos(kot) < 0, Math.sin(kot) < 0)), 300);
    return () => clearTimeout(t);
  }, [zacetno, vstopi]);
  // ob drsenju se oblaček skrije (je pritrjen na zaslon)
  useEffect(() => {
    if (!aktiven) return;
    const skrij = () => setAktiven(null);
    window.addEventListener("scroll", skrij, { passive: true });
    return () => window.removeEventListener("scroll", skrij);
  }, [aktiven]);
  const [znak, setZnak] = useState(false);
  const animacije = useAnimacije();
  const manjGibanja = useReducedMotion();
  const prizor = aktiven && animacije && !manjGibanja ? PRIZOR[aktiven] : null;

  return (
    // na širokem zaslonu krog bližje Delovni uri - levo ostane prostor za oblačke levih ikon
    <div className="relative mx-auto mb-6 mt-4 aspect-square w-[min(34rem,calc(100vw-5rem))] sm:mt-8 lg:ml-auto lg:mr-6">
      {/* krog: sij, prekinjena črta (počasi se vrti), notranji pikčast krog */}
      <span
        aria-hidden
        className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgb(238_122_58/0.16),transparent)]"
      />
      <motion.svg
        viewBox="0 0 100 100"
        className="me-krog fos-deko absolute inset-0 h-full w-full overflow-visible"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="me-krog-crta" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f19a66" />
            <stop offset="0.5" stopColor="#ca5010" stopOpacity="0.5" />
            <stop offset="1" stopColor="#f19a66" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="49.6"
          fill="none"
          stroke="url(#me-krog-crta)"
          strokeWidth="0.35"
          strokeDasharray="2.2 1.6"
        />
      </motion.svg>
      <span
        aria-hidden
        className="absolute inset-[18%] rounded-full border border-dotted border-white/10"
      />

      {/* sredina: znak FIN:ME ali prizor Fineseka */}
      <div className="absolute inset-[22%] grid place-items-center">
        <AnimatePresence mode="popLayout">
          {prizor ? (
            <motion.div
              key={prizor}
              initial={{ opacity: 0, scale: 0.6, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="pointer-events-none"
            >
              <MePrizor vrsta={prizor} h={108} />
            </motion.div>
          ) : (
            <motion.button
              key="znak"
              type="button"
              title="Moj Fines - kdo sem in kaj čaka"
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={TRESI}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 16,
                delay: aktiven === null ? 0.2 : 0,
              }}
              onPointerEnter={(e) => e.pointerType === "mouse" && setZnak(true)}
              onPointerLeave={() => setZnak(false)}
              onFocus={() => setZnak(true)}
              onBlur={() => setZnak(false)}
              className="flex cursor-default flex-col items-center gap-1 rounded-full p-4 outline-none focus-visible:ring-2 focus-visible:ring-fines-400"
            >
              <span className="font-display text-lg font-bold text-white sm:text-2xl">
                Živijo, {j.jaz.ime}!
              </span>
              <Znak pripona="ME" className="text-[clamp(2.2rem,8vw,4rem)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-ink-400">
                Klikni ikono
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* oblaček znaka: kdo sem */}
      <AnimatePresence>
        {znak && !aktiven && (
          <Oblacek
            key="znak"
            className="absolute left-1/2 top-[64%] w-[min(19rem,80vw)] -translate-x-1/2"
            izvor="top center"
          >
            <p className="font-display text-lg font-bold text-white">
              {polnoIme(j.jaz)}
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-200">
              <Vrsta
                ikona={Building2}
                besedilo={j.jaz.oddelek?.ime_oddelka ?? "Brez oddelka"}
              />
              <Vrsta
                ikona={UserRound}
                besedilo={
                  j.jaz.vodja
                    ? `Vodja: ${polnoIme(j.jaz.vodja)}`
                    : "Nimaš vodje"
                }
              />
              {j.vodja && (
                <Vrsta
                  ikona={Users}
                  besedilo={`Tvoja ekipa: ${j.ekipa.length}`}
                />
              )}
              <Vrsta
                ikona={Hourglass}
                besedilo={
                  stevci.moji
                    ? `Čaka na vodjo: ${stevci.moji}`
                    : "Nič ne čaka na vodjo"
                }
              />
              {j.vodja && (
                <Vrsta
                  ikona={Hourglass}
                  besedilo={
                    stevci.ekipa
                      ? `Ti potrdiš: ${stevci.ekipa}`
                      : "Nič ne čaka na tvojo potrditev"
                  }
                  poudari={stevci.ekipa > 0}
                />
              )}
            </ul>
          </Oblacek>
        )}
      </AnimatePresence>

      {/* ikone na krožnici */}
      {vstopi.map((v, i) => {
        const kot = (KOTI[i % KOTI.length] * Math.PI) / 180;
        const levo = Math.cos(kot) < 0;
        const zgoraj = Math.sin(kot) < 0;
        const z = znacke(v.href);
        const odprt = aktiven === v.href;
        return (
          <div
            key={v.href}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${odprt ? "z-30" : "z-10"}`}
            style={{
              left: `${50 + 50 * Math.cos(kot)}%`,
              top: `${50 + 50 * Math.sin(kot)}%`,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 15,
                delay: 0.35 + i * 0.1,
              }}
            >
              <Link
                href={v.href}
                data-vstop={v.href}
                title={v.hint}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "mouse") return;
                  setMesto(
                    izracunajMesto(
                      e.currentTarget.getBoundingClientRect(),
                      levo,
                      zgoraj,
                    ),
                  );
                  setAktiven(v.href);
                }}
                onPointerLeave={() => setAktiven(null)}
                onFocus={(e) => {
                  setMesto(
                    izracunajMesto(
                      e.currentTarget.getBoundingClientRect(),
                      levo,
                      zgoraj,
                    ),
                  );
                  setAktiven(v.href);
                }}
                onBlur={() => setAktiven(null)}
                className={`group relative flex flex-col items-center gap-2 outline-none sm:flex-row ${levo ? "sm:flex-row-reverse" : ""}`}
              >
                <motion.span
                  animate={odprt ? TRESI : { scale: 1, rotate: 0 }}
                  className="fos-fines-fill relative grid h-16 w-16 place-items-center rounded-full text-snow shadow-[0_0_0_6px_var(--color-ink-950),0_0_0_7px_rgb(238_122_58/0.35),0_14px_30px_-10px_rgb(202_80_16/0.9)] group-focus-visible:ring-2 group-focus-visible:ring-fines-400 sm:h-20 sm:w-20"
                >
                  <v.icon className="h-7 w-7 sm:h-9 sm:w-9" aria-hidden />
                  <span className="fos-shine absolute inset-0 overflow-hidden rounded-full" />
                  {z.length > 0 && (
                    <span
                      title={z.map((x) => x.hint).join(" · ")}
                      className={`absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold shadow-[0_0_12px_rgb(0_0_0/0.5)] ${z[0].ton === "potrdi" ? "bg-snow text-fines-700" : "bg-warn-500 text-coal"}`}
                    >
                      {z.map((x) => x.stevilo).join("+")}
                    </span>
                  )}
                </motion.span>
                <span
                  className={`whitespace-nowrap rounded-full bg-ink-950/85 px-2 font-display text-base font-bold transition-colors sm:text-xl ${odprt ? "text-fines-300" : "text-white"}`}
                >
                  {v.naslov}
                </span>
              </Link>
            </motion.div>

            {mounted &&
              createPortal(
                <AnimatePresence>
                  {odprt && mesto && (
                    <Oblacek
                      className="fixed hidden sm:block"
                      slog={{
                        left: mesto.levo,
                        top: mesto.vrh,
                        bottom: mesto.dno,
                        width: OBLACEK,
                      }}
                      izvor={`${mesto.zgoraj ? "top" : "bottom"} ${mesto.stran === "levo" ? "right" : "left"}`}
                    >
                      <p className="font-display text-lg font-bold text-white">
                        {v.naslov}
                      </p>
                      <p className="text-sm text-ink-300">{v.opis}</p>
                      <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-fines-400">
                        Tukaj lahko
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {v.kljucne.map((k, x) => (
                          <motion.li
                            key={k.besedilo}
                            initial={{
                              opacity: 0,
                              x: mesto.stran === "levo" ? -8 : 8,
                            }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 + x * 0.04 }}
                            className="flex items-center gap-2.5 text-sm font-semibold text-ink-100"
                          >
                            <span className="fos-fines-fill grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-snow">
                              <k.ikona className="h-4 w-4" aria-hidden />
                            </span>
                            {k.besedilo}
                          </motion.li>
                        ))}
                      </ul>
                      {z.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {z.map((x) => (
                            <span
                              key={x.besedilo}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${x.ton === "potrdi" ? "bg-fines-500/20 text-fines-200" : "bg-warn-500/15 text-warn-500"}`}
                            >
                              {x.besedilo}
                            </span>
                          ))}
                        </div>
                      )}
                    </Oblacek>
                  )}
                </AnimatePresence>,
                document.body,
              )}
          </div>
        );
      })}
    </div>
  );
}

function Oblacek({
  children,
  className,
  izvor,
  slog,
}: {
  children: ReactNode;
  className: string;
  izvor: string;
  slog?: CSSProperties;
}) {
  return (
    <motion.div
      role="tooltip"
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      style={{ transformOrigin: izvor, ...slog }}
      className={`fos-popup pointer-events-none z-40 rounded-[18px] p-3.5 ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,#ee7a3a,transparent)]"
      />
      {children}
    </motion.div>
  );
}

function Vrsta({
  ikona: I,
  besedilo,
  poudari,
}: {
  ikona: typeof Users;
  besedilo: string;
  poudari?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2 ${poudari ? "font-bold text-fines-200" : ""}`}
    >
      <I className="h-4 w-4 shrink-0 text-fines-300" aria-hidden />
      {besedilo}
    </li>
  );
}
