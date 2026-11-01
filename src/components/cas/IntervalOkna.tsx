"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Trash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { shraniUrnik, skrijUrnik, useCasNastavitve, MESTA_TIPK, type Statistika, type Tipka, type Urnik } from "@/lib/casNastavitve";
import { PoljeObrazca } from "./Polja";
import { IkonaStatistike } from "./Skupno";

/** Mesto spustnega okna ob polju: spodaj, če je prostora dovolj, sicer zgoraj; višina največ prostor do roba zaslona. */
type Mesto = { levo: number; sirina: number; vrh?: number; dno?: number; visina: number };
const ROB = 12;
const ZELENA = 288; // max-h-72
function izracunajMesto(el: HTMLElement): Mesto {
  const r = el.getBoundingClientRect();
  const spodaj = window.innerHeight - r.bottom - ROB;
  const zgoraj = r.top - ROB;
  const navzdol = spodaj >= Math.min(ZELENA, 200) || spodaj >= zgoraj;
  const visina = Math.max(120, Math.min(ZELENA, navzdol ? spodaj : zgoraj) - 4);
  return navzdol ? { levo: r.left, sirina: r.width, vrh: r.bottom + 4, visina } : { levo: r.left, sirina: r.width, dno: window.innerHeight - r.top + 4, visina };
}

type Moznost = { id: number; opis?: string; vsebina: ReactNode };

/**
 * Spustno okno ob polju. Okno je v portalu (fixed), zato ga ne poreže overflow-hidden starša (panel, okno); ob dnu
 * zaslona se odpre navzgor. Prazna izbira (null) je prva, razen ko je polje obvezno.
 */
function Spustno({
  value,
  onChange,
  moznosti,
  izbrano,
  prazno,
  hint,
  obvezno,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  moznosti: Moznost[];
  /** Prikaz izbrane vrednosti v polju (null = prazno). */
  izbrano: ReactNode;
  prazno: ReactNode;
  hint: string;
  obvezno?: boolean;
}) {
  const [odprto, setOdprto] = useState(false);
  const polje = useRef<HTMLButtonElement>(null);
  const [mesto, setMesto] = useState<Mesto | null>(null);
  useLayoutEffect(() => {
    if (!odprto || !polje.current) return;
    const el = polje.current;
    const posodobi = () => setMesto(izracunajMesto(el));
    posodobi();
    window.addEventListener("resize", posodobi);
    window.addEventListener("scroll", posodobi, true);
    return () => {
      window.removeEventListener("resize", posodobi);
      window.removeEventListener("scroll", posodobi, true);
    };
  }, [odprto]);
  return (
    <div className="relative">
      <button ref={polje} type="button" title={hint} aria-expanded={odprto} onClick={() => setOdprto((o) => !o)} className={`${POLJE} flex items-center gap-2 text-left`}>
        {izbrano ?? <span className="flex-1 text-ink-500">{prazno}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${odprto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {odprto && mesto && (
              <>
                <span className="fixed inset-0 z-[60]" onClick={() => setOdprto(false)} aria-hidden />
                <motion.ul
                  initial={{ opacity: 0, y: mesto.vrh != null ? -6 : 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: mesto.vrh != null ? -6 : 6, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  style={{ left: mesto.levo, width: mesto.sirina, top: mesto.vrh, bottom: mesto.dno, maxHeight: mesto.visina }}
                  className="fixed z-[61] flex flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-[14px] border border-white/10 bg-ink-900/95 p-1.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl"
                >
                  {!obvezno && (
                  <li>
                    <button type="button" onClick={() => (onChange(null), setOdprto(false))} className="w-full rounded-[10px] px-2 py-1.5 text-left text-sm text-ink-400 hover:bg-white/[0.06]">
                      {prazno}
                    </button>
                  </li>
                  )}
                  {moznosti.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        title={m.opis}
                        onClick={() => (onChange(m.id), setOdprto(false))}
                        className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-sm transition-colors ${m.id === value ? "bg-fines-500/15 text-white" : "text-ink-200 hover:bg-white/[0.06]"}`}
                      >
                        {m.vsebina}
                        {m.id === value && <Check className="h-4 w-4 text-fines-300" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

/** Izbira statistike (barva, ikona, koda, ime). */
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
  const vsebina = (s: Statistika) => (
    <>
      <IkonaStatistike s={s} velikost="sm" className="!h-6 !w-6" />
      <span className="w-12 shrink-0 font-mono text-xs font-bold text-fines-300">{s.koda}</span>
      <span className="min-w-0 flex-1 truncate">{s.ime}</span>
    </>
  );
  const izbrana = statistike.find((s) => s.id === value);
  return (
    <Spustno
      value={value}
      onChange={onChange}
      moznosti={statistike.filter((s) => s.visible || s.id === value).map((s) => ({ id: s.id, opis: s.opis, vsebina: vsebina(s) }))}
      izbrano={izbrana && vsebina(izbrana)}
      prazno={prazno}
      hint={hint}
      obvezno={obvezno}
    />
  );
}

/** Številka tipke v kvadratku (kot tipka na krmilniku). */
function ZnakTipke({ t }: { t: Tipka }) {
  return (
    <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md border border-fines-400/40 bg-[linear-gradient(135deg,rgb(241_154_102/0.25),rgb(202_80_16/0.25))] px-1 font-display text-xs font-bold tabular-nums text-fines-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]">
      {t.tipka}
    </span>
  );
}

/** Izbira tipke intervala (Nastavitve -> Krmilnik): pri vrsti Tipka obvezna, pri prihodu / izhodu neobvezna; brez tipk s funkcijo (Info, Prekliči). */
export function IzbiraTipke({ value, onChange, tipke, hint, obvezno = true }: { value: number | null; onChange: (id: number | null) => void; tipke: Tipka[]; hint: string; /** false = prazna izbira "Brez tipke" (prihod / izhod). */ obvezno?: boolean }) {
  const vsebina = (t: Tipka) => (
    <>
      <ZnakTipke t={t} />
      <span className="min-w-0 flex-1 truncate">{t.besedilo}</span>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-500">{t.prikaz.length ? t.prikaz.map((m) => MESTA_TIPK[m]).join(" · ") : "nikjer"}</span>
    </>
  );
  const izbrana = tipke.find((t) => t.id === value);
  return (
    <Spustno
      value={value}
      onChange={onChange}
      moznosti={tipke
        .filter((t) => (t.visible && !t.funkcija) || t.id === value)
        .sort((a, b) => a.tipka - b.tipka)
        .map((t) => ({ id: t.id, opis: `Tipka ${t.tipka}: ${t.besedilo}`, vsebina: vsebina(t) }))}
      izbrano={izbrana && vsebina(izbrana)}
      prazno={obvezno ? "Izberi tipko" : "Brez tipke - samodejno ob prislonu"}
      hint={hint}
      obvezno={obvezno}
    />
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
