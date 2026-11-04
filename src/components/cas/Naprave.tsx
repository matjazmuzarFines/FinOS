"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Copy, Cpu, Download, KeyRound, Plus, Power, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { POLJE } from "@/components/ui/Polje";
import { obvesti } from "@/components/ui/Obvestila";
import { fetchAll, getSupabase } from "@/lib/supabase";
import { PoljeObrazca } from "./Polja";
import { Panel } from "./Skupno";

type Naprava = { id: number; ime: string; lokacija: string; zadnji_stik: string | null; verzija: string | null; visible: boolean };

/** config.json za krmilnik (naslov tega FIN:OS, ključ, ime) - shrani se v mapo krmilnik, namestitev ga prebere sama. */
function prenesiNastavitve(ime: string, kljuc: string) {
  const vsebina = JSON.stringify({ streznik: window.location.origin, kljuc, ime, port: 8080 }, null, 2);
  const url = URL.createObjectURL(new Blob([`${vsebina}\n`], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Krmilnik je "na zvezi", če se je oglasil v zadnjih 3 minutah (program se javi vsako minuto). */
const NA_ZVEZI_MS = 3 * 60_000;

function pred(iso: string | null, zdaj: number) {
  if (!iso) return "še nikoli";
  const s = Math.round((zdaj - new Date(iso).getTime()) / 1000);
  if (s < 90) return "zdaj";
  if (s < 3600) return `pred ${Math.round(s / 60)} min`;
  if (s < 86400) return `pred ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Naprave (Nastavitve -> Krmilnik): krmilniki Raspberry Pi (021_krmilnik_naprave.sql). Dodaj napravo -> ključ se pokaže
 * SAMO enkrat (vpiše se v config.json na krmilniku). Vrstica: ime, lokacija, na zvezi / zadnji stik, verzija programa,
 * Nov ključ (star preneha delovati), Onemogoči. Brez tabele (021 ni zagnana) samo opozorilo.
 */
export function Naprave() {
  const [naprave, setNaprave] = useState<Naprava[] | null>(null);
  const [napaka, setNapaka] = useState<string | null>(null);
  const [dodaj, setDodaj] = useState(false);
  const [kljuc, setKljuc] = useState<{ ime: string; kljuc: string } | null>(null);
  const [zdaj, setZdaj] = useState(() => Date.now());

  const nalozi = useCallback(async () => {
    try {
      setNaprave(await fetchAll<Naprava>((from, to) => getSupabase().from("fos_krmilniki").select("id, ime, lokacija, zadnji_stik, verzija, visible").order("id").range(from, to)));
      setNapaka(null);
    } catch (e) {
      setNapaka((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const prvo = setTimeout(nalozi, 0);
    // stanje "na zvezi" se osveži vsako minuto
    const t = setInterval(() => {
      nalozi();
      setZdaj(Date.now());
    }, 60_000);
    return () => {
      clearTimeout(prvo);
      clearInterval(t);
    };
  }, [nalozi]);

  const novKljuc = async (n: Naprava) => {
    if (!confirm(`Nov ključ za "${n.ime}"? Star ključ preneha delovati takoj - na krmilniku ga moraš zamenjati.`)) return;
    const { data, error } = await getSupabase().rpc("fos_nov_kljuc_naprave", { p_id: n.id });
    if (error) return obvesti(error.message, "napaka");
    setKljuc({ ime: n.ime, kljuc: data as string });
  };
  const vklop = async (n: Naprava) => {
    if (n.visible && !confirm(`Onemogočim "${n.ime}"? Krmilnik ne bo več mogel pošiljati žigov.`)) return;
    const { error } = await getSupabase().from("fos_krmilniki").update({ visible: !n.visible }).eq("id", n.id);
    if (error) return obvesti(error.message, "napaka");
    obvesti(n.visible ? `${n.ime} je onemogočen.` : `${n.ime} je spet omogočen.`);
    nalozi();
  };

  return (
    <Panel
      naslov={
        <span className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" aria-hidden />
          Naprave
        </span>
      }
      desno={
        !napaka && (
          <Button hint="Dodaj nov krmilnik (Raspberry Pi) in ustvari njegov ključ" variant="success" icon={Plus} onClick={() => setDodaj(true)} className="!h-9">
            Dodaj napravo
          </Button>
        )
      }
    >
      {napaka ? (
        <p className="rounded-[12px] border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-sm text-warn-500">
          {/schema cache|does not exist/i.test(napaka) ? (
            <>
              Tabele naprav še ni - v Supabase zaženi <code className="font-mono">021_krmilnik_naprave.sql</code>.
            </>
          ) : (
            `Naprav ni mogoče prebrati: ${napaka}`
          )}
        </p>
      ) : !naprave ? (
        <div className="h-16 animate-pulse rounded-[12px] bg-white/[0.04]" />
      ) : !naprave.length ? (
        <p className="text-sm text-ink-400">Še ni nobenega krmilnika. Dodaj napravo, ključ vpiši v config.json na Raspberry Pi (navodila: mapa krmilnik/ v projektu).</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {naprave.map((n, i) => {
            const naZvezi = !!n.zadnji_stik && zdaj - new Date(n.zadnji_stik).getTime() < NA_ZVEZI_MS;
            return (
              <motion.li
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/[0.035] p-3 sm:flex-row sm:items-center ${n.visible ? "" : "opacity-50"}`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${naZvezi ? "bg-ok-500/15 text-ok-500" : "bg-white/[0.06] text-ink-400"}`} title={naZvezi ? "Na zvezi" : "Ni na zvezi"}>
                  {naZvezi ? <Wifi className="h-5 w-5" aria-hidden /> : <WifiOff className="h-5 w-5" aria-hidden />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-white">
                    {n.ime}
                    {!n.visible && <span className="ml-2 text-xs font-normal text-nok-500">onemogočen</span>}
                  </span>
                  <span className="text-xs text-ink-400">
                    {n.lokacija || "Brez lokacije"} · {naZvezi ? <b className="text-ok-500">na zvezi</b> : `zadnji stik ${pred(n.zadnji_stik, zdaj)}`}
                    {n.verzija && ` · program ${n.verzija}`}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button hint="Ustvari nov ključ - star preneha delovati" variant="primary" icon={KeyRound} onClick={() => novKljuc(n)} className="!h-9 !px-3 !text-xs" disabled={!n.visible}>
                    Nov ključ
                  </Button>
                  <Button hint={n.visible ? "Onemogoči krmilnik - ne more več pošiljati žigov" : "Spet omogoči krmilnik"} variant={n.visible ? "danger" : "success"} icon={Power} onClick={() => vklop(n)} className="!h-9 !px-3 !text-xs">
                    {n.visible ? "Onemogoči" : "Omogoči"}
                  </Button>
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}

      <DodajNapravo
        open={dodaj}
        onClose={() => setDodaj(false)}
        onDodana={(ime, k) => {
          setDodaj(false);
          setKljuc({ ime, kljuc: k });
          nalozi();
        }}
      />
      <Modal
        open={!!kljuc}
        title="Ključ naprave"
        onClose={() => setKljuc(null)}
        noga={
          <Button hint="Ključ sem si zapisal - zapri okno" variant="neutral" onClick={() => setKljuc(null)}>
            Zapri
          </Button>
        }
      >
        {kljuc && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-300">
              Ključ za <b className="text-white">{kljuc.ime}</b> se pokaže <b className="text-warn-500">samo zdaj</b>. Najlažje: <b className="text-white">Prenesi nastavitve</b> in datoteko{" "}
              <code className="font-mono text-fines-200">config.json</code> shrani v mapo <code className="font-mono text-fines-200">krmilnik</code> na USB ključku - namestitev na Raspberry Pi jo
              prebere sama. Če ključ izgubiš, ustvari nov ključ.
            </p>
            <Button hint="Prenesi config.json z naslovom FIN:OS in ključem za krmilnik" variant="primary" icon={Download} onClick={() => prenesiNastavitve(kljuc.ime, kljuc.kljuc)} className="self-start">
              Prenesi nastavitve (config.json)
            </Button>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-[10px] border border-white/10 bg-ink-950 px-3 py-2.5 font-mono text-sm text-fines-200">{kljuc.kljuc}</code>
              <Button
                hint="Kopiraj ključ v odložišče"
                variant="primary"
                icon={Copy}
                onClick={() =>
                  navigator.clipboard.writeText(kljuc.kljuc).then(
                    () => obvesti("Ključ je kopiran."),
                    () => obvesti("Kopiranje ni uspelo - označi in kopiraj ročno.", "napaka"),
                  )
                }
              >
                Kopiraj
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Panel>
  );
}

function DodajNapravo({ open, onClose, onDodana }: { open: boolean; onClose: () => void; onDodana: (ime: string, kljuc: string) => void }) {
  const [ime, setIme] = useState("");
  const [lokacija, setLokacija] = useState("");
  const [poskus, setPoskus] = useState(false);
  const shrani = async () => {
    setPoskus(true);
    if (!ime.trim()) return;
    const { data, error } = await getSupabase().rpc("fos_nova_naprava", { p_ime: ime.trim(), p_lokacija: lokacija.trim() });
    if (error) return obvesti(error.message, "napaka");
    onDodana(ime.trim(), data as string);
    setIme("");
    setLokacija("");
    setPoskus(false);
  };
  return (
    <Modal
      open={open}
      title="Dodaj napravo"
      onClose={onClose}
      noga={
        <>
          <Button hint="Zapri brez dodajanja" variant="neutral" onClick={onClose}>
            Prekliči
          </Button>
          <Button hint="Dodaj krmilnik in ustvari ključ" variant="success" icon={Plus} onClick={shrani}>
            Dodaj
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PoljeObrazca naslov="Ime" obvezno napaka={poskus && !ime.trim() ? "Vpiši ime naprave." : undefined}>
          <input className={POLJE} value={ime} onChange={(e) => setIme(e.target.value)} placeholder="npr. Vhod proizvodnja" title="Ime krmilnika" autoFocus />
        </PoljeObrazca>
        <PoljeObrazca naslov="Lokacija">
          <input className={POLJE} value={lokacija} onChange={(e) => setLokacija(e.target.value)} placeholder="npr. Glavni vhod, pritličje" title="Kje stoji krmilnik" />
        </PoljeObrazca>
      </div>
    </Modal>
  );
}
