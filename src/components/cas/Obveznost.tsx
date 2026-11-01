"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Hourglass } from "lucide-react";
import { GlavaStrani } from "@/components/ui/GlavaStrani";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { SaveBar } from "@/components/ui/SaveBar";
import { obvesti } from "@/components/ui/Obvestila";
import { fmtTrajanje, izUr } from "@/lib/cas";
import { shraniObveznost, useCasNastavitve, type Urnik } from "@/lib/casNastavitve";
import { TestniPodatki } from "./Skupno";

const DROBTINE = [
  { naslov: "FIN:OS", href: "/" },
  { naslov: "Administracija", href: "/administracija" },
  { naslov: "Registracija časa", href: "/administracija/registracija" },
  { naslov: "Nastavitve", href: "/administracija/registracija/nastavitve" },
  { naslov: "Delovna obveznost" },
];

const kljuc = (u: number, d: number) => `${u}:${d}`;

/**
 * Delovna obveznost urnikov: za vsak urnik ure po dnevih (Pon ... Ned, Praz). Dnevni saldo = knjiženo delo - obveznost.
 * 0 = prost dan (na koledarju črtkan). Celica: "8", "8:00", "7:30" ali "7,5"; spremenjena rumena, napačna rdeča -> SaveBar.
 */
export function Obveznost() {
  const n = useCasNastavitve();
  const urniki = n.urniki.filter((u) => u.visible);
  const [osnutek, setOsnutek] = useState<Record<string, string>>({});
  const [shranjujem, setShranjujem] = useState(false);

  const izvorno = (u: Urnik, d: number) => u.obveznost[d] ?? 0;
  const besedilo = (u: Urnik, d: number) => osnutek[kljuc(u.id, d)] ?? fmtTrajanje(izvorno(u, d), true);
  const minute = (u: Urnik, d: number) => izUr(besedilo(u, d));
  // napačna vrednost šteje kot sprememba (pokaže se SaveBar, Shrani javi napako)
  const spremenjena = (u: Urnik, d: number) => kljuc(u.id, d) in osnutek && minute(u, d) !== izvorno(u, d);
  const sprememb = urniki.reduce((v, u) => v + n.dnevi.filter((d) => spremenjena(u, d.id)).length, 0);
  const napak = urniki.reduce((v, u) => v + n.dnevi.filter((d) => minute(u, d.id) == null).length, 0);

  const shrani = async () => {
    if (napak) return obvesti("Popravi rdeče označene celice (npr. 8, 8:00 ali 7:30).", "napaka");
    const spremembe = urniki
      .filter((u) => n.dnevi.some((d) => spremenjena(u, d.id)))
      .map((u) => ({ id_urnika: u.id, obveznost: Object.fromEntries(n.dnevi.map((d) => [d.id, minute(u, d.id)!])) }));
    setShranjujem(true);
    try {
      await shraniObveznost(spremembe);
      setOsnutek({});
      obvesti("Delovna obveznost je shranjena.");
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };

  return (
    <>
      <GlavaStrani
        drobtine={DROBTINE}
        naslov="Delovna obveznost"
        opis="Koliko ur mora zaposleni v urniku opraviti na posamezen dan. Iz tega se izračuna dnevni saldo: presežek ali manjko ur. 0 = prost dan."
        akcije={n.virPravil === "test" && <TestniPodatki opis={`Obveznosti v bazi še ni (zaženi migracijo 011): ${n.napakaPravil ?? ""}. Spremembe veljajo samo v tem brskalniku do osvežitve.`} />}
      />

      {n.virUrnikov === "nalagam" ? (
        <div className="fos-glass h-72 animate-pulse rounded-[20px]" aria-label="Nalagam urnike" />
      ) : !urniki.length ? (
        <PraznoStanje icon={Hourglass} naslov="Ni urnikov" opis="Najprej dodaj urnik v Nastavitve -> Urniki." />
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 26 }}
          className="fos-glass overflow-hidden rounded-[20px]"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="bg-ink-800/80 text-[11px] font-bold uppercase tracking-wider text-ink-300">
                  <th className="px-4 py-3 text-left">Urnik</th>
                  {n.dnevi.map((d) => (
                    <th key={d.id} className={`px-1.5 py-3 text-center ${d.iso == null || d.iso >= 6 ? "text-ink-500" : ""}`} title={d.ime}>
                      {d.kratko}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right" title="Seštevek ponedeljek - nedelja (brez praznikov)">
                    Teden
                  </th>
                </tr>
              </thead>
              <tbody>
                {urniki.map((u, i) => {
                  const teden = n.dnevi.filter((d) => d.iso != null).reduce((v, d) => v + (minute(u, d.id) ?? 0), 0);
                  const oseb = n.zaposleniUrniki.filter((z) => z.id_urnika === u.id).length;
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.04 }}
                      className="border-t border-white/[0.06] transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-2.5">
                        <span className="flex flex-col">
                          <span className="font-semibold text-white">{u.ime}</span>
                          <span className="text-[11px] text-ink-500">{oseb} oseb</span>
                        </span>
                      </td>
                      {n.dnevi.map((d) => {
                        const min = minute(u, d.id);
                        const sprem = spremenjena(u, d.id);
                        return (
                          <td key={d.id} className="px-1 py-2.5 text-center">
                            <input
                              value={besedilo(u, d.id)}
                              inputMode="decimal"
                              onChange={(e) => setOsnutek((o) => ({ ...o, [kljuc(u.id, d.id)]: e.target.value }))}
                              onBlur={() => min != null && setOsnutek((o) => (kljuc(u.id, d.id) in o ? { ...o, [kljuc(u.id, d.id)]: fmtTrajanje(min, true) } : o))}
                              title={`${u.ime} - ${d.ime}: obveznost v urah (npr. 8, 8:00, 7:30); 0 = prost dan`}
                              aria-label={`Obveznost ${u.ime}, ${d.ime}`}
                              className={`h-9 w-16 rounded-[9px] border bg-white/[0.04] text-center font-display text-sm font-bold tabular-nums outline-none transition-all focus:border-fines-400 focus:shadow-[0_0_0_3px_rgb(238_122_58/0.2)] ${
                                min == null
                                  ? "border-nok-500/70 text-nok-500"
                                  : sprem
                                    ? "border-warn-500/70 text-white shadow-[0_0_0_2px_rgb(245_158_11/0.25)]"
                                    : min === 0
                                      ? "border-white/[0.06] text-ink-600"
                                      : "border-white/10 text-white"
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right font-display font-bold tabular-nums text-fines-300">{fmtTrajanje(teden, true)} h</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/[0.06] px-4 py-3 text-xs text-ink-500">
            Praz = obveznost na dela prost dan (praznik) ne glede na dan v tednu. Presežek in manjko dneva štejeta v saldo; kako se presežek prizna (zaokroževanje), določi interval prihoda.
          </p>
        </motion.section>
      )}

      <SaveBar sprememb={sprememb} shranjujem={shranjujem} onShrani={shrani} onPreklici={() => setOsnutek({})} />
    </>
  );
}
