"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Eye, Maximize, Minimize, Pause, Play, RefreshCw, Tv, WifiOff } from "lucide-react";
import { Znak } from "@/components/Znak";
import { oknaSeznama, potiOkna, urljiDatotek, useTv, type TvOkno, type TvVir } from "@/lib/tv";
import { minSek, type Diapozitiv as DiapozitivT } from "@/lib/tvPredvajanje";
import { Oder } from "./Diapozitiv";
import { PrazenTv, Predvajalnik } from "./Predvajalnik";

/** Verzija predvajalnika (vidna v FIN:TV pri zaslonu). */
export const VERZIJA_TV = "1.0";
const POZIV_MS = 20_000;
const ZADNJE = "fos_tv_zadnje";
const PREDPOMNILNIK = "fos-tv-datoteke";

type Odziv = {
  zaslon: { id: number; ime: string; lokacija: string; ukaz: "osvezi" | "ime" | null; ukaz_st: number };
  cas: string;
  verzija: string;
  nespremenjeno?: boolean;
  okna?: TvOkno[];
  viri?: TvVir[];
  datoteke?: Record<string, string>;
};

/**
 * /tv - predvajalnik FIN:TV čez cel zaslon.
 *   ?k=KLJUČ       računalnik ob TV-ju (Edge --app --start-fullscreen): vsebina prek /api/tv vsakih 20 s, datoteke
 *                  v predpomnilniku brskalnika (wifi: prenesejo se enkrat), brez povezave vrti zadnje stanje.
 *   ?seznam=ID     predogled iz Administracije (prijava; brez baze testni podatki iz tega brskalnika).
 * Miška / dotik / tipka pokaže vrstico: Čez cel zaslon / Pomanjšaj, Ustavi, Osveži.
 */
export function TvStran() {
  const iskanje = useSearchParams();
  const kljuc = iskanje.get("k");
  const seznam = Number(iskanje.get("seznam")) || null;
  if (kljuc) return <TvZKljucem kljuc={kljuc} />;
  if (seznam) return <TvPredogled idSeznama={seznam} />;
  return (
    <Celo>
      <Oder className="h-full w-full">
        <PrazenTv besedilo="Zaslon ni nastavljen - v FIN:OS -> FIN:TV prenesi zagon zaslona" />
      </Oder>
    </Celo>
  );
}

// ---------------------------------------------------------------------
// Računalnik ob TV-ju (ključ)
// ---------------------------------------------------------------------
async function lokalnaDatoteka(pot: string, url: string, pomnilnik: Map<string, string>): Promise<string> {
  const v = pomnilnik.get(pot);
  if (v) return v;
  try {
    const c = await caches.open(PREDPOMNILNIK);
    const kljuc = new Request(`${location.origin}/__fos_tv__/${pot}`);
    let r = await c.match(kljuc);
    if (!r) {
      const f = await fetch(url);
      if (!f.ok) throw new Error(String(f.status));
      await c.put(kljuc, f.clone());
      r = f;
    }
    const u = URL.createObjectURL(await r.blob());
    pomnilnik.set(pot, u);
    return u;
  } catch {
    return url; // brez Cache API (http) ali napaka - neposredno
  }
}

/** Odstrani datoteke, ki jih seznam ne uporablja več (prostor na disku). */
async function pocisti(poti: string[]) {
  try {
    const c = await caches.open(PREDPOMNILNIK);
    const ostanejo = new Set(poti.map((p) => `${location.origin}/__fos_tv__/${p}`));
    for (const r of await c.keys()) if (!ostanejo.has(r.url)) await c.delete(r);
  } catch {}
}

