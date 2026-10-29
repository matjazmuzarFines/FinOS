"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ShieldCheck, Building2, ChevronRight, CreditCard, DoorOpen, Eye, IdCard, Network, Settings2, UserRound, UserRoundX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GlavaStrani, NaslovRazdelka } from "@/components/ui/GlavaStrani";
import { Avatar } from "@/components/ui/Avatar";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { POLJE, PoljeNaslov, Stikalo } from "@/components/ui/Polje";
import { SaveBar } from "@/components/ui/SaveBar";
import { obvesti } from "@/components/ui/Obvestila";
import { Znak } from "@/components/Znak";
import { PoljaOrganizacije, PoljaOsebe, PoljaPrijave } from "./ZaposleniObrazec";
import { useLahkoUreja } from "@/lib/pravice";
import { polnoIme, preveriVnos, type Aplikacija, shraniZaposlenega, useZaposleni, vnosIz, zacetnice, type Zaposleni, type ZaposleniPodatki, type ZaposleniVnos } from "@/lib/zaposleni";

/** Razdelki lista zaposlenega - en vir (zavihki). Nov razdelek = nov vnos tukaj + komponenta. */
const ZAVIHKI = [
  { id: "podatki", ime: "Podatki", icon: IdCard, hint: "Osnovni podatki zaposlenega" },
  { id: "organizacija", ime: "Oddelek in vodja", icon: Network, hint: "Oddelek, vodja in podrejeni zaposleni" },
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
  const router = useRouter();

  if (napaka) return <PraznoStanje ton="napaka" icon={AlertTriangle} naslov="Zaposlenega ni mogoče prebrati" opis={napaka} />;
  if (!podatki) return <div className="fos-glass h-48 animate-pulse rounded-[24px]" aria-label="Nalagam zaposlenega" />;

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
  return <Urejanje key={JSON.stringify(vnosIz(z))} z={z} podatki={podatki} />;
}

type UrejanjeProps = { vnos: ZaposleniVnos; nastavi: (p: Partial<ZaposleniVnos>) => void; ureja: boolean };

/** Vsebina lista z osnutkom sprememb: polja so urejljiva (razen ID), shrani se prek spodnje vrstice (SaveBar). */
function Urejanje({ z, podatki }: { z: Zaposleni; podatki: ZaposleniPodatki }) {
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
  const sprememb = (Object.keys(prej) as (keyof ZaposleniVnos)[]).filter((k) => JSON.stringify(prej[k]) !== JSON.stringify(vnos[k])).length;

  const shrani = async () => {
    const n = preveriVnos(vnos);
    if (n) return obvesti(n, "napaka");
    setShranjujem(true);
    try {
      await shraniZaposlenega(z.id, vnos, prej);
      obvesti(`Shranjeno: ${vnos.ime.trim()} ${vnos.priimek.trim()}.`);
    } catch (e) {
      obvesti((e as Error).message, "napaka");
      setShranjujem(false);
    }
  };

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
          {zavihek === "podatki" && <Podatki z={z} vnos={vnos} nastavi={nastavi} ureja={ureja} />}
          {zavihek === "organizacija" && <Organizacija z={z} vnos={vnos} nastavi={nastavi} ureja={ureja} podrejeni={podrejeni} podatki={podatki} />}
          {zavihek === "dostopi" && <Dostopi z={z} vnos={vnos} nastavi={nastavi} ureja={ureja} aplikacije={podatki.aplikacije} />}
          {zavihek === "nastavitve" && <Nastavitve z={z} vnos={vnos} nastavi={nastavi} ureja={ureja} />}
        </motion.div>
      </AnimatePresence>

      <SaveBar sprememb={sprememb} shranjujem={shranjujem} onShrani={shrani} onPreklici={() => setVnos(prej)} />
    </>
  );
}

function Podatki({ z, vnos, nastavi, ureja }: { z: Zaposleni } & UrejanjeProps) {
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
    </section>
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

/** Nastavitve zaposlenega: na vrhu dostop (Super Admin), nato ostale nastavitve. */
function Nastavitve({ z, vnos, nastavi, ureja }: { z: Zaposleni } & UrejanjeProps) {
  const imaRacun = z.id_uporabnika != null || (vnos.email.trim() !== "" && vnos.geslo !== "");
  return (
    <section className="flex flex-col gap-4">
      <NaslovRazdelka>Dostop</NaslovRazdelka>
      <div className={`fos-glass flex flex-col gap-3 rounded-[18px] p-4 sm:p-5 ${vnos.super_admin ? "border-fines-400/50 shadow-[0_0_40px_-18px_rgb(238_122_58/0.8)]" : ""}`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${vnos.super_admin ? "fos-fines-fill text-snow" : "bg-white/[0.06] text-ink-400"}`}>
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col">
            <span className="font-display text-lg font-bold text-white">Super Admin</span>
            <span className="text-sm text-ink-400">Dostop do FIN:OS Administracije z e-mailom ali uporabniškim imenom in geslom tega zaposlenega.</span>
          </div>
          <div className="w-full sm:w-56">
            <Stikalo
              vklop={vnos.super_admin}
              onChange={(v) => nastavi({ super_admin: v })}
              hint={vnos.super_admin ? "Odvzemi dostop do FIN:OS Administracije" : "Dovoli dostop do FIN:OS Administracije"}
              disabled={!ureja || (!imaRacun && !vnos.super_admin)}
            >
              {vnos.super_admin ? "Vklopljen" : "Izklopljen"}
            </Stikalo>
          </div>
        </div>
        {!imaRacun && (
          <p className="text-xs text-warn-500">Zaposleni še nima računa - najprej v razdelku Podatki vpiši e-mail in geslo (Prijava v FIN:ME).</p>
        )}
      </div>

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
      <NaslovRazdelka desno={<span className="text-xs tabular-nums text-ink-400">{vnos.aplikacije.length + (vnos.super_admin ? 1 : 0)}</span>}>Aplikacije</NaslovRazdelka>
      <div className="fos-glass flex flex-col gap-3 rounded-[18px] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* FIN:OS: dostop samo prek Super Admina (Nastavitve) */}
          <div
            title="Dostop do FIN:OS Administracije ureja stikalo Super Admin v Nastavitvah"
            className={`flex flex-col gap-1 rounded-[14px] border p-3 ${vnos.super_admin ? "border-fines-400/50 bg-fines-500/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Znak pripona="OS" className="text-sm" /> Administracija
            </span>
            <span className="text-xs text-ink-400">{vnos.super_admin ? "Dostop: Super Admin" : "Brez dostopa - vklopi Super Admin v Nastavitvah"}</span>
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
