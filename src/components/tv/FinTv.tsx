"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Code2, Copy, Download, FileText, KeyRound, Link2, MonitorPlay, Pencil, Plus, Power, RefreshCw, ScanEye, Tv, Unlink, Wifi, WifiOff } from "lucide-react";
import { Button, ButtonLink, IconButton } from "@/components/ui/Button";
import { GlavaStrani } from "@/components/ui/GlavaStrani";
import { Modal } from "@/components/ui/Modal";
import { POLJE } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { obvesti } from "@/components/ui/Obvestila";
import { PoljeObrazca } from "@/components/cas/Polja";
import { Panel, TestniPodatki } from "@/components/cas/Skupno";
import { Znak } from "@/components/Znak";
import { dodajOkna, vklopVira, type TvVir, dodajZaslon, naZvezi, type TvOkno, novKljucZaslona, odveziZaslon, poveziZaslon, ukazZaslonu, urediZaslon, useTv, zasloniSeznama, type TvZaslon } from "@/lib/tv";
import { IKONE_VIROV } from "./Diapozitiv";
import { Mreza, oknoVira, VLECI_VIR } from "./Mreza";

const DROBTINE = [{ naslov: "FIN:OS", href: "/" }, { naslov: "Administracija", href: "/administracija" }, { naslov: "FIN:TV" }];

