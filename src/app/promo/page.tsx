"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MotionGlobalConfig } from "motion/react";
import { ID_PROMO, PromoPredvajalnik } from "@/components/promo/Promo";

/**
 * /promo - teaser "Moj Fines" (42 s). Izmišljeni podatki: klici baze (/rest/v1/) vrnejo napako, zato vse dela s
 * testnimi podatki (Matej Novak, Ana Kovač). ?render=1 = sličico postavi skripta (scripts/promo/posnemi.py).
 */
if (typeof window !== "undefined") {
  const w = window as unknown as { _promo?: boolean };
  if (!w._promo) {
    w._promo = true;
    const f = window.fetch.bind(window);
    window.fetch = (u, o) => (String(u).includes("/rest/v1/") ? Promise.resolve(new Response('{"message":"promo"}', { status: 500 })) : f(u, o));
    try {
      localStorage.setItem("fos_finme_test", JSON.stringify({ [ID_PROMO]: { virtualno_belezenje: true } }));
      localStorage.removeItem("fos_zahtevki_test");
      localStorage.setItem("fos-animacije", "on");
    } catch {}
    // motion: brez lastnih (časovno neodvisnih) animacij - vse gibanje v videu računa čas t
    MotionGlobalConfig.skipAnimations = true;
  }
}

function Vsebina() {
  return <PromoPredvajalnik render={useSearchParams().get("render") === "1"} />;
}

export default function PromoStran() {
  return (
    <>
      <style>{`
        .promo h2 b { background: var(--fos-grad-fines); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 24px rgb(238 122 58 / 0.35)); }
        .promo [data-testni] { display: none !important; }
      `}</style>
      <Suspense>
        <Vsebina />
      </Suspense>
    </>
  );
}
