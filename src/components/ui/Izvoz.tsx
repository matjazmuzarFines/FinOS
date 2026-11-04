"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Download, FileArchive, FileSpreadsheet, FileText, FileType, LoaderCircle, Mail, type LucideIcon } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { IskalnoPolje } from "./Polje";
import { obvesti } from "./Obvestila";
import { ujemaIskanje } from "@/lib/iskanje";

/** Tipi datotek izvoza: ikona v barvi tipa in končnica. */
export const TIPI_IZVOZA = {
  xlsx: { ime: "Excel", koncnica: ".xlsx", ikona: FileSpreadsheet, barva: "#16a34a" },
  pdf: { ime: "PDF", koncnica: ".pdf", ikona: FileText, barva: "#dc2626" },
  docx: { ime: "Word", koncnica: ".docx", ikona: FileType, barva: "#2563eb" },
  txt: { ime: "Besedilo", koncnica: ".txt", ikona: FileText, barva: "#9a9aa1" },
  csv: { ime: "CSV", koncnica: ".csv", ikona: FileSpreadsheet, barva: "#0d9488" },
  zip: { ime: "ZIP", koncnica: ".zip", ikona: FileArchive, barva: "#a16207" },
  eml: { ime: "E-mail", koncnica: ".eml", ikona: Mail, barva: "#0ea5e9" },
} satisfies Record<string, { ime: string; koncnica: string; ikona: LucideIcon; barva: string }>;
export type TipIzvoza = keyof typeof TIPI_IZVOZA;

/** En izvoz v seznamu: ime, kratek opis in tipi datotek, v katerih ga lahko preneseš. */
export type IzvozDef = {
  id: string;
  ime: string;
  opis: string;
  tipi: { tip: TipIzvoza; izvozi: () => void | Promise<void>; /** zakaj tip ni na voljo (onemogočen) */ zakaj?: string }[];
};

/**
 * Izvoz (FIN:OS): oranžen gumb "Izvozi" odpre okno s seznamom vseh izvozov strani (drsi, ko jih je veliko; iskanje od 7
 * naprej). Vrstica: ime in opis, desno spustni seznam tipa (ikona v barvi tipa + končnica, npr. Excel .xlsx) in gumb
 * Izvozi, ki se omogoči, ko je tip izbran. Brskalnik si zapomni zadnji tip vsakega izvoza (spomin + id izvoza).
 */
export function Izvoz({ izvozi, spomin }: { izvozi: IzvozDef[]; spomin: string }) {
  const [odprto, setOdprto] = useState(false);
  const [iskanje, setIskanje] = useState("");
  const prikazani = izvozi.filter((i) => ujemaIskanje(iskanje, [i.ime, i.opis, ...i.tipi.map((t) => TIPI_IZVOZA[t.tip].ime)]));
  return (
    <>
      <Button hint={`Odpri seznam izvozov (${izvozi.length})`} variant="primary" icon={Download} onClick={() => setOdprto(true)}>
        Izvozi
      </Button>
      <Modal
        open={odprto}
        siroko
        title="Izvozi"
        onClose={() => setOdprto(false)}
        noga={
          <Button hint="Zapri seznam izvozov" variant="neutral" onClick={() => setOdprto(false)}>
            Zapri
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {izvozi.length > 6 && <IskalnoPolje value={iskanje} onChange={setIskanje} hint="Išči po imenu in opisu izvoza" placeholder="Išči izvoz ..." />}
          <ul className="flex flex-col gap-2">
            {prikazani.map((i, n) => (
              <motion.li key={i.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n, 10) * 0.03 }}>
                <Vrstica izvoz={i} kljuc={`fos_izvoz_${spomin}_${i.id}`} />
              </motion.li>
            ))}
            {!prikazani.length && <li className="py-6 text-center text-sm text-ink-500">Ni izvoza s tem imenom.</li>}
          </ul>
        </div>
      </Modal>
    </>
  );
}

