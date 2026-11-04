"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Keyboard, Lock, Plus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { GlavaStrani } from "@/components/ui/GlavaStrani";
import { POLJE } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { SaveBar } from "@/components/ui/SaveBar";
import { obvesti } from "@/components/ui/Obvestila";
import {
  FUNKCIJE_TIPK,
  intervaliTipke,
  MESTA_TIPK,
  preveriTipke,
  shraniTipke,
  useCasNastavitve,
  type FunkcijaTipke,
  type MestoTipke,
  type Tipka,
  type TipkaVnos,
} from "@/lib/casNastavitve";
import { Kvadratek } from "./Polja";
import { KrmilnikPredogled } from "./KrmilnikPredogled";
import { Naprave } from "./Naprave";
import { Panel, TestniPodatki } from "./Skupno";

const DROBTINE = [
  { naslov: "FIN:OS", href: "/" },
  { naslov: "Administracija", href: "/administracija" },
  { naslov: "Registracija časa", href: "/administracija/registracija" },
  { naslov: "Nastavitve", href: "/administracija/registracija/nastavitve" },
  { naslov: "Krmilnik" },
];

/**
 * Vrstica tipke (stran je razpolovljena s predogledom): levo številka, na sredini v dveh vrstah 1. besedilo + funkcija,
 * 2. prikaz Krmilnik / FIN:ME in intervali s to tipko; desno odstrani. Flex s fiksnimi širinami - nič se ne premeša.
 */
const STEVILKA = "w-14 shrink-0";
const FUNKCIJA = "w-full sm:w-52 sm:shrink-0";
const ODSTRANI = "w-9 shrink-0";
const MESTA = Object.keys(MESTA_TIPK) as MestoTipke[];

type Vrstica = { kljuc: string; id?: number; tipka: string; besedilo: string; prikaz: MestoTipke[]; funkcija: FunkcijaTipke | null };
const izTipke = (t: Tipka): Vrstica => ({ kljuc: `t${t.id}`, id: t.id, tipka: String(t.tipka), besedilo: t.besedilo, prikaz: t.prikaz, funkcija: t.funkcija });
const stevilka = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);
const enaka = (a: MestoTipke[], b: MestoTipke[]) => [...a].sort().join() === [...b].sort().join();
let novih = 0;

/**
 * Krmilnik: seznam tipk (Tipka, Besedilo, Prikaz = kje se pokaže, Funkcija = Info / Prekliči namesto intervala).
 * Intervali vrste Tipka izberejo tipko v podrobnostih (Urniki); prihod in izhod nimata tipke (samodejno ob prislonu
 * kartice). Spremembe v osnutku -> SaveBar; odstranjena tipka se skrije (tipke, ki jo uporablja interval, ni mogoče odstraniti).
 */
