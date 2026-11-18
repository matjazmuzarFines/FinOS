"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Clock, HelpCircle, Truck } from "lucide-react";
import { TONI, ure, type Scena, type Utrip } from "@/lib/tvScene";
import { GlavaOdziv, KRIVULJA, Konfeti, Oznaka, PodatekUtripa, Stevec, Vrednost, vzmet } from "./Skupno";

/**
 * SVETI animiranih scen - vsaka komponenta svojo postavitev in animacijo (da TV ni vedno enak), Finesek povsod:
 *   merilnik (Delo - prejšnji dan): polkrožni merilnik, kazalec zaniha do ur, oznaka PLAN; Finesek ob merilniku.
 *   podij (Zaključeni krovni): stolpci produktivnosti, črta NORMATIV 100 %, Finesek se pelje na vrhu stolpca, konfeti.
 *   trak (Pripravljenost materiala): tekoči trak s paketi do Fineseka; manjkajoči = črtkani obrisi z "?".
 *   pot (Delovni plan): cesta s postajami (krovni), Finesek skače od postaje do postaje, kartica nad postajo.
 *   koledar (Pregled): koledar trga liste do števila delovnih dni do roka, Finesek kuka izza koledarja.
 * Oder 1920 × 1080; glava strani (naslov) je levo zgoraj do ~330 px - sveti so pod njo / desno.
 */

export type SvetProps = { scena: Scena; i: number; u: Utrip; mirno?: boolean; barva: string };

