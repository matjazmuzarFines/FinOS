"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CalendarRange,
  Construction,
  FileText,
  GraduationCap,
  HeartHandshake,
  ImagePlus,
  Info,
  Megaphone,
  PartyPopper,
  ShieldCheck,
  TreePalm,
  TriangleAlert,
  Trophy,
  UserPlus,
  Workflow,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { Znak } from "@/components/Znak";
import { BARVE_OBVESTIL, type TvOkno, type TvVir } from "@/lib/tv";
import type { Diapozitiv as DiapozitivT } from "@/lib/tvPredvajanje";

/** Logična velikost TV slike. 4K TV jo poveča ×2 (besedilo ostane ostro), 1080p 1:1. */
export const SIRINA = 1920;
export const VISINA = 1080;

export const IKONE_OBVESTIL: Record<string, LucideIcon> = {
  Megaphone,
  Info,
  PartyPopper,
  UserPlus,
  CalendarDays,
  TreePalm,
  GraduationCap,
  Trophy,
  ShieldCheck,
  HeartHandshake,
  Construction,
  TriangleAlert,
};
/** Ikone komponent (fos_tv_viri.ikona). */
export const IKONE_VIROV: Record<string, LucideIcon> = { Workflow, Gauge, CalendarRange, FileText, CalendarDays, Trophy, GraduationCap, ShieldCheck };

/**
 * Oder: platno 1920 × 1080, pomanjšano / povečano na velikost okvirja (letterbox, črni robovi). Isti izris za TV,
 * predogled in sličice v urejevalniku - kar vidiš v FIN:OS, je na TV-ju.
 */
export function Oder({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const izmeri = () => setM(Math.min(el.clientWidth / SIRINA, el.clientHeight / VISINA));
    izmeri();
    const ro = new ResizeObserver(izmeri);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`relative overflow-hidden bg-black ${className}`}>
      <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: SIRINA, height: VISINA, transform: `translate(-50%, -50%) scale(${m})`, visibility: m ? "visible" : "hidden" }}>
        {children}
      </div>
    </div>
  );
}

type Props = {
  /** diapozitiv (iz diapozitivi()) ali samo okno - sličica / predogled: prva stran */
  d: Pick<DiapozitivT, "okno" | "stran" | "naslovna">;
  url: (pot: string) => string | undefined;
  /** komponenta okna vrste "vir" (ime, ikona, ali je objava) */
  vir?: TvVir;
  /** sličica / predogled: video se ne predvaja (prvi kader), prazen prostor za prilogo je označen */
  mirno?: boolean;
  /** koliko diapozitiva je že minilo (video začne na pravem mestu - usklajeno s povezanimi zasloni) */
  odmikMs?: number;
  /** edini diapozitiv v seznamu - video se vrti v zanki */
  zanka?: boolean;
};

/** En diapozitiv na odru 1920 × 1080. Barve so stalne - TV je vedno temen. */
export function Diapozitiv({ d, url, vir, mirno, odmikMs = 0, zanka }: Props) {
  const { okno, stran, naslovna } = d;
  if (naslovna) return <NaslovnaTv okno={okno} vir={vir} />;
  if (okno.vrsta === "obvestilo") return <ObvestiloTv okno={okno} stran={stran} url={url} mirno={mirno} zanka={zanka} />;
  const strani = okno.vrsta === "pdf" || okno.vrsta === "vir";
  // brez `stran` (sličica) prva stran; za komponento pošlje pravo stran (tekoči teden) prviDiapozitiv()
  const pot = strani ? (stran ?? (okno.vrsta === "vir" ? vir?.objava?.strani[0] : okno.strani[0])) : (okno.datoteka ?? undefined);
  const src = pot ? url(pot) : undefined;
  const celo = (okno.vsebina.prilagoditev ?? (strani ? "celo" : "zapolni")) === "celo";
  if (okno.vrsta === "vir" && !vir?.objava) return <KomponentaBrezObjave okno={okno} vir={vir} />;
  if (!src) return <Nalagam okno={okno} />;
  if (okno.vrsta === "video") return <VideoTv src={src} celo={celo} mirno={mirno} odmikMs={odmikMs} zanka={zanka} />;
  if (strani && !celo) return <StranTv src={src} alt={okno.naslov} />;
  return <SlikaTv src={src} celo={celo} alt={okno.naslov} />;
}

