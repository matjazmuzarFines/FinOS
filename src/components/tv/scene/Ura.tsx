"use client";

import { createContext, memo, useContext, useEffect, useState } from "react";

/**
 * Živa ura na animiranih scenah FIN:TV (desno zgoraj): samo ure in minute (datum ni potreben - prostor za podatek scene).
 * Čas = ura naprave + popravek strežnika (`OdmikUre` iz Predvajalnika - ura televizorja ni nujno točna).
 * Poraba: preveri se enkrat na sekundo, izriše pa samo ob menjavi minute (brez sekund in brez utripanja).
 */

/** Popravek ure: čas strežnika - čas naprave (ms). */
export const OdmikUre = createContext(0);

const dve = (n: number) => String(n).padStart(2, "0");
const minuta = (odmik: number) => Math.floor((Date.now() + odmik) / 60_000);

export const UraSceni = memo(function UraSceni() {
  const odmik = useContext(OdmikUre);
  const [m, setM] = useState(() => minuta(odmik));
  useEffect(() => {
    const t = setInterval(() => setM(minuta(odmik)), 1000);
    return () => clearInterval(t);
  }, [odmik]);
  const d = new Date(m * 60_000);
  return (
    // suppressHydrationWarning: čas na strežniku in v brskalniku ni isti (sličice v urejevalniku)
    <div className="fos-tv-ura absolute right-[110px] top-[62px]">
      <span suppressHydrationWarning className="bg-[linear-gradient(180deg,#ffffff,#dcdcdf_60%,#9a9aa1)] bg-clip-text font-display text-[96px] font-bold leading-none tracking-[-0.03em] text-transparent tabular-nums">
        {dve(d.getHours())}
        <span className="mx-[0.04em] text-[#ee7a3a]">:</span>
        {dve(d.getMinutes())}
      </span>
    </div>
  );
});
