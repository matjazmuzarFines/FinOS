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
] as const;
const DNEVI = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];
const FINES = "linear-gradient(135deg, #f19a66, #ee7a3a 30%, #ca5010 70%, #8f380b)";

export type Potrdilo = { barva: string; ikona: string; naslov: string; opis: string; zigi?: string[] };
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
  const vh = (x: number) => (H * x) / 100;
  const vw = (x: number) => (W * x) / 100;
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
    setPotrdilo({ barva: "#22c55e", ikona: "✓", naslov: t ? "Nasvidenje, Matej!" : "Dober dan, Matej!", opis: `${ura} · ${t ? t.besedilo : "Prihod"}` });
  };

  const naprava = (
    <>
      {/* ohišje naprave */}
      <div className="rounded-[22px] bg-[linear-gradient(160deg,#3a3a3f,#1c1c1f)] p-3 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.1)]">
        <div ref={okvir} className="relative overflow-hidden rounded-[10px] bg-black" style={{ aspectRatio: `${W} / ${H}` }}>
          {merilo > 0 && (
            <div
              className="absolute left-0 top-0 origin-top-left select-none text-white"
              style={{ width: W, height: H, transform: `scale(${merilo})`, background: "radial-gradient(ellipse at top, #2b2b2f, #1c1c1f 45%, #121214)", fontFamily: '"Segoe UI", Inter, system-ui, sans-serif' }}
            >
              <div className="flex h-full flex-col" style={{ padding: `${vh(2)}px ${vw(2.4)}px`, gap: vh(2) }}>
                {/* glava */}
                <div className="flex items-center" style={{ gap: vw(1.6), paddingBottom: vh(1.4), borderBottom: "3px solid", borderImage: "linear-gradient(90deg,#8f380b,#ca5010 30%,#ee7a3a 60%,#ca5010) 1" }}>
                  <span className="flex items-center font-extrabold" style={{ fontSize: vh(4.2), letterSpacing: "-0.04em" }}>
                    <span className="bg-[linear-gradient(180deg,#fff,#dcdcdf_55%,#9a9aa1)] bg-clip-text text-transparent">FIN</span>
                    <span className="inline-flex flex-col" style={{ gap: vh(0.6), margin: `0 ${vw(0.5)}px` }}>
                      {[0, 1].map((i) => (
                        <i key={i} className="block rounded-[2px] bg-[#ee7a3a] shadow-[0_0_10px_#ee7a3a]" style={{ width: vh(1), height: vh(1) }} />
                      ))}
                    </span>
                    <span className="bg-clip-text text-transparent" style={{ backgroundImage: FINES }}>
                      OS
                    </span>
                  </span>
                  <span className="font-semibold text-[#9a9aa1]" style={{ fontSize: vh(2.4) }}>
                    {ime || "Krmilnik"}
                  </span>
                  <span className="ml-auto flex items-center font-semibold" style={{ gap: vw(0.8), fontSize: vh(2.3), color: brezT ? "#f59e0b" : "#9a9aa1" }}>
                    <i className="block rounded-full" style={{ width: vh(1.4), height: vh(1.4), background: brezT ? "#f59e0b" : "#22c55e", boxShadow: `0 0 10px ${brezT ? "#f59e0b" : "#22c55e"}` }} />
                    {brezT ? "Brez povezave · čaka 2" : "Na zvezi"}
                  </span>
                </div>

                {/* vsebina */}
                <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1.15fr 1fr", gap: vw(2.4) }}>
                  <div
                    className="relative flex flex-col items-center justify-center overflow-hidden"
                    style={{ gap: vh(2), borderRadius: 24, border: "1px solid rgb(0 0 0 / 0.5)", background: "linear-gradient(180deg,#0b0b0d,#17171a)", boxShadow: "inset 0 3px 18px rgb(0 0 0 / 0.85)" }}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.025)_0_1px,transparent_1px_3px)]" />
                    <span className="font-mono capitalize text-[rgb(246_195_159/0.75)]" style={{ fontSize: vh(2.8) }}>
                      {DNEVI[zdaj.getDay()]}, {zdaj.getDate()}. {zdaj.getMonth() + 1}. {zdaj.getFullYear()}
                    </span>
                    <span className="flex items-baseline font-extrabold tabular-nums text-[#ffb27d] [text-shadow:0_0_30px_rgb(238_122_58/0.75)]" style={{ fontSize: vh(19), lineHeight: 1 }}>
                      {dv(zdaj.getHours())}
                      <span className={zdaj.getSeconds() % 2 ? "opacity-25" : ""}>:</span>
                      {dv(zdaj.getMinutes())}
                      <small className="text-[rgb(255_178_125/0.7)]" style={{ fontSize: vh(6), marginLeft: vw(1) }}>
                        {dv(zdaj.getSeconds())}
                      </small>
                    </span>
                    <span className="flex items-center font-bold" style={{ gap: vw(1.2), fontSize: vh(3.6), color: tipka ? "#ffb27d" : "#dcdcdf" }}>
                      <CreditCard className="text-[#ee7a3a]" style={{ width: vh(5), height: vh(5) }} aria-hidden />
                      {tipka ? `${tipka.besedilo} - prisloni kartico` : "Prisloni kartico"}
                    </span>
                  </div>

                  <div className="grid min-h-0" style={{ gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: vh(1.6) }}>
                    {tipke.map((t) => {
                      const izbr = t.tipka === izbranaT;
                      const s: CSSProperties = {
                        gap: vw(1.2),
                        padding: `0 ${vw(1.2)}px`,
                        borderRadius: 16,
                        fontSize: vh(2.9),
                        border: `1px solid ${izbr ? "#ee7a3a" : "rgb(255 255 255 / 0.1)"}`,
                        background: izbr ? "rgb(202 80 16 / 0.25)" : "linear-gradient(160deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.02))",
                        boxShadow: izbr ? "0 0 26px -8px #ee7a3a" : undefined,
                      };
                      return (
                        <button key={t.tipka} type="button" title={`Na krmilniku: ${t.besedilo}`} onClick={() => setIzbrana(izbr ? null : t.tipka)} className="flex items-center text-left font-bold text-white transition-transform active:scale-95" style={s}>
                          <span
                            className="grid shrink-0 place-items-center"
                            style={{ minWidth: vh(5.4), height: vh(5.4), padding: `0 ${vh(0.6)}px`, borderRadius: 10, background: FINES, fontSize: vh(2.6), boxShadow: "0 0 14px -4px #ee7a3a" }}
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
                  <div className="text-center" style={{ minWidth: vw(55), maxWidth: vw(88), padding: `${vh(4)}px ${vw(4)}px`, borderRadius: 28, background: "linear-gradient(160deg,#2b2b2f,#18181b)", border: `2px solid ${potrdiloT.barva}`, boxShadow: `0 0 60px -10px ${potrdiloT.barva}` }}>
                    <div style={{ fontSize: vh(12), lineHeight: 1, color: potrdiloT.barva }}>{potrdiloT.ikona}</div>
                    <div className="font-extrabold" style={{ marginTop: vh(1.5), fontSize: vh(6) }}>
                      {potrdiloT.naslov}
                    </div>
                    <div className="text-[#dcdcdf]" style={{ marginTop: vh(1), fontSize: vh(3.4) }}>
                      {potrdiloT.opis}
                    </div>
                    {potrdiloT.zigi && (
                      <div className="flex flex-wrap justify-center" style={{ marginTop: vh(2), gap: `${vh(1)}px ${vw(1)}px`, fontSize: vh(3) }}>
                        {potrdiloT.zigi.map((z) => (
                          <span key={z} className="rounded-full bg-white/10" style={{ padding: `${vh(0.6)}px ${vw(1.2)}px` }}>
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
