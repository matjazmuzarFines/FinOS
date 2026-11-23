"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TvOkno, TvVir } from "@/lib/tv";
import { RAZPOLOZENJA, type Razpolozenje } from "@/lib/tvScene";
import { DEMO_DELO, demoMaterial, demoPlan, demoPrioritete, demoZakljuceni } from "@/lib/tvSceneDemo";
import { Oder } from "../Diapozitiv";
import { Predvajalnik } from "../Predvajalnik";
import { FinesekGlava } from "./FinesekGlava";

/** Testne komponente (?k=delo / zakljuceni / material / plan / pregled / prioritete; brez = vse po vrsti). */
const KOMPONENTE: { k: string; koda: string; ime: string; ikona: string; podatki: () => unknown }[] = [
  { k: "delo", koda: "fp_delo_vceraj_m", ime: "Delo - prejšnji dan · Montaža", ikona: "Gauge", podatki: () => DEMO_DELO },
  { k: "zakljuceni", koda: "fp_zakljuceni_krovni_m", ime: "Zaključeni krovni · Montaža", ikona: "Trophy", podatki: demoZakljuceni },
  { k: "material", koda: "fp_pripravljenost_mat_m", ime: "Pripravljenost materiala · Montaža", ikona: "PackageCheck", podatki: demoMaterial },
  { k: "plan", koda: "fp_plan_workflow_m", ime: "Delovni plan · Montaža", ikona: "Workflow", podatki: demoPlan },
  { k: "pregled", koda: "fp_plan_pregled_m", ime: "Delovni plan - pregled · Montaža", ikona: "CalendarRange", podatki: demoPlan },
  { k: "prioritete", koda: "fp_prioritete_krovnih_m", ime: "Prioritete krovnih · Montaža", ikona: "Truck", podatki: demoPrioritete },
];

const brezDatotek = () => undefined;

/** /tv/scena - predvajalnik s testnimi objavami vseh animiranih komponent; ?obrazi=1 = mreža počutij. */
export function SceneDemo() {
  const iskanje = useSearchParams();
  const obrazi = iskanje.get("obrazi");
  const k = iskanje.get("k");
  // samo v brskalniku (datumi testnih podatkov in ura - brez razlike strežnik / brskalnik)
  const [gor, setGor] = useState(false);
  useEffect(() => setGor(true), []);
  const { okna, viri } = useMemo(() => {
    const izbrane = KOMPONENTE.filter((x) => !k || x.k === k);
    const viri: TvVir[] = izbrane.map((x, i) => ({
      id: -100 - i,
      koda: x.koda,
      ime: x.ime,
      opis: "",
      aplikacija: "fp",
      ikona: x.ikona,
      vklopljen: true,
      objava: { strani: [], razmerja: [], podatki: [x.podatki()], izvor: "demo", created_at: "2026-11-18T06:00:00Z" },
    }));
    const okna: TvOkno[] = izbrane.map((x, i) => ({
      id: -100 - i,
      id_seznama: -100,
      vrsta: "vir",
      naslov: x.ime,
      vrstni_red: i + 1,
      trajanje_s: 15,
      prehod: "pojemanje",
      velja_od: null,
      velja_do: null,
      aktivno: true,
      datoteka: null,
      strani: [],
      vsebina: { uvod: true },
      id_vira: -100 - i,
      visible: true,
    }));
    return { okna, viri };
  }, [k]);

  if (!gor) return <div className="fixed inset-0 bg-black" />;
  if (obrazi)
    return (
      <div className="fixed inset-0 bg-black">
        <Oder className="h-full w-full">
          <div className="absolute inset-0 grid grid-cols-3 place-items-center gap-6 bg-[radial-gradient(ellipse_at_top,#2b2b2f,#121214)] p-16 text-white">
            {(Object.keys(RAZPOLOZENJA) as Razpolozenje[]).map((r) => (
              <div key={r} className="flex flex-col items-center gap-4">
                <FinesekGlava razpolozenje={r} className="w-[520px]" />
                <span className="font-display text-[44px] font-bold" style={{ color: RAZPOLOZENJA[r].barva }}>
                  {RAZPOLOZENJA[r].ime}
                </span>
              </div>
            ))}
          </div>
        </Oder>
      </div>
    );
  return (
    <div className="fixed inset-0 bg-black">
      <Predvajalnik okna={okna} viri={viri} url={brezDatotek} className="h-full w-full" />
    </div>
  );
}
