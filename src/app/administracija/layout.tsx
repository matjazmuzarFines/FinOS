import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Okvir } from "@/components/Okvir";
import { Zaklep } from "@/components/Seja";
import { IskanjeAdmin } from "@/components/admin/IskanjeAdmin";

export const metadata: Metadata = { title: "Administracija | FIN:OS" };

export default function AdministracijaLayout({ children }: { children: ReactNode }) {
  // FIN:OS (domača stran) je brez prijave, Administracija zahteva prijavo
  return (
    <Okvir>
      <Zaklep naslov="Administracija">
        {children}
        {/* Ctrl+K - iskanje po vsej Administraciji */}
        <IskanjeAdmin />
      </Zaklep>
    </Okvir>
  );
}
