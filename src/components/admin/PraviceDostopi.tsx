"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, KeyRound, Lock, RotateCcw, SearchX, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { IskalnoPolje, PoljeNaslov } from "@/components/ui/Polje";
import { Avatar } from "@/components/ui/Avatar";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { SaveBar } from "@/components/ui/SaveBar";
import { obvesti } from "@/components/ui/Obvestila";
import { ujemaIskanje } from "@/lib/iskanje";
import { IKONE, naloziUporabnike, shraniFunkcije, useFunkcije, type Funkcija, type Jaz, type Uporabnik } from "@/lib/funkcije";
import { polnoIme, useZaposleni, zacetnice, type Zaposleni } from "@/lib/zaposleni";

type Sort = { po: "ime" | "oddelek" | "prijava"; smer: 1 | -1 } | null;
/** Osnutek: "id:koda" -> vklop. */
type Osnutek = Record<string, boolean>;

const kljuc = (id: number, koda: string) => `${id}:${koda}`;

/** "pred 5 min", "včeraj", "12. 3. 2026" ali "nikoli". */
function prijava(cas: string | null | undefined): { besedilo: string; hint: string } {
  if (!cas) return { besedilo: "nikoli", hint: "Uporabnik se še ni prijavil" };
  const d = new Date(cas);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const hint = `Zadnja prijava: ${d.toLocaleString("sl-SI")}`;
  if (min < 60) return { besedilo: `pred ${Math.max(min, 1)} min`, hint };
  if (min < 24 * 60) return { besedilo: `pred ${Math.round(min / 60)} h`, hint };
  if (min < 48 * 60) return { besedilo: "včeraj", hint };
  if (min < 7 * 24 * 60) return { besedilo: `pred ${Math.round(min / 1440)} dnevi`, hint };
  return { besedilo: d.toLocaleDateString("sl-SI"), hint };
}

/**
 * Pravice in dostopi: funkcije (kartice z opisom, kaj obsegajo) in uporabniki (zaposleni z računom) z
 * zadnjo prijavo in kvadratkom za vsako funkcijo. Spremembe v osnutku, Shrani v spodnji vrstici (piše strežnik).
 */