function pred(iso: string | null, zdaj: number) {
  if (!iso) return "še nikoli";
  const s = Math.round((zdaj - new Date(iso).getTime()) / 1000);
  if (s < 90) return "zdaj";
  if (s < 3600) return `pred ${Math.round(s / 60)} min`;
  if (s < 86400) return `pred ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" });
}

const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w .-]/g, "");

/**
 * Zagon zaslona za Windows (.cmd): Edge kot okno aplikacije čez cel zaslon, v ločenem profilu (zastavice veljajo
 * tudi, ko je Edge že odprt). Datoteka gre v mapo Zagon (shell:startup) in na namizje (nazaj čez cel zaslon).
 */
function prenesiZagon(ime: string, kljuc: string) {
  const url = `${window.location.origin}/tv?k=${kljuc}`;
  const vsebina = [
    "@echo off",
    `rem FIN:TV - zaslon "${ascii(ime)}"`,
    "rem Kopiraj v mapo Zagon (Win+R -> shell:startup) in na namizje. Dvoklik = predvajanje cez cel zaslon.",
    "rem Pomanjsaj: F11. Kljuc je v tej datoteki - ne posiljaj je naokoli.",
    `start "" msedge --app="${url}" --start-fullscreen --user-data-dir="%LOCALAPPDATA%\\FinTV" --no-first-run --autoplay-policy=no-user-gesture-required`,
    "",
  ].join("\r\n");
  const u = URL.createObjectURL(new Blob([vsebina], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = `FIN-TV ${ascii(ime) || "zaslon"}.cmd`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

/**
 * FIN:TV (Administracija): levo zasloni (TV-ji) s stanjem, desno izbran zaslon - ukazi (Predvajaj tukaj, Pokaži ime,
 * Osveži TV), povezovanje z drugimi zasloni (isti seznam, sinhrono) in seznam predvajanja (Mreza).
 * Izbran zaslon v naslovu (?zaslon=). Brez baze 022 testni podatki v tem brskalniku.
 */
export function FinTv() {
  const tv = useTv(30_000);
  const router = useRouter();
  const pot = usePathname();
  const iskalni = useSearchParams();
  const [zdaj] = useState(() => Date.now());
  const [dodaj, setDodaj] = useState(false);
  const [kljuc, setKljuc] = useState<{ ime: string; kljuc: string } | null>(null);
  const [povezi, setPovezi] = useState(false);
  const [urejam, setUrejam] = useState(false);

  const zasloni = [...tv.zasloni].sort((a, b) => Number(b.visible) - Number(a.visible) || a.id - b.id);
  const izbran = zasloni.find((z) => z.id === Number(iskalni.get("zaslon"))) ?? zasloni[0];
  const izberi = (id: number) => router.replace(`${pot}?zaslon=${id}`, { scroll: false });
  const povezani = izbran ? zasloniSeznama(tv.zasloni, izbran.id_seznama).filter((z) => z.id !== izbran.id) : [];
  // drugi seznami (kopiraj okno): en vnos na seznam, ime = zasloni, ki ga kažejo
  const drugiSeznami = [...new Set(tv.zasloni.filter((z) => z.visible && z.id_seznama !== izbran?.id_seznama).map((z) => z.id_seznama))].map((id) => ({
    id,
    ime: zasloniSeznama(tv.zasloni, id)
      .map((z) => z.ime)
      .join(" + "),
  }));

  const izvedi = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) obvesti(ok);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  // komponenta v seznam izbranega zaslona (povleci ali +)
  const dodajVir = (v: TvVir) => {
    if (!izbran) return;
    if (tv.vir === "baza" && tv.testniViri) return obvesti("Komponente še niso v bazi - zaženi 023_fin_tv_komponente.sql.", "napaka");
    izvedi(() => dodajOkna([oknoVira(v, izbran.id_seznama)]), `${v.ime} je dodana na seznam ${izbran.ime}.`);
  };
  const novKljuc = (z: TvZaslon) => {
    if (!confirm(`Nov ključ za "${z.ime}"? Star preneha delovati takoj - na računalniku ob TV-ju zamenjaj zagon.`)) return;
    izvedi(async () => setKljuc({ ime: z.ime, kljuc: await novKljucZaslona(z.id) }));
  };

  return (
    <>
      <GlavaStrani
        drobtine={DROBTINE}
        naslov={
          <span className="flex flex-wrap items-baseline gap-x-4">
            <Znak pripona="TV" />
          </span>
        }
        opis="Televizorji v proizvodnji: kaj se vrti na katerem zaslonu. Vsak TV ima svoj seznam; povezani TV-ji kažejo isti seznam ob istem času."
        akcije={
          <>
            {tv.vir === "test" && <TestniPodatki opis={`Baza FIN:TV (osnutek 022) še ni zagnana${tv.napaka ? `: ${tv.napaka}` : ""}. Zasloni, okna in datoteke so samo v tem brskalniku - Predvajaj tukaj deluje.`} />}
            <Button hint="Dodaj nov TV zaslon in ustvari njegov ključ" variant="success" icon={Plus} onClick={() => setDodaj(true)}>
              Dodaj zaslon
            </Button>
          </>
        }
      />

      {tv.vir === "nalagam" ? (
        <div className="fos-glass h-72 animate-pulse rounded-[20px]" aria-label="Nalagam zaslone" />
      ) : !izbran ? (
        <PraznoStanje
          icon={Tv}
          naslov="Še ni nobenega zaslona"
          opis="Dodaj zaslon za vsak TV. Ključ in zagon prenesi na računalnik ob TV-ju - ob vklopu sam odpre predvajanje čez cel zaslon."
          akcija={
            <Button hint="Dodaj prvi zaslon" variant="success" icon={Plus} onClick={() => setDodaj(true)}>
              Dodaj zaslon
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* levo: zasloni in komponente */}
          <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[88px]">
          <Panel naslov="Zasloni" desno={<span className="text-xs text-ink-500">{zasloni.filter((z) => z.visible).length}</span>}>
            <ul className="flex flex-col gap-1.5">
              {zasloni.map((z, i) => {
                const zveza = naZvezi(z, zdaj);
                const skupaj = zasloniSeznama(tv.zasloni, z.id_seznama).filter((x) => x.id !== z.id);
                const je = z.id === izbran.id;
                return (
                  <motion.li key={z.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <button type="button" onClick={() => izberi(z.id)} title={`Odpri zaslon ${z.ime}`} className={`relative flex w-full items-center gap-3 rounded-[14px] p-2.5 text-left transition-colors ${je ? "" : "hover:bg-white/[0.04]"} ${z.visible ? "" : "opacity-45"}`}>
                      {je && <motion.span layoutId="tv-zaslon" className="absolute inset-0 rounded-[14px] border border-fines-400/50 bg-fines-500/10 shadow-[0_0_24px_-8px_rgb(238_122_58/0.8)]" />}
                      <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${zveza ? "bg-ok-500/15 text-ok-500" : "bg-white/[0.06] text-ink-400"}`} title={zveza ? "Na zvezi" : "Ni na zvezi"}>
                        {zveza ? <Wifi className="h-5 w-5" aria-hidden /> : <WifiOff className="h-5 w-5" aria-hidden />}
                      </span>
                      <span className="relative flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold text-white">
                          {z.ime}
                          {!z.visible && <span className="ml-2 text-xs font-normal text-nok-500">onemogočen</span>}
                        </span>
                        <span className="truncate text-xs text-ink-400">
                          {zveza ? <b className="text-ok-500">na zvezi</b> : `zadnji stik ${pred(z.zadnji_stik, zdaj)}`}
                          {z.lokacija && ` · ${z.lokacija}`}
                        </span>
                        {skupaj.length > 0 && (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-fines-300" title="Povezan zaslon - isti seznam, vrti sinhrono">
                            <Link2 className="h-3 w-3" aria-hidden />
                            {skupaj.map((x) => x.ime).join(", ")}
                          </span>
                        )}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </Panel>
            <Komponente viri={tv.viri} testni={tv.testniViri} zdaj={zdaj} namig={`${izbran.ime} ${izbran.lokacija ?? ""}`} onDodaj={dodajVir} />
          </div>

          {/* izbran zaslon */}
          <div className="flex min-w-0 flex-col gap-5">
            <motion.section key={izbran.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="fos-glass relative overflow-hidden rounded-[20px] p-4 sm:p-5">
              <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#f19a66,#ca5010,transparent)]" />
              <div className="flex flex-wrap items-start gap-4">
                <span className="fos-fines-fill grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-snow">
                  <Tv className="h-7 w-7" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                    {izbran.ime}
                    <IconButton hint="Uredi ime in lokacijo zaslona" icon={Pencil} onClick={() => setUrejam(true)} className="!h-8 !w-8" />
                  </h2>
                  <p className="text-sm text-ink-400">
                    {izbran.lokacija || "Brez lokacije"} · {naZvezi(izbran, zdaj) ? <b className="text-ok-500">na zvezi</b> : `zadnji stik ${pred(izbran.zadnji_stik, zdaj)}`}
                    {izbran.verzija && ` · predvajalnik ${izbran.verzija}`}
                  </p>
                  {izbran.trenutno && naZvezi(izbran, zdaj) && (
                    <p className="text-xs text-ink-300">
                      Zdaj: <b className="text-white">{izbran.trenutno}</b>
                    </p>
                  )}
                </div>
                <span className="flex shrink-0 gap-2">
                  <IconButton hint="Nov ključ in zagon za računalnik ob TV-ju" icon={KeyRound} variant="primary" onClick={() => novKljuc(izbran)} disabled={!izbran.visible} />
                  <IconButton
                    hint={izbran.visible ? "Onemogoči zaslon - TV ne dobi več vsebine" : "Spet omogoči zaslon"}
                    icon={Power}
                    variant={izbran.visible ? "danger" : "success"}
                    onClick={() => (!izbran.visible || confirm(`Onemogočim "${izbran.ime}"?`)) && izvedi(() => urediZaslon(izbran.id, { visible: !izbran.visible }), izbran.visible ? `${izbran.ime} je onemogočen.` : `${izbran.ime} je spet omogočen.`)}
                  />
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink hint="Odpri predvajanje tega seznama v novem zavihku" variant="neutral" icon={MonitorPlay} href={`/tv?seznam=${izbran.id_seznama}`} target="_blank" rel="noopener">
                  Predvajaj tukaj
                </ButtonLink>
                <Button hint="Na TV-ju se za 10 s pokaže ime zaslona" variant="neutral" icon={ScanEye} onClick={() => izvedi(() => ukazZaslonu(izbran.id, "ime"), `${izbran.ime}: ime se pokaže v 20 s.`)} disabled={!izbran.visible}>
                  Pokaži ime
                </Button>
                <Button hint="TV ponovno naloži stran (v 20 s)" variant="sync" icon={RefreshCw} onClick={() => izvedi(() => ukazZaslonu(izbran.id, "osvezi"), `${izbran.ime} se osveži v 20 s.`)} disabled={!izbran.visible}>
                  Osveži TV
                </Button>
                {povezani.length ? (
                  <Button
                    hint="Odveži - zaslon dobi svojo kopijo seznama"
                    variant="neutral"
                    icon={Unlink}
                    onClick={() => confirm(`Odvežem "${izbran.ime}"? Dobi svojo kopijo seznama, nadaljnje spremembe ne veljajo več za ${povezani.map((z) => z.ime).join(", ")}.`) && izvedi(() => odveziZaslon(izbran.id), `${izbran.ime} ima svoj seznam.`)}
                  >
                    Odveži
                  </Button>
                ) : (
                  <Button hint="Poveži z drugim zaslonom - oba kažeta isti seznam" variant="primary" icon={Link2} onClick={() => setPovezi(true)} disabled={tv.zasloni.filter((z) => z.visible).length < 2}>
                    Poveži
                  </Button>
                )}
              </div>

              {povezani.length > 0 && (
                <p className="mt-3 flex items-center gap-2 rounded-[12px] border border-fines-400/30 bg-fines-500/[0.07] px-3 py-2 text-sm text-ink-200">
                  <Link2 className="h-4 w-4 shrink-0 text-fines-300" aria-hidden />
                  <span>
                    Povezan z <b className="text-white">{povezani.map((z) => z.ime).join(", ")}</b> - isti seznam, vrtita se sinhrono. Spremembe spodaj veljajo za vse povezane.
                  </span>
                </p>
              )}
            </motion.section>

            <Mreza idSeznama={izbran.id_seznama} okna={tv.okna} viri={tv.viri} drugiSeznami={drugiSeznami} onDodajVir={dodajVir} />
          </div>
        </div>
      )}

      <DodajZaslon
        open={dodaj}
        onClose={() => setDodaj(false)}
        onDodan={(ime, k) => {
          setDodaj(false);
          setKljuc({ ime, kljuc: k });
        }}
      />
      {izbran && urejam && <UrediZaslon key={izbran.id} zaslon={izbran} onClose={() => setUrejam(false)} />}
      {izbran && povezi && <PoveziOkno key={izbran.id} zaslon={izbran} zasloni={tv.zasloni} okna={tv.okna} onClose={() => setPovezi(false)} />}
      <Modal
        open={!!kljuc}
        title="Ključ in zagon zaslona"
        onClose={() => setKljuc(null)}
        noga={
          <Button hint="Zagon sem prenesel - zapri okno" variant="neutral" onClick={() => setKljuc(null)}>
            Zapri
          </Button>
        }
      >
        {kljuc && (
          <div className="flex flex-col gap-3 text-sm text-ink-300">
            <p>
              Ključ za <b className="text-white">{kljuc.ime}</b> se pokaže <b className="text-warn-500">samo zdaj</b>. Prenesi zagon in ga na računalniku ob TV-ju:
            </p>
            <ol className="ml-5 list-decimal space-y-1">
              <li>
                kopiraj v mapo Zagon (<kbd className="font-mono text-fines-200">Win+R</kbd> → <code className="font-mono text-fines-200">shell:startup</code>) - ob vklopu se predvajanje odpre samo,
              </li>
              <li>kopiraj še na namizje - dvoklik vrne predvajanje čez cel zaslon,</li>
              <li>v Windows vklopi samodejno prijavo in izklopi spanje ter ohranjevalnik zaslona.</li>
            </ol>
            <p>
              Pomanjšaš s tipko <kbd className="rounded border border-white/20 px-1 font-mono">F11</kbd> (ali miška → vrstica zgoraj).
            </p>
            <Button hint="Prenesi zagon zaslona za Windows (.cmd)" variant="primary" icon={Download} onClick={() => prenesiZagon(kljuc.ime, kljuc.kljuc)} className="self-start">
              Prenesi zagon (FIN-TV.cmd)
            </Button>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-[10px] border border-white/10 bg-ink-950 px-3 py-2.5 font-mono text-xs text-fines-200">{`${typeof window === "undefined" ? "" : window.location.origin}/tv?k=${kljuc.kljuc}`}</code>
              <Button
                hint="Kopiraj povezavo predvajanja s ključem"
                variant="primary"
                icon={Copy}
                onClick={() =>
                  navigator.clipboard.writeText(`${window.location.origin}/tv?k=${kljuc.kljuc}`).then(
                    () => obvesti("Povezava je kopirana."),
                    () => obvesti("Kopiranje ni uspelo - označi in kopiraj ročno.", "napaka"),
                  )
                }
              >
                Kopiraj
              </Button>
            </div>
            {kljuc.kljuc.includes("testni") && <p className="text-xs text-warn-500">Testni podatki: ključ ne deluje, dokler baza 022 ni zagnana. Za preizkus uporabi Predvajaj tukaj.</p>}
          </div>
        )}
      </Modal>
    </>
  );
}

