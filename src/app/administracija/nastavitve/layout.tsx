import type { ReactNode } from "react";
import { SekcijaZMenijem } from "@/components/admin/MeniSekcije";

/** Sekcija z mrežo nastavitev: meni levo na tej strani in vseh podstraneh (SEKCIJE v nav.ts). */
export default function Layout({ children }: { children: ReactNode }) {
  return <SekcijaZMenijem>{children}</SekcijaZMenijem>;
}