function Vrstica({ izvoz, kljuc }: { izvoz: IzvozDef; kljuc: string }) {
  const [tip, setTip] = useState<TipIzvoza | null>(() => {
    try {
      const t = localStorage.getItem(kljuc) as TipIzvoza | null;
      return t && izvoz.tipi.some((x) => x.tip === t && !x.zakaj) ? t : null;
    } catch {
      return null;
    }
  });
  const [delam, setDelam] = useState(false);
  const izbran = izvoz.tipi.find((t) => t.tip === tip);
  const izberi = (t: TipIzvoza) => {
    setTip(t);
    try {
      localStorage.setItem(kljuc, t);
    } catch {}
  };
  const izvozi = async () => {
    if (!izbran) return;
    setDelam(true);
    try {
      await izbran.izvozi();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setDelam(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-white/10 bg-white/[0.035] p-3 sm:flex-row sm:items-center">
      <span className="fos-fines-fill grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-snow max-sm:hidden">
        <Download className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-white">{izvoz.ime}</span>
        <span className="text-xs text-ink-400">{izvoz.opis}</span>
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <IzbiraTipa tipi={izvoz.tipi} izbran={tip} onIzberi={izberi} ime={izvoz.ime} />
        <Button hint={izbran ? `Prenesi ${izvoz.ime} (${TIPI_IZVOZA[izbran.tip].koncnica})` : "Najprej izberi tip datoteke"} variant="primary" icon={delam ? LoaderCircle : Download} onClick={izvozi} disabled={!izbran || delam} className={delam ? "[&_svg]:animate-spin" : ""}>
          Izvozi
        </Button>
      </div>
    </div>
  );
}

/** Spustni seznam tipa datoteke (ikona v barvi tipa + ime + končnica); odpre se nad vsem (portal), ob dnu navzgor. */
function IzbiraTipa({ tipi, izbran, onIzberi, ime }: { tipi: IzvozDef["tipi"]; izbran: TipIzvoza | null; onIzberi: (t: TipIzvoza) => void; ime: string }) {
  const [odprto, setOdprto] = useState(false);
  const [mesto, setMesto] = useState<{ levo: number; sirina: number; vrh?: number; dno?: number } | null>(null);
  const gumb = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  useEffect(() => {
    if (!odprto) return;
    const zapri = () => setOdprto(false);
    window.addEventListener("resize", zapri);
    window.addEventListener("scroll", zapri, true);
    return () => {
      window.removeEventListener("resize", zapri);
      window.removeEventListener("scroll", zapri, true);
    };
  }, [odprto]);
  const odpri = () => {
    const r = gumb.current?.getBoundingClientRect();
    if (!r) return;
    const visina = tipi.length * 44 + 12;
    const navzgor = r.bottom + visina + 8 > window.innerHeight;
    setMesto({ levo: Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8), sirina: Math.max(r.width, 200), ...(navzgor ? { dno: window.innerHeight - r.top + 6 } : { vrh: r.bottom + 6 }) });
    setOdprto(true);
  };
  const T = izbran ? TIPI_IZVOZA[izbran] : null;
  return (
    <>
      <button
        ref={gumb}
        type="button"
        title={`Izberi tip datoteke - ${ime}`}
        aria-haspopup="listbox"
        aria-expanded={odprto}
        onClick={() => (odprto ? setOdprto(false) : odpri())}
        className={`flex h-10 w-44 items-center gap-2 rounded-[10px] border px-2.5 text-left text-sm transition-colors ${odprto ? "border-fines-400/60 bg-white/[0.08]" : "border-white/10 bg-white/[0.05] hover:border-white/25"}`}
      >
        {T ? (
          <>
            <T.ikona className="h-[18px] w-[18px] shrink-0" style={{ color: T.barva }} aria-hidden />
            <span className="font-semibold text-white">{T.ime}</span>
            <span className="font-mono text-xs text-ink-400">{T.koncnica}</span>
          </>
        ) : (
          <span className="text-ink-400">Izberi tip ...</span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-ink-400 transition-transform ${odprto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {odprto && mesto && (
              <>
                <span className="fixed inset-0 z-[60]" onClick={() => setOdprto(false)} aria-hidden />
                <motion.ul
                  role="listbox"
                  initial={{ opacity: 0, y: mesto.vrh != null ? -6 : 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 460, damping: 32 }}
                  style={{ left: mesto.levo, width: mesto.sirina, top: mesto.vrh, bottom: mesto.dno }}
                  className="fos-popup fixed z-[61] flex flex-col gap-0.5 rounded-[14px] p-1.5"
                >
                  {tipi.map((t) => {
                    const x = TIPI_IZVOZA[t.tip];
                    return (
                      <li key={t.tip}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={t.tip === izbran}
                          disabled={!!t.zakaj}
                          title={t.zakaj ?? `${x.ime} (${x.koncnica})`}
                          onClick={() => {
                            onIzberi(t.tip);
                            setOdprto(false);
                          }}
                          className={`flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${t.tip === izbran ? "bg-fines-500/15 text-white" : "text-ink-200 hover:bg-white/[0.07]"}`}
                        >
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${x.barva} 18%, transparent)`, color: x.barva }}>
                            <x.ikona className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="font-semibold">{x.ime}</span>
                          <span className="font-mono text-xs text-ink-400">{x.koncnica}</span>
                          {t.tip === izbran && <Check className="ml-auto h-4 w-4 text-fines-300" aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
