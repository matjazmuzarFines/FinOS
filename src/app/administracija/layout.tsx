import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Okvir } from "@/components/Okvir";
import { Zaklep } from "@/components/Seja";
import { IskanjeAdmin } from "@/components/admin/IskanjeAdmin";

export const metadata: Metadata = { title: "Administracija | FIN:OS" };

export default function AdministracijaLayout({ children }: { children: ReactNode }) {
  // Prijava je ena (domača stran FIN:OS); Administracija sme samo Super Admin
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
