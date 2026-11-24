import { Suspense } from "react";
import { DnevnikKrmilnikov } from "@/components/cas/DnevnikKrmilnikov";

export default function DnevnikKrmilnikovStran() {
  return (
    <Suspense>
      <DnevnikKrmilnikov />
    </Suspense>
  );
}
