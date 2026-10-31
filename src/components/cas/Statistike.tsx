"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Minus, Pencil, Plus, SearchX, Tags, Trash } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { Modal } from "@/components/ui/Modal";
import { IskalnoPolje, POLJE } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { obvesti } from "@/components/ui/Obvestila";
import { ujemaIskanje } from "@/lib/iskanje";
import { BARVE, IKONE_STATISTIK, PRAZNA_STATISTIKA, preveriStatistiko, shraniStatistiko, skrijStatistiko, useCasNastavitve, type Statistika, type StatistikaVnos } from "@/lib/casNastavitve";
import { CasovnaLinija } from "./CasovnaLinija";
import { Kvadratek, PoljeObrazca } from "./Polja";
import { IkonaStatistike, Panel, TestniPodatki } from "./Skupno";

const DROBTINE = [
  { naslov: "FIN:OS", href: "/" },
  { naslov: "Administracija", href: "/administracija" },
  { naslov: "Registracija časa", href: "/administracija/registracija" },
  { naslov: "Nastavitve", href: "/administracija/registracija/nastavitve" },
  { naslov: "Statistike" },
];

type Okno = {
  nacin: "nova" | "kopija" | "uredi";
  vnos: StatistikaVnos;
  id?: number;
} | null;

/**
 * Statistike: levo izbor (koda, ime, ikona) z iskanjem in gumbi Dodaj / Kopiraj / Uredi / Izbriši, desno podrobnosti
 * izbrane (?statistika=). Vsako štempljanje bo imelo statistiko; kvadratki (lastnosti) povedo, kaj se šteje.
 */
