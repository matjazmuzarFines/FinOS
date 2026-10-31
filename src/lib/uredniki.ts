/**
 * Dostop do Administracije ima Super Admin (funkcija, Nastavitve -> Pravice in dostopi, 008_funkcije.sql).
 * NEXT_PUBLIC_FOS_UREDNIKI (e-maili z vejico, .env.local in Vercel - ne v kodi) je ZASILNI seznam, da se
 * ne zaklenemo ven (npr. fines@fines.si).
 * Uporablja se v brskalniku (Zaklep, useLahkoUreja) in na strežniku (API za račune zaposlenih).
 */
const UREDNIKI = (process.env.NEXT_PUBLIC_FOS_UREDNIKI ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const jeUrednik = (email: string | null | undefined) => !!email && UREDNIKI.includes(email.toLowerCase());

/** false = NEXT_PUBLIC_FOS_UREDNIKI ni nastavljen (npr. manjka na Vercelu) - nihče nima dostopa. */
export const urednikiNastavljeni = UREDNIKI.length > 0;
