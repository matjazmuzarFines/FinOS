"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarRange,
  CreditCard,
  Database,
  DoorOpen,
  Hourglass,
  Keyboard,
  KeyRound,
  Network,
  Search,
  Settings,
  Tags,
  Tv,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { Znak } from "@/components/Znak";
import { isoDatum } from "@/lib/cas";
import { useCasNastavitve } from "@/lib/casNastavitve";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { naZvezi, useTv } from "@/lib/tv";
import { useZaposleni } from "@/lib/zaposleni";
import { odpriIskanje } from "./IskanjeAdmin";

type Ton = "ok" | "warn" | "nok" | "nevtralno";
/** vrednost null = ni podatka (baza ni dosegljiva / tabele še ni) -> "–" */
type Stevilka = { vrednost: string | number | null; oznaka: string; ton: Ton; hint: string; href?: string };
type Povezava = { ime: string; href: string; ikona: LucideIcon };
type Podrocje = { ime: string; znak?: string; ikona: LucideIcon; opis: string; href?: string; nastavitve?: string; stevilke: Stevilka[]; povezave: Povezava[]; siroka?: boolean };

const TONI: Record<Ton, string> = { ok: "text-ok-500", warn: "text-warn-500", nok: "text-nok-500", nevtralno: "text-white" };
const vzmet = { type: "spring" as const, stiffness: 240, damping: 24 };
/** Število z barvo samo, ko je > 0 (0 = sivo, nič ni narobe). */
const tonStevila = (n: number | null, ton: Ton): Ton => (n ? ton : "nevtralno");

