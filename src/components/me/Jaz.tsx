"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { AlertTriangle, Eye, LogOut, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Izbira } from "@/components/ui/Polje";
import { PraznoStanje } from "@/components/ui/PraznoStanje";
import { odjava, useDostopStanje, useSeja } from "@/components/Seja";
import { useTestniPogled } from "@/lib/testniPogled";
import { hierarhija, polnoIme, primerjajImena, useZaposleni, type Zaposleni, type ZaposleniPodatki } from "@/lib/zaposleni";

/**
 * Kdo je prijavljen v FIN:ME (Moj Fines): zaposleni, povezan z računom (fos_zaposleni.id_uporabnika), in njegova ekipa
 * = vsi (posredni) podrejeni iz hierarhije FIN:OS. Vodja = ima vsaj enega podrejenega.
 * Super Admin (in zasilni račun) lahko FIN:ME pogleda kot kateri koli zaposleni ("Ogled kot" - za preizkus), izbira
 * se zapomni v brskalniku.
 */
export type Jaz = {
  jaz: Zaposleni;
  podatki: ZaposleniPodatki;
  /** Vsi (posredni) podrejeni, po priimku. */
  ekipa: Zaposleni[];
  vodja: boolean;
  /** Super Admin gleda kot drug zaposleni. */
  ogled: boolean;
};

const JazKontekst = createContext<Jaz | null>(null);

export function useJaz(): Jaz {
  const j = useContext(JazKontekst);
  if (!j) throw new Error("useJaz zunaj JazOkvir");
  return j;
}

// "Ogled kot" (samo Super Admin) - localStorage
const KLJUC = "fos_me_kot";
const poslusalci = new Set<() => void>();
const beriKot = () => {
  try {
    return Number(localStorage.getItem(KLJUC)) || null;
  } catch {
    return null;
  }
};
const nastaviKot = (id: number | null) => {
  try {
    if (id == null) localStorage.removeItem(KLJUC);
    else localStorage.setItem(KLJUC, String(id));
  } catch {}
  poslusalci.forEach((p) => p());
};
const useKot = () =>
  useSyncExternalStore(
    (p) => {
      poslusalci.add(p);
      return () => poslusalci.delete(p);
    },
    beriKot,
    () => null,
  );

export function JazOkvir({ children }: { children: ReactNode }) {
  const seja = useSeja();
  const dostop = useDostopStanje();
  const { podatki, napaka } = useZaposleni();
  const kot = useKot();
  const admin = dostop === true;
  // testni pogled (ikona epruvete v glavi); Super Admin brez lastnega zaposlenega ga potrebuje vedno
  const testni = useTestniPogled();

  const moj = podatki?.zaposleni.find((z) => z.id_uporabnika === seja?.user.id) ?? null;
  const ogledKot = admin && (testni || !moj);
  const izbran = ogledKot && kot != null ? (podatki?.poId.get(kot) ?? null) : null;
  const jaz = izbran ?? moj;
  const ekipa = useMemo(() => {
    if (!podatki || !jaz) return [];
    const ids = hierarhija(podatki.zaposleni).potomci(jaz.id);
    return podatki.zaposleni.filter((z) => ids.has(z.id)).sort(primerjajImena);
  }, [podatki, jaz]);

  if (napaka) return <PraznoStanje icon={AlertTriangle} ton="napaka" naslov="Podatkov ni bilo mogoče naložiti" opis={napaka} />;
  if (!podatki || dostop === undefined) return <div className="fos-glass h-72 animate-pulse rounded-[24px]" aria-label="Nalagam" />;

  const izbira = ogledKot && (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-sm text-warn-500">
      <Eye className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-semibold">Ogled kot</span>
      <div className="min-w-[14rem] flex-1 sm:max-w-xs">
        <Izbira
          value={jaz?.id ?? null}
          onChange={(id) => nastaviKot(id === moj?.id ? null : id)}
          moznosti={[...podatki.zaposleni].sort(primerjajImena).map((z) => ({ id: z.id, ime: `${z.priimek} ${z.ime}${z.id === moj?.id ? " (jaz)" : ""}` }))}
          prazno="Izberi zaposlenega ..."
          hint="Super Admin: poglej FIN:ME kot izbran zaposleni"
        />
      </div>
      <span className="text-xs text-warn-500/80">Testni pogled (samo Super Admin) - izklopiš ga z ikono epruvete zgoraj.</span>
    </div>
  );

  if (!jaz)
    return admin ? (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-6">
        {izbira}
        <PraznoStanje icon={Eye} naslov="Izberi zaposlenega" opis="Tvoj račun ni povezan z zaposlenim. Kot Super Admin lahko FIN:ME pogledaš kot kateri koli zaposleni." />
      </div>
    ) : (
      <div className="mx-auto w-full max-w-lg py-10">
        <PraznoStanje
          ton="napaka"
          icon={UserRoundX}
          naslov="Račun ni povezan z zaposlenim"
          opis={`Uporabnik ${seja?.user.email ?? ""} v FIN:OS ni povezan z nobenim zaposlenim (ali baza FIN:ME še ne dovoli branja - zaženi migracijo 020). Pokliči kadrovsko službo.`}
          akcija={
            <Button hint="Odjavi se iz Moj Fines" variant="primary" icon={LogOut} onClick={odjava}>
              Odjava
            </Button>
          }
        />
      </div>
    );

  return (
    <JazKontekst.Provider value={{ jaz, podatki, ekipa, vodja: ekipa.length > 0, ogled: !!izbran && izbran.id !== moj?.id }}>
      {izbira}
      {children}
    </JazKontekst.Provider>
  );
}

export const imeOsebe = (j: Jaz, id: number | null) => (id == null ? "" : id === j.jaz.id ? "ti" : j.podatki.poId.get(id) ? polnoIme(j.podatki.poId.get(id)!) : "neznan");
