/** Prijavni podatki zaposlenega (FIN:ME) - skupna pravila za obrazec in strežnik. */
export type PrijavaVnos = { email: string | null; uporabnisko_ime: string | null; geslo?: string | null };

export const GESLO_MIN = 8;
const UPORABNISKO_IME = /^[a-z0-9._-]{3,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Počisti in preveri vnos; vrne počiščene vrednosti ali besedilo napake. */
export function preveriPrijavo(v: PrijavaVnos): { email: string | null; uporabnisko_ime: string | null; geslo: string | null } | string {
  const email = v.email?.trim().toLowerCase() || null;
  const uporabnisko_ime = v.uporabnisko_ime?.trim().toLowerCase() || null;
  const geslo = v.geslo || null;
  if (email && !EMAIL.test(email)) return "E-mail ni pravilen.";
  if (uporabnisko_ime && !UPORABNISKO_IME.test(uporabnisko_ime)) return "Uporabniško ime: 3-40 znakov, samo črke a-z, številke, pika, pomišljaj, podčrtaj.";
  if (geslo && geslo.length < GESLO_MIN) return `Geslo mora imeti vsaj ${GESLO_MIN} znakov.`;
  return { email, uporabnisko_ime, geslo };
}
