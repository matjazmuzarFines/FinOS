"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, UserRoundPlus, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Izbira, POLJE, PoljeNaslov, Stikalo } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { GESLO_MIN } from "@/lib/prijavaZaposlenega";
import { dodajZaposlenega, polnoIme, preveriVnos, PRAZEN_VNOS, type ZaposleniPodatki, type ZaposleniVnos } from "@/lib/zaposleni";

type PoljaProps = {
  vnos: ZaposleniVnos;
  nastavi: (p: Partial<ZaposleniVnos>) => void;
  /** false = samo ogled (brez pravice do urejanja). */
  ureja: boolean;
};

/** Osebni podatki: ime, priimek, številka kartice. */
export function PoljaOsebe({ vnos, nastavi, ureja }: PoljaProps) {
  return (
    <>
      <PoljeNaslov naslov="Ime *">
        <input value={vnos.ime} onChange={(e) => nastavi({ ime: e.target.value })} readOnly={!ureja} required title="Ime zaposlenega" className={POLJE} autoComplete="off" />
      </PoljeNaslov>
      <PoljeNaslov naslov="Priimek *">
        <input value={vnos.priimek} onChange={(e) => nastavi({ priimek: e.target.value })} readOnly={!ureja} required title="Priimek zaposlenega" className={POLJE} autoComplete="off" />
      </PoljeNaslov>
      <PoljeNaslov naslov="Številka kartice">
        <input
          value={vnos.st_kartice}
          onChange={(e) => nastavi({ st_kartice: e.target.value })}
          readOnly={!ureja}
          title="Številka kartice zaposlenega (lahko prazno)"
          className={`${POLJE} font-mono`}
          autoComplete="off"
          inputMode="numeric"
        />
      </PoljeNaslov>
    </>
  );
}

/**
 * Prijava v FIN:ME: e-mail, uporabniško ime, novo geslo. Geslo se nikoli ne prikaže (shrani se samo v Supabase Auth);
 * prazno polje = geslo ostane. Račun se ustvari, ko sta vpisana e-mail in geslo.
 */
