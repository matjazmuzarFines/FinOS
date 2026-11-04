"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Finesek, PLATNO } from "./Finesek";

/**
 * Prizori Fineseka ob ikonah FIN:ME (vstop Moj Fines, hover na ikono; samo z vklopljenimi animacijami):
 *   cas          naslonjen na staro uro, ki tiktaka (pravi čas) - pogleda uro, pogleda ekran
 *   odsotnosti   počiva na otoku s palmo (sončna očala, morje, sonce, z-z-z)
 *   dovolilnice  gre na pot s palico in culico
 *   popravki     premišljeno gleda posnetek registracije časa (okvir), nad njim oblaček misli
 * Velikost: h = višina Fineseka v px (ura je enako visoka). Animacije: me-* v globals.css.
 */
export type VrstaPrizora = "cas" | "odsotnosti" | "dovolilnice" | "popravki";

export function MePrizor({ vrsta, h = 96 }: { vrsta: VrstaPrizora; h?: number }) {
  if (vrsta === "cas") return <PrizorUra h={h} />;
  if (vrsta === "odsotnosti") return <PrizorOtok h={h} />;
  if (vrsta === "dovolilnice") return <PrizorPot h={h} />;
  return <PrizorPopravek h={h} />;
}

const merilo = (h: number) => h / PLATNO.h;
const sirinaF = (h: number) => PLATNO.w * merilo(h);

/** Izmenično true / false (pogled na uro / na ekran ...). */
function useMenjava(ms: number) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setV((x) => !x), ms);
    return () => clearInterval(t);
  }, [ms]);
  return v;
}

