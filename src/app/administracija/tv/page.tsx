import { Suspense } from "react";
import { FinTv } from "@/components/tv/FinTv";

export default function FinTvStran() {
  return (
    <Suspense>
      <FinTv />
    </Suspense>
  );
}
