"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, FileText, Image as IkonaSlike, LoaderCircle, Paperclip, Plus, Puzzle, Save, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { POLJE, Stikalo } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { PoljeObrazca } from "@/components/cas/Polja";
import {
  BARVE_OBVESTIL,
  dodajOkna,
  kopirajOkno,
  odstraniOkno,
  PREHODI,
  PRIVZETO_TRAJANJE,
  shraniOkno,
  urljiDatotek,
  VRSTE,
  type BarvaObvestila,
  type Obvestilo,
  type Prehod,
  imaUvod,
  obdobjaObjave,
  veljavneStrani,
  type ObjavaVira,
  type Prilagoditev,
  type PrilogaObvestila,
  type TvOkno,
  type TvVir,
} from "@/lib/tv";
import { prviDiapozitiv } from "@/lib/tvPredvajanje";
import { naloziZaTv, SPREJME } from "@/lib/tvNalozi";
import { Diapozitiv, IKONE_OBVESTIL, Oder } from "./Diapozitiv";

/** ISO -> vrednost polja datetime-local (lokalni čas) in nazaj. */
const vLokalno = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const izLokalno = (s: string) => (s ? new Date(s).toISOString() : null);

/** "4 str." ali pri objavi po tednih "5 tednov · danes 2 str." */
const opisStrani = (o: ObjavaVira) => {
  const n = obdobjaObjave(o);
  if (n <= 1 && !o.velja_od?.some(Boolean)) return `${o.strani.length} str.`;
  const tedni = n === 1 ? "1 teden" : n === 2 ? "2 tedna" : n <= 4 ? `${n} tedni` : `${n} tednov`;
  const danes = veljavneStrani(o, Date.now()).length;
  return `${tedni} · danes ${danes ? `${danes} str.` : "ni strani"}`;
};

type Osnutek = {
  naslov: string;
  trajanje: string;
  prehod: Prehod;
  prilagoditev: Prilagoditev;
  od: string;
  do: string;
  aktivno: boolean;
  uvod: boolean;
  obvestilo: Obvestilo;
  /** priloga obvestila */
  datoteka: string | null;
  strani: string[];
  razmerja: number[];
};

const iz = (o: TvOkno | null): Osnutek => ({
  naslov: o?.naslov ?? "",
  trajanje: String(o?.trajanje_s ?? PRIVZETO_TRAJANJE.obvestilo),
  prehod: o?.prehod ?? "pojemanje",
  prilagoditev: o?.vsebina.prilagoditev ?? (o?.vrsta === "pdf" ? "celo" : "zapolni"),
  od: vLokalno(o?.velja_od ?? null),
  do: vLokalno(o?.velja_do ?? null),
  aktivno: o?.aktivno ?? true,
  uvod: o ? imaUvod(o) : false,
  obvestilo: o?.vsebina.obvestilo ?? { naslov: "", besedilo: "", barva: "fines", ikona: "Megaphone" },
  datoteka: o?.datoteka ?? null,
  strani: o?.strani ?? [],
  razmerja: o?.vsebina.razmerja ?? [],
});

/**
 * Okno seznama (urejanje ali novo obvestilo): levo predogled (isti izris kot TV), desno nastavitve - naslov, trajanje,
 * prehod, prilagoditev slike, velja od-do, vklop; pri obvestilu besedilo, barva, ikona. Kopiraj na drug zaslon.
 */