function TvZKljucem({ kljuc }: { kljuc: string }) {
  const [odziv, setOdziv] = useState<Odziv | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(ZADNJE) ?? "null") as Odziv | null;
    } catch {
      return null;
    }
  });
  const [urlji, setUrlji] = useState<Record<string, string>>({});
  const [napaka, setNapaka] = useState<string | null>(null);
  const [brezPovezave, setBrezPovezave] = useState<number | null>(null);
  const [odmikUre, setOdmikUre] = useState(0);
  const [ime, setIme] = useState(false);
  const pomnilnik = useRef(new Map<string, string>());
  const trenutno = useRef("");
  const verzija = useRef<string | null>(null);
  const ukazSt = useRef<number | null>(null);

  // datoteke v lokalni predpomnilnik -> object URL
  const pripravi = useCallback(async (o: Odziv) => {
    const poti = (o.okna ?? []).flatMap((x) => potiOkna(x, o.viri));
    const izid: Record<string, string> = {};
    for (const p of poti) {
      const u = o.datoteke?.[p];
      if (u) {
        izid[p] = await lokalnaDatoteka(p, u, pomnilnik.current);
        setUrlji((s) => ({ ...s, [p]: izid[p] }));
      }
    }
    setUrlji(izid);
    pocisti(poti);
  }, []);

  const pozovi = useCallback(async () => {
    try {
      const q = new URLSearchParams({ k: kljuc, trenutno: trenutno.current });
      if (verzija.current) q.set("v", verzija.current);
      const r = await fetch(`/api/tv?${q}`, { cache: "no-store", headers: { "X-Verzija": VERZIJA_TV } });
      const j = (await r.json()) as Odziv & { napaka?: string };
      if (!r.ok) {
        setNapaka(j.napaka ?? `Napaka ${r.status}`);
        return;
      }
      setNapaka(null);
      setBrezPovezave(null);
      setOdmikUre(new Date(j.cas).getTime() - Date.now());
      // ukaz iz Administracije (prvič samo zapomni, da se star ukaz ne izvede ob zagonu)
      if (ukazSt.current != null && j.zaslon.ukaz_st > ukazSt.current) {
        if (j.zaslon.ukaz === "osvezi") return location.reload();
        if (j.zaslon.ukaz === "ime") setIme(true);
      }
      ukazSt.current = j.zaslon.ukaz_st;
      if (j.nespremenjeno) {
        setOdziv((s) => (s ? { ...s, zaslon: j.zaslon } : s));
        return;
      }
      verzija.current = j.verzija;
      setOdziv(j);
      try {
        localStorage.setItem(ZADNJE, JSON.stringify(j));
      } catch {}
      pripravi(j);
    } catch {
      setBrezPovezave((s) => s ?? Date.now());
    }
  }, [kljuc, pripravi]);

  useEffect(() => {
    // zadnje stanje iz prejšnjega zagona (brez povezave) - datoteke iz predpomnilnika
    const prvo = setTimeout(() => {
      if (odziv?.okna) pripravi(odziv);
      pozovi();
    }, 0);
    const t = setInterval(pozovi, POZIV_MS);
    // vsako noč ob ~4:00 ponovno naloži stran (nova verzija, pomnilnik) - samo, če je strežnik dosegljiv
    const jutri = new Date();
    jutri.setHours(24 + 4, Math.floor(Math.random() * 10), 0, 0);
    const noc = setTimeout(
      () =>
        fetch(`/api/tv?k=${encodeURIComponent(kljuc)}`, { cache: "no-store" })
          .then((r) => r.ok && location.reload())
          .catch(() => {}),
      jutri.getTime() - Date.now(),
    );
    return () => {
      clearTimeout(prvo);
      clearInterval(t);
      clearTimeout(noc);
    };
  }, [pozovi]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ime) return;
    const t = setTimeout(() => setIme(false), 10_000);
    return () => clearTimeout(t);
  }, [ime]);

  const url = useCallback((p: string) => urlji[p], [urlji]);
  if (!odziv && napaka)
    return (
      <Celo>
        <Oder className="h-full w-full">
          <PrazenTv besedilo={napaka} />
        </Oder>
      </Celo>
    );

  return (
    <Predvajanje
      okna={odziv?.okna ?? []}
      viri={odziv?.viri ?? []}
      url={url}
      odmikUre={odmikUre}
      ime={odziv?.zaslon.ime ?? "FIN:TV"}
      lokacija={odziv?.zaslon.lokacija}
      pokaziIme={ime}
      stanje={napaka ? { tip: "napaka", besedilo: napaka } : brezPovezave ? { tip: "brez", besedilo: `Brez povezave od ${new Date(brezPovezave).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" })}` } : { tip: "ok", besedilo: "Na zvezi" }}
      onTrenutno={(d, i, n) => (trenutno.current = `${d.okno.naslov || d.okno.vrsta}${d.naslovna ? " (naslov)" : d.stStrani ? ` (stran ${d.stStrani})` : ""} · ${i + 1}/${n}`)}
    />
  );
}

