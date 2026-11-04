"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Check, CreditCard, Hourglass, MousePointer2, Send } from "lucide-react";
import { Ozadje } from "@/components/Ozadje";
import { Znak } from "@/components/Znak";
import { Finesek, type Poza, type Pogled } from "@/components/finesek/Finesek";
import { MeKrog } from "@/components/me/MeKrog";
import { DelovnaUra } from "@/components/me/DelovnaUra";
import type { Jaz } from "@/components/me/Jaz";
import { KrmilnikPredogled } from "@/components/cas/KrmilnikPredogled";
import { Koledar } from "@/components/cas/Koledar";
import { IkonaStatistike } from "@/components/cas/Skupno";
import { Avatar } from "@/components/ui/Avatar";
import { dneviMeseca, izracunajDan } from "@/lib/cas";
import { useCasNastavitve } from "@/lib/casNastavitve";
import { testniDan, testniUrnik } from "@/lib/casTest";
import { ME_VSTOPI } from "@/lib/nav";

/**
 * Promo video "Moj Fines" (teaser za zaposlene, 42 s, 1920 × 1080). Vse je izračunano iz časa t (ms) - vsako sličico
 * se da ponoviti: render (scripts/promo) kliče window.__promo(t) in posname zaslon. Brez ?render=1 se predvaja sam.
 * Podatki so izmišljeni (Matej Novak, vodja Ana Kovač). Glasba: data/ (ffmpeg jo doda pri sestavi).
 */
export const TRAJANJE = 42_000;
const W = 1920;
const H = 1080;
export const ID_PROMO = 3;

// ---------------------------------------------------------------------------------------------------------------
// čas in gibanje
// ---------------------------------------------------------------------------------------------------------------
const omeji = (x: number) => Math.max(0, Math.min(1, x));
const del = (t: number, od: number, trajanje: number) => omeji((t - od) / trajanje);
const izhod = (x: number) => 1 - Math.pow(1 - x, 3);
const odskok = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

