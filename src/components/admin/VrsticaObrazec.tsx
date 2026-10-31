"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { POLJE, Stikalo } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { dodajVrstico, podvojena, pretvori, shraniVrstico, vBesedilo, type TabelaBaze, type Vrstica } from "@/lib/tabeleBaze";

type Props = {
  tabela: TabelaBaze;
  /** null = nova vrstica. */
  vrstica: Vrstica | null;
  vrstice: Vrstica[];
  lahkoUreja: boolean;
  onClose: () => void;
};

type Vnos = { polja: Record<string, string>; visible: boolean };

const vnosIz = (t: TabelaBaze, v: Vrstica | null): Vnos => ({
  polja: Object.fromEntries(t.stolpci.map((s) => [s.ime, v ? vBesedilo(s, v[s.ime]) : (s.privzeto ?? "")])),
  visible: v?.visible ?? true,
});

const cas = (v: unknown) => (v ? new Date(String(v)).toLocaleString("sl-SI") : "-");

/**
 * Dodaj / uredi vrstico tabele (kot "Insert row" v Supabase): eno polje na stolpec z imenom, tipom in opisom,
 * obvezna polja z zvezdico, sistemski stolpci samo za branje. Vrstice se ne brišejo - stikalo "Prikazana" (visible).
 */
export function VrsticaObrazec({ tabela: t, vrstica, vrstice, lahkoUreja, onClose }: Props) {
  const [vnos, setVnos] = useState<Vnos>(() => vnosIz(t, vrstica));
  const [napaka, setNapaka] = useState<string | null>(null);
  const [shranjujem, setShranjujem] = useState(false);
  const nova = vrstica == null;

  const shrani = async () => {
    const podatki: Record<string, unknown> = { visible: vnos.visible };
    const napake: string[] = [];
    for (const s of t.stolpci) {
      const r = pretvori(s, vnos.polja[s.ime]);
      if ("napaka" in r) napake.push(r.napaka);
      else podatki[s.ime] = r.vrednost;
    }
    const dvojnik = napake.length ? null : podvojena(t, vrstice, podatki, vrstica?.id);
    if (napake.length || dvojnik) return setNapaka(napake.join(" ") || dvojnik);
    setNapaka(null);
    setShranjujem(true);
    try {
      if (nova) {
        const id = await dodajVrstico(t, podatki);
        obvesti(`Vrstica dodana v ${t.naslov} (ID ${id}).`);
      } else {
        await shraniVrstico(t, vrstica, podatki);
        obvesti(`Vrstica ${vrstica.id} shranjena.`);
      }
      onClose();
    } catch (e) {
      setNapaka((e as Error).message);
      obvesti("Vrstice ni bilo mogoče shraniti.", "napaka");
    } finally {
      setShranjujem(false);
    }
  };

  return (
    <Modal
      open
      title={nova ? `Nova vrstica - ${t.naslov}` : `Vrstica ${vrstica.id} - ${t.naslov}`}
      onClose={onClose}
      noga={
        <>
          <Button hint="Zapri okno brez shranjevanja" variant="neutral" icon={X} onClick={onClose} disabled={shranjujem}>
            Prekliči
          </Button>
          {lahkoUreja && (
            <Button hint={nova ? "Dodaj vrstico v tabelo" : "Shrani spremembe vrstice"} variant="success" icon={Check} onClick={shrani} disabled={shranjujem}>
              {shranjujem ? "Shranjujem ..." : "Shrani"}
            </Button>
          )}
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (lahkoUreja) shrani();
        }}
      >
        <p className="font-mono text-xs text-ink-500">{t.ime}</p>

        {t.stolpci.map((s, i) => (
          <label key={s.ime} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold text-ink-300">
                {s.naslov}
                {s.obvezno && <span className="ml-0.5 text-fines-400" title="Obvezen podatek">*</span>}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
                {s.ime}
                <span className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-px text-ink-400">{s.pgTip}</span>
                {s.enolicno && <span className="rounded border border-fines-400/30 bg-fines-500/10 px-1.5 py-px text-fines-300">enolično</span>}
              </span>
            </span>
            <input
              value={vnos.polja[s.ime]}
              onChange={(e) => setVnos((v) => ({ ...v, polja: { ...v.polja, [s.ime]: e.target.value } }))}
              inputMode={s.tip === "stevilo" ? "numeric" : undefined}
              placeholder={s.tip === "seznam" ? `npr. ${s.primer || "a|b"}` : s.privzeto != null ? `privzeto ${s.privzeto}` : `npr. ${s.primer}`}
              title={s.opis}
              disabled={!lahkoUreja}
              autoFocus={i === 0 && nova}
              className={`${POLJE} ${s.tip === "stevilo" || s.tip === "seznam" ? "font-mono" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
            />
            {s.tip === "seznam" && <Seznam vrednost={vnos.polja[s.ime]} />}
            <span className="text-xs leading-snug text-ink-500">{s.opis}</span>
          </label>
        ))}

        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold text-ink-300">Prikazana</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
              visible <span className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-px text-ink-400">bool</span>
            </span>
          </span>
          <Stikalo vklop={vnos.visible} onChange={(v) => setVnos((s) => ({ ...s, visible: v }))} hint="Skrita vrstica se v aplikaciji ne prikaže (podatkov ne brišemo)" disabled={!lahkoUreja}>
            {vnos.visible ? "Prikazana v aplikaciji" : "Skrita (visible = false)"}
          </Stikalo>
        </div>

        {/* sistemski stolpci - samo za branje */}
        <dl className="grid grid-cols-3 gap-2 rounded-[12px] border border-white/10 bg-white/[0.03] p-3 text-xs">
          {[
            ["id", nova ? "samodejno" : String(vrstica.id)],
            ["created_at", nova ? "samodejno" : cas(vrstica.created_at)],
            ["updated_at", nova ? "samodejno" : cas(vrstica.updated_at)],
          ].map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col gap-0.5">
              <dt className="font-mono text-[11px] text-ink-500">{k}</dt>
              <dd className="truncate font-semibold text-ink-300" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        {napaka && <p className="rounded-[10px] border border-nok-500/40 bg-nok-500/10 px-3 py-2 text-sm font-semibold text-nok-500">{napaka}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Predogled seznama (text[]) kot čipi. */
export function Seznam({ vrednost }: { vrednost: string | string[] }) {
  const deli = Array.isArray(vrednost) ? vrednost : vrednost.replace(/^\{|\}$/g, "").split(/[|,]/).map((x) => x.trim()).filter(Boolean);
  if (!deli.length) return <span className="text-xs text-ink-500">prazen seznam</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {deli.map((d, i) => (
        <span key={d + i} className="rounded-md border border-fines-400/30 bg-fines-500/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fines-300">
          {d}
        </span>
      ))}
    </span>
  );
}
