"use client";

import { AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { prenesi, zapisiCsv } from "@/lib/csv";
import { glavaCsv, imeDatoteke, type TabelaBaze } from "@/lib/tabeleBaze";

const TIP: Record<string, string> = { besedilo: "besedilo", stevilo: "celo število", seznam: "seznam (ločen z |)", logicno: "true / false" };

/** Prenese predlogo CSV: glava + primeri (ločilo ;, UTF-8 - Excel jo odpre pravilno). */
export function prenesiPredlogo(t: TabelaBaze) {
  const glava = glavaCsv(t);
  prenesi(imeDatoteke(t, "predloga"), zapisiCsv(glava, t.primeri.map((p) => glava.map((g) => (g === "visible" ? "true" : (p[g] ?? ""))))));
}

/**
 * Navodila za uvoz CSV v tabelo: oblika datoteke, stolpci (ime v glavi, tip, obvezno, opis, primer),
 * pravila tabele in predloga za prenos.
 */
export function NavodilaTabele({ tabela: t }: { tabela: TabelaBaze }) {
  const glava = glavaCsv(t);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <ul className="grid gap-2 text-ink-300 sm:grid-cols-2">
        {[
          <>
            Prva vrstica je <b className="text-white">glava</b> z imeni stolpcev (kot spodaj, velike / male črke niso pomembne).
          </>,
          <>
            Ločilo <b className="font-mono text-white">;</b> (Excel) ali <b className="font-mono text-white">,</b> - zazna se samo. Kodiranje UTF-8 (Excel: &quot;CSV UTF-8&quot;).
          </>,
          <>
            Stolpcev <b className="font-mono text-white">id</b>, <b className="font-mono text-white">created_at</b>, <b className="font-mono text-white">updated_at</b> ne vpisuj - nastavi jih baza. Neznani stolpci se prezrejo.
          </>,
          <>
            Vrstica z obstoječo vrednostjo <b className="font-mono text-fines-300">{t.kljuc}</b> se <b className="text-white">posodobi</b>, ostale se <b className="text-white">dodajo</b>. Vrstice se nikoli ne brišejo.
          </>,
          <>
            <b className="font-mono text-white">visible</b> (neobvezno): <span className="font-mono">true</span> = prikazana, <span className="font-mono">false</span> = skrita; prazno = brez spremembe (nova vrstica je prikazana).
          </>,
          <>Pred zapisom vidiš predogled: vsaka vrstica je označena kot nova, posodobitev, brez sprememb ali napaka.</>,
        ].map((b, i) => (
          <li key={i} className="flex gap-2 leading-snug">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[2px] bg-[linear-gradient(135deg,#f19a66,#ca5010)] shadow-[0_0_8px_rgb(238_122_58/0.7)]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* stolpci */}
      <div className="overflow-x-auto rounded-[12px] border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ink-800 text-[11px] font-bold uppercase tracking-wider text-ink-300">
            <tr>
              <th className="px-3 py-2">Stolpec v glavi</th>
              <th className="px-3 py-2">Tip</th>
              <th className="px-3 py-2">Obvezno</th>
              <th className="px-3 py-2">Opis</th>
              <th className="px-3 py-2">Primer</th>
            </tr>
          </thead>
          <tbody>
            {t.stolpci.map((s) => (
              <tr key={s.ime} className="border-t border-white/[0.06] align-top">
                <td className="px-3 py-2 font-mono font-semibold text-fines-300">
                  {s.ime}
                  {s.ime === t.kljuc && <span className="ml-1.5 rounded border border-fines-400/30 bg-fines-500/10 px-1 py-px font-sans text-[10px] uppercase tracking-wider">ključ</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-300">
                  {TIP[s.tip]} <span className="font-mono text-[11px] text-ink-500">{s.pgTip}</span>
                </td>
                <td className="px-3 py-2">{s.obvezno ? <span className="font-semibold text-white">da{s.enolicno ? ", enolično" : ""}</span> : <span className="text-ink-500">ne{s.privzeto != null ? ` (prazno = ${s.privzeto})` : ""}</span>}</td>
                <td className="px-3 py-2 text-ink-400">{s.opis}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-ink-200">{s.primer || <span className="text-ink-500">prazno</span>}</td>
              </tr>
            ))}
            <tr className="border-t border-white/[0.06] align-top">
              <td className="px-3 py-2 font-mono font-semibold text-ink-300">visible</td>
              <td className="whitespace-nowrap px-3 py-2 text-ink-300">
                {TIP.logicno} <span className="font-mono text-[11px] text-ink-500">bool</span>
              </td>
              <td className="px-3 py-2 text-ink-500">ne</td>
              <td className="px-3 py-2 text-ink-400">Prikazana / skrita vrstica (true, false, da, ne, 1, 0).</td>
              <td className="px-3 py-2 font-mono text-ink-200">true</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* primer datoteke */}
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-400">
          <FileSpreadsheet className="h-3.5 w-3.5 text-fines-400" aria-hidden />
          Primer datoteke {imeDatoteke(t, "predloga")}
        </span>
        <pre className="overflow-x-auto rounded-[12px] border border-white/10 bg-ink-950/60 px-3 py-2.5 font-mono text-xs leading-relaxed text-ink-200">
          <span className="text-fines-300">{glava.join(";")}</span>
          {t.primeri.map((p) => "\n" + glava.map((g) => (g === "visible" ? "true" : (p[g] ?? ""))).join(";"))}
        </pre>
      </div>

      {t.opombe.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-[12px] border border-warn-500/30 bg-warn-500/[0.07] px-3 py-2.5 text-ink-300">
          {t.opombe.map((o) => (
            <li key={o} className="flex gap-2 leading-snug">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn-500" aria-hidden />
              {o}
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button hint={`Prenesi predlogo CSV s primeri za ${t.ime}`} variant="primary" icon={Download} onClick={() => prenesiPredlogo(t)}>
          Prenesi predlogo CSV
        </Button>
      </div>
    </div>
  );
}
