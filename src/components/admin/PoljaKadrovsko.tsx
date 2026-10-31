"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { POLJE } from "@/components/ui/Polje";
import { emsoPodatki, RAZDELKI, type KadrovskoVnos, type Polje, type Razdelek } from "@/lib/kadrovsko";

type Props = {
  zavihek: Razdelek["zavihek"];
  vnos: KadrovskoVnos;
  nastavi: (p: KadrovskoVnos) => void;
  ureja: boolean;
  napake: Record<string, string>;
  /** true po poskusu shranjevanja: pokaži vse napake, tudi v nedotaknjenih poljih. */
  pokaziNapake: boolean;
};

const SIRINA = { 2: "sm:col-span-2", 4: "sm:col-span-2 lg:col-span-4" } as const;

/** Skrit prikaz: pike + zadnje 3 znake. */
const skrij = (v: string) => (v.length > 3 ? "•".repeat(Math.min(v.length - 3, 10)) + v.slice(-3) : "•".repeat(v.length));

/** Razdelki kadrovskih podatkov izbranega zavihka (Podatki / Zaposlitev), iz RAZDELKI v kadrovsko.ts. */
export function PoljaKadrovsko({ zavihek, vnos, nastavi, ureja, napake, pokaziNapake }: Props) {
  // EMŠO izpolni prazen datum rojstva in spol
  const spremeni = (ime: string, v: string) => {
    const p: KadrovskoVnos = { [ime]: v };
    const e = ime === "emso" ? emsoPodatki(v.replace(/\s+/g, "")) : null;
    if (e && !vnos.datum_rojstva) p.datum_rojstva = e.datum;
    if (e && !vnos.spol) p.spol = e.spol;
    nastavi(p);
  };

  return (
    <>
      {RAZDELKI.filter((r) => r.zavihek === zavihek).map((r, i) => (
        <motion.div key={r.id} className="flex flex-col gap-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, type: "spring", stiffness: 260, damping: 26 }}>
          <NaslovRazdelka>{r.naslov}</NaslovRazdelka>
          <div className="fos-glass grid items-start gap-x-4 gap-y-5 rounded-[18px] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
            {r.polja.map((p) => (
              <PoljeKadrovsko key={p.ime} p={p} vrednost={vnos[p.ime] ?? ""} onChange={(v) => spremeni(p.ime, v)} ureja={ureja} napaka={napake[p.ime]} pokaziNapake={pokaziNapake} />
            ))}
            {r.opis && <p className="text-xs text-ink-500 sm:col-span-2 lg:col-span-4">{r.opis}</p>}
          </div>
        </motion.div>
      ))}
    </>
  );
}

function PoljeKadrovsko({ p, vrednost, onChange, ureja, napaka, pokaziNapake }: { p: Polje; vrednost: string; onChange: (v: string) => void; ureja: boolean; napaka?: string; pokaziNapake: boolean }) {
  const [pokazi, setPokazi] = useState(false);
  const [fokus, setFokus] = useState(false);
  // napaka šele, ko uporabnik zapusti polje (ali ob poskusu shranjevanja) - ne med tipkanjem
  const [dotaknjeno, setDotaknjeno] = useState(false);
  const vidnaNapaka = napaka && !fokus && (dotaknjeno || pokaziNapake) ? napaka : undefined;
  // skrito samo, ko se polja ne ureja (med pisanjem je vrednost vidna)
  const skrito = p.obcutljivo && !pokazi && !fokus && vrednost !== "";
  const razred = `${POLJE} ${p.mono ? "font-mono" : ""} ${vidnaNapaka ? "border-nok-500/60 focus:border-nok-500 focus:ring-nok-500/15" : ""} read-only:cursor-default`;
  const kontrola = {
    onFocus: () => setFokus(true),
    onBlur: () => {
      setFokus(false);
      if (vrednost !== "") setDotaknjeno(true);
    },
    title: skrito ? `${p.hint} - skrito, klikni za urejanje ali oko za prikaz` : p.hint,
    "aria-invalid": !!vidnaNapaka,
  };

  return (
    <label className={`flex min-w-0 flex-col justify-start gap-1.5 ${p.siroko ? SIRINA[p.siroko] : ""}`}>
      {/* naslov v eni vrsti - vnosna polja v vrsti so vedno poravnana */}
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink-400" title={p.naslov}>
        <span className="truncate">{p.naslov}</span>
        {p.obcutljivo && <Lock className="h-3 w-3 shrink-0 text-fines-400" aria-label="Občutljiv podatek" />}
      </span>
      {p.tip === "izbira" ? (
        <select value={vrednost} onChange={(e) => onChange(e.target.value)} disabled={!ureja} {...kontrola} className={`${razred} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 [&>option]:bg-ink-900`}>
          <option value="">-</option>
          {p.moznosti?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.ime}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative">
          <input
            type={p.tip === "datum" ? "date" : "text"}
            value={skrito ? skrij(vrednost) : vrednost}
            onChange={(e) => onChange(e.target.value)}
            readOnly={!ureja}
            placeholder={p.placeholder}
            inputMode={p.inputMode}
            autoComplete="off"
            spellCheck={false}
            {...kontrola}
            className={`${razred} ${p.obcutljivo ? "pr-10" : ""}`}
          />
          {p.obcutljivo && vrednost !== "" && (
            <button
              type="button"
              title={pokazi ? `Skrij ${p.naslov}` : `Pokaži ${p.naslov}`}
              aria-label={pokazi ? `Skrij ${p.naslov}` : `Pokaži ${p.naslov}`}
              // brez fokusa: klik na oko ne sproži blur / preverjanja polja
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPokazi(!pokazi)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-400 transition-colors hover:text-fines-300"
            >
              {pokazi ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          )}
        </div>
      )}
      <AnimatePresence initial={false}>
        {vidnaNapaka && (
          <motion.span initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden text-xs font-semibold leading-snug text-nok-500">
            {vidnaNapaka}
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
}