// ---------------------------------------------------------------------
// Predogled iz Administracije
// ---------------------------------------------------------------------
function TvPredogled({ idSeznama }: { idSeznama: number }) {
  const tv = useTv();
  const okna = oknaSeznama(tv.okna, idSeznama);
  const zasloni = tv.zasloni.filter((z) => z.id_seznama === idSeznama);
  const [urlji, setUrlji] = useState<Record<string, string>>({});
  const poti = okna.flatMap((o) => potiOkna(o, tv.viri)).join("|");
  useEffect(() => {
    if (!poti) return;
    let ziv = true;
    urljiDatotek(poti.split("|"))
      .then((u) => ziv && setUrlji(u))
      .catch(() => {});
    return () => {
      ziv = false;
    };
  }, [poti, tv.vir]);
  const url = useCallback((p: string) => urlji[p], [urlji]);
  return (
    <Predvajanje
      okna={okna}
      viri={tv.viri}
      url={url}
      ime={zasloni.map((z) => z.ime).join(" + ") || "Predogled"}
      predogled
      stanje={{ tip: "ok", besedilo: tv.vir === "test" ? "Predogled · testni podatki (ta brskalnik)" : "Predogled" }}
    />
  );
}

// ---------------------------------------------------------------------
// Skupno: predvajanje + vrstica
// ---------------------------------------------------------------------
type Stanje = { tip: "ok" | "brez" | "napaka"; besedilo: string };

