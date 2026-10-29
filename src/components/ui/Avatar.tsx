type Props = { besedilo: string; velikost?: "sm" | "md" | "xl"; className?: string; title?: string };

const VELIKOST = {
  sm: "h-9 w-9 rounded-[10px] text-xs",
  md: "h-11 w-11 rounded-xl text-sm",
  xl: "h-20 w-20 rounded-[22px] text-2xl sm:h-24 sm:w-24 sm:rounded-[26px] sm:text-3xl",
};

/** Začetnice osebe na oranžnem prelivu s sijem (zaposleni, vodja). */
export function Avatar({ besedilo, velikost = "md", className = "", title }: Props) {
  return (
    <span title={title} className={`fos-fines-fill relative grid shrink-0 place-items-center overflow-hidden font-display font-bold tracking-tight text-snow ${VELIKOST[velikost]} ${className}`}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgb(255_255_255/0.25),transparent)]" />
      <span className="relative">{besedilo}</span>
    </span>
  );
}
