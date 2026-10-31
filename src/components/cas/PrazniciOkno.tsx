"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Lock, Plus, Trash } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { izIso } from "@/lib/cas";
import { dodajPraznik, skrijPraznik, useCasNastavitve } from "@/lib/casNastavitve";
import { prazniki } from "@/lib/prazniki";
import { PoljeObrazca } from "./Polja";

const DNEVI = ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"];
const datumIzpis = (d: string) => `${Number(d.slice(8))}. ${Number(d.slice(5, 7))}. ${d.slice(0, 4)}`;

/**
 * Prazniki (gumb na strani Urniki): dela prosti dnevi izbranega leta - standardni po zakonu (zaklenjeni, tudi velika noč
 * in binkošti) in posebni (dodaš, ko so posebnosti, npr. dan solidarnosti; brisanje = skrij). Veljajo za dan "Praz" v intervalih.
 */
export function PrazniciOkno({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      title="Prazniki - dela prosti dnevi"
      onClose={onClose}
      siroko
      noga={
        <Button hint="Zapri seznam praznikov" variant="neutral" onClick={onClose}>
          Zapri
        </Button>
      }
    >
      {open && <Prazniki />}
    </Modal>
  );
}

function Prazniki() {
  const n = useCasNastavitve();
  const [leto, setLeto] = useState(() => new Date().getFullYear());
  const [datum, setDatum] = useState("");
  const [ime, setIme] = useState("");
  const [opis, setOpis] = useState("");
  const [poskus, setPoskus] = useState(false);

  const standardni = [...prazniki(leto)].map(([d, i]) => ({ datum: d, ime: i, id: null as number | null, opis: "" }));
  const posebni = n.prazniki.filter((p) => p.visible && p.datum.startsWith(String(leto)));
  const vsi = [...standardni, ...posebni].sort((a, b) => a.datum.localeCompare(b.datum));
  const delovnih = vsi.filter((p) => (izIso(p.datum).getDay() || 7) <= 5).length;

  const napakaDatum = !datum ? "Izberi datum." : vsi.some((p) => p.datum === datum) || n.prazniki.some((p) => p.visible && p.datum === datum) ? "Na ta dan je že praznik." : undefined;
  const napakaIme = !ime.trim() ? "Vpiši ime (npr. Dan solidarnosti)." : undefined;
  const dodaj = async () => {
    setPoskus(true);
    if (napakaDatum || napakaIme) return;
    try {
      await dodajPraznik({ datum, ime, opis });
      obvesti(`Dela prost dan ${datumIzpis(datum)} je dodan.`);
      setLeto(Number(datum.slice(0, 4)));
      setDatum("");
      setIme("");
      setOpis("");
      setPoskus(false);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <IconButton hint="Prejšnje leto" icon={ChevronLeft} onClick={() => setLeto((l) => l - 1)} />
          <span className="w-16 text-center font-display text-xl font-bold tabular-nums text-white">{leto}</span>
          <IconButton hint="Naslednje leto" icon={ChevronRight} onClick={() => setLeto((l) => l + 1)} />
        </div>
        <span className="text-xs text-ink-400">
          <b className="text-ink-200">{vsi.length}</b> dela prostih dni, od tega <b className="text-ink-200">{delovnih}</b> na delovni dan
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {vsi.map((p) => {
            const dan = izIso(p.datum).getDay();
            const vikend = dan === 0 || dan === 6;
            return (
              <motion.li
                key={p.datum + (p.id ?? "")}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-[6.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="font-display font-bold tabular-nums text-white">{datumIzpis(p.datum)}</span>
                <span className={`text-xs font-semibold ${vikend ? "text-ink-500" : "text-fines-300"}`} title={vikend ? "Pade na vikend" : "Pade na delovni dan"}>
                  {DNEVI[dan]}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-ink-100">{p.ime}</span>
                  {p.opis && <span className="truncate text-xs text-ink-500">{p.opis}</span>}
                </span>
                {p.id == null ? (
                  <span title="Standardni praznik po zakonu - se ne ureja" className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    <Lock className="h-3 w-3" aria-hidden />
                    Zakon
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-fines-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fines-300">Poseben</span>
                    <IconButton
                      hint="Izbriši (skrij) poseben dela prost dan"
                      icon={Trash}
                      variant="danger"
                      className="!h-8 !w-8"
                      onClick={() =>
                        skrijPraznik(p.id!).then(
                          () => obvesti(`${p.ime} (${datumIzpis(p.datum)}) je izbrisan.`),
                          (e: Error) => obvesti(e.message, "napaka"),
                        )
                      }
                    />
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <section className="flex flex-col gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] p-3 sm:p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-fines-400">Dodaj poseben dela prost dan</h3>
        <div className="grid items-start gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <PoljeObrazca naslov="Datum" obvezno napaka={poskus ? napakaDatum : undefined}>
            <input type="date" className={POLJE} value={datum} onChange={(e) => setDatum(e.target.value)} title="Datum dela prostega dne" />
          </PoljeObrazca>
          <PoljeObrazca naslov="Ime" obvezno napaka={poskus ? napakaIme : undefined}>
            <input className={POLJE} value={ime} onChange={(e) => setIme(e.target.value)} placeholder="Dan solidarnosti" title="Ime dela prostega dne" />
          </PoljeObrazca>
          <PoljeObrazca naslov="Opis">
            <input className={POLJE} value={opis} onChange={(e) => setOpis(e.target.value)} placeholder="Zakaj je dan dela prost" title="Opis" />
          </PoljeObrazca>
          <div className="flex flex-col gap-1.5">
            <span className="hidden text-xs sm:block">&nbsp;</span>
            <Button hint="Dodaj dela prost dan" variant="success" icon={Plus} onClick={dodaj}>
              Dodaj
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-500">Standardne praznike (zakon) aplikacija izračuna sama za vsako leto. Sem dodaš samo posebnosti, ki veljajo enkrat.</p>
      </section>
    </div>
  );
}
