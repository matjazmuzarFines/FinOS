"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BookOpen, ChevronDown, Database, Download, EyeOff, FileUp, Plus, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { IskalnoPolje, PoljeNaslov } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { NavodilaTabele } from "./NavodilaTabele";
import { UvozCsv } from "./UvozCsv";
import { Seznam, VrsticaObrazec } from "./VrsticaObrazec";
import { useLahkoUreja } from "@/lib/pravice";
import { ujemaIskanje } from "@/lib/iskanje";
import { prenesi, zapisiCsv } from "@/lib/csv";
import { glavaCsv, imeDatoteke, TABELE, tabela as poImenu, useStevila, useTabela, vBesedilo, type Stolpec, type TabelaBaze, type Vrstica } from "@/lib/tabeleBaze";

type Prikaz = "prikazane" | "skrite" | "vse";
type Sort = { stolpec: string; smer: 1 | -1 } | null;

const PRIKAZ: { id: Prikaz; ime: string; hint: string }[] = [
  { id: "prikazane", ime: "Prikazane", hint: "Samo vrstice, ki so prikazane v aplikaciji" },
  { id: "skrite", ime: "Skrite", hint: "Samo skrite vrstice (visible = false)" },
  { id: "vse", ime: "Vse", hint: "Vse vrstice, prikazane in skrite" },
];

/** Sistemski stolpci, po katerih se tudi razvršča. */
const SORT_SISTEM = [
  { ime: "id", tip: "stevilo" },
  { ime: "updated_at", tip: "besedilo" },
] as const;

// navodila odprta / zaprta ostanejo ob menjavi tabele
let navodilaOdprta = true;

/**
 * Podatki baze: levo meni tabel (na telefonu vodoravna vrsta), desno izbrana tabela (?tabela=):
 * glava z dejanji (Izvozi, Uvozi CSV, Dodaj vrstico), navodila za uvoz, tabela podatkov z iskanjem in razvrščanjem.
 */