function SlikaTv({ src, celo, alt }: { src: string; celo: boolean; alt: string }) {
  return (
    <div className="absolute inset-0 bg-black">
      {celo && <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-[60px]" />}
      <img src={src} alt={alt} draggable={false} className={`absolute inset-0 h-full w-full ${celo ? "object-contain" : "object-cover"}`} />
    </div>
  );
}

/** Koliko se sme stran raztegniti v eno smer (A4 ležeče -> 16:9 = 1,26; pokončna dobi bele robove). */
const RAZTEG_MAX = 1.3;

/**
 * Stran PDF / komponente pri "Zapolni zaslon": vedno CELA stran (nič odrezano, nič razrezano), raztegnjena do robov
 * zaslona. Ležeča A4 zapolni zaslon v celoti; pokončna se raztegne največ RAZTEG_MAX, ostalo je belo (papir).
 */
function StranTv({ src, alt }: { src: string; alt: string }) {
  const [razmerje, setRazmerje] = useState<number | null>(null); // višina / širina strani
  let w = SIRINA;
  let h = VISINA;
  if (razmerje) {
    if (razmerje > VISINA / SIRINA) w = Math.min(SIRINA, (VISINA / razmerje) * RAZTEG_MAX);
    else h = Math.min(VISINA, SIRINA * razmerje * RAZTEG_MAX);
  }
  return (
    <div className="absolute inset-0 grid place-items-center bg-white">
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => setRazmerje(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth || null)}
        className="max-w-none"
        style={{ width: w, height: h, visibility: razmerje ? "visible" : "hidden" }}
      />
    </div>
  );
}

function VideoTv({ src, celo, mirno, odmikMs, zanka }: { src: string; celo: boolean; mirno?: boolean; odmikMs: number; zanka?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const zacetek = useRef(odmikMs);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const ob = () => {
      // sličica: kader pri 1 s; TV: tam, kjer je video na povezanih zaslonih
      const t = mirno ? Math.min(1, (v.duration || 2) / 2) : zacetek.current / 1000;
      if (t > 0.5 && Number.isFinite(v.duration)) v.currentTime = Math.min(t, Math.max(0, v.duration - 0.2));
    };
    v.addEventListener("loadedmetadata", ob, { once: true });
    return () => v.removeEventListener("loadedmetadata", ob);
  }, [mirno]);
  return (
    <div className="absolute inset-0 bg-black">
      <video ref={ref} src={src} muted playsInline autoPlay={!mirno} loop={zanka} preload={mirno ? "metadata" : "auto"} className={`absolute inset-0 h-full w-full ${celo ? "object-contain" : "object-cover"}`} />
    </div>
  );
}

function Nalagam({ okno }: { okno: TvOkno }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_top,#2b2b2f,#121214)]">
      <span className="flex flex-col items-center gap-6 text-[#6b6b72]">
        <FileText className="h-32 w-32" aria-hidden />
        <span className="text-5xl font-semibold">{okno.naslov || "Nalagam ..."}</span>
      </span>
    </div>
  );
}

/** Ozadje TV strani v barvi (sij levo zgoraj, mreža, črtkan krog desno). */
function Ozadje({ barva, krog = true }: { barva: string; krog?: boolean }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 70% at 15% 10%, color-mix(in srgb, ${barva} 38%, transparent), transparent 70%), radial-gradient(ellipse at 100% 100%, #2b2b2f, #121214 60%)` }} />
      <div
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "96px 96px", maskImage: "radial-gradient(ellipse at 30% 30%, black, transparent 75%)" }}
      />
      {krog && (
        <>
          <div className="absolute -right-48 -top-48 h-[760px] w-[760px] rounded-full border-[3px] border-dashed opacity-30" style={{ borderColor: barva }} />
          <div className="absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full opacity-25 blur-3xl" style={{ background: barva }} />
        </>
      )}
      <div className="absolute inset-x-0 bottom-0 h-3" style={{ background: `linear-gradient(90deg, ${barva}, color-mix(in srgb, ${barva} 50%, transparent) 60%, transparent)` }} />
    </>
  );
}

/** Naslovna stran pred oknom: naslov na sredini (kot obvestilo, samo naslov). */
export function NaslovnaTv({ okno, vir }: { okno: TvOkno; vir?: TvVir }) {
  const barva = okno.vrsta === "obvestilo" ? (BARVE_OBVESTIL[okno.vsebina.obvestilo?.barva ?? "fines"]?.barva ?? "#ee7a3a") : "#ee7a3a";
  const naslov = okno.naslov || vir?.ime || "";
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#121214] font-sans text-white">
      <Ozadje barva={barva} krog={false} />
      <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-dashed opacity-20" style={{ borderColor: barva }} />
      <div className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl" style={{ background: barva }} />
      <div className="relative flex h-full flex-col items-center justify-center gap-10 px-[160px] text-center">
        <h2 className={`max-w-[1600px] bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text pb-2 font-display font-bold leading-[1.05] tracking-[-0.03em] text-transparent ${naslov.length > 40 ? "text-[96px]" : "text-[132px]"}`}>
          {naslov}
        </h2>
        <span className="h-2 w-64 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${barva}, transparent)`, boxShadow: `0 0 30px ${barva}` }} />
      </div>
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 opacity-70">
        <Znak pripona="TV" className="text-[44px]" />
      </div>
    </div>
  );
}

