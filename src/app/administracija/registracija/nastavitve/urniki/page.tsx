import { Suspense } from "react";
import { Urniki } from "@/components/cas/Urniki";

export default function UrnikiStran() {
  return (
    <Suspense>
      <Urniki />
    </Suspense>
  );
}