export function PodatkiBaze() {
  const router = useRouter();
  const pot = usePathname();
  const iskalni = useSearchParams();
  const t = poImenu(iskalni.get("tabela")) ?? TABELE[0];
  const stevila = useStevila();
  const izberi = (ime: string) => router.replace(ime === TABELE[0].ime ? pot : `${pot}?tabela=${ime}`, { scroll: false });

  return (
    <>
      <GlavaStrani
        drobtine={[
          { naslov: "FIN:OS", href: "/" },
          { naslov: "Administracija", href: "/administracija" },
          { naslov: "Nastavitve", href: "/administracija/nastavitve" },
          { naslov: "Podatki baze" },
        ]}
        naslov="Podatki baze"
        opis="Šifranti in nastavitvene tabele FIN:OS v Supabase: dodajanje in urejanje vrstic ter uvoz iz CSV. Vrstic ne brišemo - skrijemo jih."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
        {/* meni tabel */}
        <motion.nav aria-label="Tabele" className="flex flex-col gap-3 lg:sticky lg:top-[88px]" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
          <NaslovRazdelka>Tabele</NaslovRazdelka>
          <div className="-mx-3 overflow-x-auto px-3 pb-1 lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="fos-glass flex min-w-max gap-1 rounded-[18px] p-1.5 lg:min-w-0 lg:flex-col">
              {TABELE.map((x, i) => {
                const izbran = x.ime === t.ime;
                return (
                  <motion.li key={x.ime} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                    <button
                      type="button"
                      title={`Odpri tabelo ${x.ime}`}
                      aria-pressed={izbran}
                      onClick={() => izberi(x.ime)}
                      className={`group relative flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2 text-left transition-colors duration-300 ${izbran ? "text-snow" : "text-ink-200 hover:bg-white/[0.06] hover:text-white"}`}
                    >
                      {izbran && (
                        <motion.span
                          layoutId="tabela-baze"
                          className="absolute inset-0 rounded-[13px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_6px_20px_-8px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition-all duration-300 ${izbran ? "bg-black/15" : "bg-fines-500/10 text-fines-300 ring-1 ring-fines-400/25 group-hover:scale-105"}`}>
                        <x.icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span className="relative flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{x.naslov}</span>
                        <span className={`truncate font-mono text-[11px] ${izbran ? "text-snow/75" : "text-ink-500"}`}>{x.ime}</span>
                      </span>
                      <span className={`relative rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${izbran ? "bg-black/20" : "bg-white/10 text-ink-400"}`} title="Prikazanih vrstic">
                        {stevila[x.ime] ?? "·"}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </motion.nav>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={t.ime} className="flex min-w-0 flex-col gap-4" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 260, damping: 28 }}>
            <Tabela t={t} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

/** Izbrana tabela: glava, navodila in podatki. */
function Tabela({ t }: { t: TabelaBaze }) {
  const { vrstice, napaka } = useTabela(t);
  const lahkoUreja = useLahkoUreja();
  const [odprta, setOdprta] = useState<Vrstica | "nova" | null>(null);
  const [uvoz, setUvoz] = useState(false);
  const [navodila, setNavodila] = useState(navodilaOdprta);
  const [iskanje, setIskanje] = useState("");
  const [prikaz, setPrikaz] = useState<Prikaz>("prikazane");
  const [sort, setSort] = useState<Sort>(null);

  const vidnih = vrstice?.filter((v) => v.visible).length ?? 0;
  const skritih = (vrstice?.length ?? 0) - vidnih;

  const prikazane = useMemo(() => {
    const s = sort && [...t.stolpci, ...SORT_SISTEM].find((x) => x.ime === sort.stolpec);
    return (vrstice ?? [])
      .filter((v) => (prikaz === "vse" ? true : prikaz === "skrite" ? !v.visible : v.visible))
      .filter((v) => ujemaIskanje(iskanje, [String(v.id), ...t.stolpci.map((x) => vBesedilo(x, v[x.ime]))]))
      .sort((a, b) => {
        if (!s || !sort) return a.id - b.id;
        const ka = a[s.ime];
        const kb = b[s.ime];
        const prazna = (x: unknown) => x == null || x === "" || (Array.isArray(x) && !x.length);
        if (prazna(ka) !== prazna(kb)) return prazna(ka) ? 1 : -1; // prazne vedno na koncu
        const r = s.tip === "stevilo" ? Number(ka) - Number(kb) : vBesedilo(s, ka).localeCompare(vBesedilo(s, kb), "sl", { sensitivity: "base", numeric: true });
        return sort.smer * r || a.id - b.id;
      });
  }, [vrstice, prikaz, iskanje, sort, t]);

  // klik: naraščajoče -> padajoče -> privzeto (po ID)
  const razvrsti = (stolpec: string) => setSort((s) => (s?.stolpec !== stolpec ? { stolpec, smer: 1 } : s.smer === 1 ? { stolpec, smer: -1 } : null));
  const filtrirano = iskanje !== "" || prikaz !== "prikazane";
  const preklopiNavodila = () => {
    navodilaOdprta = !navodila;
    setNavodila(navodilaOdprta);
  };

  const izvozi = () => {
    const glava = glavaCsv(t);
    const stolpci: Pick<Stolpec, "ime" | "tip">[] = [...t.stolpci, { ime: "visible", tip: "logicno" }];
    prenesi(imeDatoteke(t, "izvoz"), zapisiCsv(glava, (vrstice ?? []).map((v) => stolpci.map((s) => vBesedilo(s, v[s.ime])))));
  };

  return (
    <>
      {/* glava tabele */}
      <section className="fos-glass relative overflow-hidden rounded-[20px] p-4 sm:p-5">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.16),transparent_70%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[min(100%,18rem)] flex-1 items-start gap-4">
            <span className="fos-fines-fill relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-snow">
              <t.icon className="h-6 w-6" aria-hidden />
              <span className="fos-shine absolute inset-0" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="font-display text-2xl font-bold text-white">{t.naslov}</h2>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
                <span className="flex items-center gap-1 font-mono text-fines-300">
                  <Database className="h-3.5 w-3.5" aria-hidden />
                  {t.ime}
                </span>
                {vrstice && (
                  <>
                    <span>
                      <b className="tabular-nums text-ink-200">{vidnih}</b> prikazanih
                    </span>
                    {skritih > 0 && (
                      <span className="flex items-center gap-1">
                        <EyeOff className="h-3 w-3" aria-hidden />
                        <b className="tabular-nums text-ink-200">{skritih}</b> skritih
                      </span>
                    )}
                  </>
                )}
              </p>
              <p className="text-sm text-ink-400">{t.opis}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button hint={`Prenesi vse vrstice ${t.ime} v CSV`} variant="primary" icon={Download} onClick={izvozi} disabled={!vrstice?.length}>
              Izvozi CSV
            </Button>
            {lahkoUreja && (
              <>
                <Button hint={`Uvozi vrstice iz CSV v ${t.ime}`} variant="primary" icon={FileUp} onClick={() => setUvoz(true)} disabled={!vrstice}>
                  Uvozi CSV
                </Button>
                <Button hint={`Dodaj novo vrstico v ${t.ime}`} variant="success" icon={Plus} onClick={() => setOdprta("nova")} disabled={!vrstice}>
                  Dodaj vrstico
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* navodila */}
      <section className="fos-glass overflow-hidden rounded-[20px]">
        <button
          type="button"
          onClick={preklopiNavodila}
          title={navodila ? "Skrij navodila za uvoz" : "Pokaži navodila: struktura stolpcev in podatkov za uvoz"}
          aria-expanded={navodila}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] sm:px-5"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-fines-500/10 text-fines-300 ring-1 ring-fines-400/25">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-white">Navodila za uvoz CSV</span>
            <span className="truncate text-xs text-ink-400">Struktura stolpcev in podatkov za {t.ime}</span>
          </span>
          <ChevronDown className={`ml-auto h-5 w-5 shrink-0 text-ink-400 transition-transform duration-300 ${navodila ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {navodila && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="overflow-hidden">
              <div className="border-t border-white/10 p-4 sm:p-5">
                <NavodilaTabele tabela={t} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* podatki */}
      {napaka ? (
        <PraznoStanje
          ton="napaka"
          icon={AlertTriangle}
          naslov={`Tabele ${t.ime} ni mogoče prebrati`}
          opis={
            <>
              <p>{napaka}</p>
              {/relation|does not exist|schema cache/i.test(napaka) && <p className="mt-2">Tabela še ni ustvarjena: zaženi migracije v supabase/migrations (Supabase → SQL Editor).</p>}
            </>
          }
        />
      ) : (
        <section aria-label={`Vrstice ${t.ime}`} className="flex flex-col gap-3">
          <div className="fos-glass flex flex-wrap items-end gap-3 rounded-[20px] p-3 sm:p-4">
            <PoljeNaslov naslov="Iskanje" className="min-w-[min(100%,16rem)] flex-1">
              <IskalnoPolje value={iskanje} onChange={setIskanje} hint={`Išči po vseh stolpcih ${t.ime}`} placeholder="Išči po vseh stolpcih ..." />
            </PoljeNaslov>
            <PoljeNaslov naslov="Vrstice">
              <span className="flex max-w-full overflow-x-auto rounded-[10px] border border-white/10 bg-white/[0.03] p-0.5">
                {PRIKAZ.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.hint}
                    aria-pressed={prikaz === p.id}
                    onClick={() => setPrikaz(p.id)}
                    className={`h-10 whitespace-nowrap rounded-[8px] px-3 text-sm font-semibold transition-all duration-300 sm:h-[34px] ${
                      prikaz === p.id ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_4px_14px_-6px_rgb(202_80_16/0.9)]" : "text-ink-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {p.ime}
                    <span className="ml-1 text-xs opacity-75 tabular-nums">({p.id === "vse" ? (vrstice?.length ?? 0) : p.id === "skrite" ? skritih : vidnih})</span>
                  </button>
                ))}
              </span>
            </PoljeNaslov>
            {filtrirano && (
              <Button
                hint="Počisti iskanje in prikaži prikazane vrstice"
                variant="neutral"
                icon={RotateCcw}
                onClick={() => {
                  setIskanje("");
                  setPrikaz("prikazane");
                }}
              >
                Ponastavi
              </Button>
            )}
          </div>

          {!vrstice ? (
            <Nalaganje />
          ) : (
            <div className="fos-glass overflow-x-auto rounded-[16px]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-ink-800/90 text-[11px] font-bold uppercase tracking-wider text-ink-300">
                  <tr>
                    <SortTh ime="id" naslov="ID" sort={sort} onClick={razvrsti} desno />
                    {t.stolpci.map((s) => (
                      <SortTh key={s.ime} ime={s.ime} naslov={s.naslov} tip={s.pgTip} sort={sort} onClick={razvrsti} desno={s.tip === "stevilo"} />
                    ))}
                    <th className="px-3 py-2.5">Prikazana</th>
                    <SortTh ime="updated_at" naslov="Spremenjeno" sort={sort} onClick={razvrsti} />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {prikazane.map((v, i) => (
                      <motion.tr
                        key={v.id}
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 14) * 0.02 } }}
                        exit={{ opacity: 0 }}
                        onClick={() => setOdprta(v)}
                        onKeyDown={(e) => e.key === "Enter" && setOdprta(v)}
                        tabIndex={0}
                        title={lahkoUreja ? `Uredi vrstico ${v.id}` : `Odpri vrstico ${v.id}`}
                        className={`group cursor-pointer border-t border-white/[0.06] outline-none transition-colors hover:bg-fines-500/[0.07] focus-visible:bg-fines-500/10 ${v.visible ? "" : "opacity-55"}`}
                      >
                        <td className="relative px-3 py-2.5 text-right font-mono tabular-nums text-ink-500">
                          <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] origin-center scale-y-0 rounded-full bg-[linear-gradient(180deg,#f19a66,#ca5010)] transition-transform duration-300 group-hover:scale-y-100" />
                          {v.id}
                        </td>
                        {t.stolpci.map((s) => (
                          <td key={s.ime} className={`max-w-[18rem] px-3 py-2.5 ${s.tip === "stevilo" ? "text-right font-mono tabular-nums text-ink-200" : "text-white"} ${s.ime === t.kljuc ? "font-semibold" : ""}`}>
                            <Celica s={s} v={v[s.ime]} />
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          {v.visible ? (
                            <span className="inline-flex rounded-full border border-ok-500/40 bg-ok-500/10 px-2 py-0.5 text-xs font-semibold text-ok-500">Da</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-semibold text-ink-400">
                              <EyeOff className="h-3 w-3" aria-hidden />
                              Skrita
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-ink-400">{new Date(v.updated_at).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" })}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {!prikazane.length && (
                <div className="p-4">
                  <PraznoStanje
                    icon={vrstice.length ? SearchX : Database}
                    naslov={vrstice.length ? "Ni vrstic za izbrane filtre" : `Tabela ${t.naslov.toLowerCase()} je prazna`}
                    opis={vrstice.length ? "Spremeni iskanje ali prikaz vrstic." : lahkoUreja ? "Dodaj prvo vrstico ali uvozi CSV." : undefined}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {odprta && vrstice && <VrsticaObrazec tabela={t} vrstica={odprta === "nova" ? null : odprta} vrstice={vrstice} lahkoUreja={lahkoUreja} onClose={() => setOdprta(null)} />}
      {uvoz && vrstice && <UvozCsv tabela={t} vrstice={vrstice} onClose={() => setUvoz(false)} />}
    </>
  );
}

function Celica({ s, v }: { s: Stolpec; v: unknown }) {
  if (s.tip === "seznam") return <Seznam vrednost={Array.isArray(v) ? (v as string[]) : []} />;
  const b = vBesedilo(s, v);
  if (!b) return <span className="text-ink-500">-</span>;
  return (
    <span className="block truncate" title={b}>
      {b}
    </span>
  );
}

/** Glava stolpca z razvrščanjem (naraščajoče, padajoče, privzeto). */
function SortTh({ ime, naslov, tip, sort, onClick, desno }: { ime: string; naslov: string; tip?: string; sort: Sort; onClick: (s: string) => void; desno?: boolean }) {
  const aktiven = sort?.stolpec === ime;
  const Ikona = !aktiven ? ArrowUpDown : sort.smer === 1 ? ArrowUp : ArrowDown;
  return (
    <th className={`px-3 py-2.5 ${desno ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onClick(ime)}
        title={!aktiven ? `Razvrsti po ${naslov.toLowerCase()} naraščajoče` : sort.smer === 1 ? `Razvrsti po ${naslov.toLowerCase()} padajoče` : "Privzeti vrstni red (po ID)"}
        className={`group/s inline-flex items-center gap-1.5 uppercase tracking-wider transition-colors hover:text-fines-300 ${aktiven ? "text-fines-300" : ""} ${desno ? "flex-row-reverse" : ""}`}
      >
        <span className="flex flex-col items-start leading-tight">
          {naslov}
          {tip && <span className="font-mono text-[10px] font-medium normal-case tracking-normal text-ink-500">{ime} · {tip}</span>}
        </span>
        <Ikona className={`h-3.5 w-3.5 shrink-0 ${aktiven ? "" : "opacity-40 group-hover/s:opacity-80"}`} aria-hidden />
      </button>
    </th>
  );
}

function Nalaganje() {
  return (
    <div aria-label="Nalagam vrstice" className="fos-glass flex flex-col gap-2 rounded-[16px] p-3">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="h-9 animate-pulse rounded-[10px] bg-white/[0.06]" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}
