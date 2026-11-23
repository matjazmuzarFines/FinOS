"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { Check, Clock, HelpCircle, Truck } from "lucide-react";
import { TONI, ure, type Scena, type Utrip } from "@/lib/tvScene";
import { GlavaOdziv, KRIVULJA, Konfeti, Oznaka, PodatekUtripa, PRELIV, Vrednost, besediloVrednosti, svetlejsa, temnejsa } from "./Skupno";

/**
 * SVETI animiranih scen - vsaka komponenta svojo postavitev (da TV ni vedno enak), Finesek povsod.
 * MIRNA SCENA (2026-11-20, televizor): vse je takoj narisano in miruje; v utripu se premakne EN del sveta, nato kratek
 * odziv glave. Nič ne teče ves čas.
 *   merilnik (Delo - prejšnji dan): kazalec se zasuče do ur (od prejšnjega položaja), oznaka PLAN; Finesek ob merilniku.
 *   podij (Zaključeni krovni): vsi stolpci se ob začetku dvignejo SKUPAJ (enkrat), Finesek se premakne na vrh trenutnega
 *     stolpca; konfeti samo pri "Skupaj".
 *   trak (Pripravljenost materiala): paketi enkrat pripeljejo (pri "pride"), trak miruje; manjkajoči = črtkani obrisi.
 *   pot (Delovni plan): cesta miruje, Finesek skoči do naslednje postaje, kartica nad postajo se prelije.
 *   koledar (Pregled): koledar odtrga liste do števila delovnih dni do roka, Finesek kuka izza koledarja.
 *   odpreme (Prioritete krovnih): tabla VSEH odprem krovnega (datum, kosi, družina, kupec, stanje) miruje; kamion
 *     pripelje do naslednje odpreme; daljši seznam = več strani (utripov), menjava s prelivom prosojnosti.
 * Oder 1920 × 1080; glava strani (naslov) je levo zgoraj do ~330 px - sveti so pod njo / desno.
 */

/** `zamik` (s) = kdaj se sme začeti gibanje utripa (prvi utrip šele po prehodu med okni). */
export type SvetProps = { scena: Scena; i: number; u: Utrip; mirno?: boolean; barva: string; zamik: number };

/** Podatek desno (od `levo` do desnega roba); menjava = preliv prosojnosti. */
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

export function SvetMerilnik({ i, u, mirno, zamik }: SvetProps) {
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
  const potLoka = lok(0, Math.max(vr, max * 0.002), max);
  return (
    <>
      {/* podatek je narisan PRED animiranim delom: kar je narisano za animiranim slojem, postane svoj (velik) sloj */}
      <Desno levo={1230}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} brezVrednosti brezTraku />
      </Desno>
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
        {/* lok je takoj narisan; sij = širša prosojna poteza (brez filtra drop-shadow) */}
        <path d={potLoka} fill="none" stroke={barva} strokeOpacity={0.22} strokeWidth={M.deb + 30} strokeLinecap="round" />
        <path d={potLoka} fill="none" stroke={barva} strokeWidth={M.deb} strokeLinecap="round" />
        {plan && (
          <>
            <line x1={M.cx + (M.r - M.deb / 2 - 6) * Math.cos(kotV(plan, max))} y1={M.cy + (M.r - M.deb / 2 - 6) * Math.sin(kotV(plan, max))} x2={px} y2={py} stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
            <text x={lx} y={ly} fill="#dcdcdf" fontSize={30} fontWeight={700} textAnchor="middle" dominantBaseline="middle" style={{ letterSpacing: "0.08em" }}>
              PLAN {ure(plan, true)} h
            </text>
          </>
        )}
      </svg>
      {/* kazalec: EDINO gibanje sveta - zasuče se od prejšnjega položaja do novega (prvič od 0) */}
      <motion.div
        className={`absolute rounded-full ${mirno ? "" : "fos-tv-sloj"}`}
        style={{ left: M.cx - 8, top: M.cy - (M.r - 50), width: 16, height: M.r - 50, transformOrigin: "50% 100%", background: "linear-gradient(180deg,#ffffff,#9a9aa1)", boxShadow: "0 0 24px rgb(255 255 255 / 0.5)" }}
        initial={mirno ? false : { rotate: -90 }}
        animate={{ rotate: kotKazalca }}
        transition={mirno ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 13, delay: zamik }}
      />
      <div className="absolute rounded-full border-[6px] border-[#121214]" style={{ left: M.cx - 34, top: M.cy - 34, width: 68, height: 68, background: `radial-gradient(circle at 35% 35%, #ffffff, ${barva})`, boxShadow: `0 0 30px ${barva}` }} />
      {/* odčitek pod sredino */}
      <div className="absolute flex justify-center" style={{ left: M.cx - 300, width: 600, top: M.cy + 34 }}>
        <Vrednost v={{ st: vr, predpona: u.vrednost.predpona, pripona: " h" }} barva={barva} velikost={84} />
      </div>
      <GlavaOdziv u={u} i={i} mirno={mirno} zamik={zamik} pogledX={8} className="absolute left-[870px] top-[560px] w-[340px]" />
    </>
  );
}

