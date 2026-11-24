"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard, Info, Power, RefreshCw, ScrollText, Settings2, Undo2, Wifi, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { GlavaStrani } from "@/components/ui/GlavaStrani";
import { IskalnoPolje, Izbira, POLJE, Stikalo } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { fetchAll, getSupabase } from "@/lib/supabase";

const DROBTINE = [
  { naslov: "FIN:OS", href: "/" },
  { naslov: "Administracija", href: "/administracija" },
  { naslov: "Registracija časa", href: "/administracija/registracija" },
  { naslov: "Nastavitve", href: "/administracija/registracija/nastavitve" },
  { naslov: "Dnevnik krmilnikov" },
];

type Vnos = {
  id: number;
  id_krmilnika: number;
  lokalni_id: string;
  cas: string;
  prejeto: string;
  vrsta: string;
  st_kartice: string | null;
  tipka: number | null;
  id_ziga: string | null;
  uspeh: boolean | null;
  sporocilo: string | null;
  trajanje_ms: number | null;
  podatki: Record<string, unknown>;
  verzija: string | null;
};
type Naprava = { id: number; ime: string };

/** Vrste dogodkov krmilnika (fines_krmilnik.py -> dnevnik): ime, ikona, barva. */
const VRSTE: Record<string, { ime: string; ikona: LucideIcon; barva: string }> = {
  kartica: { ime: "Kartica", ikona: CreditCard, barva: "#ee7a3a" },
  odgovor: { ime: "Odgovor FIN:OS", ikona: ScrollText, barva: "#22c55e" },
  info: { ime: "Info", ikona: Info, barva: "#60a5fa" },
  preklic: { ime: "Preklic", ikona: Undo2, barva: "#f59e0b" },
  povezava: { ime: "Povezava", ikona: Wifi, barva: "#a78bfa" },
  nastavitve: { ime: "Nastavitve", ikona: Settings2, barva: "#94a3b8" },
  ura: { ime: "Ura", ikona: Clock, barva: "#f59e0b" },
  zagon: { ime: "Zagon", ikona: Power, barva: "#94a3b8" },
  napaka: { ime: "Napaka", ikona: AlertTriangle, barva: "#ef4444" },
};
const vrstaOf = (v: string) => VRSTE[v] ?? { ime: v, ikona: ScrollText, barva: "#94a3b8" };

const danesIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const premakniDan = (iso: string, dni: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dni);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const casDogodka = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};
const odgovorOf = (v: Vnos) => (v.podatki?.odgovor ?? null) as { ok?: boolean; znana?: boolean; ime?: string; priimek?: string; napaka?: string } | null;

/** Stanje vrstice: kartica dobi stanje iz odgovora istega žiga (id_ziga); brez odgovora = čaka. */
type Stanje = "ok" | "opozorilo" | "napaka" | "caka" | "info";
const STANJA: Record<Stanje, { ime: string; razred: string }> = {
  ok: { ime: "V redu", razred: "border-ok-500/40 bg-ok-500/10 text-ok-500" },
  opozorilo: { ime: "Opozorilo", razred: "border-warn-500/40 bg-warn-500/10 text-warn-500" },
  napaka: { ime: "Napaka", razred: "border-nok-500/40 bg-nok-500/10 text-nok-500" },
  caka: { ime: "Brez odgovora", razred: "border-warn-500/40 bg-warn-500/10 text-warn-500" },
  info: { ime: "-", razred: "border-white/10 bg-white/[0.04] text-ink-400" },
};

function stanjeVnosa(v: Vnos): Stanje {
  if (v.vrsta === "odgovor" && odgovorOf(v)?.znana === false) return "opozorilo";
  if (v.uspeh === true) return "ok";
  if (v.uspeh === false) return v.vrsta === "ura" ? "opozorilo" : "napaka";
  return "info";
}

/** Filter vrst: čip = skupina vrst. */
const SKUPINE: { id: string; ime: string; vrste: string[] | null }[] = [
  { id: "vse", ime: "Vse", vrste: null },
  { id: "zigi", ime: "Žigi", vrste: ["kartica", "odgovor"] },
  { id: "info", ime: "Info / Preklic", vrste: ["info", "preklic"] },
  { id: "povezava", ime: "Povezava", vrste: ["povezava"] },
  { id: "sistem", ime: "Sistem", vrste: ["zagon", "nastavitve", "ura", "napaka"] },
];

