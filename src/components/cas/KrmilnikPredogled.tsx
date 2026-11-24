"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CreditCard, MonitorSmartphone, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { FunkcijaTipke } from "@/lib/casNastavitve";
import { Panel } from "./Skupno";

/** Tipka v predogledu (osnutek s strani Krmilnik - pokaže se še pred shranjevanjem). */
export type TipkaPredogleda = { tipka: number; besedilo: string; funkcija: FunkcijaTipke | null };

const ZASLONI = [
  { id: "800", w: 800, h: 480, ime: '7" (800 × 480)' },
  { id: "1024", w: 1024, h: 600, ime: '7" HD (1024 × 600)' },
  { id: "1280", w: 1280, h: 800, ime: '10" (1280 × 800)' },
  { id: "480p", w: 480, h: 800, ime: '7" pokončen (480 × 800)' },
  { id: "600p", w: 600, h: 1024, ime: '7" HD pokončen (600 × 1024)' },
  { id: "800p", w: 800, h: 1280, ime: '10" pokončen (800 × 1280)' },
] as const;
const DNEVI = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];
const FINES = "linear-gradient(135deg, #f19a66, #ee7a3a 30%, #ca5010 70%, #8f380b)";

/** Finesek v kotu potrdila (kot krmilnik/ui - slog krmilnik/ui/finesek.css, uvožen v globals.css). */
export type PrizorFineseka = "maha" | "malica" | "odhod";
export type Potrdilo = { barva: string; ikona: string; naslov: string; opis: string; zigi?: string[]; prizor?: PrizorFineseka; hrana?: string; id?: number };
const HRANA = ["burger", "pica", "sendvic"];
const MALICA = /malic|kosil|obrok|hran|jest/i;

/** Ista oznaka kot krmilnik/ui/index.html (#finesek) - deli /finesek/*.webp, prizor = razred fz--{prizor}. */
function FinesekPotrdila({ prizor, hrana, h }: { prizor: PrizorFineseka; hrana?: string; h: number }) {
  const s = h / 750;
  const del = (razred: string, slika: string) => (
    <div className={`fz-del ${razred}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/finesek/${slika}.webp`} alt="" />
    </div>
  );
  return (
    <div className={`fz fz--${prizor}`} aria-hidden style={{ width: 640 * s, height: h, left: h * 0.05, bottom: h * 0.05, ["--s" as string]: s }}>
      <div className="fz-platno">
        <div className="fz-odeja" />
        <div className="fz-senca" />
        <div className="fz-lik">
          <div className="fz-spredaj">
            {del("fz-noga-l", "noga-leva")}
            {del("fz-noga-d", "noga-desna")}
            {del("fz-roka-l", "roka-leva")}
            {del("fz-roka-d", "roka-desna")}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="fz-telo" src="/finesek/telo-spredaj.webp" alt="" />
            <div className="fz-hrana">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {hrana && <img src={`/finesek/hrana-${hrana}.svg`} alt="" />}
            </div>
            <div className="fz-drobtine">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="fz-stran">
            {del("fz-snoga-z", "noga-desna")}
            {del("fz-snoga-s", "noga-desna")}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="fz-telo-stran" src="/finesek/telo-stran.webp" alt="" />
            {del("fz-sroka", "roka-desna")}
          </div>
        </div>
      </div>
    </div>
  );
}
/** Vodenje od zunaj (promo video): izbrana tipka, potrdilo, stanje zveze. */
export type NadzorPredogleda = { izbrana: number | null; potrdilo: Potrdilo | null; brezPovezave: boolean };

/**
 * Predogled zaslona krmilnika (Raspberry Pi, krmilnik/ui) - enake mere in barve kot na napravi, izrisan v izbrani
 * ločljivosti in pomanjšan na širino panela. Tipke iz osnutka (prikaz "Krmilnik"); klik na tipko jo izbere kot na
 * napravi, "Prisloni kartico" pokaže potrdilo žiga. Ko spremeniš krmilnik/ui, uskladi tudi ta predogled.
 */