function pred(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

/** Registracija časa iz baze: na delu zdaj (liho število žigov danes), zahtevki čakajo, neznane kartice (7 dni). */
function useStanjeCasa() {
  const [s, setS] = useState<{ naDelu: number | null; zahtevki: number | null; neznane: number | null }>({ naDelu: null, zahtevki: null, neznane: null });
  useEffect(() => {
    if (!supabaseConfigured) return;
    let ziv = true;
    const sb = getSupabase();
    const danes = isoDatum(new Date());
    const teden = isoDatum(new Date(Date.now() - 7 * 86400_000));
    Promise.all([
      sb.from("fos_dogodki").select("id_zaposlenega").eq("datum", danes).eq("visible", true).eq("spregledan", false).not("id_zaposlenega", "is", null).limit(5000),
      sb.from("fos_zahtevki").select("id", { count: "exact", head: true }).eq("status", "oddano"),
      sb.from("fos_dogodki").select("id", { count: "exact", head: true }).is("id_zaposlenega", null).eq("visible", true).gte("datum", teden),
    ]).then(([d, z, n]) => {
      if (!ziv) return;
      const zigi = new Map<number, number>();
      for (const x of d.data ?? []) zigi.set(x.id_zaposlenega as number, (zigi.get(x.id_zaposlenega as number) ?? 0) + 1);
      setS({
        naDelu: d.error ? null : [...zigi.values()].filter((v) => v % 2 === 1).length,
        zahtevki: z.error ? null : (z.count ?? 0),
        neznane: n.error ? null : (n.count ?? 0),
      });
    });
    return () => {
      ziv = false;
    };
  }, []);
  return s;
}

/**
 * Vstop v Administracijo (finos_stil.txt -> 14): plošča po področjih. PODROČJA = velike kartice s stanjem (2-3 številke,
 * barvne samo, ko kaj čaka / je narobe) in bližnjicami; LJUDJE = zaposleni, hierarhija in opozorila (brez urnika,
 * kartice, računa); SISTEM = tanka vrstica povezav. Iskanje po vsem: gumb ali Ctrl+K (IskanjeAdmin).
 */
export function AdminPregled() {
  const { podatki } = useZaposleni();
  const n = useCasNastavitve();
  const tv = useTv();
  const cas = useStanjeCasa();
  const zaposleni = podatki?.zaposleni;

  const zasloni = tv.zasloni.filter((z) => z.visible);
  const objave = tv.viri.map((v) => v.objava?.created_at).filter((x): x is string => !!x).sort();
  const brezUrnika = zaposleni && n.virUrnikov === "baza" ? zaposleni.filter((z) => !n.zaposleniUrniki.some((u) => u.id_zaposlenega === z.id)).length : null;
  const brezKartice = zaposleni ? zaposleni.filter((z) => !z.st_kartice?.trim()).length : null;
  const brezRacuna = zaposleni ? zaposleni.filter((z) => !z.id_uporabnika).length : null;

  const podrocja: Podrocje[] = [
    {
      ime: "Registracija časa",
      ikona: CalendarClock,
      opis: "Prisotnost, žigi, urniki in zahtevki zaposlenih.",
      href: "/administracija/registracija",
      nastavitve: "/administracija/registracija/nastavitve",
      siroka: true,
      stevilke: [
        { vrednost: cas.naDelu, oznaka: "na delu zdaj", ton: "ok", hint: "Zaposleni z lihim številom žigov danes (prišli, še niso odšli)", href: "/administracija/registracija" },
        { vrednost: cas.zahtevki, oznaka: "zahtevkov čaka", ton: tonStevila(cas.zahtevki, "warn"), hint: "Oddani zahtevki (odsotnosti, dovolilnice, popravki), ki jih vodje še niso potrdili" },
        { vrednost: cas.neznane, oznaka: "žigov neznanih kartic (7 dni)", ton: tonStevila(cas.neznane, "nok"), hint: "Žigi kartic, ki niso dodeljene nobenemu zaposlenemu - kartico vpiši pri zaposlenem", href: "/administracija/zaposleni" },
      ],
      povezave: [
        { ime: "Koledar", href: "/administracija/registracija", ikona: CalendarClock },
        { ime: "Urniki", href: "/administracija/registracija/nastavitve/urniki", ikona: CalendarRange },
        { ime: "Statistike", href: "/administracija/registracija/nastavitve/statistike", ikona: Tags },
        { ime: "Obveznost", href: "/administracija/registracija/nastavitve/obveznost", ikona: Hourglass },
        { ime: "Krmilnik", href: "/administracija/registracija/nastavitve/krmilnik", ikona: Keyboard },
      ],
    },
    {
      ime: "FIN:TV",
      znak: "TV",
      ikona: Tv,
      opis: "Televizorji v proizvodnji.",
      href: "/administracija/tv",
      stevilke: [
        {
          vrednost: tv.vir === "nalagam" ? null : `${zasloni.filter((z) => naZvezi(z)).length}/${zasloni.length}`,
          oznaka: "zaslonov na zvezi",
          ton: zasloni.length && zasloni.every((z) => naZvezi(z)) ? "ok" : zasloni.length ? "nok" : "nevtralno",
          hint: "Zasloni, ki so se javili v zadnjih 2 minutah",
        },
        { vrednost: objave.length ? pred(objave[objave.length - 1]) : null, oznaka: "od zadnje objave", ton: "nevtralno", hint: "Kdaj je projekt (npr. Production) nazadnje objavil komponento na TV" },
      ],
      // FIN:TV je ena stran (zasloni, seznam, komponente) - bližnjic ni, klik na kartico jo odpre
      povezave: [],
    },
    { ime: "FIN:DOOR", znak: "DOOR", ikona: DoorOpen, opis: "Prostori, dostopi in kartice.", stevilke: [], povezave: [] },
  ];

  const ljudje: { ime: string; vrednost?: number | null; opis: string; ikona: LucideIcon; href: string; opozorilo?: boolean; hint: string }[] = [
    { ime: "Zaposleni", vrednost: zaposleni?.length ?? null, opis: "seznam in listi", ikona: Users, href: "/administracija/zaposleni", hint: "Odpri seznam zaposlenih" },
    { ime: "Hierarhija", opis: "vodje in ekipe", ikona: Network, href: "/administracija/zaposleni/hierarhija", hint: "Odpri prikaz hierarhije" },
    { ime: "Brez urnika", vrednost: brezUrnika, opis: "zaposleni", ikona: CalendarRange, href: "/administracija/registracija/nastavitve/urniki", opozorilo: true, hint: "Zaposleni brez urnika - Urniki -> Urniki zaposlenih" },
    { ime: "Brez kartice", vrednost: brezKartice, opis: "ne morejo štempljati", ikona: CreditCard, href: "/administracija/zaposleni", opozorilo: true, hint: "Zaposleni brez številke kartice" },
    { ime: "Brez računa", vrednost: brezRacuna, opis: "ni prijave v FIN:ME", ikona: UserX, href: "/administracija/zaposleni", opozorilo: true, hint: "Zaposleni brez e-maila / uporabniškega imena za FIN:ME" },
  ];

  const sistem: Povezava[] = [
    { ime: "Podatki baze", href: "/administracija/nastavitve/podatki", ikona: Database },
    { ime: "Pravice in dostopi", href: "/administracija/nastavitve/pravice", ikona: KeyRound },
    { ime: "Vse nastavitve", href: "/administracija/nastavitve", ikona: Settings },
  ];

  return (
    <>
      <GlavaStrani
        drobtine={[{ naslov: "FIN:OS", href: "/" }, { naslov: "Administracija" }]}
        naslov={
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            Administracija <Znak pripona="OS" className="text-xl sm:text-2xl" />
          </span>
        }
        opis="Kaj se dogaja po področjih in kaj čaka. Iskanje po vsem: Ctrl+K."
        akcije={
          <button
            type="button"
            onClick={odpriIskanje}
            title="Išči stran, nastavitev ali zaposlenega (Ctrl+K)"
            className="flex h-10 w-full min-w-64 items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.05] px-3 text-sm text-ink-400 backdrop-blur-md transition-all hover:border-fines-400/50 hover:text-white sm:w-auto"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="flex-1 text-left">Išči ...</span>
            <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 text-[11px]">Ctrl K</kbd>
          </button>
        }
      />

      <section className="flex flex-col gap-3">
        <NaslovRazdelka>Področja</NaslovRazdelka>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {podrocja.map((p, i) => (
            <KarticaPodrocja key={p.ime} p={p} i={i} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <NaslovRazdelka>Ljudje</NaslovRazdelka>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {ljudje.map((l, i) => {
            const opozori = l.opozorilo && !!l.vrednost;
            return (
              <motion.div key={l.ime} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...vzmet, delay: 0.25 + i * 0.05 }}>
                <Link
                  href={l.href}
                  title={l.hint}
                  className={`flex items-center gap-3 rounded-[16px] border p-3 transition-all hover:-translate-y-0.5 ${opozori ? "border-warn-500/30 bg-warn-500/[0.06] hover:border-warn-500/60" : "fos-kartica border-white/10 hover:border-fines-400/50"}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${opozori ? "bg-warn-500/15 text-warn-500" : l.opozorilo ? "bg-white/[0.06] text-ink-400" : "fos-fines-fill text-snow"}`}>
                    <l.ikona className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-baseline gap-1.5">
                      {l.vrednost !== undefined && <b className={`font-display text-xl ${opozori ? "text-warn-500" : "text-white"}`}>{l.vrednost ?? "–"}</b>}
                      <span className="truncate text-sm font-semibold text-white">{l.ime}</span>
                    </span>
                    <span className="truncate text-xs text-ink-400">{l.opis}</span>
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <NaslovRazdelka>Sistem</NaslovRazdelka>
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-[14px] border border-white/10 bg-white/[0.02] px-4 py-2.5">
          {sistem.map((s) => (
            <Link key={s.ime} href={s.href} title={`Odpri ${s.ime}`} className="flex items-center gap-2 text-sm font-semibold text-ink-300 transition-colors hover:text-fines-300">
              <s.ikona className="h-4 w-4" aria-hidden />
              {s.ime}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function KarticaPodrocja({ p, i }: { p: Podrocje; i: number }) {
  const kmalu = !p.href;
  const Naslov = (
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2 font-display text-xl font-bold text-white">
        {p.znak ? <Znak pripona={p.znak} className="text-xl" /> : p.ime}
        {!kmalu && <ArrowUpRight className="h-4 w-4 text-fines-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />}
        {kmalu && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-300">kmalu</span>}
      </span>
      <span className="text-sm text-ink-400">{p.opis}</span>
    </span>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...vzmet, delay: 0.08 + i * 0.07 }}
      className={`group relative overflow-hidden rounded-[24px] p-px ${p.siroka ? "md:col-span-2" : ""} ${kmalu ? "opacity-55" : ""}`}
    >
      <span aria-hidden className="absolute inset-0 rounded-[24px] bg-white/10" />
      {!kmalu && (
        <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[24px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <span className="fos-border-anim absolute -inset-[50%]" />
        </span>
      )}
      <div className="fos-kartica relative flex h-full flex-col gap-5 rounded-[23px] p-5">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.16),transparent_70%)]" />
        <div className="relative flex items-start gap-3">
          <span className="fos-fines-fill grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-snow transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-105">
            <p.ikona className="h-6 w-6" aria-hidden />
          </span>
          {p.href ? (
            <Link href={p.href} title={`Odpri ${p.ime}`} className="min-w-0 flex-1 after:absolute after:inset-0 after:content-['']">
              {Naslov}
            </Link>
          ) : (
            <span className="min-w-0 flex-1">{Naslov}</span>
          )}
          {p.nastavitve && (
            <Link href={p.nastavitve} title={`Nastavitve: ${p.ime}`} className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-ink-200 transition-all hover:rotate-90 hover:border-fines-400/50 hover:text-fines-300">
              <Settings className="h-5 w-5" aria-hidden />
            </Link>
          )}
        </div>
        {p.stevilke.length > 0 && (
          <div className="relative z-10 flex flex-wrap gap-x-8 gap-y-3">
            {p.stevilke.map((s) => {
              const vsebina = (
                <>
                  <span className={`font-display text-3xl font-bold leading-none ${TONI[s.ton]}`}>{s.vrednost ?? "–"}</span>
                  <span className="mt-1 text-xs text-ink-400">{s.oznaka}</span>
                </>
              );
              return s.href ? (
                <Link key={s.oznaka} href={s.href} title={s.hint} className="flex flex-col transition-opacity hover:opacity-80">
                  {vsebina}
                </Link>
              ) : (
                <span key={s.oznaka} title={s.hint} className="flex flex-col">
                  {vsebina}
                </span>
              );
            })}
          </div>
        )}
        {p.povezave.length > 0 && (
          <div className="relative z-10 mt-auto flex flex-wrap gap-1.5">
            {p.povezave.map((x) => (
              <Link key={x.ime} href={x.href} title={`Odpri ${x.ime}`} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-ink-200 transition-all hover:border-fines-400/50 hover:bg-fines-500/10 hover:text-white">
                <x.ikona className="h-3.5 w-3.5 text-fines-300" aria-hidden />
                {x.ime}
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
