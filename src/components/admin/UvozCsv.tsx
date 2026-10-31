"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, BookOpen, Check, CheckCircle2, ChevronDown, CircleDashed, FileUp, Loader2, X, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Stikalo } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { NavodilaTabele } from "./NavodilaTabele";
import { Seznam } from "./VrsticaObrazec";
import { preberiCsv } from "@/lib/csv";
import { pripraviUvoz, uvozi, vBesedilo, type TabelaBaze, type UvozPriprava, type UvozVrstica, type Vrstica } from "@/lib/tabeleBaze";

type Props = { tabela: TabelaBaze; vrstice: Vrstica[]; onClose: () => void };

const STANJE: Record<UvozVrstica["stanje"], { ime: string; razred: string }> = {
  nova: { ime: "Nova", razred: "border-ok-500/40 bg-ok-500/10 text-ok-500" },
  posodobi: { ime: "Posodobi", razred: "border-sync-500/40 bg-sync-500/10 text-sync-500" },
  enaka: { ime: "Brez sprememb", razred: "border-white/10 bg-white/[0.04] text-ink-400" },
  napaka: { ime: "Napaka", razred: "border-nok-500/40 bg-nok-500/10 text-nok-500" },
};

/**
 * Uvoz CSV v tabelo: 1) izbira datoteke (povleci in spusti ali klikni) + navodila, 2) predogled vseh vrstic s stanjem
 * (nova / posodobi / brez sprememb / napaka), 3) zapis. Vrstice z napako se ne zapišejo, ostale se.
 */
