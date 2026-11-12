"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, EyeOff, FileText, GripVertical, Heading, Image as IkonaSlike, LoaderCircle, MessageSquareText, Plus, Puzzle, Upload, Video, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { obvesti } from "@/components/ui/Obvestila";
import { Panel } from "@/components/cas/Skupno";
import { dodajOkna, imaUvod, oknaSeznama, potiOkna, preurediOkna, PREHODI, PRIVZETO_TRAJANJE, urljiDatotek, type NovoOkno, type TvOkno, type TvVir, type VrstaOkna } from "@/lib/tv";
import { diapozitivi, minSek, prviDiapozitiv, straniOkna, trajanjeKroga, veljaZdaj } from "@/lib/tvPredvajanje";
import { brezKoncnice, naloziZaTv, SPREJME, VELIK_VIDEO } from "@/lib/tvNalozi";
import { Diapozitiv, Oder } from "./Diapozitiv";
import { OknoUredi } from "./OknoUredi";

const IKONE_VRST: Record<VrstaOkna, LucideIcon> = { slika: IkonaSlike, video: Video, pdf: FileText, obvestilo: MessageSquareText, vir: Puzzle };
/** Tip podatka pri vlečenju komponente iz panela Komponente v seznam. */
export const VLECI_VIR = "application/x-fos-tv-vir";

type Nalaganje = { kljuc: string; ime: string; stanje: string };

/** Novo okno s komponento (zadnja objava se vrti; pokončne strani razrezane - Zapolni zaslon). */
export const oknoVira = (v: TvVir, idSeznama: number): NovoOkno => ({
  id_seznama: idSeznama,
  vrsta: "vir",
  id_vira: v.id,
  naslov: v.ime,
  trajanje_s: PRIVZETO_TRAJANJE.vir,
  prehod: "pojemanje",
  velja_od: null,
  velja_do: null,
  aktivno: true,
  datoteka: null,
  strani: [],
  vsebina: { prilagoditev: "zapolni" },
});

/**
 * Seznam predvajanja zaslona: mreža oken 16:9 (sličica = isti izris kot TV), vrstni red s povleci in spusti,
 * na koncu polje za nalaganje (povleci datoteke ali klik). Komponento (panel Komponente) povlečeš sem.
 * PDF -> strani kot slike 4K (+ razmerja), video -> trajanje = dolžina.
 */