export function Krmilnik() {
  const n = useCasNastavitve();
  const izvorne = n.tipke.filter((t) => t.visible).sort((a, b) => a.tipka - b.tipka);
  const [osnutek, setOsnutek] = useState<Vrstica[] | null>(null);
  const [poskus, setPoskus] = useState(false);
  const [shranjujem, setShranjujem] = useState(false);

  const vrstice = osnutek ?? izvorne.map(izTipke);
  const vnosi: TipkaVnos[] = vrstice.map((v) => ({ id: v.id, tipka: stevilka(v.tipka), besedilo: v.besedilo, prikaz: v.prikaz, funkcija: v.funkcija }));
  const napake = preveriTipke(vnosi);
  const skrite = izvorne.filter((t) => !vrstice.some((v) => v.id === t.id)).map((t) => t.id);
  const spremenjena = (v: Vrstica) => {
    const t = izvorne.find((x) => x.id === v.id);
    return !t || String(t.tipka) !== v.tipka.trim() || t.besedilo !== v.besedilo.trim() || t.funkcija !== v.funkcija || !enaka(t.prikaz, v.prikaz);
  };
  const sprememb = vrstice.filter(spremenjena).length + skrite.length;

  const uredi = (fn: (v: Vrstica[]) => Vrstica[]) => setOsnutek(fn(vrstice));
  const nastavi = (kljuc: string, p: Partial<Vrstica>) => uredi((s) => s.map((x) => (x.kljuc === kljuc ? { ...x, ...p } : x)));
  const dodaj = () => {
    const naslednja = Math.max(0, ...vnosi.map((v) => v.tipka ?? 0)) + 1;
    uredi((v) => [...v, { kljuc: `n${++novih}`, tipka: String(naslednja), besedilo: "", prikaz: ["krmilnik"], funkcija: null }]);
  };
  const preklici = () => {
    setOsnutek(null);
    setPoskus(false);
  };

  const shrani = async () => {
    setPoskus(true);
    if (Object.keys(napake).length) return obvesti("Popravi rdeče označene tipke.", "napaka");
    setShranjujem(true);
    try {
      await shraniTipke(vnosi, skrite);
      preklici();
      obvesti("Tipke krmilnika so shranjene.");
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };

  return (
    <>
      <GlavaStrani
        drobtine={DROBTINE}
        naslov="Krmilnik"
        opis="Tipke na krmilniku in v FIN:ME ter besedilo, ki se izpiše ob žigu s tipko. Prihod in izhod nimata tipke - delujeta samodejno ob prislonu kartice. Tipko intervalu izbereš v Urnikih."
        akcije={
          <>
            {n.virTipk === "test" && <TestniPodatki opis={`Tipke še niso v celoti v bazi (013 / 014): ${n.napakaTipk ?? ""}. Spremembe veljajo samo v tem brskalniku do osvežitve.`} />}
            <Button hint="Dodaj novo tipko" variant="success" icon={Plus} onClick={dodaj}>
              Dodaj tipko
            </Button>
          </>
        }
      />

      {n.virUrnikov === "nalagam" ? (
        <div className="fos-glass h-72 animate-pulse rounded-[20px]" aria-label="Nalagam tipke" />
      ) : (
        // levo tipke, desno predogled krmilnika in naprave
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 26 }} className="min-w-0">
            <Panel naslov="Tipke" desno={<span className="text-xs text-ink-500">{vrstice.length} tipk</span>}>
              <div className="flex items-center gap-2.5 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                <span className={STEVILKA}>Tipka</span>
                <span className="min-w-0 flex-1">Besedilo</span>
                <span className="hidden w-52 shrink-0 sm:block">Funkcija</span>
                <span className={ODSTRANI} />
              </div>

              {/* prihod / izhod: brez tipke, samodejno */}
              <div className="flex items-center gap-2.5 rounded-[14px] border border-dashed border-white/10 bg-white/[0.02] p-2 text-sm" title="Prihod in izhod nimata tipke: krmilnik sam ugotovi smer (odsoten -> prihod, prisoten -> izhod).">
                <span className={`${STEVILKA} grid h-9 place-items-center rounded-[10px] bg-white/[0.04] text-ink-500`}>
                  <Lock className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex min-h-9 min-w-0 flex-1 flex-col justify-center">
                  <span className="font-semibold text-ink-200">Prihod / Izhod</span>
                  <span className="text-[11px] text-ink-500">Brez tipke - samodejno ob prislonu kartice</span>
                </span>
              </div>

              {!vrstice.length && <PraznoStanje icon={Keyboard} naslov="Ni tipk" opis="Dodaj tipko (npr. 5 - Odmor) in jo izberi pri intervalu vrste Tipka v Urnikih." />}

              <AnimatePresence initial={false}>
                {vrstice.map((v, k) => {
                  const e = napake[k];
                  const prikazi = (p?: string) => (poskus || v.id != null ? p : undefined);
                  const intervali = v.id != null ? intervaliTipke(v.id, n) : [];
                  const sprem = spremenjena(v);
                  return (
                    <motion.div
                      key={v.kljuc}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      className={`flex items-start gap-2.5 rounded-[14px] border p-2 transition-colors ${sprem ? "border-warn-500/40 bg-warn-500/[0.05]" : "border-white/[0.06] bg-white/[0.03]"}`}
                    >
                      {/* številka */}
                      <span className={`${STEVILKA} flex flex-col gap-1`}>
                        <input
                          value={v.tipka}
                          inputMode="numeric"
                          onChange={(ev) => nastavi(v.kljuc, { tipka: ev.target.value })}
                          title="Številka tipke (1, 2, 3 ...)"
                          aria-label="Številka tipke"
                          className={`${POLJE} h-9 px-1 text-center font-display text-lg font-bold tabular-nums ${prikazi(e?.tipka) ? "!border-nok-500/70 text-nok-500" : "text-fines-300"}`}
                        />
                        {prikazi(e?.tipka) && <span className="text-[11px] leading-tight text-nok-500">{e!.tipka}</span>}
                      </span>

                      {/* sredina: 1. besedilo + funkcija, 2. prikaz + intervali */}
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                          <span className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                            <input
                              value={v.besedilo}
                              autoFocus={v.id == null && !v.besedilo}
                              onChange={(ev) => nastavi(v.kljuc, { besedilo: ev.target.value })}
                              placeholder="npr. Odmor"
                              title="Besedilo, ki se izpiše ob žigu s to tipko"
                              aria-label="Besedilo tipke"
                              className={`${POLJE} h-9 ${prikazi(e?.besedilo) ? "!border-nok-500/70" : ""}`}
                            />
                            {prikazi(e?.besedilo) && <span className="text-[11px] leading-tight text-nok-500">{e!.besedilo}</span>}
                          </span>
                          <span className={`${FUNKCIJA} flex flex-col gap-1`}>
                            <select
                              value={v.funkcija ?? ""}
                              onChange={(ev) => nastavi(v.kljuc, { funkcija: (ev.target.value || null) as FunkcijaTipke | null })}
                              title="Sistemska funkcija krmilnika namesto intervala"
                              aria-label="Funkcija tipke"
                              className={`${POLJE} h-9 cursor-pointer text-sm [&>option]:bg-ink-900 ${e?.funkcija ? "!border-nok-500/70" : v.funkcija ? "text-fines-300" : ""}`}
                            >
                              <option value="">Interval</option>
                              {(Object.keys(FUNKCIJE_TIPK) as FunkcijaTipke[]).map((f) => (
                                <option key={f} value={f}>
                                  {FUNKCIJE_TIPK[f]}
                                </option>
                              ))}
                            </select>
                            {e?.funkcija && <span className="text-[11px] leading-tight text-nok-500">{e.funkcija}</span>}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
                          <span className="flex items-center gap-3" title="Kje se tipka pokaže; brez izbire se ne pokaže nikjer">
                            {MESTA.map((m) => {
                              const je = v.prikaz.includes(m);
                              return (
                                <label key={m} className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-200">
                                  <Kvadratek majhen vklop={je} hint={`${je ? "Skrij" : "Pokaži"} tipko: ${MESTA_TIPK[m]}`} onChange={() => nastavi(v.kljuc, { prikaz: je ? v.prikaz.filter((x) => x !== m) : [...v.prikaz, m] })} />
                                  {MESTA_TIPK[m]}
                                </label>
                              );
                            })}
                            {!v.prikaz.length && <span className="text-[11px] text-ink-600">Nikjer</span>}
                          </span>
                          <span aria-hidden className="h-4 w-px bg-white/10" />
                          {intervali.length ? (
                            intervali.map((x) => (
                              <span key={x.id} title={x.opis || x.ime} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-200">
                                {x.ime}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-ink-600">{v.funkcija ? "Funkcija krmilnika" : v.id == null ? "Nova tipka" : "Ni v nobenem intervalu"}</span>
                          )}
                        </span>
                      </span>

                      {/* odstrani */}
                      <IconButton
                        hint={intervali.length ? `Tipko uporablja ${intervali.length} intervalov - najprej jim izberi drugo tipko` : "Odstrani tipko"}
                        icon={X}
                        variant="danger"
                        disabled={intervali.length > 0}
                        className={`${ODSTRANI} !h-9 !w-9 disabled:cursor-not-allowed disabled:opacity-30`}
                        onClick={() => uredi((s) => s.filter((x) => x.kljuc !== v.kljuc))}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Panel>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-[88px]">
            <KrmilnikPredogled
              ime="Vhod proizvodnja"
              tipke={vnosi
                .filter((t, i) => t.tipka != null && vrstice[i].prikaz.includes("krmilnik"))
                .map((t) => ({ tipka: t.tipka!, besedilo: t.besedilo.trim(), funkcija: t.funkcija }))
                .sort((a, b) => a.tipka - b.tipka)}
            />
            <Naprave />
          </motion.div>
        </div>
      )}

      <SaveBar sprememb={sprememb} shranjujem={shranjujem} onShrani={shrani} onPreklici={preklici} />
    </>
  );
}
