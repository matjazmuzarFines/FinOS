"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Briefcase, DatabaseZap, KeyRound, LockKeyhole, ShieldCheck, Building2, ChevronRight, CreditCard, DoorOpen, Eye, IdCard, Network, Settings2, UserRound, UserRoundX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { Avatar } from "@/components/ui/Avatar";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { POLJE, PoljeNaslov, Stikalo } from "@/components/ui/Polje";
import { SaveBar } from "@/components/ui/SaveBar";
import { obvesti } from "@/components/ui/Obvestila";
import { Znak } from "@/components/Znak";
import { PoljaOrganizacije, PoljaOsebe, PoljaPrijave } from "./ZaposleniObrazec";
import { PoljaKadrovsko } from "./PoljaKadrovsko";
import { useLahkoUreja } from "@/lib/pravice";
import { IKONE, useFunkcije } from "@/lib/funkcije";
import { useFunkcija } from "@/components/Seja";
import { RAZDELKI, preveriKadrovsko, shraniKadrovsko, spremembKadrovsko, useKadrovsko, VRSTE_POGODBE, type Kadrovsko, type KadrovskoVnos } from "@/lib/kadrovsko";
import { polnoIme, preveriVnos, type Aplikacija, shraniZaposlenega, useZaposleni, vnosIz, zacetnice, type Zaposleni, type ZaposleniPodatki, type ZaposleniVnos } from "@/lib/zaposleni";

/** Razdelki lista zaposlenega - en vir (zavihki). Nov razdelek = nov vnos tukaj + komponenta. */
const ZAVIHKI = [
  { id: "podatki", ime: "Podatki", icon: IdCard, hint: "Osnovni podatki zaposlenega" },
  { id: "organizacija", ime: "Oddelek in vodja", icon: Network, hint: "Oddelek, vodja in podrejeni zaposleni" },
  { id: "zaposlitev", ime: "Zaposlitev", icon: Briefcase, hint: "Pogodba, delovni čas, dopust in izobrazba" },
  { id: "dostopi", ime: "Dostopi", icon: DoorOpen, hint: "Kartica in dostopi do prostorov" },
  { id: "nastavitve", ime: "Nastavitve", icon: Settings2, hint: "Nastavitve zaposlenega" },
] as const satisfies readonly { id: string; ime: string; icon: LucideIcon; hint: string }[];
type ZavihekId = (typeof ZAVIHKI)[number]["id"];

const DROBTINE = [
  { naslov: "FIN:OS", href: "/" },
  { naslov: "Administracija", href: "/administracija" },
  { naslov: "Zaposleni", href: "/administracija/zaposleni" },
];

/** List zaposlenega: glava osebe, zavihki razdelkov (izbran zavihek je v naslovu strani ?zavihek=). */
export function ListZaposlenega({ id }: { id: number }) {
  const { podatki, napaka } = useZaposleni();
  const kadrovsko = useKadrovsko(id, useFunkcija("kadrovanje"));
  const router = useRouter();

  if (napaka) return <PraznoStanje ton="napaka" icon={AlertTriangle} naslov="Zaposlenega ni mogoče prebrati" opis={napaka} />;
  if (!podatki || (!kadrovsko.podatki && !kadrovsko.napaka)) return <div className="fos-glass h-48 animate-pulse rounded-[24px]" aria-label="Nalagam zaposlenega" />;

  const z = podatki.poId.get(id);
  if (!z)
    return (
      <>
        <GlavaStrani drobtine={[...DROBTINE, { naslov: "Ni najden" }]} naslov="Zaposleni ni najden" />
        <PraznoStanje
          icon={UserRoundX}
          naslov={`Zaposlenega z ID ${id} ni`}
          opis="Morda je bil skrit ali pa povezava ni pravilna."
          akcija={
            <Button hint="Nazaj na seznam vseh zaposlenih" variant="neutral" icon={ChevronRight} onClick={() => router.push("/administracija/zaposleni")}>
              Na seznam zaposlenih
            </Button>
          }
        />
      </>
    );

  // nov ključ po shranjevanju (sveži podatki iz baze) -> osnutek se ponastavi
  return (
    <Urejanje
      key={JSON.stringify([vnosIz(z), kadrovsko.podatki])}
      z={z}
      podatki={podatki}
      kadrovsko={kadrovsko.podatki}
      kadrovskoNapaka={kadrovsko.manjkaTabela ? "manjka" : kadrovsko.napaka}
      osveziKadrovsko={kadrovsko.osvezi}
    />
  );
}

