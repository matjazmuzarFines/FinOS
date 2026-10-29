/**
 * Začasne pravice (dokler ni tabele dostopov): v Administracijo smejo in urejajo samo uporabniki iz
 * NEXT_PUBLIC_FOS_UREDNIKI (e-maili z vejico, .env.local in Vercel - ne v kodi). Za zdaj: fines@fines.si.
 * Uporablja se v brskalniku (Zaklep, useLahkoUreja) in na strežniku (API za račune zaposlenih).
 */
const UREDNIKI = (process.env.NEXT_PUBLIC_FOS_UREDNIKI ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const jeUrednik = (email: string | null | undefined) => !!email && UREDNIKI.includes(email.toLowerCase());
