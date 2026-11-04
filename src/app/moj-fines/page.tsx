"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, Users } from "lucide-react";
import { NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { useJaz } from "@/components/me/Jaz";
import { MeKrog, type Znacka } from "@/components/me/MeKrog";
import { DelovnaUra } from "@/components/me/DelovnaUra";
import { fmtCas } from "@/lib/cas";
import { useCasNastavitve } from "@/lib/casNastavitve";
import { ME_VSTOPI } from "@/lib/nav";
import { fmtObdobje, STATUSI, useZahtevki, VRSTE, type VrstaZahtevka } from "@/lib/zahtevki";

const VRSTA_STRANI: Record<string, VrstaZahtevka> = { "/moj-fines/odsotnosti": "odsotnost", "/moj-fines/dovolilnice": "dovolilnica", "/moj-fines/popravki": "popravek" };

/** FIN:ME (Moj Fines) - vstop: pozdrav, velike kartice (Moj čas, Odsotnosti, Dovolilnice, Popravki), zadnji zahtevki. */
export default function MojFinesStran() {
  const j = useJaz();
  const { jaz, ekipa, vodja } = j;
  const zh = useZahtevki();
  const n = useCasNastavitve();
  const ekipaIds = new Set(ekipa.map((z) => z.id));

  const znacke = (href: string): Znacka[] => {
    const vrsta = VRSTA_STRANI[href];
    if (!vrsta) return [];
    const moji = zh.zahtevki.filter((z) => z.vrsta === vrsta && z.id_zaposlenega === jaz.id && z.status === "oddano").length;
    const ekipe = zh.zahtevki.filter((z) => z.vrsta === vrsta && ekipaIds.has(z.id_zaposlenega) && z.status === "oddano").length;
    return [
      ...(ekipe ? [{ stevilo: ekipe, besedilo: `${ekipe} za potrditev`, hint: "Zahtevki ekipe, ki čakajo na tvojo potrditev", ton: "potrdi" as const }] : []),
      ...(moji ? [{ stevilo: moji, besedilo: `${moji} čaka`, hint: "Tvoji zahtevki, ki še čakajo na vodjo", ton: "caka" as const }] : []),
    ];
  };
  const zadnji = zh.zahtevki
    .filter((z) => z.id_zaposlenega === jaz.id)
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);
  const href = (v: VrstaZahtevka) => ME_VSTOPI.find((x) => VRSTA_STRANI[x.href] === v)!.href;

  return (
    <>
      <h1 className="sr-only">Moj Fines</h1>
      {/* osrednja funkcija čim višje: levo krog, desno Delovna ura */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <nav aria-label="Moj Fines" className="min-w-0">
          <MeKrog
            vstopi={ME_VSTOPI}
            znacke={znacke}
            j={j}
            stevci={{
              moji: zh.zahtevki.filter((z) => z.id_zaposlenega === jaz.id && z.status === "oddano").length,
              ekipa: zh.zahtevki.filter((z) => ekipaIds.has(z.id_zaposlenega) && z.status === "oddano").length,
            }}
          />
        </nav>
        <div className="lg:sticky lg:top-[88px]">
          <DelovnaUra j={j} />
        </div>
      </div>

      {zadnji.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="flex flex-col gap-3">
          <NaslovRazdelka>Moji zadnji zahtevki</NaslovRazdelka>
          <ul className="flex flex-col gap-1.5">
            {zadnji.map((z) => {
              const S = STATUSI[z.status];
              const stat = n.statistike.find((s) => s.id === z.id_statistike);
              return (
                <li key={z.id}>
                  <Link
                    href={href(z.vrsta)}
                    title={`Odpri ${VRSTE[z.vrsta].mnozina.toLowerCase()}`}
                    className="fos-glass group flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-fines-400/40"
                    style={{ boxShadow: `inset 3px 0 0 ${S.barva}` }}
                  >
                    <S.ikona className="h-5 w-5 shrink-0" style={{ color: S.barva }} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                      <b className="text-sm text-white">{z.vrsta === "popravek" ? "Popravek" : z.tip_dovolilnice === "delo" ? "Delo izven urnika" : (stat?.ime ?? VRSTE[z.vrsta].ime)}</b>
                      <span className="text-sm tabular-nums text-ink-400">
                        {fmtObdobje(z.datum_od, z.datum_do)}
                        {z.cas_od != null && ` · ${fmtCas(z.cas_od)} - ${fmtCas(z.cas_do ?? 0)}`}
                      </span>
                    </span>
                    <span className="text-xs font-bold" style={{ color: S.barva }}>
                      {S.ime}
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-500 transition-transform group-hover:translate-x-0.5 group-hover:text-fines-300" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      {vodja && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="flex items-center gap-2 text-sm text-ink-400">
          <Users className="h-4 w-4 text-fines-300" aria-hidden />
          Zahtevke ekipe potrdiš v vsakem razdelku pod zavihkom <b className="text-ink-200">Ekipa</b>.
        </motion.p>
      )}
    </>
  );
}