/** Kamera: ob vsakem utripu približa fokus (Fineseka) in se oddalji. */
export function Kamera({ i, fokus, mirno, children }: { i: number; fokus: string; mirno?: boolean; children: ReactNode }) {
  return (
    <motion.div
      key={mirno ? "mirno" : `kamera${i}`}
      className="absolute inset-0"
      style={{ transformOrigin: fokus }}
      initial={false}
      animate={mirno ? undefined : { scale: [1, 1.14, 1.14, 1] }}
      transition={{ duration: 1.9, times: [0, 0.35, 0.55, 1], ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/** Podatek desno (od `levo` do desnega roba). */
function Desno({ levo, children }: { levo: number; children: ReactNode }) {
  return (
    <div className="absolute" style={{ left: levo, right: 110, top: 250, bottom: 130 }}>
      <AnimatePresence mode="wait" initial={false}>
        {children}
      </AnimatePresence>
    </div>
  );
}

// =====================================================================
// MERILNIK - Delo prejšnji dan
// =====================================================================
const M = { cx: 520, cy: 930, r: 330, deb: 58 };
const tocka = (a: number, r: number) => [M.cx + r * Math.cos(a), M.cy + r * Math.sin(a)] as const;
const kotV = (v: number, max: number) => Math.PI * (1 + Math.max(0, Math.min(v, max)) / max);
function lok(od: number, doo: number, max: number, r = M.r) {
  const [x1, y1] = tocka(kotV(od, max), r);
  const [x2, y2] = tocka(kotV(doo, max), r);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export function SvetMerilnik({ i, u, mirno }: SvetProps) {
  const vr = u.meter?.vrednost ?? u.vrednost.st ?? 0;
  const plan = u.meter?.plan ?? null;
  const max = Math.max(plan ? plan * 1.3 : 0, vr * 1.1, 1);
  const barva = TONI[u.ton];
  const pas = plan
    ? [
        { od: 0, do: plan * 0.85, b: "#f97316" },
        { od: plan * 0.85, do: plan, b: "#eab308" },
        { od: plan, do: max, b: "#22c55e" },
      ]
    : [{ od: 0, do: max, b: "#3a3a40" }];
  const [px, py] = plan ? tocka(kotV(plan, max), M.r + M.deb / 2 + 18) : [0, 0];
  const [lx, ly] = plan ? tocka(kotV(plan, max), M.r + M.deb / 2 + 70) : [0, 0];
  const kotKazalca = -90 + (180 * Math.min(vr, max)) / max;
  return (
    <>
      <Kamera i={i} fokus="56% 70%" mirno={mirno}>
        <svg className="absolute inset-0" viewBox="0 0 1920 1080" aria-hidden>
          {pas.map((p) => (
            <path key={p.od} d={lok(p.od, p.do, max)} fill="none" stroke={p.b} strokeOpacity={0.28} strokeWidth={M.deb} />
          ))}
          {Array.from({ length: 11 }, (_, j) => {
            const a = Math.PI * (1 + j / 10);
            const [x1, y1] = tocka(a, M.r - M.deb / 2 - 8);
            const [x2, y2] = tocka(a, M.r - M.deb / 2 - (j % 5 ? 26 : 44));
            return <line key={j} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b6b72" strokeWidth={j % 5 ? 3 : 5} strokeLinecap="round" />;
          })}
          <motion.path
            key={mirno ? "mirno" : `lok${i}`}
            d={lok(0, Math.max(vr, max * 0.002), max)}
            fill="none"
            stroke={barva}
            strokeWidth={M.deb}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 18px ${barva})` }}
            initial={mirno ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={mirno ? { duration: 0 } : { duration: 1.6, delay: 0.9, ease: KRIVULJA }}
          />
          {plan && (
            <>
              <line x1={M.cx + (M.r - M.deb / 2 - 6) * Math.cos(kotV(plan, max))} y1={M.cy + (M.r - M.deb / 2 - 6) * Math.sin(kotV(plan, max))} x2={px} y2={py} stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
              <text x={lx} y={ly} fill="#dcdcdf" fontSize={30} fontWeight={700} textAnchor="middle" dominantBaseline="middle" style={{ letterSpacing: "0.08em" }}>
                PLAN {ure(plan, true)} h
              </text>
            </>
          )}
        </svg>
        {/* kazalec */}
        <motion.div
          key={mirno ? "mirno" : `kazalec${i}`}
          className="absolute rounded-full"
          style={{ left: M.cx - 8, top: M.cy - (M.r - 50), width: 16, height: M.r - 50, transformOrigin: "50% 100%", background: "linear-gradient(180deg,#ffffff,#9a9aa1)", boxShadow: "0 0 24px rgb(255 255 255 / 0.5)" }}
          initial={mirno ? false : { rotate: -90 }}
          animate={{ rotate: kotKazalca }}
          transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 45, damping: 7, delay: 0.9 }}
        />
        <div className="absolute rounded-full border-[6px] border-[#121214]" style={{ left: M.cx - 34, top: M.cy - 34, width: 68, height: 68, background: `radial-gradient(circle at 35% 35%, #ffffff, ${barva})`, boxShadow: `0 0 30px ${barva}` }} />
        {/* odčitek pod sredino */}
        <div className="absolute flex justify-center" style={{ left: M.cx - 300, width: 600, top: M.cy + 34 }}>
          <Vrednost v={{ st: vr, predpona: u.vrednost.predpona, pripona: " h" }} barva={barva} mirno={mirno} velikost={84} />
        </div>
        <GlavaOdziv u={u} i={i} mirno={mirno} pogledX={8} className="absolute left-[870px] top-[560px] w-[340px]" />
      </Kamera>
      <Desno levo={1230}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} brezVrednosti brezTraku />
      </Desno>
    </>
  );
}

// =====================================================================
// PODIJ - Zaključeni krovni (stolpci produktivnosti)
// =====================================================================
const P = { dno: 950, visina: 540, x0: 150, sirina: 150, razmik: 46, max: 1.5 };
const visinaStolpca = (p: number) => (Math.min(Math.max(p, 0), P.max) / P.max) * P.visina;

export function SvetPodij({ scena, i, u, mirno }: SvetProps) {
  const stolpci = scena.utripi.map((x, j) => ({ x, j, p: (x.vrednost.st ?? 0) / 100, skupaj: x.kljuc === "skupaj" }));
  const vidni = stolpci.filter((s) => s.j <= i);
  const levo = (j: number) => P.x0 + j * (P.sirina + P.razmik);
  const zdaj = stolpci[i] ?? stolpci[0];
  const h = visinaStolpca(zdaj.p);
  const normativ = P.dno - visinaStolpca(1);
  const uspeh = u.razpolozenje === "navdusen" || u.razpolozenje === "vesel" || u.razpolozenje === "ponosen";
  const sirinaGlave = 260;
  return (
    <>
      {/* črta normativa */}
      <div className="absolute border-t-[4px] border-dashed border-white/35" style={{ left: P.x0 - 40, width: 5 * (P.sirina + P.razmik) + 40, top: normativ }} />
      <span className="absolute text-[24px] font-bold uppercase tracking-[0.12em] text-[#9a9aa1]" style={{ left: P.x0 + 5 * (P.sirina + P.razmik) - 230, top: normativ - 40 }}>
        Normativ 100 %
      </span>
      <div className="absolute h-[6px] rounded-full bg-white/15" style={{ left: P.x0 - 40, width: 5 * (P.sirina + P.razmik) + 40, top: P.dno }} />
      {vidni.map((s) => {
        const trenutni = s.j === i;
        const b = TONI[s.x.ton];
        return (
          <div key={s.j} className="absolute" style={{ left: levo(s.j), width: P.sirina, top: P.dno - P.visina - 20, height: P.visina + 20 }}>
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-t-[22px]"
              style={{
                background: trenutni ? `linear-gradient(180deg, ${b}, color-mix(in srgb, ${b} 45%, black))` : s.skupaj ? "linear-gradient(180deg,#facc15,#a16207)" : "linear-gradient(180deg,#4a4a52,#2a2a2f)",
                boxShadow: trenutni ? `0 0 50px -6px ${b}` : undefined,
              }}
              initial={mirno || !trenutni ? false : { height: 0 }}
              animate={{ height: visinaStolpca(s.p) }}
              transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 12, delay: 0.9 }}
            >
              <span className="absolute inset-x-0 top-3 text-center font-display font-bold text-white" style={{ fontSize: trenutni ? 44 : 30 }}>
                {trenutni ? <Stevec v={{ st: s.p * 100, cela: true }} mirno={mirno} zamik={0.9} /> : Math.round(s.p * 100)}%
              </span>
            </motion.div>
            <span className="absolute inset-x-0 text-center font-display text-[30px] font-bold" style={{ top: P.visina + 36, color: trenutni ? "#ffffff" : "#6b6b72" }}>
              {s.skupaj ? "Skupaj" : s.x.glava}
            </span>
          </div>
        );
      })}
      {/* Finesek na vrhu trenutnega stolpca */}
      <motion.div
        className="absolute"
        style={{ width: sirinaGlave }}
        initial={mirno ? false : { left: levo(i) + P.sirina / 2 - sirinaGlave / 2, top: P.dno - 160 }}
        animate={{ left: levo(i) + P.sirina / 2 - sirinaGlave / 2, top: P.dno - h - 170 }}
        transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 12, delay: 0.9 }}
      >
        <GlavaOdziv u={u} i={i} mirno={mirno} pogledX={6} className="w-full" />
      </motion.div>
      {uspeh && !mirno && <Konfeti key={`konfeti${i}`} zamik={1.8} />}
      <Desno levo={1230}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} brezTraku />
      </Desno>
    </>
  );
}