export function Statistike() {
  const router = useRouter();
  const pot = usePathname();
  const iskalni = useSearchParams();
  const n = useCasNastavitve();
  const [iskanje, setIskanje] = useState("");
  const [okno, setOkno] = useState<Okno>(null);
  const [brisem, setBrisem] = useState(false);

  const vidne = n.statistike.filter((s) => s.visible);
  const prikazane = vidne.filter((s) => ujemaIskanje(iskanje, [s.koda, s.ime, s.opis]));
  const izbrana = vidne.find((s) => s.id === Number(iskalni.get("statistika"))) ?? vidne[0] ?? null;
  const izberi = (id: number) => router.replace(`${pot}?statistika=${id}`, { scroll: false });
  const vnosIz = (s: Statistika): StatistikaVnos => ({
    koda: s.koda,
    ime: s.ime,
    opis: s.opis,
    barva: s.barva,
    ikona: s.ikona,
    lastnosti: s.lastnosti,
  });

  return (
    <>
      <GlavaStrani
        drobtine={DROBTINE}
        naslov="Statistike"
        opis="V katero statistiko gre štempljanje (delo po urniku, delo od doma, dopust, bolniška ...) in kaj se pri njej šteje. Barva in ikona se pokažeta na koledarju."
        akcije={n.vir === "test" ? <TestniPodatki opis={`Baza statistik ni dosegljiva (${n.napakaBaze}) - prikazani so testni podatki, spremembe se ne shranijo.`} /> : undefined}
      />

      {n.vir === "nalagam" ? (
        <div className="fos-glass h-96 animate-pulse rounded-[20px]" aria-label="Nalagam statistike" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-6">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="lg:sticky lg:top-[84px]">
            <Panel naslov="Statistike" desno={<span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-400">{vidne.length}</span>}>
              <div className="flex flex-wrap items-center gap-2">
                <Button hint="Dodaj novo statistiko" variant="success" icon={Plus} onClick={() => setOkno({ nacin: "nova", vnos: PRAZNA_STATISTIKA })}>
                  Dodaj
                </Button>
                <span className="ml-auto flex gap-1.5">
                  <IconButton
                    hint="Kopiraj izbrano statistiko v novo"
                    icon={Copy}
                    variant="primary"
                    disabled={!izbrana}
                    onClick={() =>
                      izbrana &&
                      setOkno({
                        nacin: "kopija",
                        vnos: {
                          ...vnosIz(izbrana),
                          koda: `${izbrana.koda}_K`.slice(0, 12),
                          ime: `${izbrana.ime} (kopija)`,
                        },
                      })
                    }
                  />
                  <IconButton
                    hint="Uredi izbrano statistiko"
                    icon={Pencil}
                    variant="primary"
                    disabled={!izbrana}
                    onClick={() =>
                      izbrana &&
                      setOkno({
                        nacin: "uredi",
                        vnos: vnosIz(izbrana),
                        id: izbrana.id,
                      })
                    }
                  />
                  <IconButton hint="Izbriši (skrij) izbrano statistiko" icon={Trash} variant="danger" disabled={!izbrana} onClick={() => setBrisem(true)} />
                </span>
              </div>
              <IskalnoPolje value={iskanje} onChange={setIskanje} hint="Išči po kodi ali imenu statistike" placeholder="Išči kodo ali ime ..." />
              <ul className="-mx-1 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto px-1">
                {prikazane.map((s) => {
                  const je = s.id === izbrana?.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => izberi(s.id)}
                        onDoubleClick={() => setOkno({ nacin: "uredi", vnos: vnosIz(s), id: s.id })}
                        aria-pressed={je}
                        title={`${s.koda} - ${s.ime} (dvoklik = uredi)`}
                        className={`relative flex w-full items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-left transition-colors duration-300 ${je ? "" : "hover:bg-white/[0.06]"}`}
                      >
                        {je && (
                          <motion.span
                            layoutId="izbrana-statistika"
                            className="absolute inset-0 rounded-[12px] border border-fines-400/60 bg-fines-500/10 shadow-[0_0_20px_-8px_rgb(238_122_58/0.9)]"
                            transition={{
                              type: "spring",
                              stiffness: 420,
                              damping: 34,
                            }}
                          />
                        )}
                        <IkonaStatistike s={s} velikost="sm" className="relative" />
                        <span className="relative w-14 shrink-0 truncate font-mono text-xs font-bold text-fines-300">{s.koda}</span>
                        <span className={`relative min-w-0 flex-1 truncate text-sm font-semibold ${je ? "text-white" : "text-ink-200"}`}>{s.ime}</span>
                      </button>
                    </li>
                  );
                })}
                {!prikazane.length && (
                  <li className="flex flex-col items-center gap-2 py-6 text-xs text-ink-500">
                    <SearchX className="h-5 w-5" aria-hidden />
                    Ni statistik za to iskanje.
                  </li>
                )}
              </ul>
            </Panel>
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {izbrana ? (
              <motion.div
                key={izbrana.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="min-w-0"
              >
                <Podrobnosti
                  s={izbrana}
                  onUredi={() =>
                    setOkno({
                      nacin: "uredi",
                      vnos: vnosIz(izbrana),
                      id: izbrana.id,
                    })
                  }
                />
              </motion.div>
            ) : (
              <PraznoStanje icon={Tags} naslov="Ni statistik" opis="Dodaj prvo statistiko (npr. DELO - Delo po urniku)." />
            )}
          </AnimatePresence>
        </div>
      )}

      <StatistikaObrazec
        okno={okno}
        onClose={() => setOkno(null)}
        onShranjeno={(id) => {
          setOkno(null);
          izberi(id);
        }}
      />

      <Modal
        open={brisem && !!izbrana}
        title="Izbriši statistiko"
        onClose={() => setBrisem(false)}
        noga={
          <>
            <Button hint="Ne briši statistike" variant="neutral" onClick={() => setBrisem(false)}>
              Prekliči
            </Button>
            <Button
              hint="Skrij statistiko (ostane v zgodovini)"
              variant="danger"
              icon={Trash}
              onClick={async () => {
                if (!izbrana) return;
                try {
                  await skrijStatistiko(izbrana.id);
                  obvesti(`Statistika ${izbrana.koda} je izbrisana (skrita).`);
                  router.replace(pot, { scroll: false });
                } catch (e) {
                  obvesti((e as Error).message, "napaka");
                } finally {
                  setBrisem(false);
                }
              }}
            >
              Izbriši
            </Button>
          </>
        }
      >
        {izbrana && (
          <div className="flex flex-col gap-3 text-sm text-ink-300">
            <p>
              Statistika{" "}
              <b className="text-white">
                {izbrana.koda} - {izbrana.ime}
              </b>{" "}
              se skrije (ne izbriše iz baze): pretekla štempljanja jo obdržijo, za nova je ne bo mogoče izbrati.
            </p>
            {uporaba(izbrana.id, n.intervali).length > 0 && (
              <p className="rounded-[12px] border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-warn-500">
                Uporabljajo jo intervali:{" "}
                {uporaba(izbrana.id, n.intervali)
                  .map((i) => i.ime)
                  .join(", ")}
                . Po brisanju jim izberi drugo statistiko.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

/** Intervali, ki uporabljajo statistiko. */
const uporaba = (id: number, intervali: ReturnType<typeof useCasNastavitve>["intervali"]) => intervali.filter((i) => i.visible && i.id_statistike === id);

function Podrobnosti({ s, onUredi }: { s: Statistika; onUredi: () => void }) {
  const n = useCasNastavitve();
  const intervali = uporaba(s.id, n.intervali);
  return (
    <div className="flex flex-col gap-4">
      <section className="fos-glass relative overflow-hidden rounded-[20px] p-4 sm:p-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-2xl"
          style={{
            background: `radial-gradient(circle, ${s.barva}, transparent 70%)`,
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[min(100%,18rem)] flex-1 items-start gap-4">
            <IkonaStatistike s={s} velikost="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-sm font-bold text-fines-300">{s.koda}</span>
              <h2 className="font-display text-2xl font-bold text-white">{s.ime}</h2>
              <p className="text-sm text-ink-400">{s.opis || "Brez opisa."}</p>
            </div>
          </div>
          <Button hint="Uredi to statistiko" variant="primary" icon={Pencil} onClick={onUredi}>
            Uredi
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel naslov="Kaj se šteje">
          <ul className="flex flex-col gap-2">
            {n.lastnosti.map((l) => {
              const ima = s.lastnosti.includes(l.id);
              return (
                <li key={l.id} className={`flex items-start gap-3 rounded-[12px] border px-3 py-2 ${ima ? "border-fines-400/40 bg-fines-500/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${ima ? "bg-ok-500 text-snow" : "bg-white/10 text-ink-500"}`}>
                    {ima ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={`text-sm font-semibold ${ima ? "text-white" : "text-ink-400"}`}>{l.ime}</span>
                    <span className="text-xs text-ink-500">{l.opis}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel naslov="Na koledarju">
            <div className="flex flex-col gap-3 text-xs text-ink-400">
              <span>Del dneva (npr. izhod)</span>
              <CasovnaLinija segmenti={[{ od: 7 * 60, do: 15 * 60, id_statistike: s.id }]} statistike={n.statistike} />
              <span>Cel dan (odsotnost)</span>
              <CasovnaLinija
                segmenti={[
                  {
                    od: 7 * 60,
                    do: 15 * 60,
                    id_statistike: s.id,
                    celodnevno: true,
                  },
                ]}
                statistike={n.statistike}
              />
              <span className="flex items-center gap-2">
                Barva{" "}
                <span
                  className="h-4 w-8 rounded-md"
                  style={{
                    background: s.barva,
                    boxShadow: `0 0 10px -2px ${s.barva}`,
                  }}
                />
                <span className="font-mono text-ink-300">{s.barva}</span>
              </span>
            </div>
          </Panel>
          <Panel naslov="Uporaba">
            {intervali.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {intervali.map((i) => (
                  <li key={i.id} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-ink-200">
                    {i.ime}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-500">Noben interval je še ne uporablja.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const NASLOV_OKNA = {
  nova: "Nova statistika",
  kopija: "Kopija statistike",
  uredi: "Uredi statistiko",
};

/** Okno Dodaj / Kopiraj / Uredi: koda, ime, opis, barva, ikona, kvadratki (lastnosti). */
function StatistikaObrazec({ okno, onClose, onShranjeno }: { okno: Okno; onClose: () => void; onShranjeno: (id: number) => void }) {
  return (
    <Modal open={!!okno} title={okno ? NASLOV_OKNA[okno.nacin] : ""} onClose={onClose} siroko>
      {okno && <Obrazec key={`${okno.nacin}-${okno.id ?? ""}`} okno={okno} onClose={onClose} onShranjeno={onShranjeno} />}
    </Modal>
  );
}

function Obrazec({ okno, onClose, onShranjeno }: { okno: NonNullable<Okno>; onClose: () => void; onShranjeno: (id: number) => void }) {
  const n = useCasNastavitve();
  const [v, setV] = useState<StatistikaVnos>(okno.vnos);
  const [poskus, setPoskus] = useState(false);
  const [shranjujem, setShranjujem] = useState(false);
  const napake = useMemo(() => preveriStatistiko(v, okno.id), [v, okno.id]);
  const nastavi = (p: Partial<StatistikaVnos>) => setV((x) => ({ ...x, ...p }));
  const shrani = async () => {
    setPoskus(true);
    if (Object.keys(napake).length) return;
    setShranjujem(true);
    try {
      const id = await shraniStatistiko(v, okno.id);
      obvesti(okno.nacin === "uredi" ? `Statistika ${v.koda} je shranjena.` : `Statistika ${v.koda} je dodana.`);
      onShranjeno(id);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };
  const N = (k: keyof StatistikaVnos) => (poskus ? napake[k] : undefined);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <PoljeObrazca naslov="Koda" obvezno napaka={N("koda")} opis="Velike črke, npr. DELO">
          <input
            className={`${POLJE} font-mono uppercase`}
            value={v.koda}
            maxLength={12}
            onChange={(e) =>
              nastavi({
                koda: e.target.value.toUpperCase().replace(/\s/g, "_"),
              })
            }
            title="Kratka enolična koda statistike"
          />
        </PoljeObrazca>
        <PoljeObrazca naslov="Ime" obvezno napaka={N("ime")} opis="Ime se pokaže kot stanje dneva na koledarju.">
          <input className={POLJE} value={v.ime} onChange={(e) => nastavi({ ime: e.target.value })} title="Ime statistike, npr. Delo po urniku" />
        </PoljeObrazca>
      </div>
      <PoljeObrazca naslov="Opis" opis="Kdaj se uporablja ta statistika.">
        <textarea className={`${POLJE} h-auto min-h-20 resize-y py-2`} value={v.opis} onChange={(e) => nastavi({ opis: e.target.value })} title="Opis statistike" />
      </PoljeObrazca>

      <div className="grid gap-5 md:grid-cols-2">
        <PoljeObrazca naslov="Barva" obvezno napaka={N("barva")}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {BARVE.map((b) => (
                <button
                  key={b}
                  type="button"
                  title={`Izberi barvo ${b}`}
                  onClick={() => nastavi({ barva: b })}
                  className={`h-7 w-7 rounded-lg transition-transform duration-200 hover:scale-110 ${v.barva.toLowerCase() === b ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : ""}`}
                  style={{ background: b, boxShadow: `0 4px 12px -4px ${b}` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(v.barva) ? v.barva : "#000000"}
                onChange={(e) => nastavi({ barva: e.target.value })}
                title="Prosta izbira barve"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-[10px] border border-white/10 bg-transparent p-1"
              />
              <input className={`${POLJE} font-mono`} value={v.barva} onChange={(e) => nastavi({ barva: e.target.value.trim() })} title="Barva v obliki #RRGGBB" />
            </div>
          </div>
        </PoljeObrazca>
        <PoljeObrazca naslov="Ikona">
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(IKONE_STATISTIK).map(([ime, I]) => {
              const je = v.ikona === ime;
              return (
                <button
                  key={ime}
                  type="button"
                  title={`Ikona ${ime}`}
                  onClick={() => nastavi({ ikona: ime })}
                  className={`grid aspect-square place-items-center rounded-[9px] transition-all duration-200 ${je ? "text-snow" : "border border-white/10 bg-white/[0.04] text-ink-300 hover:border-white/25 hover:text-white"}`}
                  style={
                    je
                      ? {
                          background: v.barva,
                          boxShadow: `0 0 14px -3px ${v.barva}`,
                        }
                      : undefined
                  }
                >
                  <I className="h-4 w-4" aria-hidden />
                </button>
              );
            })}
          </div>
        </PoljeObrazca>
      </div>

      <section className="flex flex-col gap-2">
        <NaslovRazdelka>Kaj se šteje</NaslovRazdelka>
        <ul className="grid gap-2 sm:grid-cols-2">
          {n.lastnosti.map((l) => {
            const ima = v.lastnosti.includes(l.id);
            const preklopi = () =>
              nastavi({
                lastnosti: ima ? v.lastnosti.filter((x) => x !== l.id) : [...v.lastnosti, l.id].sort((a, b) => a - b),
              });
            return (
              <li key={l.id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-2.5 transition-colors ${ima ? "border-fines-400/50 bg-fines-500/[0.07]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                >
                  <Kvadratek vklop={ima} onChange={preklopi} hint={l.opis} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-white">{l.ime}</span>
                    <span className="text-xs text-ink-500">{l.opis}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-3">
        <IkonaStatistike s={v} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-white">{v.ime || "Ime statistike"}</span>
          <span className="font-mono text-xs text-fines-300">{v.koda || "KODA"}</span>
        </span>
        <span className="w-40">
          <CasovnaLinija segmenti={[{ od: 360, do: 1000, id_statistike: -1 }]} statistike={[{ ...v, id: -1, visible: true }]} />
        </span>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
        <Button hint="Zapri brez shranjevanja" variant="neutral" onClick={onClose}>
          Prekliči
        </Button>
        <Button hint="Shrani statistiko v bazo" variant="success" icon={Check} onClick={shrani} disabled={shranjujem || n.vir === "nalagam"}>
          {shranjujem ? "Shranjujem ..." : "Shrani"}
        </Button>
      </div>
    </div>
  );
}
