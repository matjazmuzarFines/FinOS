import { Suspense } from "react";
import { PraviceDostopi } from "@/components/admin/PraviceDostopi";

export default function PraviceStran() {
  return (
    <Suspense>
      <PraviceDostopi />
    </Suspense>
  );
}