// =====================================================================
// TRAK - Pripravljenost materiala
// =====================================================================
const T = { levo: 100, sirina: 1010, vrh: 860, skatla: 118 };

function Skatla({ crtkano, barva, vprasaj, mirno }: { crtkano?: boolean; barva: string; vprasaj?: boolean; mirno?: boolean }) {
  if (crtkano)
    return (
      <div className="grid h-full w-full place-items-center rounded-[14px] border-[5px] border-dashed" style={{ borderColor: barva }}>
        {vprasaj && (
          <motion.span animate={mirno ? undefined : { scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ color: barva }}>
            <HelpCircle className="h-14 w-14" strokeWidth={2.4} aria-hidden />
          </motion.span>
        )}
      </div>
    );
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[14px] shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)]" style={{ background: "linear-gradient(160deg,#e2b47a,#b57d40 60%,#8f5e2a)" }}>
      <div className="absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-[#f1d3a2]/70" />
      <div className="absolute inset-x-0 top-[38%] h-[3px] bg-black/15" />
      <div className="absolute bottom-4 left-4 h-2 w-8 rounded bg-black/25" />
    </div>
  );
}

export function SvetTrak({ i, u, mirno }: SvetProps) {
  const stanje = u.material ?? "zaloga";
  const barva = TONI[u.ton];
  const n = stanje === "zaloga" ? 3 : Math.max(1, Math.min(5, Math.round(u.vrednost.st ?? 1)));
  const cilj = (j: number) => T.levo + T.sirina - 290 - j * (T.skatla + 26);
  const tece = stanje !== "ni_naroceno";
  const tag =
    stanje === "zaloga"
      ? { ikona: Check, besedilo: "Vse je v hiši" }
      : stanje === "pride"
        ? { ikona: Truck, besedilo: `Pride ${u.kdaj ?? ""}` }
        : stanje === "prepozno"
          ? { ikona: Clock, besedilo: `Pride šele ${u.kdaj ?? ""}` }
          : stanje === "zapadel"
            ? { ikona: Clock, besedilo: "Rok dobave je mimo" }
            : { ikona: HelpCircle, besedilo: "Ni naročeno" };
  return (
    <>
      <Kamera i={i} fokus="55% 68%" mirno={mirno}>
        {/* trak */}
        <motion.div
          className="absolute rounded-[23px]"
          style={{
            left: T.levo,
            width: T.sirina,
            top: T.vrh,
            height: 46,
            backgroundImage: "repeating-linear-gradient(90deg,#2b2b30 0 40px,#1d1d21 40px 80px)",
            boxShadow: "inset 0 3px 0 rgb(255 255 255 / 0.08), 0 20px 40px -18px #000",
          }}
          animate={mirno || !tece ? undefined : { backgroundPositionX: ["0px", "-160px"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
        {Array.from({ length: 8 }, (_, j) => (
          <div key={j} className="absolute h-10 w-10 rounded-full border-4 border-[#3a3a40] bg-[#18181b]" style={{ left: T.levo + 40 + j * 130, top: T.vrh + 52 }} />
        ))}
        {/* tablica */}
        <motion.div
          key={mirno ? "mirno" : `tag${i}`}
          className="absolute flex items-center gap-4 rounded-full border-2 px-7 py-3 text-[36px] font-bold"
          style={{ left: T.levo + 20, top: T.vrh - 250, color: barva, borderColor: `${barva}88`, background: `${barva}1f` }}
          initial={mirno ? false : { opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={vzmet(mirno, 0.8)}
        >
          <tag.ikona className="h-10 w-10" strokeWidth={2.4} aria-hidden />
          {tag.besedilo}
        </motion.div>
        {/* škatle */}
        {Array.from({ length: n }, (_, j) => {
          const x = cilj(j);
          const crtkano = stanje === "ni_naroceno" || stanje === "zapadel" || stanje === "prepozno";
          return (
            <div key={`${i}:${j}`} className="absolute" style={{ left: x, top: T.vrh - T.skatla - 2, width: T.skatla, height: T.skatla }}>
              {crtkano ? (
                <Skatla crtkano barva={barva} vprasaj={stanje === "ni_naroceno"} mirno={mirno} />
              ) : (
                <motion.div
                  className="h-full w-full"
                  initial={mirno ? false : stanje === "zaloga" ? { scale: 0, y: -80 } : { x: T.levo - x - 200 }}
                  animate={stanje === "zaloga" ? { scale: 1, y: 0 } : { x: 0 }}
                  transition={mirno ? { duration: 0 } : stanje === "zaloga" ? { type: "spring", stiffness: 160, damping: 12, delay: 0.9 + j * 0.15 } : { duration: 2.2, delay: 0.8 + (n - j) * 0.3, ease: KRIVULJA }}
                >
                  <Skatla barva={barva} mirno={mirno} />
                </motion.div>
              )}
            </div>
          );
        })}
        {/* zamujajoča škatla: obtiči daleč na traku in se maje */}
        {(stanje === "prepozno" || stanje === "zapadel") && (
          <motion.div
            key={mirno ? "mirno" : `zamuja${i}`}
            className="absolute"
            style={{ left: T.levo + 40, top: T.vrh - T.skatla - 2, width: T.skatla, height: T.skatla }}
            initial={mirno ? false : { x: -260, opacity: 0 }}
            animate={mirno ? { x: 0, opacity: 1 } : { x: 0, opacity: 1, rotate: [0, -3, 3, 0] }}
            transition={mirno ? { duration: 0 } : { duration: 2.4, delay: 0.8, ease: KRIVULJA, rotate: { duration: 1.2, repeat: Infinity, delay: 3 } }}
          >
            <Skatla barva={barva} mirno={mirno} />
          </motion.div>
        )}
        {stanje === "zaloga" && (
          <motion.span
            key={mirno ? "mirno" : `ok${i}`}
            className="absolute grid h-20 w-20 place-items-center rounded-full bg-[#22c55e] text-white shadow-[0_0_40px_#22c55e]"
            style={{ left: cilj(0) + T.skatla - 30, top: T.vrh - T.skatla - 52 }}
            initial={mirno ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 10, delay: 1.8 }}
          >
            <Check className="h-12 w-12" strokeWidth={3.5} aria-hidden />
          </motion.span>
        )}
        <GlavaOdziv u={u} i={i} mirno={mirno} pogledX={-8} className="absolute left-[860px] top-[560px] w-[270px]" />
      </Kamera>
      <Desno levo={1230}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} />
      </Desno>
    </>
  );
}

// =====================================================================
// POT - Delovni plan (postaje = krovni)
// =====================================================================
const C = { y: 840, levo: 240, desno: 1580, krog: 92, glava: 190 };

export function SvetPot({ scena, i, u, mirno }: SvetProps) {
  const n = scena.utripi.length;
  const x = (j: number) => (n === 1 ? 960 : C.levo + (j * (C.desno - C.levo)) / (n - 1));
  const barva = TONI[u.ton];
  const sirinaKartice = 700;
  const levoKartice = Math.max(110, Math.min(1920 - 110 - sirinaKartice, x(i) - sirinaKartice / 2));
  return (
    <>
      {/* cesta */}
      <div
        className="absolute rounded-full"
        style={{ left: 120, right: 120, top: C.y - 36, height: 72, background: "linear-gradient(180deg,#34343a,#1c1c20)", boxShadow: "inset 0 3px 0 rgb(255 255 255 / 0.08), 0 30px 50px -25px #000" }}
      />
      <motion.div
        className="absolute h-[6px]"
        style={{ left: 150, right: 150, top: C.y - 3, backgroundImage: "repeating-linear-gradient(90deg,#9a9aa1 0 40px,transparent 40px 80px)", opacity: 0.5 }}
        animate={mirno ? undefined : { backgroundPositionX: ["0px", "80px"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
      {/* postaje */}
      {scena.utripi.map((s, j) => {
        const b = TONI[s.ton];
        const zdaj = j === i;
        return (
          <div key={s.kljuc + j} className="absolute flex flex-col items-center" style={{ left: x(j) - 150, width: 300, top: C.y - C.krog / 2 }}>
            <motion.div
              className="grid place-items-center rounded-full border-[6px] font-display text-[40px] font-bold"
              style={{ width: C.krog, height: C.krog }}
              initial={false}
              animate={{
                borderColor: zdaj ? b : j < i ? "#4a4a52" : "#3a3a40",
                backgroundColor: zdaj ? b : j < i ? "#2a2a2f" : "#18181b",
                color: zdaj ? "#ffffff" : "#6b6b72",
                boxShadow: zdaj ? `0 0 50px ${b}` : "0 0 0 transparent",
                scale: zdaj ? 1.12 : 1,
              }}
              transition={{ duration: mirno ? 0 : 0.6 }}
            >
              {j < i ? <Check className="h-11 w-11" strokeWidth={3} aria-hidden /> : j + 1}
            </motion.div>
            <span className="mt-3 font-display text-[34px] font-bold" style={{ color: zdaj ? "#ffffff" : "#8a8a91" }}>
              {s.glava}
            </span>
            <span className="text-[24px] font-medium text-[#8a8a91]">{s.kdaj}</span>
            {s.danes && <span className="mt-2 rounded-full bg-[#22c55e] px-4 py-1 text-[22px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_0_24px_#22c55e]">Danes</span>}
          </div>
        );
      })}
      {/* Finesek skače od postaje do postaje */}
      <motion.div
        className="absolute"
        style={{ width: C.glava, top: C.y - C.krog / 2 - 140 }}
        initial={mirno ? false : { left: x(Math.max(0, i - 1)) - C.glava / 2 }}
        animate={{ left: x(i) - C.glava / 2 }}
        transition={mirno ? { duration: 0 } : { duration: 1.1, delay: 0.3, ease: "easeInOut" }}
      >
        <motion.div key={mirno ? "mirno" : `skok${i}`} animate={mirno ? undefined : { y: [0, -150, 0, -30, 0] }} transition={{ duration: 1.3, delay: 0.25, times: [0, 0.4, 0.75, 0.88, 1] }}>
          <GlavaOdziv u={u} i={i} mirno={mirno} pogledX={0} className="w-full" />
        </motion.div>
      </motion.div>
      {/* kartica nad postajo */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mirno ? "mirno" : `kartica${i}`}
          className="absolute flex flex-col gap-3 rounded-[36px] border-2 px-9 py-7"
          style={{ left: levoKartice, width: sirinaKartice, top: 350, borderColor: `${barva}88`, background: "linear-gradient(160deg, rgb(43 43 47 / 0.92), rgb(18 18 20 / 0.95))", boxShadow: `0 40px 90px -40px ${barva}` }}
          initial={mirno ? false : { opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, transition: { duration: 0.4 } }}
          transition={vzmet(mirno, 1.2)}
        >
          <Oznaka u={u} mirno={mirno} velikost={32} />
          <div className="flex items-baseline justify-between gap-6">
            <span className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text font-display text-[110px] font-bold leading-none tracking-[-0.04em] text-transparent">{u.glava}</span>
            <Vrednost v={u.vrednost} barva={barva} mirno={mirno} velikost={84} />
          </div>
          {u.pod && <span className="line-clamp-1 text-[36px] font-semibold text-[#b5b5bb]">{u.pod}</span>}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// =====================================================================
// KOLEDAR - Pregled (delovni dnevi do roka)
// =====================================================================
const K = { levo: 220, vrh: 420, sirina: 540, visina: 580, pas: 130 };

function ListKoledarja({ dni }: { dni: number | null }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center rounded-b-[40px] bg-[linear-gradient(180deg,#fafafb,#dcdcdf)]" style={{ top: K.pas }}>
      {dni === null || dni <= 0 ? (
        <span className="font-display text-[150px] font-bold leading-none tracking-[-0.04em] text-[#dc2626]">DANES</span>
      ) : (
        <>
          <span className="font-display text-[300px] font-bold leading-[0.85] tracking-[-0.05em] text-[#1c1c1f]">{dni}</span>
          <span className="mt-2 text-[40px] font-bold uppercase tracking-[0.1em] text-[#6b6b72]">{dni === 1 ? "dan" : dni === 2 ? "dneva" : "dni"}</span>
        </>
      )}
    </div>
  );
}

export function SvetKoledar({ i, u, mirno, barva }: SvetProps) {
  const dni = u.dni ?? null;
  const prej = dni !== null ? [dni + 2, dni + 1] : [];
  const tresi = u.razpolozenje === "zaskrbljen";
  return (
    <>
      <Kamera i={i} fokus="27% 62%" mirno={mirno}>
        <motion.div
          key={mirno ? "mirno" : `koledar${i}`}
          className="absolute"
          style={{ left: K.levo, top: K.vrh, width: K.sirina, height: K.visina }}
          animate={mirno || !tresi ? undefined : { x: [0, -16, 16, -12, 12, -6, 0] }}
          transition={{ duration: 0.8, delay: 2.3 }}
        >
          <div className="absolute inset-0 rounded-[40px] shadow-[0_50px_90px_-30px_#000]" />
          {/* pas z obročki */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-center rounded-t-[40px]" style={{ height: K.pas, background: `linear-gradient(135deg, ${barva}, color-mix(in srgb, ${barva} 55%, black))` }}>
            <span className="text-[44px] font-bold uppercase tracking-[0.08em] text-white">Rok {u.kdaj}</span>
          </div>
          {[0.25, 0.75].map((f) => (
            <span key={f} className="absolute h-16 w-7 rounded-full bg-[linear-gradient(180deg,#e5e5e8,#8a8a91)] shadow-[0_6px_10px_#0008]" style={{ left: `calc(${f * 100}% - 14px)`, top: -30 }} />
          ))}
          <ListKoledarja dni={dni} />
          {/* listi, ki se odtrgajo */}
          {!mirno &&
            prej.map((d, j) => (
              <motion.div
                key={`${i}:${d}`}
                className="absolute inset-x-0 bottom-0"
                style={{ top: K.pas, transformOrigin: "0% 0%" }}
                initial={{ rotate: 0, y: 0, x: 0, opacity: 1 }}
                animate={{ rotate: [0, -6, 28], y: [0, 16, 760], x: [0, -10, 180], opacity: [1, 1, 0] }}
                transition={{ duration: 1.1, delay: 0.9 + (prej.length - 1 - j) * 0.7, times: [0, 0.25, 1], ease: "easeIn" }}
              >
                <ListKoledarja dni={d} />
              </motion.div>
            ))}
        </motion.div>
        <motion.div className="absolute" style={{ left: K.levo + K.sirina - 40, top: K.vrh - 120, width: 270, rotate: 12 }}>
          <GlavaOdziv u={u} i={i} mirno={mirno} pogledX={8} className="w-full" />
        </motion.div>
      </Kamera>
      <Desno levo={1090}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} brezVrednosti brezTraku />
      </Desno>
    </>
  );
}
