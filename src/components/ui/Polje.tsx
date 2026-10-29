"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Search, X } from "lucide-react";

/** Vnosno polje FinOS: steklo, 40 px (na telefonu 44 px / 16 px zaradi iPhona), oranžen fokus s sijem. */
export const POLJE =
  "h-11 w-full rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-base text-white placeholder:text-ink-500 shadow-[inset_0_1px_2px_rgb(0_0_0/0.15)] backdrop-blur-md transition-all duration-300 hover:border-white/20 focus:border-fines-400/70 focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-fines-500/15 sm:h-10 sm:text-sm [&::-ms-reveal]:hidden";

/** Naslov polja nad njim (standard: naslovi nad polji, polja poravnana spodaj). */
export function PoljeNaslov({ naslov, children, className = "" }: { naslov: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col justify-end gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-ink-400">{naslov}</span>
      {children}
    </label>
  );
}

type IskanjeProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "title"> & {
  value: string;
  onChange: (v: string) => void;
  hint: string;
};

/** Iskalno polje z lupo levo in gumbom za brisanje desno. */
export function IskalnoPolje({ value, onChange, hint, className = "", ...rest }: IskanjeProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} title={hint} className={`${POLJE} pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`} {...rest} />
      {value && (
        <button
          type="button"
          title="Počisti iskanje"
          aria-label="Počisti iskanje"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/10 hover:text-fines-300"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

type IzbiraProps = {
  value: number | null;
  onChange: (v: number | null) => void;
  moznosti: { id: number; ime: string }[];
  /** Besedilo prazne izbire (npr. "Brez oddelka"). */
  prazno: string;
  hint: string;
  disabled?: boolean;
};

/** Enojni izbor (select 40 px) s prazno možnostjo; vrednost je id ali null. */
export function Izbira({ value, onChange, moznosti, prazno, hint, disabled }: IzbiraProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      title={hint}
      disabled={disabled}
      className={`${POLJE} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 [&>option]:bg-ink-900`}
    >
      <option value="">{prazno}</option>
      {moznosti.map((m) => (
        <option key={m.id} value={m.id}>
          {m.ime}
        </option>
      ))}
    </select>
  );
}

type StikaloProps = { vklop: boolean; onChange: (v: boolean) => void; hint: string; children: ReactNode; disabled?: boolean };

/** Preklopnik v okvirju 40 px (kot ostala polja): vklop = oranžen preliv s sijem in oranžna obroba. */
export function Stikalo({ vklop, onChange, hint, children, disabled }: StikaloProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={vklop}
      title={hint}
      disabled={disabled}
      onClick={() => onChange(!vklop)}
      className={`flex h-11 w-full items-center gap-3 rounded-[10px] border px-3 text-left text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 ${
        vklop ? "border-fines-400/50 bg-fines-500/10 text-white" : "border-white/10 bg-white/[0.04] text-ink-300 hover:border-white/20"
      }`}
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-all duration-300 ${
          vklop ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_0_12px_-2px_rgb(238_122_58/0.8)]" : "bg-ink-700 shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)]"
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-snow shadow-[0_1px_4px_rgb(0_0_0/0.4)] transition-all duration-300 ease-[cubic-bezier(0.3,1.5,0.5,1)] ${vklop ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