export function PoljaPrijave({ vnos, nastavi, ureja, imaRacun }: PoljaProps & { imaRacun: boolean }) {
  const [pokazi, setPokazi] = useState(false);
  return (
    <>
      <PoljeNaslov naslov="E-mail">
        <input type="email" value={vnos.email} onChange={(e) => nastavi({ email: e.target.value })} readOnly={!ureja} title="E-mail zaposlenega za prijavo v FIN:ME" className={POLJE} autoComplete="off" />
      </PoljeNaslov>
      <PoljeNaslov naslov="Uporabniško ime">
        <input
          value={vnos.uporabnisko_ime}
          onChange={(e) => nastavi({ uporabnisko_ime: e.target.value.toLowerCase() })}
          readOnly={!ureja}
          title="Uporabniško ime za prijavo (male črke, brez presledkov)"
          className={POLJE}
          autoComplete="off"
          autoCapitalize="none"
        />
      </PoljeNaslov>
      <PoljeNaslov naslov={imaRacun ? "Novo geslo" : "Geslo"}>
        <div className="relative">
          <input
            type={pokazi ? "text" : "password"}
            value={vnos.geslo}
            onChange={(e) => nastavi({ geslo: e.target.value })}
            readOnly={!ureja}
            placeholder={imaRacun ? "Brez spremembe" : `Vsaj ${GESLO_MIN} znakov`}
            title={imaRacun ? "Vpiši novo geslo samo, če ga želiš zamenjati" : "Geslo za prijavo v FIN:ME"}
            className={`${POLJE} pr-10`}
            autoComplete="new-password"
          />
          <button
            type="button"
            title={pokazi ? "Skrij vpisano geslo" : "Pokaži vpisano geslo"}
            aria-label={pokazi ? "Skrij vpisano geslo" : "Pokaži vpisano geslo"}
            onClick={() => setPokazi(!pokazi)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-400 transition-colors hover:text-fines-300"
          >
            {pokazi ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </PoljeNaslov>
      <PoljeNaslov naslov="Račun FIN:ME">
        <span
          title={imaRacun ? "Zaposleni se lahko prijavi v FIN:ME" : "Račun se ustvari, ko vpišeš e-mail in geslo"}
          className={`flex h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold sm:h-10 ${
            imaRacun ? "border-ok-500/40 bg-ok-500/10 text-ok-500" : "border-white/10 bg-white/[0.04] text-ink-400"
          }`}
        >
          <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
          {imaRacun ? "Račun ustvarjen" : "Ni računa"}
        </span>
      </PoljeNaslov>
    </>
  );
}

/** Organizacija: oddelek, vodja, ali je zaposleni sam vodja. `idZaposlenega` izloči samega sebe iz vodij. */
export function PoljaOrganizacije({ vnos, nastavi, ureja, podatki, idZaposlenega }: PoljaProps & { podatki: ZaposleniPodatki; idZaposlenega?: number }) {
  const vodje = podatki.vodje.filter((v) => v.zaposleni.id !== idZaposlenega).map((v) => ({ id: v.id, ime: polnoIme(v.zaposleni) }));
  const imaPodrejene = idZaposlenega != null && podatki.zaposleni.some((z) => z.vodja?.id === idZaposlenega);
  return (
    <>
      <PoljeNaslov naslov="Oddelek">
        <Izbira
          value={vnos.id_oddelek}
          onChange={(v) => nastavi({ id_oddelek: v })}
          moznosti={podatki.oddelki.map((o) => ({ id: o.id, ime: o.ime_oddelka }))}
          prazno="Brez oddelka"
          hint="Oddelek, v katerem dela zaposleni"
          disabled={!ureja}
        />
      </PoljeNaslov>
      <PoljeNaslov naslov="Vodja">
        <Izbira value={vnos.id_vodja} onChange={(v) => nastavi({ id_vodja: v })} moznosti={vodje} prazno="Brez vodje" hint="Neposredni vodja zaposlenega" disabled={!ureja} />
      </PoljeNaslov>
      <PoljeNaslov naslov="Vloga">
        <Stikalo
          vklop={vnos.je_vodja}
          onChange={(v) => nastavi({ je_vodja: v })}
          hint={imaPodrejene && vnos.je_vodja ? "Vodja ima podrejene - najprej jim določi drugega vodjo" : "Zaposleni je vodja (izbere se ga lahko drugim)"}
          disabled={!ureja || (imaPodrejene && vnos.je_vodja)}
        >
          Je vodja
        </Stikalo>
      </PoljeNaslov>
    </>
  );
}

type DodajProps = {
  open: boolean;
  onClose: () => void;
  podatki: ZaposleniPodatki;
  /** Začetne vrednosti (npr. vodja iz hierarhije). */
  zacetno?: Partial<ZaposleniVnos>;
  /** false = po shranjevanju ostani na strani (hierarhija), sicer odpri list novega zaposlenega. */
  odpriList?: boolean;
  /** Naslov okna (privzeto "Dodaj zaposlenega"). */
  naslov?: string;
};

/** Okno "Dodaj zaposlenega": vsi podatki naenkrat, Shrani (zelen) v nogi; po shranjevanju odpre list. */
export function DodajZaposlenega({ open, onClose, podatki, zacetno, odpriList = true, naslov = "Dodaj zaposlenega" }: DodajProps) {
  const router = useRouter();
  const prazno = { ...PRAZEN_VNOS, ...zacetno };
  const [vnos, setVnos] = useState<ZaposleniVnos>(prazno);
  const [napaka, setNapaka] = useState<string | null>(null);
  const [shranjujem, setShranjujem] = useState(false);
  const nastavi = (p: Partial<ZaposleniVnos>) => {
    setVnos((v) => ({ ...v, ...p }));
    setNapaka(null);
  };

  const zapri = () => {
    setVnos(prazno);
    setNapaka(null);
    onClose();
  };

  const shrani = async () => {
    const n = preveriVnos(vnos);
    if (n) return setNapaka(n);
    setNapaka(null);
    setShranjujem(true);
    try {
      const id = await dodajZaposlenega(vnos);
      obvesti(`Dodan zaposleni ${vnos.ime.trim()} ${vnos.priimek.trim()}.`);
      zapri();
      if (odpriList) router.push(`/administracija/zaposleni/${id}`);
    } catch (e) {
      setNapaka((e as Error).message);
    } finally {
      setShranjujem(false);
    }
  };

  return (
    <Modal
      open={open}
      title={naslov}
      onClose={zapri}
      noga={
        <>
          <Button hint="Zapri okno brez shranjevanja" variant="neutral" icon={X} onClick={zapri} disabled={shranjujem}>
            Prekliči
          </Button>
          <Button hint="Shrani novega zaposlenega v bazo" variant="success" icon={UserRoundPlus} onClick={shrani} disabled={shranjujem}>
            {shranjujem ? "Shranjujem ..." : "Shrani"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          shrani();
        }}
      >
        <PoljaOsebe vnos={vnos} nastavi={nastavi} ureja />
        <PoljaOrganizacije vnos={vnos} nastavi={nastavi} ureja podatki={podatki} />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-fines-400 sm:col-span-2">Prijava v FIN:ME (neobvezno)</p>
        <PoljaPrijave vnos={vnos} nastavi={nastavi} ureja imaRacun={false} />
        {napaka && (
          <p className="flex items-center gap-2 rounded-[10px] border border-nok-500/40 bg-nok-500/10 px-3 py-2 text-sm text-nok-500 sm:col-span-2">
            <XCircle className="h-4 w-4 shrink-0" aria-hidden />
            {napaka}
          </p>
        )}
        <p className="text-xs text-ink-500 sm:col-span-2">* obvezno polje</p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