type UrejanjeProps = { vnos: ZaposleniVnos; nastavi: (p: Partial<ZaposleniVnos>) => void; ureja: boolean };

/** Kadrovski podatki v osnutku (fos_zaposleni_kadrovsko); napaka "manjka" = tabela še ni ustvarjena (007). */
type KadrovskoProps = { kVnos: KadrovskoVnos; nastaviK: (p: KadrovskoVnos) => void; napakeK: Record<string, string>; pokaziNapake: boolean; kadrovskoNapaka: string | null };

/** Vsebina lista z osnutkom sprememb: polja so urejljiva (razen ID), shrani se prek spodnje vrstice (SaveBar). */
function Urejanje({
  z,
  podatki,
  kadrovsko,
  kadrovskoNapaka,
  osveziKadrovsko,
}: {
  z: Zaposleni;
  podatki: ZaposleniPodatki;
  kadrovsko: Kadrovsko | null;
  kadrovskoNapaka: string | null;
  osveziKadrovsko: () => void;
}) {
  const router = useRouter();
  const pot = usePathname();
  const iskalni = useSearchParams();
  const zavihek: ZavihekId = ZAVIHKI.find((t) => t.id === iskalni.get("zavihek"))?.id ?? "podatki";
  const izberi = (t: ZavihekId) => router.replace(t === "podatki" ? pot : `${pot}?zavihek=${t}`, { scroll: false });

  const ureja = useLahkoUreja();
  const prej = vnosIz(z);
  const [vnos, setVnos] = useState<ZaposleniVnos>(prej);
  const [shranjujem, setShranjujem] = useState(false);
  const nastavi = (p: Partial<ZaposleniVnos>) => setVnos((v) => ({ ...v, ...p }));
  const kPrej = kadrovsko?.vnos;
  const [kVnos, setKVnos] = useState<KadrovskoVnos>(kPrej ?? {});
  const nastaviK = (p: KadrovskoVnos) => setKVnos((v) => ({ ...v, ...p }));
  const napakeK = preveriKadrovsko(kVnos);
  const [pokaziNapake, setPokaziNapake] = useState(false);
  const kSprememb = kPrej ? spremembKadrovsko(kVnos, kPrej) : 0;
  const sprememb = (Object.keys(prej) as (keyof ZaposleniVnos)[]).filter((k) => JSON.stringify(prej[k]) !== JSON.stringify(vnos[k])).length + kSprememb;

  const shrani = async () => {
    const stNapak = Object.keys(napakeK).length;
    const n = preveriVnos(vnos) ?? (stNapak ? `Popravi označena polja (${stNapak}): ${Object.values(napakeK)[0]}` : null);
    if (n) {
      setPokaziNapake(stNapak > 0);
      return obvesti(n, "napaka");
    }
    setShranjujem(true);
    try {
      // kadrovski podatki najprej: po shranjevanju zaposlenega se list znova naloži
      if (kadrovsko && kSprememb) await shraniKadrovsko(z.id, kadrovsko, kVnos);
      await shraniZaposlenega(z.id, vnos, prej);
      if (kSprememb) osveziKadrovsko();
      obvesti(`Shranjeno: ${vnos.ime.trim()} ${vnos.priimek.trim()}.`);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };
  const k: KadrovskoProps = { kVnos, nastaviK, napakeK, pokaziNapake, kadrovskoNapaka };
  const delovnoMesto = kPrej?.delovno_mesto;

  const podrejeni = podatki.zaposleni.filter((p) => p.vodja?.id === z.id);

  return (
    <>
      <GlavaStrani drobtine={[...DROBTINE, { naslov: polnoIme(z) }]} naslov={polnoIme(z)} />

      {/* glava osebe (shranjeni podatki) */}
      <motion.section
        className="fos-kartica relative overflow-hidden rounded-[24px] border border-white/10 p-5 shadow-[var(--fos-shadow-card)] sm:p-7"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
      >
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(238_122_58/0.22),transparent_70%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-12 right-4 font-display text-[8rem] font-bold leading-none text-white/[0.03] sm:text-[10rem]">
          {zacetnice(z)}
        </span>
        <div className="relative flex flex-wrap items-center gap-5">
          <motion.span initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}>
            <Avatar besedilo={zacetnice(z)} velikost="xl" />
          </motion.span>
          <div className="flex min-w-[min(100%,14rem)] flex-1 flex-col gap-2">
            <p className="font-display text-2xl font-bold text-white sm:text-3xl">{polnoIme(z)}</p>
            <div className="flex flex-wrap gap-2">
              <Oznaka icon={Building2} hint="Oddelek zaposlenega">
                {z.oddelek?.ime_oddelka ?? "Brez oddelka"}
              </Oznaka>
              <Oznaka icon={UserRound} hint="Vodja zaposlenega">
                {z.vodja ? `Vodja: ${polnoIme(z.vodja)}` : "Brez vodje"}
              </Oznaka>
              <Oznaka icon={CreditCard} hint="Številka kartice zaposlenega" mono>
                {z.st_kartice ?? "Brez kartice"}
              </Oznaka>
              {delovnoMesto && (
                <Oznaka icon={Briefcase} hint="Delovno mesto">
                  {delovnoMesto}
                </Oznaka>
              )}
              {z.super_admin && (
                <Oznaka icon={ShieldCheck} hint="Ima dostop do FIN:OS Administracije">
                  Super Admin
                </Oznaka>
              )}
              {z.id_kot_vodja != null && (
                <Oznaka icon={Network} hint="Zaposleni je vodja">
                  Vodja ({podrejeni.length})
                </Oznaka>
              )}
            </div>
          </div>
          <span className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs text-ink-400" title="ID zaposlenega v bazi (fos_zaposleni.id)">
              ID {z.id}
            </span>
            {!ureja && (
              <span className="flex items-center gap-1.5 text-xs text-ink-500" title="Za urejanje nimaš pravic">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Samo ogled
              </span>
            )}
          </span>
        </div>
      </motion.section>

      {/* zavihki razdelkov - na ozkem zaslonu se drsijo, lepljivi pod glavo */}
      <nav aria-label="Razdelki zaposlenega" className="sticky top-[68px] z-20 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="fos-glass inline-flex min-w-max gap-1 rounded-[16px] p-1">
          {ZAVIHKI.map((t) => {
            const izbran = t.id === zavihek;
            return (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                aria-pressed={izbran}
                onClick={() => izberi(t.id)}
                className={`relative flex h-10 items-center gap-2 rounded-[12px] px-3.5 text-sm font-semibold transition-colors duration-300 sm:px-4 ${izbran ? "text-snow" : "text-ink-300 hover:bg-white/[0.06] hover:text-white"}`}
              >
                {izbran && (
                  <motion.span
                    layoutId="zavihek-zaposleni"
                    className="absolute inset-0 rounded-[12px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_6px_20px_-8px_rgb(202_80_16/0.9),inset_0_1px_0_rgb(255_255_255/0.3)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <t.icon className="relative h-4 w-4" aria-hidden />
                <span className="relative">{t.ime}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={zavihek} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {zavihek === "podatki" && <Podatki z={z} vnos={vnos} nastavi={nastavi} ureja={ureja} {...k} />}
          {zavihek === "zaposlitev" && <Zaposlitev ureja={ureja} {...k} />}
          {zavihek === "organizacija" && <Organizacija z={z} vnos={vnos} nastavi={nastavi} ureja={ureja} podrejeni={podrejeni} podatki={podatki} />}
          {zavihek === "dostopi" && <Dostopi z={z} vnos={vnos} nastavi={nastavi} ureja={ureja} aplikacije={podatki.aplikacije} />}
          {zavihek === "nastavitve" && <Nastavitve z={z} />}
        </motion.div>
      </AnimatePresence>

      <SaveBar
        sprememb={sprememb}
        shranjujem={shranjujem}
        onShrani={shrani}
        onPreklici={() => {
          setVnos(prej);
          setKVnos(kPrej ?? {});
          setPokaziNapake(false);
        }}
      />
    </>
  );
}

function Podatki({ z, vnos, nastavi, ureja, ...k }: { z: Zaposleni } & UrejanjeProps & KadrovskoProps) {
  return (
    <section className="flex flex-col gap-4">
      <NaslovRazdelka>Osnovni podatki</NaslovRazdelka>
      <div className="fos-glass grid gap-4 rounded-[18px] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        <PoljaOsebe vnos={vnos} nastavi={nastavi} ureja={ureja} />
        <PoljeNaslov naslov="ID zaposlenega">
          <input value={z.id} readOnly disabled title="ID se ne ureja (fos_zaposleni.id)" className={`${POLJE} cursor-not-allowed font-mono opacity-60`} />
        </PoljeNaslov>
      </div>
      <NaslovRazdelka>
        <span className="inline-flex items-center gap-1.5">
          Prijava v <Znak pripona="ME" className="text-[11px]" />
        </span>
      </NaslovRazdelka>
      <div className="fos-glass grid gap-4 rounded-[18px] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        <PoljaPrijave vnos={vnos} nastavi={nastavi} ureja={ureja} imaRacun={z.id_uporabnika != null} />
        <p className="text-xs text-ink-500 sm:col-span-2 lg:col-span-4">
          Geslo se shrani zaščiteno (Supabase Auth) in ga ni mogoče prebrati - lahko ga samo zamenjaš. Zaposleni se prijavi z e-mailom ali uporabniškim imenom.
        </p>
      </div>
      <KadrovskiRazdelki zavihek="podatki" ureja={ureja} {...k} />
    </section>
  );
}

function Zaposlitev({ ureja, ...k }: { ureja: boolean } & KadrovskoProps) {
  const vrsta = VRSTE_POGODBE.find((v) => v.id === k.kVnos.vrsta_pogodbe)?.ime;
  const od = k.kVnos.datum_zaposlitve;
  return (
    <section className="flex flex-col gap-4">
      {!k.kadrovskoNapaka && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Povzetek naslov="Pogodba" vrednost={vrsta ?? "-"} opis={k.kVnos.pogodba_do ? `do ${datum(k.kVnos.pogodba_do)}` : undefined} />
          <Povzetek naslov="V Fines" vrednost={od ? stazOd(od) : "-"} opis={od ? `od ${datum(od)}` : undefined} />
          <Povzetek naslov="Delovni čas" vrednost={k.kVnos.tedenske_ure ? `${k.kVnos.tedenske_ure} h / teden` : "-"} opis={k.kVnos.letni_dopust ? `${k.kVnos.letni_dopust} dni dopusta na leto` : undefined} />
        </div>
      )}
      <KadrovskiRazdelki zavihek="zaposlitev" ureja={ureja} {...k} />
    </section>
  );
}

const datum = (d: string) => new Date(d).toLocaleDateString("sl-SI");

/** Staž od datuma zaposlitve do danes (leta, meseci). */
function stazOd(od: string): string {
  const z = new Date(od);
  const d = new Date();
  let m = (d.getFullYear() - z.getFullYear()) * 12 + d.getMonth() - z.getMonth() - (d.getDate() < z.getDate() ? 1 : 0);
  if (m < 0) return "še ni začel";
  const l = Math.floor(m / 12);
  m %= 12;
  const leta = l === 1 ? "leto" : l === 2 ? "leti" : l < 5 ? "leta" : "let";
  return [l > 0 && `${l} ${leta}`, (m > 0 || l === 0) && `${m} mes.`].filter(Boolean).join(" ");
}

function Povzetek({ naslov, vrednost, opis }: { naslov: string; vrednost: string; opis?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="fos-glass relative flex flex-col gap-0.5 overflow-hidden rounded-[16px] p-4">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#f19a66,#ca5010,transparent)]" />
      <span className="text-xs font-semibold text-ink-400">{naslov}</span>
      <span className="font-display text-xl font-bold text-white">{vrednost}</span>
      {opis && <span className="text-xs text-ink-500">{opis}</span>}
    </motion.div>
  );
}

/** Kadrovski razdelki zavihka ali opozorilo, če tabele še ni / je ni mogoče prebrati. */
function KadrovskiRazdelki({ zavihek, ureja, kVnos, nastaviK, napakeK, pokaziNapake, kadrovskoNapaka }: { zavihek: "podatki" | "zaposlitev"; ureja: boolean } & KadrovskoProps) {
  const kadrovanje = useFunkcija("kadrovanje");
  if (kadrovskoNapaka)
    return (
      <PraznoStanje
        ton="napaka"
        icon={DatabaseZap}
        naslov={kadrovskoNapaka === "manjka" ? "Kadrovski podatki še niso pripravljeni" : "Kadrovskih podatkov ni mogoče prebrati"}
        opis={
          kadrovskoNapaka === "manjka" ? (
            <>
              V Supabase (SQL Editor) po vrsti zaženi <code className="font-mono text-fines-300">007_kadrovsko.sql</code> in <code className="font-mono text-fines-300">008_funkcije.sql</code> (mapa supabase/migrations).
            </>
          ) : (
            kadrovskoNapaka
          )
        }
      />
    );
  if (zavihek === "podatki" && !kadrovanje) return <OsebniZaklenjeni />;
  return <PoljaKadrovsko zavihek={zavihek} vnos={kVnos} nastavi={nastaviK} ureja={ureja} napake={napakeK} pokaziNapake={pokaziNapake} />;
}

/** Osebni podatki brez funkcije Kadrovanje: baza jih ne vrne, prikaže se samo zaklenjen okvir z imeni razdelkov. */
function OsebniZaklenjeni() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
      <NaslovRazdelka>Osebni podatki</NaslovRazdelka>
      <div className="fos-glass relative overflow-hidden rounded-[18px] p-5 sm:p-6">
        {/* zamegljen nadomestek polj - podatkov v brskalniku ni */}
        <div aria-hidden className="pointer-events-none grid select-none gap-4 opacity-40 blur-[3px] sm:grid-cols-2 lg:grid-cols-4">
          {RAZDELKI.filter((r) => r.zavihek === "podatki")
            .flatMap((r) => r.polja)
            .slice(0, 8)
            .map((p) => (
              <span key={p.ime} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-400">{p.naslov}</span>
                <span className="h-10 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 font-mono leading-10 text-ink-400">••••••••••</span>
              </span>
            ))}
        </div>
        <div className="absolute inset-0 grid place-items-center bg-ink-950/30 p-4">
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <span className="fos-fines-fill grid h-12 w-12 place-items-center rounded-2xl text-snow shadow-[var(--fos-glow-fines)]">
              <LockKeyhole className="h-6 w-6" aria-hidden />
            </span>
            <span className="font-display text-lg font-bold text-white">Zaščiteno - Kadrovanje</span>
            <span className="text-sm text-ink-300">
              {RAZDELKI.filter((r) => r.zavihek === "podatki")
                .map((r) => r.naslov)
                .join(", ")}{" "}
              vidi in ureja samo uporabnik s funkcijo Kadrovanje (Nastavitve → Pravice in dostopi).
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Organizacija({ z, vnos, nastavi, ureja, podrejeni, podatki }: { z: Zaposleni; podrejeni: Zaposleni[]; podatki: ZaposleniPodatki } & UrejanjeProps) {
  const vOddelku = vnos.id_oddelek != null ? podatki.zaposleni.filter((p) => p.id_oddelek === vnos.id_oddelek).length : 0;
  const vodja = z.vodja ? podatki.poId.get(z.vodja.id) : undefined;
  return (
    <section className="flex flex-col gap-4">
      <NaslovRazdelka>Oddelek in vodja</NaslovRazdelka>
      <div className="fos-glass grid gap-4 rounded-[18px] p-4 sm:grid-cols-3 sm:p-5">
        <PoljaOrganizacije vnos={vnos} nastavi={nastavi} ureja={ureja} podatki={podatki} idZaposlenega={z.id} />
        <p className="text-xs text-ink-500 sm:col-span-3">
          {vnos.id_oddelek != null && `${vOddelku} zaposlenih v izbranem oddelku. `}
          Za vodjo lahko izbereš zaposlene, ki imajo vklopljeno &quot;Je vodja&quot;.
        </p>
      </div>
      {vodja && (
        <div className="fos-glass flex flex-col gap-2 rounded-[16px] p-4 sm:max-w-md">
          <span className="text-xs font-semibold text-ink-400">Trenutni vodja</span>
          <Oseba z={vodja} />
        </div>
      )}

      <NaslovRazdelka desno={<span className="text-xs tabular-nums text-ink-400">{podrejeni.length}</span>}>Podrejeni</NaslovRazdelka>
      {podrejeni.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {podrejeni.map((p, i) => (
            <motion.li key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <div className="fos-glass rounded-[16px] p-3">
                <Oseba z={p} />
              </div>
            </motion.li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-ink-500">{polnoIme(z)} ni vodja nobenemu zaposlenemu.</p>
      )}
    </section>
  );
}

/** Nastavitve zaposlenega: na vrhu pravice (funkcije - samo pregled, urejajo se v Nastavitve -> Pravice in dostopi). */
function Nastavitve({ z }: { z: Zaposleni }) {
  const router = useRouter();
  const { funkcije } = useFunkcije();
  return (
    <section className="flex flex-col gap-4">
      <NaslovRazdelka
        desno={
          <Button hint="Uredi funkcije zaposlenega v Pravicah in dostopih" variant="neutral" icon={KeyRound} onClick={() => router.push(`/administracija/nastavitve/pravice?zaposleni=${z.id}`)}>
            Uredi pravice
          </Button>
        }
      >
        Pravice
      </NaslovRazdelka>
      <div className="grid gap-3 sm:grid-cols-2">
        {(funkcije ?? []).map((f) => {
          const ima = z.funkcije.includes(f.koda);
          const Ikona = IKONE[f.koda] ?? KeyRound;
          return (
            <div key={f.koda} className={`fos-glass flex items-start gap-4 rounded-[18px] p-4 sm:p-5 ${ima ? "border-fines-400/50 shadow-[0_0_40px_-18px_rgb(238_122_58/0.8)]" : ""}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${ima ? "fos-fines-fill text-snow" : "bg-white/[0.06] text-ink-400"}`}>
                <Ikona className="h-5 w-5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-bold text-white">{f.ime}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ima ? "border-ok-500/40 bg-ok-500/10 text-ok-500" : "border-white/10 bg-white/[0.04] text-ink-400"}`}>{ima ? "Ima" : "Nima"}</span>
                </span>
                <span className="text-sm text-ink-400">{f.opis}</span>
              </div>
            </div>
          );
        })}
      </div>
      {!z.id_uporabnika && <p className="text-xs text-warn-500">Zaposleni še nima računa - funkcije lahko dobi, ko mu v razdelku Podatki vpišeš e-mail in geslo (Prijava v FIN:ME).</p>}

      <NaslovRazdelka>Ostale nastavitve</NaslovRazdelka>
      <PraznoStanje icon={Settings2} naslov="Kmalu" opis="Tu bodo ostale nastavitve zaposlenega (npr. delovni čas)." />
    </section>
  );
}

function Dostopi({ z, vnos, nastavi, ureja, aplikacije }: { z: Zaposleni; aplikacije: Aplikacija[] } & UrejanjeProps) {
  const preklopi = (id: number, vklop: boolean) =>
    nastavi({ aplikacije: (vklop ? [...vnos.aplikacije, id] : vnos.aplikacije.filter((a) => a !== id)).sort((a, b) => a - b) });
  return (
    <section className="flex flex-col gap-4">
      <NaslovRazdelka desno={<span className="text-xs tabular-nums text-ink-400">{vnos.aplikacije.length + (z.super_admin ? 1 : 0)}</span>}>Aplikacije</NaslovRazdelka>
      <div className="fos-glass flex flex-col gap-3 rounded-[18px] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* FIN:OS: dostop samo prek Super Admina (Nastavitve) */}
          <div
            title="Dostop do FIN:OS Administracije da funkcija Super Admin (Nastavitve -> Pravice in dostopi)"
            className={`flex flex-col gap-1 rounded-[14px] border p-3 ${z.super_admin ? "border-fines-400/50 bg-fines-500/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Znak pripona="OS" className="text-sm" /> Administracija
            </span>
            <span className="text-xs text-ink-400">{z.super_admin ? "Dostop: Super Admin" : "Brez dostopa - funkcija Super Admin (Pravice in dostopi)"}</span>
          </div>
          {aplikacije.map((a) => (
            <div key={a.id} className="flex flex-col gap-1.5">
              <Stikalo vklop={vnos.aplikacije.includes(a.id)} onChange={(v) => preklopi(a.id, v)} hint={`Dostop zaposlenega do aplikacije ${a.ime}`} disabled={!ureja}>
                {a.ime}
              </Stikalo>
              {a.opis && <span className="px-1 text-xs text-ink-500">{a.opis}</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-500">
          {z.id_uporabnika
            ? "Dostop velja za račun zaposlenega (prijava z e-mailom / uporabniškim imenom) in začne veljati takoj po shranjevanju."
            : "Zaposleni še nima računa - dostopi začnejo veljati, ko mu v razdelku Podatki ustvariš prijavo."}
        </p>
      </div>

      <NaslovRazdelka>Kartica</NaslovRazdelka>
      <div className="fos-glass flex min-w-0 flex-col gap-1 rounded-[16px] p-4 sm:max-w-md">
        <span className="text-xs font-semibold text-ink-400">Številka kartice</span>
        <span className={`truncate font-mono text-lg font-semibold ${z.st_kartice ? "text-white" : "text-ink-500"}`}>{z.st_kartice || "-"}</span>
        <span className="text-xs text-ink-500">{z.st_kartice ? "Kartico urejaš v razdelku Podatki." : "Zaposleni še nima kartice - vpiši jo v razdelku Podatki."}</span>
      </div>
      <NaslovRazdelka>Dostopi do prostorov</NaslovRazdelka>
      <PraznoStanje
        icon={DoorOpen}
        naslov="Dostopi - kmalu"
        opis={
          <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
            Dostope do prostorov bo urejal podprogram <Znak pripona="DOOR" className="text-sm" />
          </span>
        }
      />
    </section>
  );
}

/** Povezava na drugega zaposlenega (vodja, podrejeni). */
function Oseba({ z }: { z: Zaposleni }) {
  return (
    <Link href={`/administracija/zaposleni/${z.id}`} title={`Odpri list zaposlenega ${polnoIme(z)}`} className="group flex min-w-0 items-center gap-3">
      <Avatar besedilo={zacetnice(z)} velikost="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-white transition-colors group-hover:text-fines-300">{polnoIme(z)}</span>
        <span className="truncate text-xs text-ink-400">{z.oddelek?.ime_oddelka ?? "Brez oddelka"}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-500 transition-all group-hover:translate-x-1 group-hover:text-fines-300" aria-hidden />
    </Link>
  );
}

function Oznaka({ icon: Icon, hint, mono, children }: { icon: LucideIcon; hint: string; mono?: boolean; children: ReactNode }) {
  return (
    <span title={hint} className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-ink-200 ${mono ? "font-mono" : ""}`}>
      <Icon className="h-3.5 w-3.5 text-fines-400" aria-hidden />
      {children}
    </span>
  );
}
