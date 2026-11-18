import { Suspense } from "react";
import type { Metadata } from "next";
import { SceneDemo } from "@/components/tv/scene/SceneDemo";

export const metadata: Metadata = { title: "FIN:TV · scene" };

/** Preizkus animiranih scen FIN:TV s testnimi podatki (brez prijave, kot /tv). ?obrazi=1 = vsa počutja Fineseka. */
export default function SceneDemoPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <SceneDemo />
    </Suspense>
  );
}