// =====================================================================
// PODIJ - Zaključeni krovni (stolpci produktivnosti)
// =====================================================================
const P = { dno: 950, visina: 540, x0: 150, sirina: 150, razmik: 46, max: 1.5 };
const visinaStolpca = (p: number) => (Math.min(Math.max(p, 0), P.max) / P.max) * P.visina;

export function SvetPodij({ scena, i, u, mirno, zamik }: SvetProps) {
  const stolpci = scena.utripi.map((x, j) => ({ x, j, p: (x.vrednost.st ?? 0) / 100, skupaj: x.kljuc === "skupaj" }));
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
      {/* vsi stolpci so takoj na mestu in se ob začetku scene dvignejo SKUPAJ (en CSS razred, preoblikovanje; ob menjavi
          utripa se samo obarva trenutni) */}
      <div className={`absolute inset-0 ${mirno ? "" : "fos-tv-raste"}`} style={{ "--z": `${zamik}s`, transformOrigin: `50% ${P.dno}px` } as React.CSSProperties}>
        {stolpci.map((s) => {
          const trenutni = s.j === i;
          const b = TONI[s.x.ton];
          return (
            <div key={s.j} className="absolute" style={{ left: levo(s.j), width: P.sirina, top: P.dno - P.visina - 20, height: P.visina + 20 }}>
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-[22px]"
                style={{
                  height: visinaStolpca(s.p),
                  background: trenutni ? `linear-gradient(180deg, ${b}, ${temnejsa(b, 0.45)})` : s.skupaj ? "linear-gradient(180deg,#facc15,#a16207)" : "linear-gradient(180deg,#4a4a52,#2a2a2f)",
                  boxShadow: trenutni ? `0 0 50px -6px ${b}` : undefined,
                }}
              >
                <span className="absolute inset-x-0 top-3 text-center font-display font-bold text-white" style={{ fontSize: trenutni ? 44 : 30 }}>
                  {trenutni ? besediloVrednosti({ st: s.p * 100, cela: true }) : Math.round(s.p * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {stolpci.map((s) => (
        <span key={s.j} className="absolute text-center font-display text-[30px] font-bold" style={{ left: levo(s.j), width: P.sirina, top: P.dno + 16, color: s.j === i ? "#ffffff" : "#6b6b72" }}>
          {s.skupaj ? "Skupaj" : s.x.glava}
        </span>
      ))}
      {/* podatek je narisan PRED animiranim delom: kar je narisano za animiranim slojem, postane svoj (velik) sloj */}
      <Desno levo={1230}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} brezTraku />
      </Desno>
      {/* Finesek na vrhu trenutnega stolpca (ob menjavi utripa se premakne do naslednjega) */}
      <motion.div
        className="absolute left-0 top-0"
        style={{ width: sirinaGlave }}
        initial={false}
        animate={{ x: levo(i) + P.sirina / 2 - sirinaGlave / 2, y: P.dno - h - 170 }}
        transition={mirno ? { duration: 0 } : { duration: 0.9, delay: zamik, ease: "easeInOut" }}
      >
        <GlavaOdziv u={u} i={i} mirno={mirno} zamik={zamik} pogledX={6} className="w-full" />
      </motion.div>
      {/* konfeti samo pri skupnem rezultatu celice (malo koščkov) */}
      {uspeh && !mirno && u.kljuc === "skupaj" && <Konfeti key={`konfeti${i}`} zamik={zamik + 1.2} />}
    </>
  );
}

// =====================================================================
// TRAK - Pripravljenost materiala
// =====================================================================
const T = { levo: 100, sirina: 1010, vrh: 860, skatla: 118 };

function Skatla({ crtkano, barva, vprasaj }: { crtkano?: boolean; barva: string; vprasaj?: boolean }) {
  if (crtkano)
    return (
      <div className="grid h-full w-full place-items-center rounded-[14px] border-[5px] border-dashed" style={{ borderColor: barva }}>
        {vprasaj && (
          <span style={{ color: barva }}>
            <HelpCircle className="h-14 w-14" strokeWidth={2.4} aria-hidden />
          </span>
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

export function SvetTrak({ i, u, mirno, zamik }: SvetProps) {
  const stanje = u.material ?? "zaloga";
  const barva = TONI[u.ton];
  const n = stanje === "zaloga" ? 3 : Math.max(1, Math.min(5, Math.round(u.vrednost.st ?? 1)));
  const cilj = (j: number) => T.levo + T.sirina - 290 - j * (T.skatla + 26);
  const crtkano = stanje === "ni_naroceno" || stanje === "zapadel" || stanje === "prepozno";
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
      <Desno levo={1230}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} />
      </Desno>
      {Array.from({ length: 8 }, (_, j) => (
        <div key={j} className="absolute h-10 w-10 rounded-full border-4 border-[#3a3a40] bg-[#18181b]" style={{ left: T.levo + 40 + j * 130, top: T.vrh + 52 }} />
      ))}
      {/* tablica */}
      <div className="absolute flex items-center gap-4 rounded-full border-2 px-7 py-3 text-[36px] font-bold" style={{ left: T.levo + 20, top: T.vrh - 250, color: barva, borderColor: `${barva}88`, background: `${barva}1f` }}>
        <tag.ikona className="h-10 w-10" strokeWidth={2.4} aria-hidden />
        {tag.besedilo}
      </div>
      {/* trak (miruje) */}
      <div
        className="absolute rounded-[23px]"
        style={{ left: T.levo, width: T.sirina, top: T.vrh, height: 46, backgroundImage: "repeating-linear-gradient(90deg,#2b2b30 0 40px,#1d1d21 40px 80px)", boxShadow: "inset 0 3px 0 rgb(255 255 255 / 0.08), 0 20px 40px -18px #000" }}
      />
      {/* zamujajoča škatla: obtiči daleč na traku (miruje) */}
      {(stanje === "prepozno" || stanje === "zapadel") && (
        <div className="absolute" style={{ left: T.levo + 40, top: T.vrh - T.skatla - 2, width: T.skatla, height: T.skatla, transform: "rotate(-3deg)" }}>
          <Skatla barva={barva} />
        </div>
      )}
      {/* škatle: pri "pride" enkrat pripeljejo z leve (edino gibanje), sicer so takoj na mestu */}
      {Array.from({ length: n }, (_, j) => {
        const x = cilj(j);
        return (
          <div key={`${i}:${j}`} className="absolute" style={{ left: x, top: T.vrh - T.skatla - 2, width: T.skatla, height: T.skatla }}>
            {crtkano ? (
              <Skatla crtkano barva={barva} vprasaj={stanje === "ni_naroceno"} />
            ) : (
              <motion.div
                className="h-full w-full"
                initial={mirno || stanje !== "pride" ? false : { x: T.levo - x - 200 }}
                animate={{ x: 0 }}
                transition={mirno ? { duration: 0 } : { duration: 1.6, delay: zamik + (n - 1 - j) * 0.2, ease: KRIVULJA }}
              >
                <Skatla barva={barva} />
              </motion.div>
            )}
          </div>
        );
      })}
      {stanje === "zaloga" && (
        <span className="absolute grid h-20 w-20 place-items-center rounded-full bg-[#22c55e] text-white shadow-[0_0_40px_#22c55e]" style={{ left: cilj(0) + T.skatla - 30, top: T.vrh - T.skatla - 52 }}>
          <Check className="h-12 w-12" strokeWidth={3.5} aria-hidden />
        </span>
      )}
      <GlavaOdziv u={u} i={i} mirno={mirno} zamik={zamik} pogledX={-8} className="absolute left-[860px] top-[560px] w-[270px]" />
    </>
  );
}

// =====================================================================
// POT - Delovni plan (postaje = krovni)
// =====================================================================
const C = { y: 840, levo: 240, desno: 1580, krog: 92, glava: 190 };

export function SvetPot({ scena, i, u, mirno, zamik }: SvetProps) {
  const n = scena.utripi.length;
  const x = (j: number) => (n === 1 ? 960 : C.levo + (j * (C.desno - C.levo)) / (n - 1));
  const barva = TONI[u.ton];
  const sirinaKartice = 700;
  const levoKartice = Math.max(110, Math.min(1920 - 110 - sirinaKartice, x(i) - sirinaKartice / 2));
  // skok Fineseka do postaje (enkrat na utrip; glava se ne vstavlja znova)
  const [skok, animiraj] = useAnimate<HTMLDivElement>();
  useEffect(() => {
    if (mirno || !skok.current) return;
    const a = animiraj(skok.current, { y: [0, -130, 0] }, { duration: 0.9, delay: zamik, ease: "easeInOut" });
    return () => a.stop();
  }, [i, mirno]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {/* cesta (miruje) */}
      <div
        className="absolute rounded-full"
        style={{ left: 120, right: 120, top: C.y - 36, height: 72, background: "linear-gradient(180deg,#34343a,#1c1c20)", boxShadow: "inset 0 3px 0 rgb(255 255 255 / 0.08), 0 30px 50px -25px #000" }}
      />
      <div className="absolute h-[6px]" style={{ left: 150, right: 150, top: C.y - 3, opacity: 0.5, backgroundImage: "repeating-linear-gradient(90deg,#9a9aa1 0 40px,transparent 40px 80px)" }} />
      {/* postaje (brez animacije barv - samo stanje utripa) */}
      {scena.utripi.map((s, j) => {
        const b = TONI[s.ton];
        const zdaj = j === i;
        return (
          <div key={s.kljuc + j} className="absolute flex flex-col items-center" style={{ left: x(j) - 150, width: 300, top: C.y - C.krog / 2 }}>
            <div
              className="grid place-items-center rounded-full border-[6px] font-display text-[40px] font-bold"
              style={{
                width: C.krog,
                height: C.krog,
                borderColor: zdaj ? b : j < i ? "#4a4a52" : "#3a3a40",
                backgroundColor: zdaj ? b : j < i ? "#2a2a2f" : "#18181b",
                color: zdaj ? "#ffffff" : "#6b6b72",
                boxShadow: zdaj ? `0 0 50px ${b}` : undefined,
                transform: zdaj ? "scale(1.12)" : undefined,
              }}
            >
              {j < i ? <Check className="h-11 w-11" strokeWidth={3} aria-hidden /> : j + 1}
            </div>
            <span className="mt-3 font-display text-[34px] font-bold" style={{ color: zdaj ? "#ffffff" : "#8a8a91" }}>
              {s.glava}
            </span>
            <span className="text-[24px] font-medium text-[#8a8a91]">{s.kdaj}</span>
            {s.danes && <span className="mt-2 rounded-full bg-[#22c55e] px-4 py-1 text-[22px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_0_24px_#22c55e]">Danes</span>}
          </div>
        );
      })}
      {/* Finesek skoči od postaje do postaje (premik + skok = edino gibanje sveta) */}
      <motion.div
        className="absolute left-0"
        style={{ width: C.glava, top: C.y - C.krog / 2 - 140 }}
        initial={mirno ? false : { x: x(Math.max(0, i - 1)) - C.glava / 2 }}
        animate={{ x: x(i) - C.glava / 2 }}
        transition={mirno ? { duration: 0 } : { duration: 0.9, delay: zamik, ease: "easeInOut" }}
      >
        <div ref={skok}>
          <GlavaOdziv u={u} i={i} mirno={mirno} zamik={zamik} pogledX={0} className="w-full" />
        </div>
      </motion.div>
      {/* kartica nad postajo (menjava = preliv prosojnosti) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mirno ? "mirno" : `kartica${i}`}
          className="absolute flex flex-col gap-3 rounded-[36px] border-2 px-9 py-7"
          style={{ left: levoKartice, width: sirinaKartice, top: 350, borderColor: `${barva}88`, background: "linear-gradient(160deg, rgb(43 43 47 / 0.92), rgb(18 18 20 / 0.95))", boxShadow: `0 40px 90px -40px ${barva}` }}
          {...PRELIV}
          initial={mirno ? false : PRELIV.initial}
        >
          <Oznaka u={u} velikost={32} />
          <div className="flex items-baseline justify-between gap-6">
            <span className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text font-display text-[110px] font-bold leading-none tracking-[-0.04em] text-transparent">{u.glava}</span>
            <Vrednost v={u.vrednost} barva={barva} velikost={84} />
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

export function SvetKoledar({ i, u, mirno, barva, zamik }: SvetProps) {
  const dni = u.dni ?? null;
  // en list se odtrga (prej dva + tresenje koledarja)
  const prej = dni !== null ? [dni + 1] : [];
  return (
    <>
      <Desno levo={1090}>
        <PodatekUtripa key={mirno ? "mirno" : `${i}:${u.kljuc}`} u={u} mirno={mirno} brezVrednosti brezTraku />
      </Desno>
      <div className="absolute" style={{ left: K.levo, top: K.vrh, width: K.sirina, height: K.visina }}>
        <div className="absolute inset-0 rounded-[40px] shadow-[0_50px_90px_-30px_#000]" />
        {/* pas z obročki */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-center rounded-t-[40px]" style={{ height: K.pas, background: `linear-gradient(135deg, ${barva}, ${temnejsa(barva, 0.55)})` }}>
          <span className="text-[44px] font-bold uppercase tracking-[0.08em] text-white">Rok {u.kdaj}</span>
        </div>
        {[0.25, 0.75].map((f) => (
          <span key={f} className="absolute h-16 w-7 rounded-full bg-[linear-gradient(180deg,#e5e5e8,#8a8a91)] shadow-[0_6px_10px_#0008]" style={{ left: `calc(${f * 100}% - 14px)`, top: -30 }} />
        ))}
        <ListKoledarja dni={dni} />
        {/* list, ki se odtrga (edino gibanje sveta) */}
        {!mirno &&
          prej.map((d) => (
            <motion.div
              key={`${i}:${d}`}
              className="fos-tv-sloj absolute inset-x-0 bottom-0"
              style={{ top: K.pas, transformOrigin: "0% 0%" }}
              initial={{ rotate: 0, y: 0, x: 0, opacity: 1 }}
              animate={{ rotate: [0, -6, 28], y: [0, 16, 760], x: [0, -10, 180], opacity: [1, 1, 0] }}
              transition={{ duration: 1.1, delay: zamik + 0.2, times: [0, 0.25, 1], ease: "easeIn" }}
            >
              <ListKoledarja dni={d} />
            </motion.div>
          ))}
      </div>
      <div className="absolute" style={{ left: K.levo + K.sirina - 40, top: K.vrh - 120, width: 270, transform: "rotate(12deg)" }}>
        <GlavaOdziv u={u} i={i} mirno={mirno} zamik={zamik} pogledX={8} className="w-full" />
      </div>
    </>
  );
}

// =====================================================================
// ODPREME - Prioritete krovnih (tabla odprem kot tabla odhodov)
// =====================================================================
const O = { levo: 110, vrh: 380, sirina: 1190, glava: 54, vrsta: 92, desno: 1370 };

export function SvetOdpreme({ i, u, mirno, barva, zamik }: SvetProps) {
  const vrstice = u.odpreme ?? [];
  const ton = TONI[u.ton];
  return (
    <>
      {/* tabla: glava stolpcev + vrstice strani (menjava strani = preliv prosojnosti) */}
      <div className="absolute overflow-hidden rounded-[32px] border-2 border-white/10" style={{ left: O.levo, top: O.vrh, width: O.sirina, height: O.glava + 6 * O.vrsta + 24, background: "linear-gradient(170deg, rgb(43 43 47 / 0.9), rgb(18 18 20 / 0.95))", boxShadow: "0 40px 90px -40px #000" }}>
        <div className="flex items-center gap-6 px-8 text-[22px] font-bold uppercase tracking-[0.14em] text-[#8a8a91]" style={{ height: O.glava, borderBottom: `3px solid ${barva}55` }}>
          <span className="w-[310px]">Odprema</span>
          <span className="w-[190px]">Kosi</span>
          <span className="flex-1">Kupec</span>
          <span className="w-[220px] text-right">{u.stran && u.stran.n > 1 ? `Stran ${u.stran.i} / ${u.stran.n}` : "Stanje"}</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mirno ? "mirno" : `stran${i}`} className="absolute inset-x-0 px-3" style={{ top: O.glava + 10 }} {...PRELIV} initial={mirno ? false : PRELIV.initial}>
            {vrstice.length ? (
              vrstice.map((v) => {
                const b = TONI[v.ton];
                return (
                  <div
                    key={v.kljuc}
                    className="relative flex items-center gap-6 rounded-[20px] px-5"
                    style={{ height: O.vrsta - 8, marginBottom: 8, background: v.naslednja ? `linear-gradient(90deg, ${barva}33, ${barva}0d)` : "rgb(255 255 255 / 0.03)", boxShadow: v.naslednja ? `inset 0 0 0 3px ${barva}` : undefined }}
                  >
                    <span className="flex w-[310px] shrink-0 items-center gap-3 whitespace-nowrap font-display text-[40px] font-bold text-white">
                      {v.naslednja ? (
                        // kamion pripelje do naslednje odpreme (EDINO gibanje sveta, enkrat na utrip)
                        <motion.span
                          className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl text-white ${mirno ? "" : "fos-tv-sloj"}`}
                          style={{ background: `linear-gradient(135deg, ${svetlejsa(barva, 0.6)}, ${barva} 50%, ${temnejsa(barva, 0.55)})` }}
                          initial={mirno ? false : { x: -360, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={mirno ? { duration: 0 } : { duration: 1.3, delay: zamik, ease: KRIVULJA }}
                        >
                          <Truck className="h-9 w-9" strokeWidth={2.4} aria-hidden />
                        </motion.span>
                      ) : (
                        <span className="h-14 w-14 shrink-0" />
                      )}
                      {v.dan}
                    </span>
                    <span className="flex w-[190px] shrink-0 items-baseline gap-2">
                      <span className="font-display text-[48px] font-bold" style={{ color: v.naslednja ? svetlejsa(barva, 0.75) : "#ee7a3a" }}>
                        {v.kos}
                      </span>
                      <span className="truncate text-[28px] font-semibold text-[#b5b5bb]">{v.druzina ? `× ${v.druzina}` : "kos"}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[32px] font-semibold text-[#b5b5bb]">{v.kupec ?? ""}</span>
                    <span className="w-[220px] shrink-0 text-right">
                      <span className="inline-block whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-[23px] font-bold uppercase tracking-[0.04em]" style={{ color: b, borderColor: `${b}88`, background: `${b}1f` }}>
                        {v.stanje}
                      </span>
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="grid place-items-center text-center text-[44px] font-semibold text-[#9a9aa1]" style={{ height: 5 * O.vrsta }}>
                Ni naročil - krovni gre na zalogo.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* povzetek desno: oznaka, naročeni kosi, delež v krovnem, stavek (miruje, menja se s prelivom) */}
      <div className="absolute flex flex-col gap-5" style={{ left: O.desno, right: 110, top: 540 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mirno ? "mirno" : `povzetek${u.oznaka}`} className="flex flex-col gap-4" {...PRELIV} initial={mirno ? false : PRELIV.initial}>
            <Oznaka u={u} velikost={30} />
            <div className="flex flex-col">
              <Vrednost v={u.vrednost} barva={ton} velikost={110} />
              <span className="mt-1 text-[28px] font-bold uppercase tracking-[0.12em] text-[#9a9aa1]">naročenih</span>
            </div>
            {u.trak != null && (
              <div className="h-5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${Math.min(1, u.trak) * 100}%`, background: `linear-gradient(90deg, ${temnejsa(ton, 0.55)}, ${ton})` }} />
              </div>
            )}
            <p className="line-clamp-2 text-[34px] font-semibold leading-tight text-[#dcdcdf]">{u.stavek}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <GlavaOdziv u={u} i={i} mirno={mirno} zamik={zamik} pogledX={-8} className="absolute left-[1470px] top-[270px] w-[250px]" />
    </>
  );
}