/** Pojav elementa ob času od: prosojnost, premik, povečava, zamegljenost. */
function pojav(t: number, od: number, o: { dur?: number; x?: number; y?: number; s?: number; blur?: number; izginiOd?: number } = {}): CSSProperties {
  const { dur = 650, x = 0, y = 34, s = 1, blur = 10, izginiOd } = o;
  const p = del(t, od, dur);
  const e = odskok(p);
  const ven = izginiOd != null ? del(t, izginiOd, 350) : 0;
  return {
    opacity: izhod(p) * (1 - ven),
    transform: `translate(${x * (1 - e)}px, ${y * (1 - e) - ven * 20}px) scale(${lerp(s, 1, e)})`,
    filter: blur && p < 1 ? `blur(${blur * (1 - izhod(p))}px)` : undefined,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// skupno
// ---------------------------------------------------------------------------------------------------------------
/** Prizor: viden med od in do, pretapljanje 400 ms; vsebina se naloži 1,5 s prej (podatki). */
function Prizor({ t, od, do: doo, children, zoom = true }: { t: number; od: number; do: number; children: ReactNode; zoom?: boolean }) {
  if (t < od - 1500 || t > doo + 100) return null;
  const vh = del(t, od, 450);
  const iz = del(t, doo - 420, 420);
  const s = zoom ? lerp(1.04, 1, izhod(vh)) + iz * 0.03 : 1;
  return (
    <div className="absolute inset-0" style={{ opacity: t < od ? 0 : izhod(vh) * (1 - iz), transform: `scale(${s})`, pointerEvents: "none" }}>
      {children}
    </div>
  );
}

/** Napis: nadnaslov (oranžen), velik naslov, ključne besede kot čipi (zaporedno). */
function Napis({ t, od, nad, naslov, kljucne = [], className = "", sredina }: { t: number; od: number; nad?: string; naslov: ReactNode; kljucne?: string[]; className?: string; sredina?: boolean }) {
  return (
    <div className={`absolute flex flex-col gap-5 ${sredina ? "items-center text-center" : ""} ${className}`}>
      {nad && (
        <span className="flex items-center gap-3 text-[22px] font-bold uppercase tracking-[0.3em] text-fines-400" style={pojav(t, od, { y: 16, blur: 0 })}>
          <span className="h-[3px] w-10 rounded-full bg-[linear-gradient(90deg,#f19a66,#ca5010)]" />
          {nad}
        </span>
      )}
      <h2 className="font-display text-[76px] font-bold leading-[1.02] tracking-tight text-white" style={pojav(t, od + 120, { y: 40, blur: 14 })}>
        {naslov}
      </h2>
      {kljucne.length > 0 && (
        <div className={`flex flex-wrap gap-3 ${sredina ? "justify-center" : ""}`}>
          {kljucne.map((k, i) => (
            <span
              key={k}
              className="flex items-center gap-2.5 rounded-full border border-fines-400/40 bg-fines-500/15 px-5 py-2.5 text-[24px] font-semibold text-white shadow-[0_0_30px_-10px_rgb(238_122_58/0.9)]"
              style={pojav(t, od + 520 + i * 170, { y: 24, s: 0.8, blur: 0 })}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-fines-400 shadow-[0_0_10px_#ee7a3a]" />
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const JAZ = {
  jaz: { id: ID_PROMO, ime: "Matej", priimek: "Novak", oddelek: { id: 1, ime_oddelka: "Proizvodnja" }, vodja: { id: 9, ime: "Ana", priimek: "Kovač" } },
  ekipa: [],
  vodja: false,
  ogled: false,
  podatki: { poId: new Map() },
} as unknown as Jaz;

const ura = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------------------------------------------
// 1. uvod: FIN:OS se sestavi (0 - 4 s)
// ---------------------------------------------------------------------------------------------------------------
const ODMIKI = [
  { x: -620, y: -260, r: -70, s: 2.4 },
  { x: -180, y: 380, r: 40, s: 0.3 },
  { x: 260, y: -420, r: 120, s: 2 },
  { x: 520, y: 300, r: 80, s: 2.2 },
  { x: 700, y: -220, r: -40, s: 0.5 },
];

function Uvod({ t }: { t: number }) {
  const crke = [
    { c: "F", cls: "fos-text-grad" },
    { c: "I", cls: "fos-text-grad" },
    { c: "N", cls: "fos-text-grad" },
    { c: "O", cls: "fos-text-fines" },
    { c: "S", cls: "fos-text-fines" },
  ];
  const val = del(t, 1650, 1300);
  const crta = izhod(del(t, 1850, 650));
  const razmik = izhod(del(t, 2150, 1000));
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative flex flex-col items-center">
        {/* val in sij */}
        <span className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fines-400" style={{ width: lerp(100, 1500, val), height: lerp(100, 1500, val), opacity: (1 - val) * (t > 1650 ? 0.8 : 0) }} />
        <span className="absolute left-1/2 top-[45%] h-[600px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(238_122_58/0.35),transparent)]" style={{ opacity: izhod(del(t, 1600, 900)) }} />
        <div className="relative flex items-center font-display text-[260px] font-bold leading-none tracking-[-0.04em]">
          {crke.map((c, i) => {
            const od = 250 + i * 110;
            const p = del(t, od, 950);
            const e = odskok(p);
            const o = ODMIKI[i];
            const el = (
              <span
                key={c.c}
                className={`inline-block ${c.cls}`}
                style={{ opacity: izhod(del(t, od, 350)), transform: `translate(${o.x * (1 - e)}px, ${o.y * (1 - e)}px) rotate(${o.r * (1 - e)}deg) scale(${lerp(o.s, 1, e)})`, filter: p < 1 ? `blur(${14 * (1 - izhod(p))}px)` : undefined }}
              >
                {c.c}
              </span>
            );
            if (i !== 3) return el;
            return (
              <span key="dvopicje" className="flex items-center">
                <span className="mx-[0.06em] inline-flex flex-col justify-center gap-[0.17em] pt-[0.05em]">
                  {[0, 1].map((k) => {
                    const p2 = del(t, 1150 + k * 140, 520);
                    const pad = p2 < 0.6 ? Math.pow(p2 / 0.6, 2) : 1 - Math.sin(((p2 - 0.6) / 0.4) * Math.PI) * 0.12;
                    return <span key={k} className="fos-fines-fill block h-[0.15em] w-[0.15em] rounded-[0.035em] shadow-[0_0_30px_#ee7a3a]" style={{ opacity: p2 > 0 ? 1 : 0, transform: `translateY(${(1 - pad) * -700}px)` }} />;
                  })}
                </span>
                {el}
              </span>
            );
          })}
        </div>
        <span className="mt-4 h-[5px] rounded-full bg-[linear-gradient(90deg,transparent,#ee7a3a,transparent)]" style={{ width: lerp(0, 900, crta), opacity: crta }} />
        <span className="mt-7 font-display text-[40px] font-semibold uppercase text-ink-200" style={{ letterSpacing: `${lerp(1.2, 0.32, razmik)}em`, opacity: razmik }}>
          Fines Operating System
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Finesek prižge FIN:ME (4 - 10 s)
// ---------------------------------------------------------------------------------------------------------------
function Prizig({ t }: { t: number }) {
  const PRIHOD = 4200;
  const STOP = 5900;
  const PRIZIG = 6300;
  const tek = t < STOP;
  const x = lerp(-420, 110, izhod(del(t, PRIHOD, STOP - PRIHOD)));
  let pogled: Pogled = "stran";
  let poza: Poza = "tek";
  if (!tek) {
    pogled = "spredaj";
    poza = t < PRIZIG + 100 ? "seze" : t < 7800 ? "veselje" : "maha";
  }
  // neonski prižig: utripanje, nato sveti
  const utrip = [0, 1, 0, 1, 1, 0, 1];
  const fazaUtripa = Math.floor((t - PRIZIG) / 80);
  const sveti = t < PRIZIG ? 0 : fazaUtripa < utrip.length ? utrip[fazaUtripa] : 1;
  const sij = izhod(del(t, PRIZIG + 560, 700));
  const val = del(t, PRIZIG + 560, 1100);
  return (
    <div className="absolute inset-0">
      <div className="absolute left-1/2 top-[300px] -translate-x-1/2">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fines-400" style={{ width: lerp(200, 1600, val), height: lerp(120, 900, val), opacity: (1 - val) * (val > 0 ? 0.7 : 0) }} />
        <span className="absolute left-1/2 top-1/2 h-[520px] w-[1200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(238_122_58/0.32),transparent)]" style={{ opacity: sij }} />
        <div style={{ filter: sveti ? `drop-shadow(0 0 ${30 * sij}px rgb(238 122 58 / 0.6))` : "grayscale(1) brightness(0.32)", transition: "none" }}>
          <Znak pripona="ME" className="text-[230px]" />
        </div>
      </div>
      {/* Finesek */}
      <div className="absolute bottom-[50px]" style={{ left: x }}>
        <Finesek s={0.46} pogled={pogled} poza={poza} />
      </div>
      <Napis
        t={t}
        od={6950}
        sredina
        className="left-1/2 top-[640px] w-[1250px] -translate-x-1/2"
        naslov={
          <>
            Prihaja <b>Moj Fines</b>
          </>
        }
        kljucne={["Moj čas", "Odsotnosti", "Dovolilnice", "Popravki", "Delovna ura"]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 3. krog Moj Fines (10 - 19,5 s)
// ---------------------------------------------------------------------------------------------------------------
const KROG = [
  { href: "/moj-fines/cas", od: 10600, naslov: "Moj čas", opis: "Vsak prihod, odhod in saldo ur – na dlani." },
  { href: "/moj-fines/odsotnosti", od: 12800, naslov: "Odsotnosti", opis: "Dopust, bolniška, očetovski – v nekaj klikih." },
  { href: "/moj-fines/dovolilnice", od: 15000, naslov: "Dovolilnice", opis: "Izhod med delom ali nadure – vodja odobri." },
  { href: "/moj-fines/popravki", od: 17200, naslov: "Popravki", opis: "Pozabil žig? Predlagaj popravek." },
];

function Krog({ t }: { t: number }) {
  const aktiven = [...KROG].reverse().find((k) => t >= k.od) ?? null;
  return (
    <div className="absolute inset-0">
      <div className="absolute left-1/2 top-[40px] w-[640px] -translate-x-1/2 scale-[1.32] origin-top">
        <MeKrog vstopi={ME_VSTOPI} j={JAZ} znacke={() => []} stevci={{ moji: 0, ekipa: 0 }} zacetno={aktiven?.href ?? null} />
      </div>
      {KROG.map((k) =>
        t >= k.od - 200 && t < k.od + 2200 ? (
          <div key={k.href} className="absolute bottom-[70px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-center">
            <span className="font-display text-[64px] font-bold leading-none fos-text-fines" style={pojav(t, k.od, { y: 26, izginiOd: k.od + 1850 })}>
              {k.naslov}
            </span>
            <span className="text-[34px] font-semibold text-ink-100" style={pojav(t, k.od + 140, { y: 20, izginiOd: k.od + 1850 })}>
              {k.opis}
            </span>
          </div>
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 4. odsotnost: oddaj -> vodja potrdi (19,5 - 24,5 s)
// ---------------------------------------------------------------------------------------------------------------
const RAZLOGI = [
  { ime: "Redni dopust", barva: "#0ea5e9", ikona: "tree-palm" },
  { ime: "Lanski dopust", barva: "#38bdf8", ikona: "sun" },
  { ime: "Bolniška", barva: "#b91c1c", ikona: "thermometer" },
  { ime: "Očetovski dopust", barva: "#6366f1", ikona: "baby" },
];

function Odsotnost({ t }: { t: number }) {
  const IZBERI = 20250;
  const DATUM = 20650;
  const POSLJI = 21250;
  const ODDANO = 21650;
  const VODJA = 22350;
  const POTRDI = 22950;
  const potrjeno = t >= POTRDI + 150;
  const obrazecVen = del(t, ODDANO - 150, 450);
  const pritisk = (od: number) => (t >= od && t < od + 160 ? 0.94 : 1);
  return (
    <div className="absolute inset-0">
      <Napis t={t} od={19650} nad="Odsotnosti" className="left-[150px] top-[300px] w-[760px]" naslov={t < VODJA ? <>Oddaj dopust <b>v treh klikih</b></> : <>Vodja potrdi <b>z enim</b></>} kljucne={["Brez papirja", "Brez čakanja", "Vidiš status"]} />

      {/* obrazec */}
      {t < ODDANO + 300 && (
        <div className="fos-popup absolute left-[1010px] top-[170px] w-[760px] rounded-[32px] p-9" style={{ ...pojav(t, 19800, { y: 50 }), opacity: (pojav(t, 19800).opacity as number) * (1 - obrazecVen), transform: `translateX(${-obrazecVen * 120}px) scale(${1 - obrazecVen * 0.08})` }}>
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 rounded-t-[32px] bg-[linear-gradient(90deg,#8f380b,#ca5010_30%,#ee7a3a_60%,#ca5010)]" />
          <h3 className="flex items-center gap-3 font-display text-[36px] font-bold text-white">
            <Send className="h-8 w-8 text-fines-300" /> Nova odsotnost
          </h3>
          <p className="mt-6 flex items-center gap-3 text-[24px] font-bold text-white">
            <span className="fos-fines-fill grid h-9 w-9 place-items-center rounded-full text-[18px] text-snow">1</span> Zakaj te ne bo?
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {RAZLOGI.map((r, i) => {
              const izb = i === 0 && t >= IZBERI;
              return (
                <div key={r.ime} className={`relative flex items-center gap-3 rounded-[18px] border p-3 ${izb ? "border-fines-400/80 bg-fines-500/20 shadow-[0_0_30px_-8px_rgb(238_122_58/0.9)]" : "border-white/10 bg-white/[0.04]"}`} style={{ transform: `scale(${i === 0 ? pritisk(IZBERI) : 1})` }}>
                  <IkonaStatistike s={{ barva: r.barva, ikona: r.ikona }} className="!h-12 !w-12" />
                  <span className="text-[22px] font-bold text-white">{r.ime}</span>
                  {izb && (
                    <span className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(135deg,#f19a66,#ca5010)] text-snow" style={{ transform: `scale(${odskok(del(t, IZBERI, 350))})` }}>
                      <Check className="h-5 w-5" strokeWidth={3} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-6 flex items-center gap-3 text-[24px] font-bold text-white">
            <span className="fos-fines-fill grid h-9 w-9 place-items-center rounded-full text-[18px] text-snow">2</span> Kdaj?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[24px]">
            {["Od  10. 11. 2026", "Do  12. 11. 2026"].map((d, i) => (
              <span key={d} className="rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-3 font-semibold text-white" style={{ opacity: t >= DATUM + i * 180 ? 1 : 0.25 }}>
                {t >= DATUM + i * 180 ? d : i ? "Do" : "Od"}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[22px] text-ink-300" style={{ opacity: izhod(del(t, DATUM + 400, 300)) }}>
            <b className="font-display text-[30px] text-white">3</b> delovni dnevi
          </p>
          <div className="mt-5 flex h-[70px] items-center justify-center gap-3 rounded-[18px] bg-[linear-gradient(135deg,#4ade80,#16a34a_60%,#14532d)] text-[28px] font-bold text-snow shadow-[0_14px_36px_-12px_rgb(22_163_74/0.9)]" style={{ transform: `scale(${pritisk(POSLJI)})` }}>
            <Send className="h-7 w-7" /> Pošlji vodji
          </div>
        </div>
      )}

      {/* zahtevek: oddano -> potrjeno */}
      {t >= ODDANO && (
        <div className="absolute left-[1010px] top-[330px] flex w-[760px] flex-col gap-5">
          {t >= VODJA && (
            <div className="flex items-center gap-4" style={pojav(t, VODJA, { y: -20 })}>
              <Avatar besedilo="AK" velikost="md" className="!h-14 !w-14 !text-lg" />
              <span className="flex flex-col">
                <span className="text-[26px] font-bold text-white">Ana Kovač · vodja</span>
                <span className="text-[20px] text-ink-400">Za potrditev: 1</span>
              </span>
            </div>
          )}
          <div className="fos-popup flex items-center gap-5 rounded-[26px] p-6" style={{ ...pojav(t, ODDANO, { y: 80, s: 0.9 }), boxShadow: `inset 6px 0 0 ${potrjeno ? "#22c55e" : "#f59e0b"}, var(--fos-popup-senca)` }}>
            <IkonaStatistike s={{ barva: "#0ea5e9", ikona: "tree-palm" }} velikost="lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[30px] font-bold text-white">Redni dopust</span>
              <span className="text-[22px] text-ink-300">10. 11. – 12. 11. 2026 · 3 dni</span>
              <span className="text-[19px] text-ink-500">Matej Novak · Proizvodnja</span>
            </span>
            <span className="flex flex-col items-end gap-3">
              <span
                className="flex items-center gap-2 rounded-full border px-4 py-2 text-[22px] font-bold"
                style={{ color: potrjeno ? "#22c55e" : "#f59e0b", borderColor: potrjeno ? "rgb(34 197 94 / 0.5)" : "rgb(245 158 11 / 0.5)", background: potrjeno ? "rgb(34 197 94 / 0.12)" : "rgb(245 158 11 / 0.12)", transform: `scale(${potrjeno ? lerp(1.35, 1, odskok(del(t, POTRDI + 150, 450))) : 1})` }}
              >
                {potrjeno ? <Check className="h-6 w-6" strokeWidth={3} /> : <Hourglass className="h-6 w-6" />}
                {potrjeno ? "Potrjeno" : "Oddano"}
              </span>
              {t >= VODJA && !potrjeno && (
                <span className="flex h-[52px] items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#4ade80,#16a34a_60%,#14532d)] px-5 text-[22px] font-bold text-snow" style={{ ...pojav(t, VODJA + 250, { y: 10, blur: 0 }), transform: `scale(${pritisk(POTRDI)})` }}>
                  <Check className="h-5 w-5" strokeWidth={3} /> Potrdi
                </span>
              )}
            </span>
          </div>
          {potrjeno && <span className="absolute right-[40px] top-[120px] rounded-full border-4 border-ok-500" style={{ width: lerp(60, 420, del(t, POTRDI + 150, 700)), height: lerp(60, 420, del(t, POTRDI + 150, 700)), opacity: 1 - del(t, POTRDI + 150, 700), transform: "translate(50%, -50%)" }} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 5. Delovna ura (24,5 - 29 s)
// ---------------------------------------------------------------------------------------------------------------
export const KLIK_PRIHOD = 26100;

function Ura({ t }: { t: number }) {
  // kazalec miške do gumba Prihod (koordinate kartice, pomanjšane 1,5x)
  const pot = izhod(del(t, 25200, 800));
  return (
    <div className="absolute inset-0">
      <Napis t={t} od={24650} nad="Delovna ura" className="left-[150px] top-[330px] w-[820px]" naslov={<>Prihod <b>z enim klikom</b></>} kljucne={["Odmor", "Službeni izhod", "Delo od doma"]} />
      <div className="absolute left-[1080px] top-[90px] w-[420px] origin-top-left" style={{ ...pojav(t, 24750, { y: 60 }), transform: `${pojav(t, 24750, { y: 60 }).transform} scale(1.55)` }}>
        <DelovnaUra j={JAZ} demo />
        {t >= 25200 && t < 27400 && (
          <span className="absolute z-10" style={{ left: lerp(330, 200, pot), top: lerp(420, 228, pot), opacity: 1 - del(t, 27000, 300) }}>
            <MousePointer2 className="h-9 w-9 fill-white text-ink-900 drop-shadow-[0_4px_8px_rgb(0_0_0/0.6)]" style={{ transform: `scale(${t >= KLIK_PRIHOD && t < KLIK_PRIHOD + 180 ? 0.85 : 1})` }} />
            {t >= KLIK_PRIHOD && <span className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ width: lerp(10, 90, del(t, KLIK_PRIHOD, 500)), height: lerp(10, 90, del(t, KLIK_PRIHOD, 500)), opacity: 1 - del(t, KLIK_PRIHOD, 500) }} />}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 6. krmilnik (29 - 34 s)
// ---------------------------------------------------------------------------------------------------------------
const TIPKE_KRMILNIKA = [
  { tipka: 1, besedilo: "Poslovni izhod", funkcija: null },
  { tipka: 2, besedilo: "Privatni izhod", funkcija: null },
  { tipka: 3, besedilo: "Izredno", funkcija: null },
  { tipka: 4, besedilo: "Info", funkcija: "info" as const },
  { tipka: 5, besedilo: "Odmor", funkcija: null },
  { tipka: 9, besedilo: "Prekliči", funkcija: "preklici" as const },
];

function Krmilnik({ t }: { t: number }) {
  const KARTICA = 30900;
  const ZIG = 31550;
  const k = izhod(del(t, KARTICA, 650));
  const potrdilo = t >= ZIG && t < ZIG + 2300 ? { barva: "#22c55e", ikona: "✓", naslov: "Dober dan, Matej!", opis: `${ura()} · Prihod` } : null;
  return (
    <div className="absolute inset-0">
      <Napis t={t} od={29150} nad="Nov krmilnik" className="left-[150px] top-[290px] w-[640px]" naslov={<>Prisloni kartico, <b>pozdravi te po imenu</b></>} kljucne={["Tipke za odmor", "Deluje tudi brez wifija"]} />
      <div className="absolute left-[860px] top-[200px] w-[940px]" style={pojav(t, 29300, { y: 70, s: 0.92 })}>
        <KrmilnikPredogled samoZaslon ime="Vhod proizvodnja" tipke={TIPKE_KRMILNIKA} nadzor={{ izbrana: null, potrdilo, brezPovezave: false }} />
      </div>
      {/* kartica zaposlenega */}
      {t >= KARTICA - 50 && t < ZIG + 900 && (
        <div
          className="absolute flex h-[150px] w-[240px] flex-col justify-between rounded-[18px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] p-5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)]"
          style={{ left: lerp(1920, 1640, k), top: lerp(900, 640, k), transform: `rotate(${lerp(30, -8, k)}deg)`, opacity: 1 - del(t, ZIG + 500, 400) }}
        >
          <span className="flex items-center justify-between text-snow">
            <span className="font-display text-[26px] font-bold">FINES</span>
            <CreditCard className="h-8 w-8" />
          </span>
          <span className="text-[18px] font-semibold text-snow/90">Matej Novak</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 7. koledar (34 - 38 s)
// ---------------------------------------------------------------------------------------------------------------
function KoledarPrizor({ t }: { t: number }) {
  const n = useCasNastavitve();
  const dnevi = useMemo(() => {
    const urnik = testniUrnik(ID_PROMO, n);
    const danes = "2026-11-05";
    return dneviMeseca("2026-10-01").map((d) => izracunajDan(d, testniDan(ID_PROMO, d, n, danes, 420), n, danes, 420, urnik));
  }, [n]);
  const odkrij = izhod(del(t, 34300, 1400));
  return (
    <div className="absolute inset-0">
      <Napis t={t} od={34150} nad="Moj čas" className="left-[150px] top-[300px] w-[640px]" naslov={<>Vse tvoje ure <b>na enem mestu</b></>} kljucne={["Saldo", "Dopust", "Malice"]} />
      <div className="fos-glass absolute left-[880px] top-[110px] w-[920px] overflow-hidden rounded-[26px] p-4" style={{ ...pojav(t, 34250, { y: 60 }), height: 860, clipPath: `inset(0 0 ${100 - odkrij * 100}% 0 round 26px)` }}>
        <div className="mb-3 flex items-center gap-3">
          <Avatar besedilo="MN" velikost="sm" />
          <span className="font-display text-[22px] font-bold text-white">Matej Novak</span>
          <span className="ml-auto font-display text-[18px] font-bold text-ink-300">Oktober 2026</span>
        </div>
        <Koledar dnevi={dnevi} statistike={n.statistike} velik={false} zdajMin={420} onOdpri={() => {}} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(transparent,var(--color-ink-950))]" />
      </div>
      {[
        { b: "Saldo", v: "+6:30", c: "#22c55e", od: 35300, levo: 150 },
        { b: "Dopust ostane", v: "17 dni", c: "#0ea5e9", od: 35550, levo: 390 },
        { b: "Malice", v: "21", c: "#ee7a3a", od: 35800, levo: 630 },
      ].map((x) => (
        <div key={x.b} className="fos-popup absolute top-[660px] flex w-[220px] flex-col rounded-[22px] px-6 py-4" style={{ ...pojav(t, x.od, { y: 40, s: 0.85 }), left: x.levo }}>
          <span className="text-[20px] font-semibold text-ink-300">{x.b}</span>
          <span className="font-display text-[44px] font-bold" style={{ color: x.c }}>
            {x.v}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// 8. špica (38 - 42 s)
// ---------------------------------------------------------------------------------------------------------------
function Spica({ t }: { t: number }) {
  const udarec = del(t, 38000, 700);
  const val = del(t, 38000, 1400);
  const tema = del(t, 41450, 550);
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative flex flex-col items-center">
          <span className="absolute left-1/2 top-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fines-400" style={{ width: lerp(200, 2000, val), height: lerp(200, 2000, val), opacity: (1 - val) * 0.8 }} />
          <span className="absolute left-1/2 top-[230px] h-[700px] w-[1300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(238_122_58/0.38),transparent)]" />
          <span className="rounded-2xl bg-snow px-7 py-4 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]" style={pojav(t, 38150, { y: -30, blur: 0 })}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fines-logo.png" alt="FINES" width={220} height={58} className="h-auto w-[220px]" />
          </span>
          <div className="mt-10" style={{ transform: `scale(${lerp(1.25, 1, izhod(udarec))})`, opacity: izhod(del(t, 37950, 250)), filter: `drop-shadow(0 0 ${lerp(70, 28, udarec)}px rgb(238 122 58 / 0.65))` }}>
            <Znak pripona="ME" className="text-[220px]" />
          </div>
          <span className="mt-6 font-display text-[64px] font-bold text-white" style={pojav(t, 38450, { y: 30 })}>
            Moj Fines
          </span>
          <span className="mt-3 text-[32px] font-semibold text-fines-300" style={pojav(t, 38750, { y: 24 })}>
            Kmalu za vse zaposlene
          </span>
          <span className="mt-12 font-display text-[36px] font-medium text-ink-200" style={pojav(t, 39150, { y: 20, blur: 6 })}>
            People <b className="fos-text-fines font-bold">Bake</b> for People
          </span>
        </div>
      </div>
      <div className="absolute bottom-[90px] right-[170px]" style={pojav(t, 38700, { x: 120, y: 0 })}>
        <Finesek s={0.38} pogled="spredaj" poza={t < 39400 ? "veselje" : "maha"} />
      </div>
      <div className="absolute inset-0 bg-black" style={{ opacity: tema }} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// celota
// ---------------------------------------------------------------------------------------------------------------
export function PromoVideo({ t }: { t: number }) {
  return (
    <div className="promo relative overflow-hidden bg-ink-950" style={{ width: W, height: H }}>
      <Ozadje />
      {/* slike se naložijo vnaprej (Finesek, logotip) - v prizorih so takoj vidne */}
      <div aria-hidden className="pointer-events-none absolute -left-[5000px] top-0 opacity-0">
        {["telo-spredaj", "telo-stran", "roka-leva", "roka-desna", "noga-leva", "noga-desna"].map((d) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={d} src={`/finesek/${d}.webp`} alt="" />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fines-logo.png" alt="" />
      </div>
      <Prizor t={t} od={0} do={4050} zoom={false}>
        <Uvod t={t} />
      </Prizor>
      <Prizor t={t} od={4000} do={10050}>
        <Prizig t={t} />
      </Prizor>
      <Prizor t={t} od={10000} do={19550}>
        <Krog t={t} />
      </Prizor>
      <Prizor t={t} od={19500} do={24550}>
        <Odsotnost t={t} />
      </Prizor>
      <Prizor t={t} od={24500} do={29050}>
        <Ura t={t} />
      </Prizor>
      <Prizor t={t} od={29000} do={34050}>
        <Krmilnik t={t} />
      </Prizor>
      <Prizor t={t} od={34000} do={38050}>
        <KoledarPrizor t={t} />
      </Prizor>
      <Prizor t={t} od={37950} do={42100} zoom={false}>
        <Spica t={t} />
      </Prizor>
      {/* vinjeta */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55))]" />
    </div>
  );
}

/**
 * Upravljanje časa: ?render=1 -> window.__promo(t) nastavi sličico (posnetek), sicer se predvaja sam v zanki.
 * CSS animacije (Finesek, morje, ura ...) se postavijo na čas t, da je vsaka sličica enaka.
 */
export function PromoPredvajalnik({ render }: { render: boolean }) {
  const [t, setT] = useState(0);
  const [merilo, setMerilo] = useState(1);

  useEffect(() => {
    if (render) {
      let kliknjeno = false;
      (window as unknown as { __promo: (x: number) => boolean }).__promo = (x: number) => {
        flushSync(() => setT(x));
        // samo CSS animacije (Finesek, morje, ura ...); animacij knjižnice motion se ne dotikamo
        document.getAnimations().forEach((a) => {
          if (typeof CSSAnimation === "undefined" || !(a instanceof CSSAnimation)) return;
          a.pause();
          a.currentTime = x;
        });
        if (!kliknjeno && x >= KLIK_PRIHOD) {
          kliknjeno = true;
          (document.querySelector('button[title^="Zabeleži prihod"]') as HTMLButtonElement | null)?.click();
        }
        return true;
      };
      return;
    }
    let raf = 0;
    let kliknjeno = false;
    const zacetek = performance.now();
    const zanka = () => {
      const x = (performance.now() - zacetek) % TRAJANJE;
      if (x < 1000) kliknjeno = false;
      if (!kliknjeno && x >= KLIK_PRIHOD) {
        kliknjeno = true;
        (document.querySelector('button[title^="Zabeleži prihod"]') as HTMLButtonElement | null)?.click();
      }
      setT(x);
      raf = requestAnimationFrame(zanka);
    };
    raf = requestAnimationFrame(zanka);
    return () => cancelAnimationFrame(raf);
  }, [render]);

  useEffect(() => {
    if (render) return;
    const prilagodi = () => setMerilo(Math.min(window.innerWidth / W, window.innerHeight / H));
    prilagodi();
    window.addEventListener("resize", prilagodi);
    return () => window.removeEventListener("resize", prilagodi);
  }, [render]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: render ? undefined : `scale(${merilo})` }}>
        <PromoVideo t={t} />
      </div>
    </div>
  );
}