/**
 * Dnevnik krmilnikov (033_krmilnik_dnevnik.sql): vsak dogodek na krmilniku - prebrana kartica, odgovor FIN:OS,
 * Info / Prekliči, izpad povezave, nastavitve, zagon, napake. Debug pogled: filtri (naprava, dan, vrsta, samo
 * napake, iskanje), povzetek dneva, tabela; klik na vrstico pokaže vse podatke (JSON) in ostale dogodke istega žiga.
 */
export function DnevnikKrmilnikov() {
  const router = useRouter();
  const pot = usePathname();
  const sp = useSearchParams();
  const idNaprave = sp.get("naprava") ? Number(sp.get("naprava")) : null;
  const datum = sp.get("datum") || danesIso();
  const nastavi = (p: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v == null || v === "") q.delete(k);
      else q.set(k, v);
    }
    router.replace(`${pot}?${q.toString()}`, { scroll: false });
  };

  const [naprave, setNaprave] = useState<Naprava[]>([]);
  const [vnosi, setVnosi] = useState<Vnos[] | null>(null);
  const [napaka, setNapaka] = useState<string | null>(null);
  const [skupina, setSkupina] = useState("vse");
  const [samoNapake, setSamoNapake] = useState(false);
  const [iskanje, setIskanje] = useState("");
  const [odprt, setOdprt] = useState<number | null>(null);
  const [zivo, setZivo] = useState(true);
  const [nalagam, setNalagam] = useState(false);
  const danes = datum === danesIso();

  const nalozi = useCallback(async () => {
    setNalagam(true);
    try {
      const od = new Date(`${datum}T00:00:00`);
      const doo = new Date(od);
      doo.setDate(doo.getDate() + 1);
      const [n, d] = await Promise.all([
        fetchAll<Naprava>((f, t) => getSupabase().from("fos_krmilniki").select("id, ime").order("id").range(f, t)),
        fetchAll<Vnos>((f, t) => {
          let q = getSupabase()
            .from("fos_krmilnik_dnevnik")
            .select("id, id_krmilnika, lokalni_id, cas, prejeto, vrsta, st_kartice, tipka, id_ziga, uspeh, sporocilo, trajanje_ms, podatki, verzija")
            .gte("cas", od.toISOString())
            .lt("cas", doo.toISOString());
          if (idNaprave) q = q.eq("id_krmilnika", idNaprave);
          return q.order("cas", { ascending: false }).order("id", { ascending: false }).range(f, t);
        }),
      ]);
      setNaprave(n);
      setVnosi(d);
      setNapaka(null);
    } catch (e) {
      setNapaka((e as Error).message);
    } finally {
      setNalagam(false);
    }
  }, [datum, idNaprave]);

  useEffect(() => {
    const prvo = setTimeout(nalozi, 0);
    // v živo (samo danes): vsakih 5 s; skrit zavihek ne bere
    const t = zivo && danes ? setInterval(() => document.visibilityState === "visible" && nalozi(), 5000) : undefined;
    return () => {
      clearTimeout(prvo);
      if (t) clearInterval(t);
    };
  }, [nalozi, zivo, danes]);

  // odgovori po žigu (id_ziga) - kartica dobi stanje in ime iz zadnjega odgovora
  const poZigu = useMemo(() => {
    const m = new Map<string, Vnos[]>();
    for (const v of vnosi ?? []) if (v.id_ziga) m.set(v.id_ziga, [...(m.get(v.id_ziga) ?? []), v]);
    return m;
  }, [vnosi]);
  const imeNaprave = (id: number) => naprave.find((n) => n.id === id)?.ime ?? `#${id}`;

  const stanje = useCallback(
    (v: Vnos): Stanje => {
      if (v.vrsta !== "kartica") return stanjeVnosa(v);
      if (v.uspeh === false) return "napaka";
      const odg = (poZigu.get(v.id_ziga ?? "") ?? []).filter((x) => x.vrsta === "odgovor");
      return odg.length ? stanjeVnosa(odg[0]) : "caka"; // odg[0] = zadnji odgovor (padajoče po času)
    },
    [poZigu],
  );
  const osebaOf = useCallback(
    (v: Vnos) => {
      const viri = v.vrsta === "kartica" ? (poZigu.get(v.id_ziga ?? "") ?? []).filter((x) => x.vrsta === "odgovor") : [v];
      const o = viri.map(odgovorOf).find((x) => x?.ime);
      return o ? [o.ime, o.priimek].filter(Boolean).join(" ") : null;
    },
    [poZigu],
  );

  const prikazani = useMemo(() => {
    const sk = SKUPINE.find((s) => s.id === skupina)?.vrste;
    const besede = iskanje.toLowerCase().split(/\s+/).filter(Boolean);
    return (vnosi ?? []).filter((v) => {
      if (sk && !sk.includes(v.vrsta)) return false;
      if (samoNapake && !["napaka", "opozorilo", "caka"].includes(stanje(v))) return false;
      if (!besede.length) return true;
      const t = `${v.st_kartice ?? ""} ${v.sporocilo ?? ""} ${v.vrsta} ${osebaOf(v) ?? ""} ${v.id_ziga ?? ""}`.toLowerCase();
      return besede.every((b) => t.includes(b));
    });
  }, [vnosi, skupina, samoNapake, iskanje, stanje, osebaOf]);

  const povzetek = useMemo(() => {
    const v = vnosi ?? [];
    const kartice = v.filter((x) => x.vrsta === "kartica" && x.id_ziga);
    const odgovori = v.filter((x) => x.vrsta === "odgovor");
    const casi = odgovori.map((x) => Number(x.podatki?.od_prislona_ms)).filter((x) => Number.isFinite(x) && x >= 0);
    return {
      zigov: kartice.length,
      ok: kartice.filter((x) => stanje(x) === "ok").length,
      neznana: kartice.filter((x) => stanje(x) === "opozorilo").length,
      brez: kartice.filter((x) => stanje(x) === "caka").length,
      napak: v.filter((x) => stanje(x) === "napaka").length,
      povprecje: casi.length ? Math.round(casi.reduce((a, b) => a + b, 0) / casi.length) : null,
      najdlje: casi.length ? Math.max(...casi) : null,
    };
  }, [vnosi, stanje]);

  const tabelaManjka = napaka && /schema cache|does not exist|fos_krmilnik_dnevnik/i.test(napaka);

  return (
    <>
      <GlavaStrani
        drobtine={DROBTINE}
        naslov="Dnevnik krmilnikov"
        opis="Vse, kar se je zgodilo na krmilnikih: prebrane kartice, odgovori FIN:OS, Info in preklici, izpadi povezave, nastavitve in napake. Klik na vrstico pokaže vse podatke dogodka."
      />

      {/* filtri */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="fos-glass flex flex-col gap-3 rounded-[20px] p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(12rem,16rem)_auto_minmax(14rem,1fr)_auto]">
          <Izbira value={idNaprave} onChange={(id) => nastavi({ naprava: id ? String(id) : null })} moznosti={naprave} prazno="Vse naprave" hint="Prikaži dnevnik ene naprave ali vseh" />
          <div className="flex items-center gap-1.5">
            <IconButton hint="Prejšnji dan" icon={ChevronLeft} onClick={() => nastavi({ datum: premakniDan(datum, -1) })} />
            <input type="date" value={datum} max={danesIso()} onChange={(e) => nastavi({ datum: e.target.value || null })} title="Dan dnevnika" className={`${POLJE} w-40`} />
            <IconButton hint="Naslednji dan" icon={ChevronRight} onClick={() => nastavi({ datum: premakniDan(datum, 1) })} disabled={danes} />
            {!danes && (
              <button type="button" onClick={() => nastavi({ datum: null })} title="Pokaži današnji dnevnik" className="h-9 rounded-[10px] border border-white/10 px-3 text-xs font-semibold text-ink-200 hover:border-fines-400/60 hover:text-fines-300">
                Danes
              </button>
            )}
          </div>
          <IskalnoPolje value={iskanje} onChange={setIskanje} hint="Išči po kartici, imenu, sporočilu ali id žiga" placeholder="Kartica, ime, sporočilo ..." />
          <div className="flex gap-2">
            <Stikalo vklop={samoNapake} onChange={setSamoNapake} hint="Samo napake, opozorila in žigi brez odgovora">
              Samo težave
            </Stikalo>
            {danes && (
              <Stikalo vklop={zivo} onChange={setZivo} hint="Osvežuj vsakih 5 sekund">
                <span className="inline-flex items-center gap-1.5">
                  V živo <RefreshCw className={`h-3.5 w-3.5 ${nalagam && zivo ? "animate-spin" : ""}`} aria-hidden />
                </span>
              </Stikalo>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SKUPINE.map((s) => {
            const st = (vnosi ?? []).filter((v) => !s.vrste || s.vrste.includes(v.vrsta)).length;
            const izbran = skupina === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSkupina(s.id)}
                title={`Prikaži: ${s.ime}`}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${izbran ? "border-fines-400/60 bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] text-snow shadow-[0_0_14px_-4px_rgb(238_122_58/0.8)]" : "border-white/10 bg-white/[0.04] text-ink-300 hover:border-white/20"}`}
              >
                {s.ime}
                <span className={`tabular-nums ${izbran ? "text-snow/80" : "text-ink-500"}`}>{st}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {tabelaManjka ? (
        <PraznoStanje icon={ScrollText} naslov="Dnevnika še ni" opis={<>V Supabase zaženi <code className="font-mono">033_krmilnik_dnevnik.sql</code>. Krmilniki (program 1.2.0) dnevnik hranijo pri sebi in ga pošljejo, ko bo tabela pripravljena.</>} />
      ) : napaka ? (
        <PraznoStanje icon={AlertTriangle} ton="napaka" naslov="Dnevnika ni mogoče prebrati" opis={napaka} />
      ) : !vnosi ? (
        <div className="fos-glass h-72 animate-pulse rounded-[20px]" aria-label="Nalagam dnevnik" />
      ) : (
        <>
          {/* povzetek dneva */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <Stevilka naslov="Žigov" vrednost={povzetek.zigov} opis="prebranih kartic" />
            <Stevilka naslov="Potrjenih" vrednost={povzetek.ok} opis="FIN:OS je odgovoril z imenom" ton={povzetek.ok ? "ok" : undefined} />
            <Stevilka naslov="Neznana kartica" vrednost={povzetek.neznana} opis="kartica ni dodeljena" ton={povzetek.neznana ? "warn" : undefined} />
            <Stevilka naslov="Brez odgovora" vrednost={povzetek.brez} opis="čaka v vrsti na krmilniku ali še ni poslan" ton={povzetek.brez ? "warn" : undefined} />
            <Stevilka naslov="Napak" vrednost={povzetek.napak} opis="dogodki z napako" ton={povzetek.napak ? "nok" : undefined} />
            <Stevilka naslov="Prislon -> odgovor" vrednost={povzetek.povprecje == null ? "–" : `${povzetek.povprecje} ms`} opis={povzetek.najdlje == null ? "povprečje" : `povprečje · najdlje ${povzetek.najdlje} ms`} />
          </div>

          <div className="fos-glass overflow-x-auto rounded-[16px]">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="sticky top-0 bg-ink-800/95 text-[11px] font-bold uppercase tracking-wider text-ink-300">
                <tr>
                  <th className="w-8 px-2 py-2.5" />
                  <th className="px-3 py-2.5">Čas</th>
                  <th className="px-3 py-2.5">Naprava</th>
                  <th className="px-3 py-2.5">Vrsta</th>
                  <th className="px-3 py-2.5">Kartica</th>
                  <th className="px-3 py-2.5">Zaposleni · tipka</th>
                  <th className="px-3 py-2.5">Stanje</th>
                  <th className="px-3 py-2.5">Sporočilo</th>
                  <th className="px-3 py-2.5 text-right">Trajanje</th>
                </tr>
              </thead>
              <tbody>
                {prikazani.map((v) => {
                  const vr = vrstaOf(v.vrsta);
                  const s = stanje(v);
                  const oseba = osebaOf(v);
                  const zaostanek = Math.round((new Date(v.prejeto).getTime() - new Date(v.cas).getTime()) / 1000);
                  const odPrislona = Number(v.podatki?.od_prislona_ms);
                  const je = odprt === v.id;
                  return (
                    <Fragment key={v.id}>
                      <tr
                        onClick={() => setOdprt(je ? null : v.id)}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setOdprt(je ? null : v.id)}
                        title="Pokaži vse podatke dogodka"
                        className={`cursor-pointer border-t border-white/[0.06] outline-none transition-colors hover:bg-fines-500/[0.07] focus-visible:bg-fines-500/10 ${je ? "bg-fines-500/[0.08]" : ""}`}
                      >
                        <td className="px-2 py-2 text-ink-500">
                          <ChevronDown className={`h-4 w-4 transition-transform ${je ? "" : "-rotate-90"}`} aria-hidden />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-ink-200" title={`Prejeto v FIN:OS: ${new Date(v.prejeto).toLocaleString("sl-SI")}${zaostanek > 5 ? ` (${zaostanek} s pozneje)` : ""}`}>
                          {casDogodka(v.cas)}
                          {zaostanek > 60 && <span className="ml-1.5 text-warn-500">+{zaostanek < 3600 ? `${Math.round(zaostanek / 60)} min` : `${Math.round(zaostanek / 3600)} h`}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-300">{imeNaprave(v.id_krmilnika)}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: vr.barva }}>
                            <vr.ikona className="h-3.5 w-3.5" aria-hidden />
                            {vr.ime}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-fines-200">{v.st_kartice ?? ""}</td>
                        <td className="px-3 py-2 text-xs text-white">
                          {oseba ?? ""}
                          {v.tipka != null && <span className="ml-1.5 rounded-[6px] bg-fines-500/15 px-1.5 py-0.5 font-mono text-[11px] text-fines-300">tipka {v.tipka}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {s !== "info" && <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STANJA[s].razred}`}>{STANJA[s].ime}</span>}
                        </td>
                        <td className="max-w-[28rem] px-3 py-2 text-xs text-ink-200">{v.sporocilo}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums text-ink-400" title={Number.isFinite(odPrislona) ? `Od prislona do odgovora: ${odPrislona} ms` : undefined}>
                          {v.trajanje_ms != null ? `${v.trajanje_ms} ms` : ""}
                          {Number.isFinite(odPrislona) && <span className="block text-[10px] text-ink-500">prislon {odPrislona} ms</span>}
                        </td>
                      </tr>
                      {je && (
                        <tr className="border-t border-white/[0.06] bg-ink-950/60">
                          <td colSpan={9} className="px-4 py-3">
                            <Podrobnosti v={v} povezani={(poZigu.get(v.id_ziga ?? "") ?? []).filter((x) => x.id !== v.id)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!prikazani.length && <p className="p-6 text-center text-sm text-ink-400">{vnosi.length ? "Noben dogodek ne ustreza filtrom." : "Ta dan ni dogodkov."}</p>}
          </div>
        </>
      )}
    </>
  );
}

function Stevilka({ naslov, vrednost, opis, ton }: { naslov: string; vrednost: number | string; opis: string; ton?: "ok" | "warn" | "nok" }) {
  const barva = ton === "ok" ? "text-ok-500" : ton === "warn" ? "text-warn-500" : ton === "nok" ? "text-nok-500" : "text-white";
  return (
    <div className="fos-glass rounded-[16px] px-3 py-2.5" title={opis}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{naslov}</div>
      <div className={`font-display text-2xl font-bold tabular-nums ${barva}`}>{vrednost}</div>
      <div className="truncate text-[11px] text-ink-500">{opis}</div>
    </div>
  );
}

/** Razprta vrstica: vsa polja dogodka (JSON) in ostali dogodki istega žiga. */
function Podrobnosti({ v, povezani }: { v: Vnos; povezani: Vnos[] }) {
  const polja = { id: v.id, lokalni_id: v.lokalni_id, id_ziga: v.id_ziga, cas_krmilnik: v.cas, prejeto_finos: v.prejeto, vrsta: v.vrsta, st_kartice: v.st_kartice, tipka: v.tipka, uspeh: v.uspeh, trajanje_ms: v.trajanje_ms, verzija_programa: v.verzija };
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-fines-400">Dogodek</span>
        <pre className="max-h-80 overflow-auto rounded-[10px] border border-white/10 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-ink-200">{JSON.stringify(polja, null, 2)}</pre>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-fines-400">Podatki (odgovor, časi, napaka)</span>
        <pre className="max-h-80 overflow-auto rounded-[10px] border border-white/10 bg-ink-950 p-3 font-mono text-[11px] leading-relaxed text-ink-200">{JSON.stringify(v.podatki, null, 2)}</pre>
      </div>
      {povezani.length > 0 && (
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fines-400">Isti žig ({povezani.length})</span>
          <ul className="flex flex-col gap-1">
            {[...povezani].reverse().map((p) => (
              <li key={p.id} className="flex flex-wrap gap-x-3 font-mono text-[11px] text-ink-300">
                <span className="tabular-nums text-ink-200">{casDogodka(p.cas)}</span>
                <span style={{ color: vrstaOf(p.vrsta).barva }}>{vrstaOf(p.vrsta).ime}</span>
                <span>{p.sporocilo}</span>
                {p.trajanje_ms != null && <span className="text-ink-500">{p.trajanje_ms} ms</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