export function UvozCsv({ tabela: t, vrstice, onClose }: Props) {
  const [datoteka, setDatoteka] = useState<string | null>(null);
  const [priprava, setPriprava] = useState<UvozPriprava | null>(null);
  const [posodobi, setPosodobi] = useState(true);
  const [vlecem, setVlecem] = useState(false);
  const [berem, setBerem] = useState(false);
  const [zapisujem, setZapisujem] = useState(false);
  const [navodila, setNavodila] = useState(false);
  const izbira = useRef<HTMLInputElement>(null);

  const preberi = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) return obvesti(`${f.name} ni datoteka CSV.`, "napaka");
    setBerem(true);
    try {
      const csv = preberiCsv(await f.text());
      setDatoteka(f.name);
      setPriprava(pripraviUvoz(t, csv.glava, csv.vrstice, vrstice));
    } finally {
      setBerem(false);
    }
  };

  const stevila = useMemo(() => {
    const s = { nova: 0, posodobi: 0, enaka: 0, napaka: 0 };
    for (const v of priprava?.vrstice ?? []) s[v.stanje]++;
    return s;
  }, [priprava]);
  const zapisov = stevila.nova + (posodobi ? stevila.posodobi : 0);

  const zapisi = async () => {
    if (!priprava) return;
    setZapisujem(true);
    try {
      const r = await uvozi(t, priprava.vrstice, posodobi);
      obvesti(`Uvoz v ${t.naslov}: ${r.dodanih} dodanih, ${r.posodobljenih} posodobljenih.`);
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setZapisujem(false);
    }
  };

  const nazaj = () => {
    setPriprava(null);
    setDatoteka(null);
  };

  return (
    <Modal
      open
      siroko
      title={`Uvoz CSV - ${t.naslov}`}
      onClose={onClose}
      noga={
        priprava ? (
          <>
            <Button hint="Izberi drugo datoteko" variant="neutral" icon={ArrowLeft} onClick={nazaj} disabled={zapisujem}>
              Druga datoteka
            </Button>
            <Button hint={`Zapiši ${zapisov} vrstic v ${t.ime}`} variant="success" icon={zapisujem ? Loader2 : Check} onClick={zapisi} disabled={zapisujem || !zapisov || priprava.napake.length > 0}>
              {zapisujem ? "Uvažam ..." : `Uvozi ${zapisov} ${zapisov === 1 ? "vrstico" : zapisov === 2 ? "vrstici" : zapisov < 5 && zapisov > 0 ? "vrstice" : "vrstic"}`}
            </Button>
          </>
        ) : (
          <Button hint="Zapri okno brez uvoza" variant="neutral" icon={X} onClick={onClose}>
            Prekliči
          </Button>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {!priprava ? (
          <motion.div key="izbira" className="flex flex-col gap-4" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            {/* povleci in spusti ali klikni */}
            <button
              type="button"
              title="Izberi datoteko CSV ali jo povleci sem"
              onClick={() => izbira.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setVlecem(true);
              }}
              onDragLeave={() => setVlecem(false)}
              onDrop={(e) => {
                e.preventDefault();
                setVlecem(false);
                preberi(e.dataTransfer.files[0]);
              }}
              className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-[18px] border-2 border-dashed px-6 py-10 text-center transition-all duration-300 ${
                vlecem ? "scale-[1.01] border-fines-400 bg-fines-500/10 shadow-[0_0_40px_-10px_rgb(238_122_58/0.8)]" : "border-white/15 bg-white/[0.03] hover:border-fines-400/50 hover:bg-white/[0.05]"
              }`}
            >
              <span className={`fos-fines-fill relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl text-snow transition-transform duration-500 ${vlecem ? "-translate-y-1 scale-110" : "group-hover:-translate-y-0.5"}`}>
                {berem ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden /> : <FileUp className="h-7 w-7" aria-hidden />}
                <span className="fos-shine absolute inset-0" />
              </span>
              <span className="font-display text-lg font-bold text-white">{berem ? "Berem datoteko ..." : vlecem ? "Spusti datoteko" : "Povleci datoteko CSV sem ali klikni"}</span>
              <span className="text-sm text-ink-400">
                Tabela <span className="font-mono text-fines-300">{t.ime}</span> · stolpci <span className="font-mono text-ink-200">{t.stolpci.map((s) => s.ime).join(", ")}</span>
              </span>
            </button>
            <input ref={izbira} type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => {
                preberi(e.target.files?.[0]);
                e.target.value = "";
              }} />

            <div className="rounded-[14px] border border-white/10 bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setNavodila((n) => !n)}
                title={navodila ? "Skrij navodila za uvoz" : "Pokaži navodila za strukturo datoteke"}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-ink-200 transition-colors hover:text-white"
              >
                <BookOpen className="h-4 w-4 text-fines-400" aria-hidden />
                Navodila: struktura datoteke za {t.naslov.toLowerCase()}
                <ChevronDown className={`ml-auto h-4 w-4 transition-transform duration-300 ${navodila ? "rotate-180" : ""}`} aria-hidden />
              </button>
              <AnimatePresence initial={false}>
                {navodila && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="border-t border-white/10 p-4">
                      <NavodilaTabele tabela={t} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div key="predogled" className="flex flex-col gap-4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-400">
              Datoteka <b className="font-mono text-white">{datoteka}</b> · {priprava.vrstice.length} vrstic s podatki
            </p>

            {priprava.napake.length > 0 && (
              <Sporocila ton="napaka" naslov="Datoteke ni mogoče uvoziti" seznam={[...priprava.napake, `Pričakovana glava: ${[...t.stolpci.map((s) => s.ime), "visible"].join(";")}`]} />
            )}
            {priprava.opozorila.length > 0 && <Sporocila ton="opozorilo" naslov="Opozorila" seznam={priprava.opozorila} />}

            {priprava.vrstice.length > 0 && (
              <>
                {/* povzetek */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(STANJE) as UvozVrstica["stanje"][]).map((s, i) => (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                      className={`flex flex-col rounded-[14px] border px-3 py-2 ${STANJE[s].razred} ${s === "posodobi" && !posodobi ? "opacity-50" : ""}`}
                    >
                      <span className="font-display text-2xl font-bold tabular-nums">{stevila[s]}</span>
                      <span className="text-xs font-semibold">{STANJE[s].ime}</span>
                    </motion.div>
                  ))}
                </div>

                {stevila.posodobi > 0 && (
                  <Stikalo vklop={posodobi} onChange={setPosodobi} hint="Vrstice z obstoječim ključem posodobi ali preskoči">
                    Posodobi obstoječe vrstice ({stevila.posodobi}) - po stolpcu {t.kljuc}
                  </Stikalo>
                )}

                <Predogled t={t} priprava={priprava} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

function Sporocila({ ton, naslov, seznam }: { ton: "napaka" | "opozorilo"; naslov: string; seznam: string[] }) {
  const napaka = ton === "napaka";
  return (
    <div className={`rounded-[12px] border px-3 py-2.5 text-sm ${napaka ? "border-nok-500/40 bg-nok-500/10" : "border-warn-500/30 bg-warn-500/[0.07]"}`}>
      <p className={`flex items-center gap-2 font-semibold ${napaka ? "text-nok-500" : "text-warn-500"}`}>
        {napaka ? <XCircle className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        {naslov}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 pl-6 text-ink-300">
        {seznam.map((s) => (
          <li key={s} className="list-disc font-mono text-xs leading-relaxed">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Predogled vrstic: stanje, vrednosti; spremenjene celice (posodobitev) so oranžne s staro vrednostjo v hover tekstu. */
function Predogled({ t, priprava }: { t: TabelaBaze; priprava: UvozPriprava }) {
  const stolpci = t.stolpci.filter((s) => priprava.stolpci.includes(s.ime));
  const zVisible = priprava.stolpci.includes("visible");
  // napake najprej, nato spremembe
  const red = { napaka: 0, nova: 1, posodobi: 2, enaka: 3 };
  const vrstice = [...priprava.vrstice].sort((a, b) => red[a.stanje] - red[b.stanje] || a.st - b.st);

  return (
    <div className="max-h-[40vh] overflow-auto rounded-[12px] border border-white/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-ink-800 text-[11px] font-bold uppercase tracking-wider text-ink-300">
          <tr>
            <th className="px-3 py-2">Vrstica</th>
            <th className="px-3 py-2">Stanje</th>
            {stolpci.map((s) => (
              <th key={s.ime} className="px-3 py-2 font-mono normal-case tracking-normal">
                {s.ime}
              </th>
            ))}
            {zVisible && <th className="px-3 py-2 font-mono normal-case tracking-normal">visible</th>}
          </tr>
        </thead>
        <tbody>
          {vrstice.map((v) => (
            <tr key={v.st} className="border-t border-white/[0.06] align-top">
              <td className="px-3 py-2 tabular-nums text-ink-500">{v.st}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${STANJE[v.stanje].razred}`}>
                  {v.stanje === "napaka" ? <XCircle className="h-3 w-3" aria-hidden /> : v.stanje === "enaka" ? <CircleDashed className="h-3 w-3" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
                  {STANJE[v.stanje].ime}
                  {v.obstojeca && <span className="font-normal opacity-80">· ID {v.obstojeca.id}</span>}
                </span>
                {v.sporocilo && <p className="mt-1 max-w-xs text-xs text-nok-500">{v.sporocilo}</p>}
              </td>
              {[...stolpci, ...(zVisible ? [{ ime: "visible", tip: "logicno" as const }] : [])].map((s) => {
                const nova = v.podatki[s.ime];
                const stara = v.obstojeca?.[s.ime];
                const spremenjena = v.stanje === "posodobi" && s.ime in v.podatki && JSON.stringify(stara ?? null) !== JSON.stringify(nova ?? null);
                return (
                  <td
                    key={s.ime}
                    title={spremenjena ? `Prej: ${vBesedilo(s, stara) || "prazno"}` : undefined}
                    className={`px-3 py-2 ${spremenjena ? "bg-fines-500/10 font-semibold text-fines-300" : "text-ink-200"}`}
                  >
                    {!(s.ime in v.podatki) ? (
                      <span className="text-ink-500">-</span>
                    ) : s.tip === "seznam" ? (
                      <Seznam vrednost={(nova as string[]) ?? []} />
                    ) : (
                      vBesedilo(s, nova) || <span className="text-ink-500">prazno</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