export function PraviceDostopi() {
  const { podatki, napaka } = useZaposleni();
  const { funkcije, napaka: napakaFunkcij } = useFunkcije();
  const izbran = Number(useSearchParams().get("zaposleni")) || null;
  const [uporabniki, setUporabniki] = useState<{ po: Map<number, Uporabnik>; jaz: Jaz } | null>(null);
  const [napakaApi, setNapakaApi] = useState<string | null>(null);
  const [osnutek, setOsnutek] = useState<Osnutek>({});
  const [shranjujem, setShranjujem] = useState(false);
  const [iskanje, setIskanje] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(null);

  useEffect(() => {
    let ziv = true;
    naloziUporabnike().then(
      (r) => ziv && setUporabniki({ po: new Map(r.uporabniki.map((u) => [u.id_zaposlenega, u])), jaz: r.jaz }),
      (e: Error) => ziv && setNapakaApi(e.message),
    );
    return () => {
      ziv = false;
    };
  }, []);

  const zRacunom = useMemo(() => (podatki?.zaposleni ?? []).filter((z) => z.id_uporabnika), [podatki]);
  const brezRacuna = (podatki?.zaposleni.length ?? 0) - zRacunom.length;
  const ima = (z: Zaposleni, koda: string) => osnutek[kljuc(z.id, koda)] ?? z.funkcije.includes(koda);
  const sprememb = Object.entries(osnutek).filter(([k, v]) => {
    const [id, koda] = k.split(":");
    return podatki?.poId.get(Number(id))?.funkcije.includes(koda) !== v;
  });

  const jaz = uporabniki?.jaz;
  /** Zakaj kvadratka ni mogoče spremeniti (ali null). */
  const zaklenjen = (z: Zaposleni, koda: string): string | null => {
    if (!jaz) return "Nalagam pravice ...";
    if (koda === "kadrovanje" && !jaz.zasilni && !jaz.funkcije.includes("kadrovanje")) return "Kadrovanje lahko dodeli ali odvzame samo uporabnik, ki ima Kadrovanje.";
    if (koda === "super_admin" && z.id === jaz.id_zaposlenega && !jaz.zasilni && ima(z, koda)) return "Sebi ne moreš odvzeti Super Admina - to naj naredi drug Super Admin.";
    return null;
  };

  const prikazani = useMemo(() => {
    const kljucSort = (z: Zaposleni): string | number | undefined =>
      sort?.po === "oddelek" ? z.oddelek?.ime_oddelka : sort?.po === "prijava" ? (uporabniki?.po.get(z.id)?.zadnja_prijava ?? undefined) : `${z.priimek} ${z.ime}`;
    return zRacunom
      .filter((z) => ujemaIskanje(iskanje, [z.ime, z.priimek, z.email, z.uporabnisko_ime, z.oddelek?.ime_oddelka]))
      .filter((z) => (filter == null ? true : filter === "" ? !z.funkcije.length : z.funkcije.includes(filter)))
      .sort((a, b) => {
        if (!sort) return a.priimek.localeCompare(b.priimek, "sl") || a.ime.localeCompare(b.ime, "sl");
        const ka = kljucSort(a);
        const kb = kljucSort(b);
        if (!ka !== !kb) return ka ? -1 : 1; // prazne vedno na koncu
        return sort.smer * String(ka ?? "").localeCompare(String(kb ?? ""), "sl") || a.priimek.localeCompare(b.priimek, "sl");
      });
  }, [zRacunom, iskanje, filter, sort, uporabniki]);

  // odprto z lista zaposlenega (?zaposleni=): pomakni do vrstice
  useEffect(() => {
    if (!izbran || !podatki) return;
    const t = setTimeout(() => document.getElementById(`uporabnik-${izbran}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    return () => clearTimeout(t);
  }, [izbran, podatki]);

  const preklopi = (z: Zaposleni, koda: string) => setOsnutek((o) => ({ ...o, [kljuc(z.id, koda)]: !ima(z, koda) }));
  const razvrsti = (po: NonNullable<Sort>["po"]) => setSort((s) => (s?.po !== po ? { po, smer: 1 } : s.smer === 1 ? { po, smer: -1 } : null));

  const shrani = async () => {
    setShranjujem(true);
    try {
      await shraniFunkcije(sprememb.map(([k, vklop]) => ({ id_zaposlenega: Number(k.split(":")[0]), koda: k.split(":")[1], vklop })));
      obvesti(`Pravice shranjene (${sprememb.length} ${sprememb.length === 1 ? "sprememba" : "sprememb"}).`);
      setOsnutek({});
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };

  const steviloZ = (koda: string) => zRacunom.filter((z) => ima(z, koda)).length;
  const filtrirano = iskanje !== "" || filter != null;

  return (
    <>
      <GlavaStrani
        drobtine={[
          { naslov: "FIN:OS", href: "/" },
          { naslov: "Administracija", href: "/administracija" },
          { naslov: "Nastavitve", href: "/administracija/nastavitve" },
          { naslov: "Pravice in dostopi" },
        ]}
        naslov="Pravice in dostopi"
        opis="Funkcije uporabnikov FIN:OS in FIN:ME. Vsaka funkcija odklene svoj del sistema - spodaj je opisano, kaj obsega."
      />

      {/* funkcije */}
      <section className="flex flex-col gap-4">
        <NaslovRazdelka>Funkcije</NaslovRazdelka>
        {napakaFunkcij ? (
          <PraznoStanje
            ton="napaka"
            icon={AlertTriangle}
            naslov="Funkcij ni mogoče prebrati"
            opis={/relation|does not exist|schema cache/i.test(napakaFunkcij) ? "V Supabase (SQL Editor) zaženi 008_funkcije.sql (mapa supabase/migrations)." : napakaFunkcij}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(funkcije ?? []).map((f, i) => (
              <KarticaFunkcije key={f.koda} f={f} stevilo={podatki ? steviloZ(f.koda) : null} zamik={i * 0.06} />
            ))}
          </div>
        )}
      </section>

      {/* uporabniki */}
      <section className="flex flex-col gap-3">
        <NaslovRazdelka desno={<span className="text-xs tabular-nums text-ink-400">{zRacunom.length}</span>}>Uporabniki</NaslovRazdelka>

        <div className="fos-glass flex flex-col gap-3 rounded-[20px] p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <PoljeNaslov naslov="Iskanje" className="min-w-[min(100%,16rem)] flex-1">
              <IskalnoPolje value={iskanje} onChange={setIskanje} hint="Išči po imenu, e-mailu, uporabniškem imenu, oddelku" placeholder="Ime, e-mail, oddelek ..." />
            </PoljeNaslov>
            {filtrirano && (
              <Button
                hint="Počisti iskanje in filter funkcij"
                variant="neutral"
                icon={RotateCcw}
                onClick={() => {
                  setIskanje("");
                  setFilter(null);
                }}
              >
                Ponastavi
              </Button>
            )}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            <Cip izbran={filter == null} onClick={() => setFilter(null)} hint="Prikaži vse uporabnike" stevilo={zRacunom.length}>
              Vsi
            </Cip>
            {(funkcije ?? []).map((f) => (
              <Cip key={f.koda} izbran={filter === f.koda} onClick={() => setFilter(filter === f.koda ? null : f.koda)} hint={`Samo uporabniki s funkcijo ${f.ime}`} stevilo={zRacunom.filter((z) => z.funkcije.includes(f.koda)).length}>
                {f.ime}
              </Cip>
            ))}
            <Cip izbran={filter === ""} onClick={() => setFilter(filter === "" ? null : "")} hint="Samo uporabniki brez funkcij" stevilo={zRacunom.filter((z) => !z.funkcije.length).length}>
              Brez funkcij
            </Cip>
          </div>
        </div>

        {napakaApi && (
          <p className="flex items-center gap-2 rounded-[12px] border border-warn-500/30 bg-warn-500/[0.07] px-3 py-2 text-sm text-warn-500">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Zadnjih prijav ni mogoče prebrati: {napakaApi}
          </p>
        )}

        {napaka ? (
          <PraznoStanje ton="napaka" icon={AlertTriangle} naslov="Uporabnikov ni mogoče prebrati" opis={napaka} />
        ) : !podatki || !funkcije ? (
          <div className="fos-glass h-48 animate-pulse rounded-[18px]" aria-label="Nalagam uporabnike" />
        ) : !zRacunom.length ? (
          <PraznoStanje icon={UserRoundX} naslov="Še ni uporabnikov" opis="Uporabnik je zaposleni z računom - na listu zaposlenega (Podatki → Prijava v FIN:ME) vpiši e-mail in geslo." />
        ) : (
          <div className="fos-glass overflow-x-auto rounded-[18px]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-ink-800/90 text-[11px] font-bold uppercase tracking-wider text-ink-300">
                <tr>
                  <SortTh naslov="Uporabnik" aktiven={sort?.po === "ime"} smer={sort?.smer} onClick={() => razvrsti("ime")} />
                  <th className="px-3 py-2.5">Prijava</th>
                  <SortTh naslov="Oddelek" aktiven={sort?.po === "oddelek"} smer={sort?.smer} onClick={() => razvrsti("oddelek")} />
                  <SortTh naslov="Zadnja prijava" aktiven={sort?.po === "prijava"} smer={sort?.smer} onClick={() => razvrsti("prijava")} />
                  {funkcije.map((f) => {
                    const Ikona = IKONE[f.koda] ?? KeyRound;
                    return (
                      <th key={f.koda} className="px-3 py-2.5 text-center" title={f.opis}>
                        <span className="inline-flex items-center gap-1.5">
                          <Ikona className="h-3.5 w-3.5 text-fines-400" aria-hidden />
                          {f.ime}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {prikazani.map((z, i) => {
                    const p = prijava(uporabniki?.po.get(z.id)?.zadnja_prijava);
                    const spremenjen = funkcije.some((f) => kljuc(z.id, f.koda) in osnutek && osnutek[kljuc(z.id, f.koda)] !== z.funkcije.includes(f.koda));
                    return (
                      <motion.tr
                        key={z.id}
                        id={`uporabnik-${z.id}`}
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 14) * 0.02 } }}
                        exit={{ opacity: 0 }}
                        className={`border-t border-white/[0.06] transition-colors ${z.id === izbran ? "bg-fines-500/10 shadow-[inset_3px_0_0_#ee7a3a]" : spremenjen ? "bg-warn-500/[0.05]" : "hover:bg-white/[0.03]"}`}
                      >
                        <td className="px-3 py-2.5">
                          <Link href={`/administracija/zaposleni/${z.id}?zavihek=nastavitve`} title={`Odpri list zaposlenega ${polnoIme(z)}`} className="group flex min-w-0 items-center gap-3">
                            <Avatar besedilo={zacetnice(z)} velikost="sm" />
                            <span className="truncate font-semibold text-white transition-colors group-hover:text-fines-300">{polnoIme(z)}</span>
                            {z.id === jaz?.id_zaposlenega && <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">Ti</span>}
                          </Link>
                        </td>
                        <td className="max-w-[16rem] px-3 py-2.5">
                          <span className="block truncate text-ink-200" title={z.email ?? undefined}>
                            {z.email ?? "-"}
                          </span>
                          {z.uporabnisko_ime && <span className="block truncate font-mono text-xs text-ink-500">{z.uporabnisko_ime}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-ink-300">{z.oddelek?.ime_oddelka ?? <span className="text-ink-500">-</span>}</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 text-xs ${p.besedilo === "nikoli" ? "text-ink-500" : "text-ink-300"}`} title={p.hint}>
                          {uporabniki ? p.besedilo : "..."}
                        </td>
                        {funkcije.map((f) => {
                          const razlog = zaklenjen(z, f.koda);
                          const vklop = ima(z, f.koda);
                          return (
                            <td key={f.koda} className="px-3 py-2.5 text-center">
                              <Kvadratek
                                vklop={vklop}
                                spremenjen={kljuc(z.id, f.koda) in osnutek && vklop !== z.funkcije.includes(f.koda)}
                                zaklenjen={razlog}
                                hint={`${vklop ? "Odvzemi" : "Dodeli"} funkcijo ${f.ime}: ${polnoIme(z)}`}
                                onClick={() => preklopi(z, f.koda)}
                              />
                            </td>
                          );
                        })}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
            {!prikazani.length && (
              <div className="p-4">
                <PraznoStanje icon={SearchX} naslov="Ni uporabnikov za izbrane filtre" opis="Spremeni iskanje ali filter funkcij." />
              </div>
            )}
          </div>
        )}

        {brezRacuna > 0 && (
          <p className="px-1 text-xs text-ink-500">
            {brezRacuna} zaposlenih še nima računa in ni na seznamu - funkcijo lahko dobijo, ko jim na listu zaposlenega vpišeš e-mail in geslo.
          </p>
        )}
      </section>

      <SaveBar sprememb={sprememb.length} shranjujem={shranjujem} onShrani={shrani} onPreklici={() => setOsnutek({})} />
    </>
  );
}