function Predvajanje({
  okna,
  viri,
  url,
  odmikUre = 0,
  ime,
  lokacija,
  pokaziIme,
  predogled,
  stanje,
  onTrenutno,
}: {
  okna: TvOkno[];
  viri: TvVir[];
  url: (p: string) => string | undefined;
  odmikUre?: number;
  ime: string;
  lokacija?: string;
  pokaziIme?: boolean;
  predogled?: boolean;
  stanje: Stanje;
  onTrenutno?: (d: DiapozitivT, i: number, n: number) => void;
}) {
  const [ustavljeno, setUstavljeno] = useState(false);
  const [zdaj, setZdaj] = useState<{ d: DiapozitivT; i: number; n: number } | null>(null);
  return (
    <Celo
      vrstica={(cel, preklopi) => (
        <Vrstica
          ime={ime}
          stanje={stanje}
          predogled={predogled}
          zdaj={zdaj}
          cel={cel}
          preklopi={preklopi}
          ustavljeno={ustavljeno}
          onUstavi={() => setUstavljeno((u) => !u)}
        />
      )}
    >
      <Predvajalnik
        okna={okna}
        viri={viri}
        url={url}
        odmikUre={odmikUre}
        ustavljeno={ustavljeno}
        className="h-full w-full"
        onTrenutno={(d, i, n) => {
          setZdaj({ d, i, n });
          onTrenutno?.(d, i, n);
        }}
      />
      {/* brez povezave: majhna oznaka v kotu (vidna ljudem v hali) */}
      {stanje.tip !== "ok" && (
        <span className="pointer-events-none absolute bottom-3 right-3 z-[5] flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-warn-400">
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          {stanje.besedilo}
        </span>
      )}
      <AnimatePresence>
        {pokaziIme && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute inset-0 z-[6] grid place-items-center bg-black/60 backdrop-blur-sm">
            <div className="fos-popup flex flex-col items-center gap-4 rounded-[32px] px-20 py-14 text-center">
              <Tv className="h-20 w-20 text-fines-300" aria-hidden />
              <span className="font-display text-7xl font-bold text-white">{ime}</span>
              {lokacija && <span className="text-3xl text-ink-300">{lokacija}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Celo>
  );
}

/** Ali je okno čez cel zaslon (Fullscreen API ali Edge --start-fullscreen / F11). */
function useCelZaslon() {
  const [stanje, setStanje] = useState({ cel: false, api: false });
  useEffect(() => {
    const ob = () => {
      const api = !!document.fullscreenElement;
      setStanje({ api, cel: api || (window.innerHeight >= screen.height - 2 && window.innerWidth >= screen.width - 2) });
    };
    ob();
    document.addEventListener("fullscreenchange", ob);
    window.addEventListener("resize", ob);
    return () => {
      document.removeEventListener("fullscreenchange", ob);
      window.removeEventListener("resize", ob);
    };
  }, []);
  return stanje;
}

/** Črno okno čez cel zaslon; kazalec se skrije, ko miruje. Vrstica se pokaže ob miški / dotiku / tipki. */
function Celo({ children, vrstica }: { children: React.ReactNode; vrstica?: (cel: { cel: boolean; api: boolean }, preklopi: () => void) => React.ReactNode }) {
  const cel = useCelZaslon();
  const [vidna, setVidna] = useState(false);
  const [namig, setNamig] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pokazi = useCallback(() => {
    setVidna(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setVidna(false), 4000);
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", pokazi);
    return () => {
      window.removeEventListener("keydown", pokazi);
      clearTimeout(t.current);
    };
  }, [pokazi]);
  const preklopi = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (cel.cel) {
      // Edge zagnan s --start-fullscreen: stran ga ne more pomanjšati - F11
      setNamig(true);
      setTimeout(() => setNamig(false), 6000);
    } else document.documentElement.requestFullscreen().catch(() => {});
  };
  return (
    <div className={`fixed inset-0 overflow-hidden bg-black ${vidna ? "" : "cursor-none"}`} onMouseMove={pokazi} onPointerDown={pokazi}>
      {children}
      {vrstica && <AnimatePresence>{vidna && vrstica(cel, preklopi)}</AnimatePresence>}
      <AnimatePresence>
        {namig && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fos-popup absolute left-1/2 top-24 z-[8] -translate-x-1/2 rounded-[16px] px-6 py-4 text-center">
            <p className="text-lg font-bold text-white">
              Pritisni tipko <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono">F11</kbd> za pomanjšanje
            </p>
            <p className="mt-1 text-sm text-ink-400">Nazaj čez cel zaslon: spet F11 ali bližnjica FIN:TV na namizju.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Vrstica({
  ime,
  stanje,
  predogled,
  zdaj,
  cel,
  preklopi,
  ustavljeno,
  onUstavi,
}: {
  ime: string;
  stanje: Stanje;
  predogled?: boolean;
  zdaj: { d: DiapozitivT; i: number; n: number } | null;
  cel: { cel: boolean; api: boolean };
  preklopi: () => void;
  ustavljeno: boolean;
  onUstavi: () => void;
}) {
  const gumb = "flex h-11 items-center gap-2 rounded-[12px] border border-white/15 bg-white/[0.08] px-4 text-sm font-semibold text-ink-100 transition-all hover:-translate-y-0.5 hover:border-fines-400/50 hover:text-fines-200 active:scale-[0.97]";
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="fos-popup absolute inset-x-3 top-3 z-[7] flex flex-wrap items-center gap-3 rounded-[18px] px-4 py-3"
    >
      <Znak pripona="TV" className="text-2xl" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-white">
          {ime}
          {predogled && <span className="ml-2 rounded-full bg-fines-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-fines-300">Predogled</span>}
        </span>
        <span className={`truncate text-xs ${stanje.tip === "ok" ? "text-ink-400" : stanje.tip === "brez" ? "text-warn-400" : "text-nok-500"}`}>
          {stanje.besedilo}
          {zdaj && ` · zdaj: ${zdaj.d.okno.naslov || zdaj.d.okno.vrsta}${zdaj.d.naslovna ? " (naslov)" : zdaj.d.stStrani ? ` (stran ${zdaj.d.stStrani})` : ""} · ${zdaj.i + 1}/${zdaj.n} · ${minSek(zdaj.d.trajanjeMs)}`}
        </span>
      </span>
      <button type="button" className={gumb} title={ustavljeno ? "Nadaljuj predvajanje" : "Ustavi na tem oknu"} onClick={onUstavi}>
        {ustavljeno ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
        {ustavljeno ? "Nadaljuj" : "Ustavi"}
      </button>
      <button type="button" className={gumb} title="Ponovno naloži vsebino" onClick={() => location.reload()}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Osveži
      </button>
      <button
        type="button"
        className={`${gumb} !border-fines-400/50 !bg-[linear-gradient(135deg,#f19a66,#ca5010_55%,#8f380b)] !text-snow`}
        title={cel.cel ? "Pomanjšaj - računalnik uporabljaš kot navadno" : "Predvajaj čez cel zaslon"}
        onClick={preklopi}
      >
        {cel.cel ? <Minimize className="h-4 w-4" aria-hidden /> : <Maximize className="h-4 w-4" aria-hidden />}
        {cel.cel ? "Pomanjšaj" : "Čez cel zaslon"}
      </button>
      {ustavljeno && (
        <span className="flex w-full items-center gap-2 text-xs font-semibold text-warn-400">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Ustavljeno - ob Nadaljuj se predvajanje uskladi z uro (in s povezanimi zasloni).
        </span>
      )}
    </motion.div>
  );
}