export function Mreza({ idSeznama, okna: vsa, viri, drugiSeznami, onDodajVir }: { idSeznama: number; okna: TvOkno[]; viri: TvVir[]; drugiSeznami: { id: number; ime: string }[]; onDodajVir: (v: TvVir) => void }) {
  const okna = oknaSeznama(vsa, idSeznama);
  const [urlji, setUrlji] = useState<Record<string, string>>({});
  const [nalaganja, setNalaganja] = useState<Nalaganje[]>([]);
  const [vlecem, setVlecem] = useState<"datoteke" | "vir" | null>(null);
  const [uredi, setUredi] = useState<TvOkno | "novo" | null>(null);
  const izbira = useRef<HTMLInputElement>(null);
  // stanje velja od-do na karticah: ob odprtju strani (osveži za novo stanje)
  const [zdaj] = useState(() => Date.now());

  // sličice: prva stran / slika / video / priloga
  const poti = okna.flatMap((o) => potiOkna(o, viri).slice(0, 1)).join("|");
  useEffect(() => {
    if (!poti) return;
    let ziv = true;
    urljiDatotek(poti.split("|"))
      .then((u) => ziv && setUrlji((s) => ({ ...s, ...u })))
      .catch((e) => obvesti(`Sličic ni mogoče naložiti: ${(e as Error).message}`, "napaka"));
    return () => {
      ziv = false;
    };
  }, [poti]);
  const url = (p: string) => urlji[p];

  const senzorji = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const spusti = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = okna.map((o) => o.id);
    preurediOkna(arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)))).catch((e) => obvesti((e as Error).message, "napaka"));
  };

  const nalozi = async (datoteke: File[]) => {
    for (const f of datoteke) {
      if (f.type.startsWith("video/") && f.size > VELIK_VIDEO) obvesti(`${f.name} ima ${Math.round(f.size / 1048576)} MB - TV-ji ga bodo prenašali dolgo (wifi). Priporočeno: 1080p mp4, do 200 MB.`, "napaka");
      const kljuc = crypto.randomUUID();
      const stanje = (s: string) => setNalaganja((n) => (n.some((x) => x.kljuc === kljuc) ? n.map((x) => (x.kljuc === kljuc ? { ...x, stanje: s } : x)) : [...n, { kljuc, ime: f.name, stanje: s }]));
      stanje("Nalagam ...");
      try {
        const n = await naloziZaTv(f, stanje);
        // PDF s pokončnimi stranmi: privzeto Zapolni zaslon (stran čez celo širino, razrezana na dele), ležeč: cela stran
        const pokoncen = n.razmerja.some((r) => r > 1);
        await dodajOkna([
          {
            id_seznama: idSeznama,
            vrsta: n.vrsta,
            naslov: brezKoncnice(f.name),
            trajanje_s: n.trajanje_s ?? PRIVZETO_TRAJANJE[n.vrsta],
            prehod: "pojemanje",
            velja_od: null,
            velja_do: null,
            aktivno: true,
            datoteka: n.datoteka,
            strani: n.strani,
            vsebina: { prilagoditev: n.vrsta === "pdf" ? (pokoncen ? "zapolni" : "celo") : "zapolni", ...(n.vrsta === "pdf" ? { razmerja: n.razmerja } : {}) },
          },
        ]);
        obvesti(`${f.name} je dodan na seznam.`);
      } catch (e) {
        obvesti(`${f.name}: ${(e as Error).message}`, "napaka");
      } finally {
        setNalaganja((n) => n.filter((x) => x.kljuc !== kljuc));
      }
    }
  };

  const ob = (e: DragEvent) => {
    const vir = e.dataTransfer.types.includes(VLECI_VIR);
    if (!vir && !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    if (e.type === "dragleave") {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setVlecem(null);
      return;
    }
    if (e.type !== "drop") {
      e.dataTransfer.dropEffect = "copy";
      setVlecem(vir ? "vir" : "datoteke");
      return;
    }
    setVlecem(null);
    if (vir) {
      const v = viri.find((x) => x.id === Number(e.dataTransfer.getData(VLECI_VIR)));
      if (v) onDodajVir(v);
    } else nalozi([...e.dataTransfer.files]);
  };

  const krog = trajanjeKroga(diapozitivi(okna, zdaj, viri));
  const urejam = uredi === "novo" ? null : uredi;

  return (
    <div onDragEnter={ob} onDragOver={ob} onDragLeave={ob} onDrop={ob} className="min-w-0">
      <Panel
        naslov="Seznam predvajanja"
        className={`transition-shadow ${vlecem ? "ring-2 ring-fines-400 shadow-[0_0_40px_-8px_rgb(238_122_58/0.8)]" : ""}`}
        desno={
          <span className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-ink-400" title="Koliko časa traja en krog vseh oken, ki se vrtijo zdaj (z naslovnimi stranmi in prehodi)">
              {okna.length} oken · krog <b className="text-ink-200">{minSek(krog)}</b>
            </span>
            <Button hint="Dodaj obvestilo z besedilom" variant="success" icon={MessageSquareText} onClick={() => setUredi("novo")} className="!h-9 !px-3 !text-xs">
              Obvestilo
            </Button>
            <Button hint="Naloži sliko, video ali PDF" variant="success" icon={Upload} onClick={() => izbira.current?.click()} className="!h-9 !px-3 !text-xs">
              Naloži
            </Button>
          </span>
        }
      >
        <input ref={izbira} type="file" accept={SPREJME} multiple hidden onChange={(e) => (nalozi([...(e.target.files ?? [])]), (e.target.value = ""))} />
        <DndContext sensors={senzorji} collisionDetection={closestCenter} onDragEnd={spusti}>
          <SortableContext items={okna.map((o) => o.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
              {okna.map((o, i) => (
                <Kartica key={o.id} okno={o} st={i + 1} url={url} vir={viri.find((v) => v.id === o.id_vira)} viri={viri} zdaj={zdaj} onUredi={() => setUredi(o)} />
              ))}
              <AnimatePresence>
                {nalaganja.map((n) => (
                  <motion.li key={n.kljuc} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex aspect-video flex-col items-center justify-center gap-2 rounded-[14px] border border-fines-400/40 bg-fines-500/[0.06] p-3 text-center">
                    <LoaderCircle className="h-7 w-7 animate-spin text-fines-300" aria-hidden />
                    <span className="max-w-full truncate text-sm font-semibold text-white">{n.ime}</span>
                    <span className="text-xs text-ink-400">{n.stanje}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
              <li>
                <button
                  type="button"
                  title="Klikni ali povleci sem slike, videe ali PDF; komponento povleci iz panela Komponente"
                  onClick={() => izbira.current?.click()}
                  className={`group flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed p-3 text-center transition-all ${vlecem ? "border-fines-400 bg-fines-500/10" : "border-white/15 hover:border-fines-400/60 hover:bg-white/[0.03]"}`}
                >
                  <span className="fos-fines-fill grid h-11 w-11 place-items-center rounded-xl text-snow transition-transform group-hover:scale-110">
                    {vlecem === "vir" ? <Puzzle className="h-6 w-6" aria-hidden /> : <Plus className="h-6 w-6" aria-hidden />}
                  </span>
                  <span className="text-sm font-semibold text-ink-200">{vlecem === "vir" ? "Spusti komponento sem" : "Povleci sem sliko, video ali PDF"}</span>
                  <span className="text-[11px] text-ink-500">Word / Excel: shrani kot PDF. PDF z več stranmi se vrti stran za stranjo.</span>
                </button>
              </li>
            </ul>
          </SortableContext>
        </DndContext>
      </Panel>

      {uredi && <OknoUredi key={urejam?.id ?? "novo"} open okno={urejam} idSeznama={idSeznama} url={url} viri={viri} drugiSeznami={drugiSeznami} onClose={() => setUredi(null)} />}
    </div>
  );
}

function Kartica({ okno, st, url, vir, viri, zdaj, onUredi }: { okno: TvOkno; st: number; url: (p: string) => string | undefined; vir?: TvVir; viri: TvVir[]; zdaj: number; onUredi: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: okno.id });
  const Ikona = IKONE_VRST[okno.vrsta];
  const velja = veljaZdaj(okno, zdaj) && (okno.vrsta !== "vir" || (!!vir?.vklopljen && !!vir.objava));
  const zacne = okno.velja_od && new Date(okno.velja_od).getTime() > zdaj;
  const { strani } = straniOkna(okno, viri);
  const oznaka = !okno.aktivno
    ? { ikona: EyeOff, besedilo: "Izklopljeno", barva: "text-ink-300" }
    : okno.vrsta === "vir" && !vir?.vklopljen
      ? { ikona: EyeOff, besedilo: "Komponenta izklopljena", barva: "text-ink-300" }
      : okno.vrsta === "vir" && !vir?.objava
        ? { ikona: CalendarClock, besedilo: "Čaka na objavo", barva: "text-sync-500" }
        : zacne
          ? { ikona: CalendarClock, besedilo: `Od ${new Date(okno.velja_od!).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" })}`, barva: "text-sync-500" }
          : !veljaZdaj(okno, zdaj)
            ? { ikona: CalendarClock, besedilo: "Poteklo", barva: "text-nok-500" }
            : okno.velja_do
              ? { ikona: CalendarClock, besedilo: `Do ${new Date(okno.velja_do).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" })}`, barva: "text-warn-500" }
              : null;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }} className="min-w-0">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group relative overflow-hidden rounded-[14px] border bg-white/[0.03] transition-all ${isDragging ? "border-fines-400 shadow-[0_0_30px_-6px_rgb(238_122_58/0.9)]" : "border-white/10 hover:border-fines-400/50 hover:shadow-[0_0_24px_-8px_rgb(238_122_58/0.6)]"}`}
      >
        <button type="button" onClick={onUredi} title={`Uredi okno "${okno.naslov}"`} className="block w-full text-left">
          <Oder className={`aspect-video w-full ${velja ? "" : "opacity-40 grayscale"}`}>
            <Diapozitiv d={prviDiapozitiv(okno, viri)} url={url} vir={vir} mirno />
          </Oder>
          <span className="flex items-center gap-2 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white" title={okno.naslov}>
                {okno.naslov}
              </span>
              <span className="flex items-center gap-1 truncate text-[11px] text-ink-400">
                {imaUvod(okno) && <Heading className="h-3 w-3 shrink-0 text-fines-300" aria-label="Z naslovno stranjo" />}
                {strani.length && (okno.vrsta === "pdf" || okno.vrsta === "vir") ? `${strani.length} str. × ${okno.trajanje_s} s` : okno.vrsta === "vir" ? `${okno.trajanje_s} s / str.` : minSek(okno.trajanje_s * 1000)} · {PREHODI[okno.prehod].ime}
              </span>
            </span>
            {oznaka && (
              <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${oznaka.barva}`}>
                <oznaka.ikona className="h-3.5 w-3.5" aria-hidden />
                {oznaka.besedilo}
              </span>
            )}
          </span>
        </button>
        {/* zaporedna številka in vrsta */}
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 py-1 pl-1 pr-2.5 text-[11px] font-bold text-snow backdrop-blur">
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[linear-gradient(135deg,#f19a66,#ca5010)] px-1 text-[10px]">{st}</span>
          <Ikona className="h-3.5 w-3.5" aria-hidden />
          {okno.vrsta === "vir" ? "Komponenta" : okno.vrsta === "pdf" ? "PDF" : okno.vrsta === "slika" ? "Slika" : okno.vrsta === "video" ? "Video" : "Obvestilo"}
        </span>
        <button
          ref={setActivatorNodeRef}
          type="button"
          title="Povleci za vrstni red"
          aria-label="Povleci za vrstni red"
          className="absolute right-2 top-2 grid h-8 w-8 cursor-grab touch-none place-items-center rounded-full bg-black/70 text-snow opacity-80 backdrop-blur transition-all hover:text-fines-300 group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      </motion.div>
    </li>
  );
}
