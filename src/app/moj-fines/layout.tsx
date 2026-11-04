import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Okvir } from "@/components/Okvir";
import { Zaklep } from "@/components/Seja";
import { JazOkvir } from "@/components/me/Jaz";

export const metadata: Metadata = { title: "Moj Fines | FIN:ME" };

export default function MojFinesLayout({ children }: { children: ReactNode }) {
  // FIN:ME: prijava z e-mailom / uporabniškim imenom zaposlenega; kdo je kdo in kaj vidi (hierarhija) ugotovi JazOkvir
  return (
    <Okvir>
      <Zaklep naslov="Moj Fines" pripona="ME" samoPrijava>
        <JazOkvir>{children}</JazOkvir>
      </Zaklep>
    </Okvir>
  );
}
