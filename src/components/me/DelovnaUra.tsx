"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Info, LockKeyhole, LogIn, LogOut, Undo2, X } from "lucide-react";
import { TestniPodatki } from "@/components/cas/Skupno";
import { obvesti } from "@/components/ui/Obvestila";
import { fmtCas, fmtTrajanje, isoDatum, izracunajDan } from "@/lib/cas";
import { useCasNastavitve, type Tipka } from "@/lib/casNastavitve";
import { testniDan, testniUrnik } from "@/lib/casTest";
import { podatkiDne, prekliciZadnjiOnline, useDogodki, zigOnline } from "@/lib/dogodki";
import { finMeZa, useFinMe } from "@/lib/finme";
import { useZahtevki, zZahtevki } from "@/lib/zahtevki";
import type { Jaz } from "./Jaz";

const DNEVI = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];

/**
 * Delovna ura (virtualni krmilnik v Mojem Finesu, enak bo kasneje na krmilniku): zaslon z uro in stanjem, velik gumb
 * Prihod / Odhod (smer samodejna - odsoten = prihod, prisoten = odhod) in tipke s prikazom "FIN:ME" (fos_tipke.prikaz).
 * Tipka Info pokaže današnje žige in ure, Prekliči umakne zadnji online žig. Deluje samo z vklopljenim "Virtualno
 * beleženje delovnega časa" (list zaposlenega -> FIN:ME). Čas žiga v bazi določi strežnik (fos_zig_online).
 */
