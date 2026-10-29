"use client";

import { useSeja } from "@/components/Seja";
import { jeUrednik } from "./uredniki";

/** true = prijavljen uporabnik sme urejati podatke (glej uredniki.ts). */
export function useLahkoUreja(): boolean {
  return jeUrednik(useSeja()?.user.email);
}