/** Komponenta (vir) brez objave - samo v urejevalniku (na TV-ju se preskoči). */
function KomponentaBrezObjave({ okno, vir }: { okno: TvOkno; vir?: TvVir }) {
  const Ikona = IKONE_VIROV[vir?.ikona ?? ""] ?? FileText;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#121214] font-sans text-white">
      <Ozadje barva="#2563eb" />
      <div className="relative flex h-full flex-col items-center justify-center gap-10 text-center">
        <Ikona className="h-40 w-40 text-[#9a9aa1]" strokeWidth={1.5} aria-hidden />
        <span className="text-[72px] font-bold">{vir?.ime ?? okno.naslov}</span>
        <span className="text-[40px] text-[#9a9aa1]">{vir && !vir.vklopljen ? "Izklopljena na TV - se ne vrti" : "Čaka na prvo objavo iz projekta"}</span>
      </div>
    </div>
  );
}

/**
 * Obvestilo: levo ikona, naslov in besedilo; desno zgoraj priloga (slika, video ali stran PDF, pomanjšano).
 * Prostor desno je vedno rezerviran (brez priloge ga zapolni okras; v urejevalniku črtkano polje).
 */
export function ObvestiloTv({ okno, stran, url, mirno, zanka }: { okno: TvOkno; stran?: string; url?: (p: string) => string | undefined; mirno?: boolean; zanka?: boolean }) {
  const o = okno.vsebina.obvestilo ?? { naslov: okno.naslov, besedilo: "", barva: "fines" as const, ikona: "Megaphone" };
  const barva = BARVE_OBVESTIL[o.barva]?.barva ?? "#ee7a3a";
  const Ikona = IKONE_OBVESTIL[o.ikona] ?? Megaphone;
  const dolgo = o.besedilo.length > 220;
  const pot = o.priloga === "pdf" ? (stran ?? okno.strani[0]) : o.priloga ? (okno.datoteka ?? undefined) : undefined;
  const src = pot && url ? url(pot) : undefined;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#121214] font-sans text-white">
      <Ozadje barva={barva} krog={!o.priloga} />
      <div className="relative flex h-full w-[1040px] flex-col justify-center gap-12 pl-[120px]">
        <span
          className="grid h-[168px] w-[168px] place-items-center rounded-[42px] text-white"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${barva} 65%, white), ${barva} 55%, color-mix(in srgb, ${barva} 65%, black))`, boxShadow: `0 30px 90px -20px ${barva}, inset 0 2px 0 rgb(255 255 255 / 0.35)` }}
        >
          <Ikona className="h-[88px] w-[88px]" strokeWidth={1.8} aria-hidden />
        </span>
        <h2 className={`bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text pb-1 font-display font-bold leading-[1.04] tracking-[-0.03em] text-transparent ${(o.naslov || okno.naslov).length > 36 ? "text-[76px]" : "text-[92px]"}`}>
          {o.naslov || okno.naslov}
        </h2>
        {o.besedilo && <p className={`whitespace-pre-line font-medium leading-[1.3] text-[#dcdcdf] ${dolgo ? "text-[34px]" : "text-[44px]"}`}>{o.besedilo}</p>}
      </div>
      {/* priloga desno zgoraj */}
      <div className="absolute right-[90px] top-[90px] h-[640px] w-[700px]">
        {o.priloga ? (
          <div className="relative h-full w-full overflow-hidden rounded-[36px] border-2 bg-black" style={{ borderColor: `color-mix(in srgb, ${barva} 55%, transparent)`, boxShadow: `0 40px 100px -30px ${barva}` }}>
            {!src ? null : o.priloga === "video" ? (
              <video src={src} muted playsInline autoPlay={!mirno} loop={!mirno || zanka} preload={mirno ? "metadata" : "auto"} className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <>
                <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-[40px]" />
                <img src={src} alt={o.naslov} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
              </>
            )}
          </div>
        ) : (
          mirno && (
            <div className="grid h-full w-full place-items-center rounded-[36px] border-4 border-dashed border-white/15 text-[#6b6b72]">
              <span className="flex flex-col items-center gap-6 text-[34px] font-semibold">
                <ImagePlus className="h-24 w-24" aria-hidden />
                Prostor za prilogo
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