export function KrmilnikPredogled({ tipke, ime, samoZaslon, nadzor }: { tipke: TipkaPredogleda[]; ime: string; /** samo naprava (brez panela in gumbov) */ samoZaslon?: boolean; nadzor?: NadzorPredogleda }) {
  const [zaslon, setZaslon] = useState<(typeof ZASLONI)[number]>(ZASLONI[0]);
  const [sirina, setSirina] = useState(0);
  const [zdaj, setZdaj] = useState(() => new Date());
  const [izbrana, setIzbrana] = useState<number | null>(null);
  const [potrdilo, setPotrdilo] = useState<Potrdilo | null>(null);
  const [brezPovezave, setBrezPovezave] = useState(false);
  const okvir = useRef<HTMLDivElement>(null);
  const zadnjiPrislon = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setZdaj(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!okvir.current) return;
    const ro = new ResizeObserver(([e]) => setSirina(e.contentRect.width));
    ro.observe(okvir.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!potrdilo) return;
    const t = setTimeout(() => setPotrdilo(null), potrdilo.zigi ? 5000 : 3500);
    return () => clearTimeout(t);
  }, [potrdilo]);

  const izbranaT = nadzor ? nadzor.izbrana : izbrana;
  const potrdiloT = nadzor ? nadzor.potrdilo : potrdilo;
  const brezT = nadzor ? nadzor.brezPovezave : brezPovezave;
  const { w: W, h: H } = zaslon;
  // kot krmilnik.css: velikosti v vmin (krajša stranica); pokončen zaslon = ura zgoraj, tipke pod njo, vse večje
  const pokoncen = H > W;
  const vm = (x: number) => (Math.min(W, H) * x) / 100;
  const vw = (x: number) => (W * x) / 100;
  /** ležeč / pokončen (vmin) */
  const p = (lezec: number, pokoncno: number) => vm(pokoncen ? pokoncno : lezec);
  const merilo = sirina ? sirina / W : 0;
  const tipka = tipke.find((t) => t.tipka === izbranaT) ?? null;
  const dv = (n: number) => String(n).padStart(2, "0");
  const ura = `${dv(zdaj.getHours())}:${dv(zdaj.getMinutes())}`;

  const kartica = () => {
    const t = tipka;
    setIzbrana(null);
    if (t?.funkcija === "info") return setPotrdilo({ barva: "#60a5fa", ikona: "i", naslov: "Matej", opis: "Današnji žigi:", zigi: ["06:52", "10:02 · Odmor", "10:31"] });
    if (t?.funkcija === "preklici") return setPotrdilo({ barva: "#f59e0b", ikona: "↶", naslov: "Zadnji žig je preklican", opis: "Matej" });
    if (brezPovezave) return setPotrdilo({ barva: "#22c55e", ikona: "✓", naslov: "Zabeleženo", opis: `${ura}${t ? ` · ${t.besedilo}` : ""} - poslano bo, ko bo povezava` });
    // kot krmilnik: takoj "Zabeleženo" (shranjeno na napravi), ime dopiše odgovor FIN:OS
    const id = ++zadnjiPrislon.current;
    setPotrdilo({ barva: "#22c55e", ikona: "✓", naslov: "Zabeleženo", opis: `${ura}${t ? ` · ${t.besedilo}` : ""}` });
    setTimeout(() => {
      if (zadnjiPrislon.current !== id) return;
      // prizor Fineseka: malica (tipka z "malica"), odhod (druga tipka), sicer prihod - pomaha
      const malica = !!t && MALICA.test(t.besedilo);
      setPotrdilo({
        barva: "#22c55e",
        ikona: "✓",
        naslov: malica ? "Dober tek, Matej!" : t ? "Nasvidenje, Matej!" : "Dober dan, Matej!",
        opis: `${ura} · ${t ? t.besedilo : "Prihod"}`,
        prizor: malica ? "malica" : t ? "odhod" : "maha",
        hrana: HRANA[id % HRANA.length],
        id,
      });
    }, 400);
  };

  const naprava = (
    <>
      {/* ohišje naprave */}
      <div className={`rounded-[22px] bg-[linear-gradient(160deg,#3a3a3f,#1c1c1f)] p-3 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.1)] ${pokoncen ? "mx-auto w-full max-w-[340px]" : ""}`}>
        <div ref={okvir} className="relative overflow-hidden rounded-[10px] bg-black" style={{ aspectRatio: `${W} / ${H}` }}>
          {merilo > 0 && (
            <div
              className="absolute left-0 top-0 origin-top-left select-none text-white"
              style={{ width: W, height: H, transform: `scale(${merilo})`, background: "radial-gradient(ellipse at top, #2b2b2f, #1c1c1f 45%, #121214)", fontFamily: '"Segoe UI", Inter, system-ui, sans-serif' }}
            >
              <div className="flex h-full flex-col" style={{ padding: pokoncen ? `${vm(2.4)}px ${vm(3)}px` : `${vm(2)}px ${vw(2.4)}px`, gap: p(2, 2.4) }}>
                {/* glava */}
                <div className="flex items-center" style={{ gap: pokoncen ? vm(2.4) : vw(1.6), paddingBottom: vm(1.4), borderBottom: "3px solid", borderImage: "linear-gradient(90deg,#8f380b,#ca5010 30%,#ee7a3a 60%,#ca5010) 1" }}>
                  <span className="flex items-center font-extrabold" style={{ fontSize: p(4.2, 6.4), letterSpacing: "-0.04em" }}>
                    <span className="bg-[linear-gradient(180deg,#fff,#dcdcdf_55%,#9a9aa1)] bg-clip-text text-transparent">FIN</span>
                    <span className="inline-flex flex-col" style={{ gap: vm(0.6), margin: `0 ${vw(0.5)}px` }}>
                      {[0, 1].map((i) => (
                        <i key={i} className="block rounded-[2px] bg-[#ee7a3a] shadow-[0_0_10px_#ee7a3a]" style={{ width: vm(1), height: vm(1) }} />
                      ))}
                    </span>
                    <span className="bg-clip-text text-transparent" style={{ backgroundImage: FINES }}>
                      OS
                    </span>
                  </span>
                  <span className="font-semibold text-[#9a9aa1]" style={{ fontSize: p(2.4, 3.6) }}>
                    {ime || "Krmilnik"}
                  </span>
                  <span className="ml-auto flex items-center font-semibold" style={{ gap: pokoncen ? vm(1.4) : vw(0.8), fontSize: p(2.3, 3.4), color: brezT ? "#f59e0b" : "#9a9aa1" }}>
                    <i className="block rounded-full" style={{ width: p(1.4, 2.2), height: p(1.4, 2.2), background: brezT ? "#f59e0b" : "#22c55e", boxShadow: `0 0 10px ${brezT ? "#f59e0b" : "#22c55e"}` }} />
                    {brezT ? "Brez povezave · čaka 2" : "Na zvezi"}
                  </span>
                </div>

                {/* vsebina */}
                <div className="grid min-h-0 flex-1" style={pokoncen ? { gridTemplateColumns: "1fr", gridTemplateRows: "auto 1fr", gap: vm(3) } : { gridTemplateColumns: "1.15fr 1fr", gap: vw(2.4) }}>
                  <div
                    className="relative flex flex-col items-center justify-center overflow-hidden"
                    style={{ gap: p(2, 2.4), padding: pokoncen ? `${vm(4)}px ${vm(2)}px` : undefined, borderRadius: 24, border: "1px solid rgb(0 0 0 / 0.5)", background: "linear-gradient(180deg,#0b0b0d,#17171a)", boxShadow: "inset 0 3px 18px rgb(0 0 0 / 0.85)" }}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.025)_0_1px,transparent_1px_3px)]" />
                    <span className="font-mono capitalize text-[rgb(246_195_159/0.75)]" style={{ fontSize: p(2.8, 4.2) }}>
                      {DNEVI[zdaj.getDay()]}, {zdaj.getDate()}. {zdaj.getMonth() + 1}. {zdaj.getFullYear()}
                    </span>
                    <span className="flex items-baseline font-extrabold tabular-nums text-[#ffb27d] [text-shadow:0_0_30px_rgb(238_122_58/0.75)]" style={{ fontSize: p(19, 24), lineHeight: 1 }}>
                      {dv(zdaj.getHours())}
                      <span className={zdaj.getSeconds() % 2 ? "opacity-25" : ""}>:</span>
                      {dv(zdaj.getMinutes())}
                      <small className="text-[rgb(255_178_125/0.7)]" style={{ fontSize: p(6, 8), marginLeft: vw(1) }}>
                        {dv(zdaj.getSeconds())}
                      </small>
                    </span>
                    <span className="flex items-center font-bold" style={{ gap: pokoncen ? vm(2) : vw(1.2), fontSize: p(3.6, 5.2), color: tipka ? "#ffb27d" : "#dcdcdf" }}>
                      <CreditCard className="text-[#ee7a3a]" style={{ width: p(5, 7), height: p(5, 7) }} aria-hidden />
                      {tipka ? `${tipka.besedilo} - prisloni kartico` : "Prisloni kartico"}
                    </span>
                  </div>

                  <div className="grid min-h-0" style={{ gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: p(1.6, 2.4) }}>
                    {tipke.map((t) => {
                      const izbr = t.tipka === izbranaT;
                      const s: CSSProperties = {
                        gap: pokoncen ? vm(2.4) : vw(1.2),
                        padding: `0 ${pokoncen ? vm(3) : vw(1.2)}px`,
                        borderRadius: 16,
                        fontSize: p(2.9, 4.6),
                        border: `1px solid ${izbr ? "#ee7a3a" : "rgb(255 255 255 / 0.1)"}`,
                        background: izbr ? "rgb(202 80 16 / 0.25)" : "linear-gradient(160deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02))",
                        boxShadow: izbr ? "0 0 26px -8px #ee7a3a" : undefined,
                      };
                      return (
                        <button key={t.tipka} type="button" title={`Na krmilniku: ${t.besedilo}`} onClick={() => setIzbrana(izbr ? null : t.tipka)} className="flex items-center text-left font-bold text-white transition-transform active:scale-95" style={s}>
                          <span
                            className="grid shrink-0 place-items-center"
                            style={{ minWidth: p(5.4, 8.4), height: p(5.4, 8.4), padding: `0 ${vm(0.6)}px`, borderRadius: 10, background: FINES, fontSize: p(2.6, 4.2), boxShadow: "0 0 14px -4px #ee7a3a" }}
                          >
                            {t.funkcija === "info" ? "i" : t.funkcija === "preklici" ? "↶" : t.tipka}
                          </span>
                          <span className="min-w-0 truncate">{t.besedilo || "(brez besedila)"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* potrdilo žiga */}
              {potrdiloT && (
                <div className="absolute inset-0 grid place-items-center bg-[rgb(18_18_20/0.86)]">
                  <div
                    className="relative text-center"
                    style={{
                      ...(pokoncen ? { width: vw(90), padding: `${vm(6)}px ${vm(5)}px` } : { minWidth: vw(55), maxWidth: vw(88), padding: `${vm(4)}px ${vw(4)}px` }),
                      ...(potrdiloT.prizor ? { paddingLeft: (pokoncen ? vm(5) : vw(4)) + (640 * vm(30)) / 750 + 8 } : {}),
                      borderRadius: 28,
                      background: "linear-gradient(160deg,#2b2b2f,#18181b)",
                      border: `2px solid ${potrdiloT.barva}`,
                      boxShadow: `0 0 60px -10px ${potrdiloT.barva}`,
                    }}
                  >
                    {potrdiloT.prizor && <FinesekPotrdila key={potrdiloT.id} prizor={potrdiloT.prizor} hrana={potrdiloT.hrana} h={vm(30)} />}
                    <div style={{ fontSize: p(12, 20), lineHeight: 1, color: potrdiloT.barva }}>{potrdiloT.ikona}</div>
                    <div className="font-extrabold" style={{ marginTop: vm(1.5), fontSize: p(6, 8) }}>
                      {potrdiloT.naslov}
                    </div>
                    <div className="text-[#dcdcdf]" style={{ marginTop: vm(1), fontSize: p(3.4, 5) }}>
                      {potrdiloT.opis}
                    </div>
                    {potrdiloT.zigi && (
                      <div className="flex flex-wrap justify-center" style={{ marginTop: vm(2), gap: pokoncen ? vm(1.6) : `${vm(1)}px ${vw(1)}px`, fontSize: p(3, 4.4) }}>
                        {potrdiloT.zigi.map((z) => (
                          <span key={z} className="rounded-full bg-white/10" style={{ padding: pokoncen ? `${vm(1)}px ${vm(2.4)}px` : `${vm(0.6)}px ${vw(1.2)}px` }}>
                            {z}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </>
  );
  if (samoZaslon) return naprava;
  return (
    <Panel
      naslov={
        <span className="flex items-center gap-1.5">
          <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden />
          Predogled krmilnika
        </span>
      }
      desno={
        <select
          value={zaslon.id}
          onChange={(e) => setZaslon(ZASLONI.find((z) => z.id === e.target.value) ?? ZASLONI[0])}
          title="Velikost zaslona krmilnika"
          className="h-8 cursor-pointer rounded-[8px] border border-white/10 bg-white/[0.05] px-2 text-xs text-ink-200 [&>option]:bg-ink-900"
        >
          {ZASLONI.map((z) => (
            <option key={z.id} value={z.id}>
              {z.ime}
            </option>
          ))}
        </select>
      }
    >
      {naprava}
      <div className="flex flex-wrap items-center gap-2">
        <Button hint="Pokaži, kaj se izpiše, ko zaposleni prisloni kartico" variant="neutral" icon={CreditCard} onClick={kartica} className="!h-9 !text-xs">
          Prisloni kartico (preizkus)
        </Button>
        <Button hint={brezPovezave ? "Pokaži krmilnik na zvezi" : "Pokaži krmilnik brez wifija"} variant="neutral" icon={WifiOff} onClick={() => setBrezPovezave((x) => !x)} className={`!h-9 !text-xs ${brezPovezave ? "!border-warn-500/60 !text-warn-500" : ""}`}>
          Brez povezave
        </Button>
        <span className="text-xs text-ink-500">Klik na tipko jo izbere kot na napravi. Prikaže tipke s prikazom »Krmilnik« - tudi neshranjene.</span>
      </div>
    </Panel>
  );
}