// ---------------------------------------------------------------------------------------------------------------
// Moj čas: ura
// ---------------------------------------------------------------------------------------------------------------
function PrizorUra({ h }: { h: number }) {
  const naEkran = useMenjava(1900);
  const [zdaj] = useState(() => new Date());
  const sek = zdaj.getSeconds();
  const min = zdaj.getMinutes() * 60 + sek;
  const ur = (zdaj.getHours() % 12) * 3600 + min;
  const kazalec = (trajanje: number, zamik: number, koraki?: number): CSSProperties => ({
    transformOrigin: "50px 50px",
    animation: `me-vrti ${trajanje}s ${koraki ? `steps(${koraki})` : "linear"} -${zamik}s infinite`,
  });
  const wF = sirinaF(h);
  const wU = h * 0.82;

  return (
    <div className="relative" style={{ width: wF + wU - h * 0.12, height: h }}>
      {/* ura (enako visoka kot Finesek) */}
      <svg viewBox="0 0 100 122" className="absolute bottom-0" style={{ left: wF - h * 0.12, width: wU, height: h }} aria-hidden>
        <defs>
          <linearGradient id="me-ura-rob" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4f4f6" />
            <stop offset="0.45" stopColor="#9a9aa1" />
            <stop offset="1" stopColor="#4d4d53" />
          </linearGradient>
          <radialGradient id="me-ura-obraz" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e4e4e8" />
          </radialGradient>
        </defs>
        {/* zvonca in nogice */}
        <circle cx="22" cy="14" r="11" fill="url(#me-ura-rob)" />
        <circle cx="78" cy="14" r="11" fill="url(#me-ura-rob)" />
        <path d="M24 108 l-10 12 M76 108 l10 12" stroke="#6b6b72" strokeWidth="6" strokeLinecap="round" />
        <g transform="translate(0 14)">
          <circle cx="50" cy="50" r="48" fill="url(#me-ura-rob)" />
          <circle cx="50" cy="50" r="41" fill="url(#me-ura-obraz)" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="50" y1="12" x2="50" y2={i % 3 ? 16 : 19} stroke="#2b2b2f" strokeWidth={i % 3 ? 1.6 : 3} strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`} />
          ))}
          <line x1="50" y1="50" x2="50" y2="28" stroke="#1c1c1f" strokeWidth="4.5" strokeLinecap="round" style={kazalec(43200, ur)} />
          <line x1="50" y1="50" x2="50" y2="19" stroke="#2b2b2f" strokeWidth="3" strokeLinecap="round" style={kazalec(3600, min)} />
          <line x1="50" y1="58" x2="50" y2="15" stroke="#ca5010" strokeWidth="1.6" strokeLinecap="round" style={kazalec(60, sek, 60)} />
          <circle cx="50" cy="50" r="3.5" fill="#ca5010" />
        </g>
      </svg>
      {/* Finesek: naslonjen na uro, izmenično gleda uro (s strani) in ekran (spredaj) */}
      <div className="absolute bottom-0 left-0" style={{ rotate: "5deg", transformOrigin: "50% 100%" }}>
        <Finesek s={merilo(h)} pogled={naEkran ? "spredaj" : "stran"} poza="stoji" roki={{ l: -62, d: -12 }} rokaStran={-8} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Odsotnosti: otok s palmo
// ---------------------------------------------------------------------------------------------------------------
function PrizorOtok({ h }: { h: number }) {
  const w = h * 2.5;
  const H = h * 1.35;
  return (
    <div className="relative" style={{ width: w, height: H, maskImage: "linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)" }}>
      <svg viewBox="0 0 250 135" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <radialGradient id="me-sonce" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="0.55" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="me-morje" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="me-pesek" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde7b0" />
            <stop offset="1" stopColor="#e9b964" />
          </linearGradient>
        </defs>
        <circle cx="212" cy="26" r="30" fill="url(#me-sonce)" className="me-sonce" />
        <rect x="0" y="98" width="250" height="37" fill="url(#me-morje)" />
      </svg>
      {/* valovi */}
      <div className="absolute inset-x-0 overflow-hidden" style={{ top: H * 0.68, height: H * 0.14 }}>
        <svg viewBox="0 0 500 20" preserveAspectRatio="none" className="me-valovi h-full" style={{ width: "200%" }} aria-hidden>
          <path d="M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 T 350 10 T 400 10 T 450 10 T 500 10 V20 H0 Z" fill="#7dd3fc" opacity="0.85" />
        </svg>
      </div>
      {/* otok + palma */}
      <svg viewBox="0 0 250 135" className="absolute inset-0 h-full w-full" aria-hidden>
        <ellipse cx="110" cy="112" rx="96" ry="16" fill="url(#me-pesek)" />
        <path d="M62 110 C 56 86, 53 66, 64 46" stroke="#8b5a2b" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M62 110 C 56 86, 53 66, 64 46" stroke="#a87444" strokeWidth="2.5" fill="none" strokeDasharray="3 5" />
        <g transform="translate(0 16)">
        <g className="me-list" style={{ transformOrigin: "64px 30px" }}>
          {[-150, -115, -75, -35, 5].map((r, i) => (
            <path key={r} d="M64 30 q 22 -10 42 6 q -22 -2 -42 -6 Z" fill={i % 2 ? "#16a34a" : "#22c55e"} transform={`rotate(${r} 64 30)`} />
          ))}
          <circle cx="62" cy="34" r="3.5" fill="#7c4a1e" />
          <circle cx="68" cy="35" r="3.5" fill="#7c4a1e" />
        </g>
        </g>
      </svg>
      {/* Finesek počiva, naslonjen nazaj na palmo, z očali */}
      <div className="absolute" style={{ left: w * 0.27, bottom: H * 0.12, rotate: "-11deg", transformOrigin: "30% 100%" }}>
        <Finesek
          s={merilo(h * 0.86)}
          pogled="spredaj"
          poza="stoji"
          roki={{ l: 112, d: -112 }}
          dodatek={
            <svg viewBox="0 0 640 750" className="absolute inset-0 h-full w-full" aria-hidden>
              <g fill="#121214" stroke="#2b2b2f" strokeWidth="8">
                <rect x="170" y="335" width="140" height="92" rx="40" />
                <rect x="350" y="335" width="140" height="92" rx="40" />
              </g>
              <path d="M310 372 q 20 -16 40 0" stroke="#2b2b2f" strokeWidth="12" fill="none" />
              <path d="M195 352 l 40 0" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="10" strokeLinecap="round" />
              <path d="M375 352 l 40 0" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="10" strokeLinecap="round" />
            </svg>
          }
        />
      </div>
      {/* z z z */}
      {[0, 1, 2].map((i) => (
        <span key={i} className="me-zzz absolute font-display font-bold text-sky-200" style={{ left: w * 0.52, top: H * 0.18, fontSize: h * (0.13 + i * 0.03), animationDelay: `${i * 0.8}s` }}>
          z
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Dovolilnice: na pot s palico in culico
// ---------------------------------------------------------------------------------------------------------------
function PrizorPot({ h }: { h: number }) {
  const w = h * 2.3;
  const H = h * 1.32;
  return (
    <div className="relative overflow-hidden" style={{ width: w, height: H }}>
      {/* pot: črtkana črta, ki teče nazaj */}
      <div className="me-cesta absolute inset-x-0 h-[3px] rounded-full" style={{ bottom: H * 0.05 }} />
      {/* kažipot */}
      <svg viewBox="0 0 60 80" className="me-kazipot absolute" style={{ right: 0, bottom: H * 0.05, height: h * 0.72 }} aria-hidden>
        <rect x="27" y="10" width="6" height="70" rx="2" fill="#8b5a2b" />
        <path d="M6 14 h40 l10 9 l-10 9 h-40 z" fill="url(#me-kazipot)" />
        <defs>
          <linearGradient id="me-kazipot" x1="0" x2="1">
            <stop offset="0" stopColor="#f19a66" />
            <stop offset="1" stopColor="#ca5010" />
          </linearGradient>
        </defs>
        <text x="25" y="27" fontSize="11" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="sans-serif">
          POT
        </text>
      </svg>
      <div className="absolute" style={{ left: w * 0.14, bottom: H * 0.05 }}>
        <Finesek
          s={merilo(h)}
          pogled="stran"
          poza="potuje"
          korak={0.5}
          rokaStran={-34}
          vRoki={
            // palica iz dlani nazaj čez ramo, culica visi na koncu
            <div className="absolute" style={{ left: 148, top: 50, width: 400, height: 16, transformOrigin: "0 50%", rotate: "-118deg" }}>
              <div className="absolute inset-y-[3px] left-0 right-0 rounded-full bg-[linear-gradient(180deg,#b07a46,#7c4a1e)] shadow-[0_2px_4px_rgb(0_0_0/0.35)]" />
              <div className="me-culica absolute" style={{ left: 360, top: 8, width: 0, height: 0, rotate: "152deg" }}>
                <svg viewBox="0 0 200 200" width="200" height="200" className="absolute" style={{ left: -100, top: -30 }} aria-hidden>
                  <path d="M100 10 C 70 30, 30 60, 30 120 C 30 175, 170 175, 170 120 C 170 60, 130 30, 100 10 Z" fill="#dc2626" />
                  <g fill="#ffffff" opacity="0.9">
                    {[
                      [70, 80],
                      [125, 95],
                      [90, 130],
                      [140, 140],
                      [55, 140],
                    ].map(([x, y]) => (
                      <circle key={`${x}-${y}`} cx={x} cy={y} r="9" />
                    ))}
                  </g>
                  <path d="M78 22 q 22 -22 44 0 q -22 14 -44 0" fill="#b91c1c" />
                </svg>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Popravki: posnetek registracije v okvirju
// ---------------------------------------------------------------------------------------------------------------
const VRSTICE: { od: number; do: number; barva: string; napaka?: boolean; prost?: boolean }[] = [
  { od: 0.26, do: 0.62, barva: "#22c55e" },
  { od: 0.25, do: 0.64, barva: "#22c55e" },
  { od: 0.27, do: 0.45, barva: "#22c55e", napaka: true },
  { od: 0.26, do: 0.61, barva: "#0ea5e9" },
  { od: 0.26, do: 0.63, barva: "#22c55e" },
  { od: 0, do: 0, barva: "", prost: true },
  { od: 0, do: 0, barva: "", prost: true },
];

function PrizorPopravek({ h }: { h: number }) {
  const misli = useMenjava(1400);
  const wF = sirinaF(h);
  const wO = h * 1.45;
  const hO = h * 1.02;
  return (
    <div className="relative" style={{ width: wF * 0.9 + wO, height: h * 1.28 }}>
      {/* okvir s posnetkom registracije časa */}
      <div className="absolute rounded-[10px] bg-[linear-gradient(135deg,#f19a66,#ca5010_55%,#8f380b)] p-[3px] shadow-[0_12px_30px_-10px_rgb(0_0_0/0.8),0_0_20px_-8px_rgb(238_122_58/0.8)]" style={{ right: 0, bottom: h * 0.12, width: wO, height: hO }}>
        <div className="flex h-full w-full flex-col gap-[3%] overflow-hidden rounded-[7px] bg-[#1c1c1f] p-[5%]">
          <div className="flex items-center gap-[4%]">
            <span className="h-[7px] w-[7px] rounded-[2px] bg-[linear-gradient(135deg,#f19a66,#ca5010)]" />
            <span className="h-[4px] w-[40%] rounded-full bg-white/50" />
            <span className="ml-auto h-[4px] w-[18%] rounded-full bg-white/20" />
          </div>
          {VRSTICE.map((v, i) => (
            <div key={i} className={`relative flex flex-1 items-center gap-[4%] rounded-[3px] px-[3%] ${v.napaka ? "me-napaka bg-nok-500/15 ring-1 ring-nok-500/70" : v.prost ? "bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.06)_0_3px,transparent_3px_6px)]" : "bg-white/[0.05]"}`}>
              <span className="h-[3px] w-[9%] rounded-full bg-white/40" />
              <span className="relative h-[42%] flex-1 rounded-[2px] bg-white/[0.04]">
                {!v.prost && <span className="absolute inset-y-0 rounded-[2px]" style={{ left: `${v.od * 100}%`, width: `${(v.do - v.od) * 100}%`, background: v.barva, boxShadow: `0 0 6px ${v.barva}` }} />}
              </span>
              {v.napaka && <span className="text-[7px] font-bold leading-none text-nok-500">!</span>}
            </div>
          ))}
        </div>
      </div>
      {/* oblaček misli */}
      <div className="absolute flex items-end gap-[3px]" style={{ left: wF * 0.45, top: -h * 0.06 }}>
        <span className="h-[5px] w-[5px] rounded-full bg-white/70" />
        <span className="h-[8px] w-[8px] rounded-full bg-white/80" />
        <span className="fos-popup flex h-[22px] items-center gap-[3px] rounded-full px-2 font-display text-xs font-bold text-fines-300">{misli ? "?" : "hmm"}</span>
      </div>
      {/* Finesek gleda okvir, premišljeno */}
      <div className="me-misli absolute bottom-0 left-0" style={{ transformOrigin: "50% 100%" }}>
        <Finesek s={merilo(h)} pogled="stran" poza="stoji" rokaStran={misli ? 8 : 18} />
      </div>
    </div>
  );
}
