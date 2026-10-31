"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Trash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { shraniUrnik, skrijUrnik, useCasNastavitve, type Statistika, type Urnik } from "@/lib/casNastavitve";
import { PoljeObrazca } from "./Polja";
import { IkonaStatistike } from "./Skupno";

/** Izbira statistike s spustnim oknom (barva, ikona, koda, ime). */
export function IzbiraStatistike({
  value,
  onChange,
  statistike,
  prazno = "Izberi statistiko",
  hint,
  obvezno,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  statistike: Statistika[];
  prazno?: string;
  hint: string;
  /** Brez prazne izbire (interval ima obvezno statistiko). */
  obvezno?: boolean;
}) {
  const [odprto, setOdprto] = useState(false);
  const izbrana = statistike.find((s) => s.id === value);
  const ponujene = statistike.filter((s) => s.visible || s.id === value);
  return (
    <div className="relative">
      <button type="button" title={hint} aria-expanded={odprto} onClick={() => setOdprto((o) => !o)} className={`${POLJE} flex items-center gap-2 text-left`}>
        {izbrana ? (
          <>
            <IkonaStatistike s={izbrana} velikost="sm" className="!h-6 !w-6" />
            <span className="font-mono text-xs font-bold text-fines-300">{izbrana.koda}</span>
            <span className="min-w-0 flex-1 truncate">{izbrana.ime}</span>
          </>
        ) : (
          <span className="flex-1 text-ink-500">{prazno}</span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${odprto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <AnimatePresence>
        {odprto && (
          <>
            <span className="fixed inset-0 z-40" onClick={() => setOdprto(false)} aria-hidden />
            <motion.ul
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="absolute inset-x-0 top-full z-50 mt-1 flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-[14px] border border-white/10 bg-ink-900/95 p-1.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl"
            >
              {!obvezno && (
              <li>
                <button type="button" onClick={() => (onChange(null), setOdprto(false))} className="w-full rounded-[10px] px-2 py-1.5 text-left text-sm text-ink-400 hover:bg-white/[0.06]">
                  {prazno}
                </button>
              </li>
              )}
              {ponujene.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    title={s.opis}
                    onClick={() => (onChange(s.id), setOdprto(false))}
                    className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-sm transition-colors ${s.id === value ? "bg-fines-500/15 text-white" : "text-ink-200 hover:bg-white/[0.06]"}`}
                  >
                    <IkonaStatistike s={s} velikost="sm" className="!h-6 !w-6" />
                    <span className="w-12 shrink-0 font-mono text-xs font-bold text-fines-300">{s.koda}</span>
                    <span className="min-w-0 flex-1 truncate">{s.ime}</span>
                    {s.id === value && <Check className="h-4 w-4 text-fines-300" aria-hidden />}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Okno Nov / Uredi urnik (ime, opis; pri urejanju še Izbriši). */
export function UrnikOkno({ okno, onClose, onShranjeno }: { okno: { urnik?: Urnik } | null; onClose: () => void; onShranjeno: (id: number | null) => void }) {
  return (
    <Modal open={!!okno} title={okno?.urnik ? "Uredi urnik" : "Nov urnik"} onClose={onClose}>
      {okno && <UrnikObrazec key={okno.urnik?.id ?? "nov"} urnik={okno.urnik} onClose={onClose} onShranjeno={onShranjeno} />}
    </Modal>
  );
}

function UrnikObrazec({ urnik, onClose, onShranjeno }: { urnik?: Urnik; onClose: () => void; onShranjeno: (id: number | null) => void }) {
  const n = useCasNastavitve();
  const [ime, setIme] = useState(urnik?.ime ?? "");
  const [opis, setOpis] = useState(urnik?.opis ?? "");
  const [poskus, setPoskus] = useState(false);
  const [delam, setDelam] = useState(false);
  const clanov = urnik ? n.zaposleniUrniki.filter((z) => z.id_urnika === urnik.id).length : 0;
  const napaka = !ime.trim() ? "Vpiši ime urnika." : n.urniki.some((u) => u.visible && u.id !== urnik?.id && u.ime.trim().toLowerCase() === ime.trim().toLowerCase()) ? "Urnik s tem imenom že obstaja." : undefined;
  const izvedi = async (fn: () => Promise<void>) => {
    setDelam(true);
    try {
      await fn();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setDelam(false);
    }
  };
  const shrani = () => {
    setPoskus(true);
    if (napaka) return;
    return izvedi(async () => {
      const id = await shraniUrnik({ ime, opis }, urnik?.id);
      obvesti(urnik ? "Urnik je shranjen." : `Urnik ${ime.trim()} je dodan.`);
      onShranjeno(id);
    });
  };
  return (
    <div className="flex flex-col gap-4">
      <PoljeObrazca naslov="Ime urnika" obvezno napaka={poskus ? napaka : undefined} opis="Skupina urnika, npr. Pisarna, Proizvodnja - 2 izmeni.">
        <input className={POLJE} value={ime} onChange={(e) => setIme(e.target.value)} title="Ime urnika" autoFocus />
      </PoljeObrazca>
      <PoljeObrazca naslov="Opis">
        <textarea className={`${POLJE} h-auto min-h-20 resize-y py-2`} value={opis} onChange={(e) => setOpis(e.target.value)} title="Opis urnika" />
      </PoljeObrazca>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
        {urnik && (
          <Button
            hint="Skrij urnik (intervali ostanejo)"
            variant="danger"
            icon={Trash}
            className="mr-auto"
            disabled={delam}
            onClick={() => {
              if (!confirm(`Izbrišem urnik ${urnik.ime}? Intervali ostanejo, urnik se skrije.${clanov ? ` ${clanov} zaposlenih bo ostalo brez urnika.` : ""}`)) return;
              return izvedi(async () => {
                await skrijUrnik(urnik.id);
                obvesti(`Urnik ${urnik.ime} je izbrisan (skrit).`);
                onShranjeno(null);
              });
            }}
          >
            Izbriši
          </Button>
        )}
        <Button hint="Zapri brez shranjevanja" variant="neutral" onClick={onClose}>
          Prekliči
        </Button>
        <Button hint="Shrani urnik" variant="success" icon={Check} onClick={shrani} disabled={delam}>
          {delam ? "Shranjujem ..." : "Shrani"}
        </Button>
      </div>
    </div>
  );
}
