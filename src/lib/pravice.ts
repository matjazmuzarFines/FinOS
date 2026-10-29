"use client";

import { useDostop } from "@/components/Seja";

/** true = prijavljen uporabnik sme urejati podatke (Super Admin ali zasilni seznam, glej uredniki.ts). */
export function useLahkoUreja(): boolean {
  return useDostop();
}
