import { Suspense } from "react";
import type { Metadata } from "next";
import { TvStran } from "@/components/tv/TvStran";

export const metadata: Metadata = { title: "FIN:TV" };

/** Predvajalnik FIN:TV (računalnik ob TV-ju: /tv?k=KLJUČ, predogled: /tv?seznam=ID). Brez glave in prijave. */
export default function TvPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <TvStran />
    </Suspense>
  );
}