export function DelovnaUra({ j }: { j: Jaz }) {
  const n = useCasNastavitve();
  const fm = useFinMe();
  const zh = useZahtevki();
  const [zdaj, setZdaj] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setZdaj(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const danes = isoDatum(zdaj);
  const zdajMin = zdaj.getHours() * 60 + zdaj.getMinutes();
  const id = j.jaz.id;
  const dog = useDogodki(id, danes, danes);
  const urnik = testniUrnik(id, n);
  const d = izracunajDan(danes, zZahtevki(id, danes, podatkiDne(id, danes, () => testniDan(id, danes, n, danes, zdajMin), dog), zh.zahtevki, n, urnik), n, danes, zdajMin, urnik);

  const [info, setInfo] = useState(false);
  const [potrdilo, setPotrdilo] = useState<{ besedilo: string; ok: boolean; kljuc: number } | null>(null);
  const [delam, setDelam] = useState(false);
  useEffect(() => {
    if (!potrdilo) return;
    const t = setTimeout(() => setPotrdilo(null), 4000);
    return () => clearTimeout(t);
  }, [potrdilo]);

  const vklopljeno = finMeZa(fm, id).virtualno_belezenje;
  // v bazi žig vpiše strežnik za prijavljen račun - "Ogled kot" ne sme štempljati za drugega
  const zaklenjeno = !vklopljeno || (j.ogled && dog.vir === "baza");
  const zadnji = d.zigi.at(-1);
  const prisoten = zadnji?.smer === "prihod";
  const prvi = d.zigi.find((z) => z.smer === "prihod");
  const stat = (idS: number | null) => n.statistike.find((s) => s.id === idS);
  const tipka = (idT: number | null) => n.tipke.find((t) => t.id === idT);
  const tipke = n.tipke.filter((t) => t.visible && t.prikaz.includes("fin_me")).sort((a, b) => a.tipka - b.tipka);

  const stanje = !zadnji
    ? { besedilo: "Danes še nisi prišel", barva: "#9a9aa1" }
    : prisoten
      ? { besedilo: `Na delu od ${fmtCas(prvi?.knjizen ?? zadnji.cas)}`, barva: "#22c55e" }
      : zadnji.id_tipke != null
        ? { besedilo: `${tipka(zadnji.id_tipke)?.besedilo ?? stat(zadnji.id_statistike)?.ime ?? "Odsoten"} od ${fmtCas(zadnji.cas)}`, barva: "#f59e0b" }
        : { besedilo: `Odšel ob ${fmtCas(zadnji.cas)}`, barva: "#9a9aa1" };

  const zig = async (t: Tipka | null) => {
    if (zaklenjeno || delam) return;
    if (t?.funkcija === "info") return setInfo((x) => !x);
    setDelam(true);
    try {
      if (t?.funkcija === "preklici") {
        const cas = await prekliciZadnjiOnline(id, d.podatki.zigi);
        setPotrdilo(cas == null ? { besedilo: "Ni žiga za preklic", ok: false, kljuc: zdaj.getTime() } : { besedilo: `Preklican žig ${fmtCas(cas)}`, ok: true, kljuc: zdaj.getTime() });
      } else {
        await zigOnline(id, t?.id ?? null);
        const ura = `${String(zdaj.getHours()).padStart(2, "0")}:${String(zdaj.getMinutes()).padStart(2, "0")}`;
        setPotrdilo({ besedilo: t ? `${ura} · ${t.besedilo}` : `${ura} · ${prisoten ? "Odhod" : "Prihod"}`, ok: true, kljuc: zdaj.getTime() });
      }
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setDelam(false);
    }
  };

  const ura = (v: number) => String(v).padStart(2, "0");

  return (
    <motion.section
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.2 }}
      aria-label="Delovna ura"
      className="fos-kartica relative flex w-full flex-col gap-3 overflow-hidden rounded-[26px] border border-white/10 p-4 shadow-[var(--fos-shadow-card)]"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8f380b,#ca5010_30%,#ee7a3a_60%,#ca5010)]" />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-fines-400">Delovna ura</h2>
        {(dog.vir === "test" || fm.vir === "test") && <TestniPodatki opis="Žigi in nastavitev virtualnega beleženja so v tem brskalniku, dokler baza (zaženi migracijo 020) ni zagnana." />}
      </div>

      {/* zaslon */}
      <div className="relative overflow-hidden rounded-[18px] border border-black/40 bg-[linear-gradient(180deg,#0b0b0d,#17171a)] px-4 pb-3 pt-3 shadow-[inset_0_2px_12px_rgb(0_0_0/0.8),0_1px_0_rgb(255_255_255/0.06)]">
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.025)_0_1px,transparent_1px_3px)]" />
        <div className="relative flex items-baseline justify-between gap-2 font-mono text-[#f6c39f]">
          <span className="text-xs capitalize text-[#f6c39f]/70">
            {DNEVI[zdaj.getDay()]}, {zdaj.getDate()}. {zdaj.getMonth() + 1}.
          </span>
          <span className="text-xs text-[#f6c39f]/70">Fines d.o.o.</span>
        </div>
        <div className="relative mt-1 flex items-baseline justify-center gap-0.5 font-display font-bold tabular-nums text-[#ffb27d] [text-shadow:0_0_18px_rgb(238_122_58/0.75)]">
          <span className="text-5xl">{ura(zdaj.getHours())}</span>
          <span className="fos-deko animate-pulse text-5xl">:</span>
          <span className="text-5xl">{ura(zdaj.getMinutes())}</span>
          <span className="ml-1 text-xl text-[#ffb27d]/70">{ura(zdaj.getSeconds())}</span>
        </div>
        <div className="relative mt-2 flex h-6 items-center justify-center">
          <AnimatePresence mode="wait">
            {potrdilo ? (
              <motion.span key={potrdilo.kljuc} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className={`flex items-center gap-1.5 text-sm font-bold ${potrdilo.ok ? "text-ok-500" : "text-warn-500"}`}>
                {potrdilo.ok ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                {potrdilo.besedilo}
              </motion.span>
            ) : (
              <motion.span key="stanje" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm font-semibold" style={{ color: stanje.barva }}>
                <span className="h-2 w-2 rounded-full" style={{ background: stanje.barva, boxShadow: `0 0 8px ${stanje.barva}` }} />
                {stanje.besedilo}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* info: današnji žigi */}
      <AnimatePresence initial={false}>
        {info && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-1.5 rounded-[14px] border border-white/10 bg-white/[0.04] p-3 text-sm">
              <span className="flex justify-between text-ink-300">
                Danes delo <b className="font-display tabular-nums text-white">{fmtTrajanje(d.delo, true)} h</b>
              </span>
              {d.obveznost != null && (
                <span className="flex justify-between text-ink-300">
                  Obveznost <b className="font-display tabular-nums text-white">{fmtTrajanje(d.obveznost, true)} h</b>
                </span>
              )}
              <span className="mt-1 flex flex-wrap gap-1">
                {d.zigi.length ? (
                  d.zigi.map((z) => (
                    <span key={z.id} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs tabular-nums text-ink-200" title={z.smer === "prihod" ? "Prihod" : "Odhod"}>
                      {z.smer === "prihod" ? "↘" : "↗"} {fmtCas(z.cas)}
                      {z.id_tipke != null && ` ${tipka(z.id_tipke)?.besedilo ?? ""}`}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-ink-500">Danes še ni žigov.</span>
                )}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {zaklenjeno && (
        <div className="flex items-start gap-3 rounded-[14px] border border-warn-500/40 bg-warn-500/10 p-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-warn-500" aria-hidden />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-white">{vklopljeno ? "Ogled kot - žigi niso mogoči" : "Beleženje tukaj ni vklopljeno"}</span>
            <span className="text-xs text-ink-300">{vklopljeno ? "Štempljaš lahko samo kot ti." : "Štempljaj na krmilniku. Vklopi ga kadrovska služba (zaposleni → FIN:ME)."}</span>
          </span>
        </div>
      )}

      {/* gumbi */}
      <div className="flex flex-col gap-2">
        <motion.button
          type="button"
          title={prisoten ? "Zabeleži odhod z dela (zdaj)" : "Zabeleži prihod na delo (zdaj)"}
          disabled={zaklenjeno || delam}
          onClick={() => zig(null)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className={`group relative flex h-16 items-center justify-center gap-3 overflow-hidden rounded-[16px] font-display text-2xl font-bold text-snow transition-shadow disabled:cursor-not-allowed disabled:opacity-50 ${
            prisoten ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_10px_30px_-10px_rgb(202_80_16/0.9)]" : "bg-[linear-gradient(135deg,#4ade80,#16a34a_60%,#14532d)] shadow-[0_10px_30px_-10px_rgb(22_163_74/0.9)]"
          }`}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/40" />
          {prisoten ? <LogOut className="h-7 w-7 transition-transform group-hover:scale-110" aria-hidden /> : <LogIn className="h-7 w-7 transition-transform group-hover:scale-110" aria-hidden />}
          {prisoten ? "Odhod" : "Prihod"}
        </motion.button>
        {tipke.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {tipke.map((t) => {
              const I = t.funkcija === "info" ? Info : t.funkcija === "preklici" ? Undo2 : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  title={t.funkcija === "info" ? "Pokaži današnje žige in ure" : t.funkcija === "preklici" ? "Prekliči zadnji žig iz Mojega Finesa" : `Žig s tipko ${t.tipka}: ${t.besedilo}`}
                  disabled={zaklenjeno || delam}
                  onClick={() => zig(t)}
                  className={`flex h-12 items-center gap-2 rounded-[12px] border px-2.5 text-left text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${
                    t.funkcija === "info" && info ? "border-fines-400/60 bg-fines-500/15 text-white" : "border-white/10 bg-white/[0.05] text-ink-100 hover:border-fines-400/40 hover:bg-white/[0.09]"
                  }`}
                >
                  <span className="fos-fines-fill grid h-7 min-w-7 shrink-0 place-items-center rounded-[8px] px-1 font-display text-xs font-bold text-snow">{I ? <I className="h-4 w-4" aria-hidden /> : t.tipka}</span>
                  <span className="min-w-0 leading-tight">{t.besedilo}</span>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </motion.section>
  );
}