export function OknoUredi({
  open,
  okno,
  idSeznama,
  url,
  viri,
  drugiSeznami,
  onClose,
}: {
  open: boolean;
  /** null = novo obvestilo */
  okno: TvOkno | null;
  idSeznama: number;
  url: (p: string) => string | undefined;
  viri: TvVir[];
  drugiSeznami: { id: number; ime: string }[];
  onClose: () => void;
}) {
  const vir = viri.find((v) => v.id === okno?.id_vira);
  const izbiraPriloge = useRef<HTMLInputElement>(null);
  const [nalagam, setNalagam] = useState<string | null>(null);
  // URL-ji novo naložene priloge (predogled pred shranjevanjem)
  const [noviUrlji, setNoviUrlji] = useState<Record<string, string>>({});
  const urlP = (p: string) => noviUrlji[p] ?? url(p);
  const [o, setO] = useState<Osnutek>(() => iz(okno));
  const [poskus, setPoskus] = useState(false);
  const [shranjujem, setShranjujem] = useState(false);
  const [kopijaV, setKopijaV] = useState<number | "">("");
  const vrsta = okno?.vrsta ?? "obvestilo";
  const nastavi = (p: Partial<Osnutek>) => setO((s) => ({ ...s, ...p }));
  const nastaviObv = (p: Partial<Obvestilo>) => setO((s) => ({ ...s, obvestilo: { ...s.obvestilo, ...p } }));

  const trajanje = Number(o.trajanje);
  const napake = {
    trajanje: vrsta === "video" ? undefined : !Number.isInteger(trajanje) || trajanje < 1 || trajanje > 3600 ? "Vpiši sekunde (1-3600)." : undefined,
    do: o.od && o.do && o.do <= o.od ? "Konec mora biti za začetkom." : undefined,
    naslov: vrsta === "obvestilo" && !o.obvestilo.naslov.trim() ? "Vpiši naslov obvestila." : undefined,
  };
  const prikazi = (n?: string) => (poskus ? n : undefined);

  const podatki = () => ({
    naslov: (vrsta === "obvestilo" ? o.naslov.trim() || o.obvestilo.naslov.trim() : o.naslov.trim()) || VRSTE[vrsta],
    trajanje_s: vrsta === "video" ? (okno?.trajanje_s ?? 10) : trajanje,
    prehod: o.prehod,
    velja_od: izLokalno(o.od),
    velja_do: izLokalno(o.do),
    aktivno: o.aktivno,
    ...(vrsta === "obvestilo" ? { datoteka: o.datoteka, strani: o.strani } : {}),
    vsebina:
      vrsta === "obvestilo"
        ? { obvestilo: { ...o.obvestilo, naslov: o.obvestilo.naslov.trim() }, uvod: o.uvod, ...(o.strani.length ? { razmerja: o.razmerja } : {}) }
        : { prilagoditev: o.prilagoditev, uvod: o.uvod, ...(okno?.vsebina.razmerja ? { razmerja: okno.vsebina.razmerja } : {}) },
  });

  // priloga obvestila: slika / video / PDF (desno zgoraj na TV-ju)
  const naloziPrilogo = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = await naloziZaTv(f, setNalagam);
      const poti = n.vrsta === "pdf" ? n.strani : [n.datoteka!];
      // predogled: URL po nalaganju (testno blob, sicer podpisan)
      const u = await urljiDatotek(poti.slice(0, 1));
      setNoviUrlji((s) => ({ ...s, ...u }));
      setO((s) => ({ ...s, datoteka: n.datoteka, strani: n.strani, razmerja: n.razmerja, obvestilo: { ...s.obvestilo, priloga: n.vrsta as PrilogaObvestila } }));
    } catch (e) {
      obvesti(`${f.name}: ${(e as Error).message}`, "napaka");
    } finally {
      setNalagam(null);
    }
  };
  const brezPriloge = () => setO((s) => ({ ...s, datoteka: null, strani: [], razmerja: [], obvestilo: { ...s.obvestilo, priloga: null } }));

  const shrani = async () => {
    setPoskus(true);
    if (Object.values(napake).some(Boolean)) return obvesti("Popravi rdeče označena polja.", "napaka");
    setShranjujem(true);
    try {
      if (okno) await shraniOkno(okno.id, podatki());
      else await dodajOkna([{ id_seznama: idSeznama, vrsta: "obvestilo", datoteka: o.datoteka, strani: o.strani, ...podatki() }]);
      obvesti(okno ? "Okno je shranjeno - TV-ji ga prevzamejo v 20 s." : "Obvestilo je dodano.");
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    } finally {
      setShranjujem(false);
    }
  };
  const odstrani = async () => {
    if (!okno || !confirm(`Odstranim "${okno.naslov}" s seznama?`)) return;
    try {
      await odstraniOkno(okno.id);
      obvesti("Okno je odstranjeno.");
      onClose();
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };
  const kopiraj = async () => {
    if (!okno || kopijaV === "") return;
    try {
      await kopirajOkno({ ...okno, ...podatki() }, kopijaV);
      obvesti(`Kopija je dodana na konec: ${drugiSeznami.find((s) => s.id === kopijaV)?.ime}.`);
      setKopijaV("");
    } catch (e) {
      obvesti((e as Error).message, "napaka");
    }
  };

  // predogled iz osnutka (obvestilo se riše sproti)
  const predogled: TvOkno = {
    ...(okno ?? { id: 0, id_seznama: idSeznama, vrsta: "obvestilo", vrstni_red: 0, datoteka: null, strani: [], visible: true }),
    ...podatki(),
    trajanje_s: trajanje || 1,
  } as TvOkno;

  return (
    <Modal
      open={open}
      siroko
      title={okno ? `${VRSTE[vrsta]}: ${okno.naslov}` : "Novo obvestilo"}
      onClose={onClose}
      noga={
        <>
          {okno && (
            <Button hint="Odstrani okno s seznama predvajanja" variant="danger" icon={Trash2} onClick={odstrani} className="mr-auto">
              Odstrani
            </Button>
          )}
          <Button hint="Zapri brez shranjevanja" variant="neutral" onClick={onClose}>
            Prekliči
          </Button>
          <Button hint={okno ? "Shrani nastavitve okna" : "Dodaj obvestilo na konec seznama"} variant="success" icon={okno ? Save : Plus} onClick={shrani} disabled={shranjujem}>
            {okno ? "Shrani" : "Dodaj"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* predogled */}
        <div className="flex flex-col gap-3">
          <Oder className="aspect-video w-full rounded-[14px] ring-1 ring-white/10">
            <Diapozitiv d={prviDiapozitiv(predogled, viri)} url={urlP} vir={vir} mirno />
          </Oder>
          <p className="text-xs text-ink-500">
            Predogled je enak sliki na TV-ju (1920 × 1080, na 4K povečano).
            {(vrsta === "pdf" || vrsta === "vir") && ` ${prviDiapozitiv(predogled, viri).pas ? "Pokončne strani se pri Zapolni zaslon razrežejo na dele čez celo širino - med deli stran zdrsne navzgor. " : ""}Vsaka stran / del se pokaže ${o.trajanje || "?"} s.`}
          </p>

          {vrsta === "vir" && (
            <div className="flex items-start gap-3 rounded-[14px] border border-sync-500/30 bg-sync-500/[0.07] p-3 text-sm">
              <Puzzle className="mt-0.5 h-5 w-5 shrink-0 text-sync-500" aria-hidden />
              <span className="flex flex-col gap-0.5">
                <b className="text-white">{vir?.ime ?? "Komponenta"}</b>
                <span className="text-ink-300">{vir?.opis}</span>
                <span className="text-xs text-ink-400">
                  {vir?.objava ? `Zadnja objava ${new Date(vir.objava.created_at).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" })}${vir.objava.izvor ? ` · ${vir.objava.izvor}` : ""} · ${opisStrani(vir.objava)}` : "Še ni objave - pokaže se, ko jo projekt prvič objavi."}
                  {vir && !vir.vklopljen && " · izklopljena na TV (panel Komponente)"}
                </span>
              </span>
            </div>
          )}

          {vrsta === "obvestilo" && (
            <>
              <PoljeObrazca naslov="Naslov obvestila" obvezno napaka={prikazi(napake.naslov)}>
                <input className={POLJE} value={o.obvestilo.naslov} onChange={(e) => nastaviObv({ naslov: e.target.value })} placeholder="npr. Kolektivni dopust" title="Velik naslov na TV-ju" autoFocus={!okno} />
              </PoljeObrazca>
              <PoljeObrazca naslov="Besedilo" opis="Nova vrstica = Enter. Kratko - bere se od daleč.">
                <textarea
                  className={`${POLJE} !h-32 resize-none py-2`}
                  value={o.obvestilo.besedilo}
                  onChange={(e) => nastaviObv({ besedilo: e.target.value })}
                  placeholder={"npr. Od 22. 12. do 2. 1. je proizvodnja zaprta.\nLepe praznike!"}
                  title="Besedilo pod naslovom"
                />
              </PoljeObrazca>
              <PoljeObrazca naslov="Priloga (desno zgoraj)" opis="Slika, video ali PDF (Word / Excel shrani kot PDF). PDF z več stranmi: obvestilo se pokaže za vsako stran.">
                <input ref={izbiraPriloge} type="file" accept={SPREJME} hidden onChange={(e) => (naloziPrilogo(e.target.files?.[0]), (e.target.value = ""))} />
                {nalagam ? (
                  <span className="flex h-10 items-center gap-2 rounded-[10px] border border-fines-400/40 bg-fines-500/[0.06] px-3 text-sm text-ink-200">
                    <LoaderCircle className="h-4 w-4 animate-spin text-fines-300" aria-hidden />
                    {nalagam}
                  </span>
                ) : o.obvestilo.priloga ? (
                  <span className="flex items-center gap-2">
                    <span className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white">
                      {o.obvestilo.priloga === "pdf" ? <FileText className="h-4 w-4 text-fines-300" aria-hidden /> : o.obvestilo.priloga === "video" ? <Video className="h-4 w-4 text-fines-300" aria-hidden /> : <IkonaSlike className="h-4 w-4 text-fines-300" aria-hidden />}
                      {o.obvestilo.priloga === "pdf" ? `PDF · ${o.strani.length} str.` : o.obvestilo.priloga === "video" ? "Video" : "Slika"}
                    </span>
                    <Button hint="Zamenjaj prilogo" variant="neutral" icon={Paperclip} onClick={() => izbiraPriloge.current?.click()} className="!h-10 !px-3 !text-xs">
                      Zamenjaj
                    </Button>
                    <Button hint="Odstrani prilogo" variant="danger" icon={X} onClick={brezPriloge} className="!h-10 !px-3 !text-xs">
                      Odstrani
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    title="Naloži sliko, video ali PDF za desni zgornji del obvestila"
                    onClick={() => izbiraPriloge.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => (e.preventDefault(), naloziPrilogo(e.dataTransfer.files[0]))}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-white/15 text-sm font-semibold text-ink-300 transition-colors hover:border-fines-400/60 hover:text-white"
                  >
                    <Paperclip className="h-4 w-4" aria-hidden />
                    Naloži ali povleci sem
                  </button>
                )}
              </PoljeObrazca>
            </>
          )}
        </div>

        {/* nastavitve */}
        <div className="flex flex-col gap-4">
          <PoljeObrazca naslov="Ime okna" opis="Ime v seznamu in v stanju zaslona (kaj se vrti).">
            <input className={POLJE} value={o.naslov} onChange={(e) => nastavi({ naslov: e.target.value })} placeholder={vrsta === "obvestilo" ? "kot naslov obvestila" : "npr. Plan montaže"} title="Ime okna" />
          </PoljeObrazca>

          {vrsta === "obvestilo" && (
            <>
              <PoljeObrazca naslov="Barva">
                <span className="flex flex-wrap gap-2">
                  {(Object.keys(BARVE_OBVESTIL) as BarvaObvestila[]).map((b) => {
                    const je = o.obvestilo.barva === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        title={`Barva: ${BARVE_OBVESTIL[b].ime}`}
                        onClick={() => nastaviObv({ barva: b })}
                        className={`grid h-9 w-9 place-items-center rounded-full text-snow transition-transform hover:scale-110 ${je ? "ring-2 ring-white ring-offset-2 ring-offset-ink-900" : ""}`}
                        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${BARVE_OBVESTIL[b].barva} 65%, white), ${BARVE_OBVESTIL[b].barva})`, boxShadow: `0 6px 16px -6px ${BARVE_OBVESTIL[b].barva}` }}
                      >
                        {je && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                      </button>
                    );
                  })}
                </span>
              </PoljeObrazca>
              <PoljeObrazca naslov="Ikona">
                <span className="grid grid-cols-6 gap-1.5">
                  {Object.entries(IKONE_OBVESTIL).map(([ime, Ikona]) => {
                    const je = o.obvestilo.ikona === ime;
                    return (
                      <button
                        key={ime}
                        type="button"
                        title={`Ikona ${ime}`}
                        onClick={() => nastaviObv({ ikona: ime })}
                        className={`grid h-10 place-items-center rounded-[10px] border transition-all ${je ? "border-fines-400/60 bg-fines-500/15 text-fines-200 shadow-[0_0_14px_-4px_rgb(238_122_58/0.8)]" : "border-white/10 bg-white/[0.04] text-ink-300 hover:border-white/25"}`}
                      >
                        <Ikona className="h-5 w-5" aria-hidden />
                      </button>
                    );
                  })}
                </span>
              </PoljeObrazca>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <PoljeObrazca
              naslov={vrsta === "pdf" ? "Trajanje strani (s)" : "Trajanje (s)"}
              obvezno={vrsta !== "video"}
              napaka={prikazi(napake.trajanje)}
              opis={vrsta === "video" ? "Samodejno: dolžina videa." : undefined}
            >
              <input className={POLJE} inputMode="numeric" value={vrsta === "video" ? String(okno?.trajanje_s ?? "") : o.trajanje} disabled={vrsta === "video"} onChange={(e) => nastavi({ trajanje: e.target.value })} title="Koliko sekund se okno prikazuje" />
            </PoljeObrazca>
            <PoljeObrazca naslov="Prikazano">
              <Stikalo vklop={o.aktivno} onChange={(v) => nastavi({ aktivno: v })} hint="Vklop / izklop okna (izklopljeno se ne vrti)">
                {o.aktivno ? "Se vrti" : "Izklopljeno"}
              </Stikalo>
            </PoljeObrazca>
          </div>

          <PoljeObrazca naslov="Naslovna stran" opis="Pred oknom 8 s: prehod, naslov okna na sredini 4 s, prehod na vsebino.">
            <Stikalo vklop={o.uvod} onChange={(v) => nastavi({ uvod: v })} hint="Naslovna stran z imenom okna pred vsebino">
              {o.uvod ? "Z naslovno stranjo" : "Brez naslovne strani"}
            </Stikalo>
          </PoljeObrazca>

          <PoljeObrazca naslov="Prehod" opis={`${PREHODI[o.prehod].opis} Prehod traja 2 s.`}>
            <span className="relative flex flex-wrap gap-1 rounded-[12px] border border-white/10 bg-white/[0.03] p-1">
              {(Object.keys(PREHODI) as Prehod[]).map((p) => (
                <button key={p} type="button" title={PREHODI[p].opis} onClick={() => nastavi({ prehod: p })} className={`relative flex-1 rounded-[9px] px-2.5 py-1.5 text-xs font-semibold transition-colors ${o.prehod === p ? "text-snow" : "text-ink-300 hover:text-white"}`}>
                  {o.prehod === p && <motion.span layoutId="tv-prehod" className="absolute inset-0 rounded-[9px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_0_14px_-3px_rgb(238_122_58/0.8)]" />}
                  <span className="relative">{PREHODI[p].ime}</span>
                </button>
              ))}
            </span>
          </PoljeObrazca>

          {vrsta !== "obvestilo" && vrsta !== "video" && (
            <PoljeObrazca naslov="Prilagoditev" opis={
                vrsta === "pdf" || vrsta === "vir"
                  ? o.prilagoditev === "zapolni"
                    ? "Stran čez celo širino zaslona. Pokončna stran se razreže na ležeče dele, med njimi zdrsne navzgor."
                    : "Vidi se cela stran naenkrat (pokončna je majhna), ob strani zamegljeno ozadje."
                  : o.prilagoditev === "zapolni"
                    ? "Slika zapolni zaslon (robovi se lahko odrežejo)."
                    : "Vidi se cela slika, ob strani zamegljeno ozadje."
              }>
              <span className="flex gap-1 rounded-[12px] border border-white/10 bg-white/[0.03] p-1">
                {(["zapolni", "celo"] as Prilagoditev[]).map((p) => (
                  <button key={p} type="button" title={p === "zapolni" ? "Zapolni cel zaslon" : "Pokaži celo sliko"} onClick={() => nastavi({ prilagoditev: p })} className={`relative flex-1 rounded-[9px] px-3 py-1.5 text-xs font-semibold ${o.prilagoditev === p ? "text-snow" : "text-ink-300 hover:text-white"}`}>
                    {o.prilagoditev === p && <motion.span layoutId="tv-prilagoditev" className="absolute inset-0 rounded-[9px] bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)]" />}
                    <span className="relative">{p === "zapolni" ? "Zapolni zaslon" : "Cela slika"}</span>
                  </button>
                ))}
              </span>
            </PoljeObrazca>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <PoljeObrazca naslov="Velja od" opis="Prazno = takoj.">
              <input type="datetime-local" className={POLJE} value={o.od} onChange={(e) => nastavi({ od: e.target.value })} title="Od kdaj se okno vrti" />
            </PoljeObrazca>
            <PoljeObrazca naslov="Velja do" opis="Prazno = brez konca. Po koncu samo izgine." napaka={prikazi(napake.do)}>
              <input type="datetime-local" className={POLJE} value={o.do} onChange={(e) => nastavi({ do: e.target.value })} title="Do kdaj se okno vrti" />
            </PoljeObrazca>
          </div>

          {okno && drugiSeznami.length > 0 && (
            <PoljeObrazca naslov="Kopiraj na drug zaslon" opis="Kopija gre na konec seznama izbranega zaslona (z nastavitvami iz tega okna).">
              <span className="flex gap-2">
                <select className={`${POLJE} cursor-pointer [&>option]:bg-ink-900`} value={kopijaV} onChange={(e) => setKopijaV(e.target.value ? Number(e.target.value) : "")} title="Zaslon, na katerega gre kopija">
                  <option value="">Izberi zaslon ...</option>
                  {drugiSeznami.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ime}
                    </option>
                  ))}
                </select>
                <Button hint="Kopiraj okno na izbran zaslon" variant="primary" icon={Copy} onClick={kopiraj} disabled={kopijaV === ""}>
                  Kopiraj
                </Button>
              </span>
            </PoljeObrazca>
          )}
        </div>
      </div>
    </Modal>
  );
}
