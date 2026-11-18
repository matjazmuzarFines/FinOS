"use client";

import { useSearchParams } from "next/navigation";
import type { TvOkno, TvVir } from "@/lib/tv";
import { RAZPOLOZENJA, type Razpolozenje } from "@/lib/tvScene";
import { DEMO_DELO } from "@/lib/tvSceneDemo";
import { Oder } from "../Diapozitiv";
import { Predvajalnik } from "../Predvajalnik";
import { FinesekGlava } from "./FinesekGlava";

const VIR: TvVir = {
  id: -100,
  koda: "fp_delo_vceraj_m",
  ime: "Delo - prejšnji dan · Montaža",
  opis: "",
  aplikacija: "fp",
  ikona: "Gauge",
  vklopljen: true,
  objava: {
    strani: [],
    razmerja: [],
    podatki: [DEMO_DELO],
    izvor: "demo",
    created_at: "2026-11-18T06:00:00Z",
  },
};

const OKNO: TvOkno = {
  id: -100,
  id_seznama: -100,
  vrsta: "vir",
  naslov: "Delo - prejšnji dan · Montaža",
  vrstni_red: 1,
  trajanje_s: 15,
  prehod: "pojemanje",
  velja_od: null,
  velja_do: null,
  aktivno: true,
  datoteka: null,
  strani: [],
  vsebina: { uvod: true },
  id_vira: -100,
  visible: true,
};

const brezDatotek = () => undefined;

/** /tv/scena - predvajalnik s testno objavo (Delo - prejšnji dan · Montaža); ?obrazi=1 = mreža počutij. */
export function SceneDemo() {
  const obrazi = useSearchParams().get("obrazi");
  if (obrazi)
    return (
      <div className="fixed inset-0 bg-black">
        <Oder className="h-full w-full">
          <div className="absolute inset-0 grid grid-cols-3 place-items-center gap-6 bg-[radial-gradient(ellipse_at_top,#2b2b2f,#121214)] p-16 text-white">
            {(Object.keys(RAZPOLOZENJA) as Razpolozenje[]).map((r) => (
              <div key={r} className="flex flex-col items-center gap-4">
                <FinesekGlava razpolozenje={r} className="w-[520px]" />
                <span
                  className="font-display text-[44px] font-bold"
                  style={{ color: RAZPOLOZENJA[r].barva }}
                >
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
      <Predvajalnik
        okna={[OKNO]}
        viri={[VIR]}
        url={brezDatotek}
        className="h-full w-full"
      />
    </div>
  );
}