function DodajZaslon({ open, onClose, onDodan }: { open: boolean; onClose: () => void; onDodan: (ime: string, kljuc: string) => void }) {
  const [ime, setIme] = useState("");
  const [lokacija, setLokacija] = useState("");
  const [poskus, setPoskus] = useState(false);
  const shrani = async () => {
    setPoskus(true);
    if (!ime.trim()) return;
    try {
      const k = await dodajZaslon(ime.trim(), lokacija.trim());
      onDodan(ime.trim(), k);
      setIme("");
      setLokacija("");
      setPoskus(false);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  return (
    <Modal
      open={open}
      title="Dodaj zaslon"
      onClose={onClose}
      noga={
        <>
          <Button hint="Zapri brez dodajanja" variant="neutral" onClick={onClose}>
            Prekliči
          </Button>
          <Button hint="Dodaj zaslon in ustvari ključ" variant="success" icon={Plus} onClick={shrani}>
            Dodaj
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PoljeObrazca naslov="Ime" obvezno napaka={poskus && !ime.trim() ? "Vpiši ime zaslona." : undefined}>
          <input className={POLJE} value={ime} onChange={(e) => setIme(e.target.value)} placeholder="npr. Montaža" title="Ime zaslona" autoFocus />
        </PoljeObrazca>
        <PoljeObrazca naslov="Lokacija">
          <input className={POLJE} value={lokacija} onChange={(e) => setLokacija(e.target.value)} placeholder="npr. Hala 1, ob liniji" title="Kje visi TV" />
        </PoljeObrazca>
      </div>
      <p className="mt-3 text-xs text-ink-500">Zaslon dobi svoj prazen seznam. Če naj kaže isto kot drug TV, ga po dodajanju poveži.</p>
    </Modal>
  );
}

function UrediZaslon({ zaslon, onClose }: { zaslon: TvZaslon; onClose: () => void }) {
  const [ime, setIme] = useState(zaslon.ime);
  const [lokacija, setLokacija] = useState(zaslon.lokacija);
  const shrani = async () => {
    if (!ime.trim()) return obvesti("Vpiši ime zaslona.", "napaka");
    try {
      await urediZaslon(zaslon.id, { ime: ime.trim(), lokacija: lokacija.trim() });
      obvesti("Zaslon je shranjen.");
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  return (
    <Modal
      open
      title={`Uredi: ${zaslon.ime}`}
      onClose={onClose}
      noga={
        <>
          <Button hint="Zapri brez shranjevanja" variant="neutral" onClick={onClose}>
            Prekliči
          </Button>
          <Button hint="Shrani ime in lokacijo" variant="success" onClick={shrani}>
            Shrani
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PoljeObrazca naslov="Ime" obvezno>
          <input className={POLJE} value={ime} onChange={(e) => setIme(e.target.value)} title="Ime zaslona" autoFocus />
        </PoljeObrazca>
        <PoljeObrazca naslov="Lokacija">
          <input className={POLJE} value={lokacija} onChange={(e) => setLokacija(e.target.value)} title="Kje visi TV" />
        </PoljeObrazca>
      </div>
    </Modal>
  );
}

/**
 * Poveži zaslon z drugim: 1. izberi zaslon, 2. katero vsebino obdržita (privzeto tista z več okni). Zaslon(i) z drugo
 * vsebino se pridružijo - njihova okna se ne kažejo več (Odveži da kopijo skupne vsebine).
 */
function PoveziOkno({ zaslon, zasloni, okna, onClose }: { zaslon: TvZaslon; zasloni: TvZaslon[]; okna: TvOkno[]; onClose: () => void }) {
  const drugi = zasloni.filter((z) => z.visible && z.id_seznama !== zaslon.id_seznama);
  const [cilj, setCilj] = useState<TvZaslon | null>(null);
  const stOken = (id: number) => okna.filter((o) => o.id_seznama === id && o.visible).length;
  const imena = (id: number) => zasloniSeznama(zasloni, id).map((z) => z.ime).join(" + ");
  const [obdrzi, setObdrzi] = useState<"moja" | "druga" | null>(null);
  const izbrana = obdrzi ?? (cilj && stOken(cilj.id_seznama) > stOken(zaslon.id_seznama) ? "druga" : "moja");
  const povezi = async () => {
    if (!cilj) return;
    try {
      // izgubi = zaslon, katerega vsebina se ne kaže več (z vsemi, ki so povezani z njim)
      if (izbrana === "moja") await poveziZaslon(cilj.id, zaslon.id);
      else await poveziZaslon(zaslon.id, cilj.id);
      obvesti(`${zaslon.ime} in ${cilj.ime} sta povezana.`);
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  const vsebina = (kaj: "moja" | "druga", id: number) => {
    const je = izbrana === kaj;
    return (
      <button
        key={kaj}
        type="button"
        title={`Obdrži vsebino: ${imena(id)}`}
        onClick={() => setObdrzi(kaj)}
        className={`flex flex-1 flex-col gap-1 rounded-[14px] border p-3 text-left transition-all ${je ? "border-fines-400/60 bg-fines-500/10 shadow-[0_0_24px_-8px_rgb(238_122_58/0.8)]" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-fines-400">{je ? "Obdržita" : "Se ne kaže več"}</span>
        <span className="font-semibold text-white">{imena(id)}</span>
        <span className="text-xs text-ink-400">{stOken(id)} oken</span>
      </button>
    );
  };
  return (
    <Modal
      open
      title={`Poveži: ${zaslon.ime}`}
      onClose={onClose}
      noga={
        <>
          <Button hint="Zapri brez povezovanja" variant="neutral" onClick={onClose}>
            Prekliči
          </Button>
          <Button hint="Poveži zaslona - kažeta isto vsebino" variant="primary" icon={Link2} onClick={povezi} disabled={!cilj}>
            Poveži
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-ink-300">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink-400">1. S katerim zaslonom?</span>
          {drugi.map((z) => (
            <button
              key={z.id}
              type="button"
              title={`Poveži ${zaslon.ime} z ${z.ime}`}
              onClick={() => {
                setCilj(z);
                setObdrzi(null);
              }}
              className={`flex w-full items-center gap-3 rounded-[14px] border p-3 text-left transition-all ${cilj?.id === z.id ? "border-fines-400/60 bg-fines-500/10" : "border-white/10 bg-white/[0.03] hover:border-fines-400/40"}`}
            >
              <Tv className="h-5 w-5 text-fines-300" aria-hidden />
              <span className="flex-1">
                <span className="block font-semibold text-white">{z.ime}</span>
                <span className="text-xs text-ink-400">
                  {z.lokacija || "Brez lokacije"} · {stOken(z.id_seznama)} oken
                </span>
              </span>
            </button>
          ))}
        </div>
        {cilj && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ink-400">2. Katero vsebino obdržita?</span>
            <div className="flex gap-2">
              {vsebina("moja", zaslon.id_seznama)}
              {vsebina("druga", cilj.id_seznama)}
            </div>
            <p className="text-xs text-ink-500">Druga vsebina se ne kaže več. Odveži kasneje da zaslonu kopijo skupne vsebine.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Skupina komponent: ista komponenta za več oddelkov ("Delovni plan · Montaža" ...) = ena vrstica z izbiro oddelka. */
type SkupinaVirov = { kljuc: string; ime: string; clani: { oddelek: string | null; vir: TvVir }[] };

const brezSumnikov = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Združi po imenu pred " · " (in aplikaciji); vrstni red = prva pojavitev. */
function skupineVirov(viri: TvVir[]): SkupinaVirov[] {
  const skupine = new Map<string, SkupinaVirov>();
  for (const v of viri) {
    const [ime, oddelek] = v.ime.split(" · ");
    const kljuc = `${v.aplikacija}|${oddelek ? ime : v.koda}`;
    const s = skupine.get(kljuc) ?? { kljuc, ime, clani: [] };
    s.clani.push({ oddelek: oddelek ?? null, vir: v });
    skupine.set(kljuc, s);
  }
  return [...skupine.values()];
}

/** Kratko ime oddelka za čip (Proizvodnja -> Proizv.). */
const kratko = (o: string) => (o.length > 8 ? `${o.slice(0, 6)}.` : o);

/**
 * Predefinirane komponente (fos_tv_viri): dokumenti, ki jih ustvarijo drugi projekti (npr. Production ob Shrani plan).
 * Ista komponenta za več oddelkov je ENA vrstica s čipi oddelkov (privzeto oddelek iz imena / lokacije zaslona);
 * povleci vrstico v seznam predvajanja ali klikni + (doda izbran oddelek). Stikalo = vklop izbranega oddelka na vseh
 * TV-jih (izklopljen oddelek je v čipu prečrtan). Nove komponente se dodajo s PROGRAMIRANJEM v projektu.
 */
function Komponente({ viri, testni, zdaj, namig, onDodaj }: { viri: TvVir[]; testni: boolean; zdaj: number; namig: string; onDodaj: (v: TvVir) => void }) {
  const [izbira, setIzbira] = useState<Record<string, number>>({});
  const skupine = skupineVirov(viri);
  const n = brezSumnikov(namig);
  return (
    <Panel
      naslov="Komponente"
      desno={
        <span className="flex items-center gap-2">
          {testni ? <TestniPodatki opis="Katalog komponent še ni v bazi (osnutek 023) - prikazane so komponente, ki jih bo objavljal Production." /> : <span className="text-xs text-ink-500">{skupine.length}</span>}
          <span title="Komponente so programirane v projektih (npr. izvoz plana v Production) in se pokažejo tu same. Izberi oddelek in povleci vrstico v seznam predvajanja ali klikni +." className="grid h-6 w-6 place-items-center rounded-full text-fines-300 hover:bg-white/[0.06]">
            <Code2 className="h-3.5 w-3.5" aria-hidden />
          </span>
        </span>
      }
    >
      <ul className="flex flex-col gap-1.5">
        {skupine.map((s) => {
          // privzeto: oddelek, ki je v imenu / lokaciji zaslona, sicer prvi
          const privzet = s.clani.find((c) => c.oddelek && n.includes(brezSumnikov(c.oddelek))) ?? s.clani[0];
          const clan = s.clani.find((c) => c.vir.id === izbira[s.kljuc]) ?? privzet;
          const v = clan.vir;
          const Ikona = IKONE_VIROV[v.ikona] ?? FileText;
          return (
            <li
              key={s.kljuc}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(VLECI_VIR, String(v.id));
                e.dataTransfer.effectAllowed = "copy";
              }}
              title={`${v.ime}
${v.opis}
Povleci v seznam predvajanja.`}
              className="group flex cursor-grab flex-col gap-1.5 rounded-[14px] border border-white/10 bg-white/[0.03] p-2 transition-all hover:border-fines-400/50 hover:bg-fines-500/[0.05] active:cursor-grabbing"
            >
              <div className={`flex items-center gap-2.5 transition-opacity ${v.vklopljen ? "" : "opacity-55"}`}>
                <span className="fos-fines-fill grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-snow">
                  <Ikona className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold leading-tight text-white">{s.ime}</span>
                  <span className="truncate text-[11px] text-ink-400">
                    {clan.oddelek ? `${clan.oddelek} · ` : `${v.aplikacija === "fp" ? "Production" : v.aplikacija} · `}
                    {v.objava ? `objava ${pred(v.objava.created_at, zdaj)}` : "še ni objave"}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={v.vklopljen}
                  title={`${v.ime}: ${v.vklopljen ? "na TV - klik izklopi na vseh TV-jih" : "izklopljena - klik vklopi na vseh TV-jih"}`}
                  onClick={() => vklopVira(v, !v.vklopljen).catch((e) => obvesti((e as Error).message, "napaka"))}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-all ${v.vklopljen ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_0_10px_-2px_rgb(238_122_58/0.8)]" : "bg-ink-700"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-snow transition-all ${v.vklopljen ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <IconButton hint={`Dodaj ${v.ime} na konec seznama izbranega zaslona`} icon={Plus} variant="success" onClick={() => onDodaj(v)} className="!h-8 !w-8" />
              </div>
              {s.clani.length > 1 && (
                <div className="flex flex-wrap gap-1 pl-[46px]" role="radiogroup" aria-label={`Oddelek za ${s.ime}`}>
                  {s.clani.map((c) => {
                    const je = c.vir.id === v.id;
                    return (
                      <button
                        key={c.vir.id}
                        type="button"
                        role="radio"
                        aria-checked={je}
                        onClick={() => setIzbira((x) => ({ ...x, [s.kljuc]: c.vir.id }))}
                        title={`${c.vir.ime}${c.vir.vklopljen ? "" : " (izklopljena)"} · ${c.vir.objava ? `objava ${pred(c.vir.objava.created_at, zdaj)}` : "še ni objave"}`}
                        className={`relative rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          je ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_0_10px_-3px_rgb(238_122_58/0.8)]" : "border border-white/10 text-ink-300 hover:border-fines-400/50 hover:text-white"
                        } ${c.vir.vklopljen ? "" : "line-through opacity-60"}`}
                      >
                        {kratko(c.oddelek ?? "")}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