function KarticaFunkcije({ f, stevilo, zamik }: { f: Funkcija; stevilo: number | null; zamik: number }) {
  const Ikona = IKONE[f.koda] ?? KeyRound;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.05 + zamik }}
      className="fos-kartica group relative flex flex-col gap-3 overflow-hidden rounded-[20px] border border-white/10 p-5 shadow-[var(--fos-shadow-card)]"
    >
      <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.18),transparent_70%)] transition-transform duration-700 group-hover:scale-150" />
      <div className="relative flex items-start gap-4">
        <span className="fos-fines-fill relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-snow">
          <Ikona className="h-6 w-6" aria-hidden />
          <span className="fos-shine absolute inset-0" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-display text-xl font-bold text-white">{f.ime}</span>
            {stevilo != null && (
              <span className="font-display text-2xl font-bold tabular-nums text-white" title={`Uporabnikov s funkcijo ${f.ime}: ${stevilo}`}>
                {stevilo}
              </span>
            )}
          </span>
          <span className="text-sm text-ink-400">{f.opis}</span>
        </div>
      </div>
      {f.obsega.length > 0 && (
        <div className="relative flex flex-col gap-1.5 rounded-[14px] border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-fines-400">Obsega</span>
          <ul className="flex flex-col gap-1">
            {f.obsega.map((o) => (
              <li key={o} className="flex gap-2 text-sm leading-snug text-ink-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fines-400" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
      {f.koda === "kadrovanje" && (
        <p className="relative flex items-center gap-1.5 text-xs text-ink-500">
          <Lock className="h-3 w-3 text-fines-400" aria-hidden />
          Dodeli in odvzame jo lahko samo uporabnik, ki jo ima. Zaščito izvaja baza.
        </p>
      )}
    </motion.div>
  );
}

/** Kvadratek funkcije 24 px: vklop = oranžen preliv s kljukico, spremenjen = rumen obroč, zaklenjen = ključavnica. */
function Kvadratek({ vklop, spremenjen, zaklenjen, hint, onClick }: { vklop: boolean; spremenjen: boolean; zaklenjen: string | null; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={vklop}
      title={zaklenjen ?? hint}
      aria-label={zaklenjen ?? hint}
      disabled={!!zaklenjen}
      onClick={onClick}
      className={`relative inline-grid h-7 w-7 place-items-center rounded-[8px] border transition-all duration-300 active:scale-90 disabled:cursor-not-allowed ${
        vklop
          ? "border-transparent bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_4px_14px_-4px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
          : "border-white/15 bg-white/[0.04] text-transparent hover:border-fines-400/60 hover:bg-white/[0.08]"
      } ${zaklenjen ? "opacity-50" : "hover:-translate-y-0.5"} ${spremenjen ? "ring-2 ring-warn-500 ring-offset-2 ring-offset-ink-900" : ""}`}
    >
      <AnimatePresence initial={false}>
        {vklop && (
          <motion.span key="k" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
      {zaklenjen && (
        <span className="absolute -bottom-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full border border-white/10 bg-ink-800 text-ink-300">
          <Lock className="h-2.5 w-2.5" aria-hidden />
        </span>
      )}
    </button>
  );
}

function SortTh({ naslov, aktiven, smer, onClick }: { naslov: string; aktiven: boolean; smer?: 1 | -1; onClick: () => void }) {
  const Ikona = !aktiven ? ArrowUpDown : smer === 1 ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-2.5">
      <button
        type="button"
        onClick={onClick}
        title={!aktiven ? `Razvrsti po ${naslov.toLowerCase()} naraščajoče` : smer === 1 ? `Razvrsti po ${naslov.toLowerCase()} padajoče` : "Privzeti vrstni red (po priimku)"}
        className={`group/s inline-flex items-center gap-1.5 uppercase tracking-wider transition-colors hover:text-fines-300 ${aktiven ? "text-fines-300" : ""}`}
      >
        {naslov}
        <Ikona className={`h-3.5 w-3.5 ${aktiven ? "" : "opacity-40 group-hover/s:opacity-80"}`} aria-hidden />
      </button>
    </th>
  );
}

function Cip({ izbran, onClick, hint, stevilo, children }: { izbran: boolean; onClick: () => void; hint: string; stevilo: number; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={izbran}
      className={`flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-all duration-300 active:scale-[0.97] ${
        izbran
          ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_6px_20px_-8px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
          : "border border-white/10 bg-white/[0.04] text-ink-200 hover:border-fines-400/40 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
      <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${izbran ? "bg-black/20" : "bg-white/10 text-ink-400"}`}>{stevilo}</span>
    </button>
  );
}
