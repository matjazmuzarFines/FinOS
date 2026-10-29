"use client";

import { Sparkles } from "lucide-react";
import { nastaviAnimacije, useAnimacije } from "@/lib/animacije";

/** Preklopnik dodatnih animacij (levo zgoraj v glavi). Vklopljen: oranžen preliv s sijem, izklopljen: steklen siv. */
export function AnimacijeStikalo() {
  const vklop = useAnimacije();
  const hint = vklop ? "Ustavi dodatne animacije in zmanjšaj porabo" : "Vklopi dodatne animacije (Finesek, ozadje)";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={vklop}
      aria-label={hint}
      title={hint}
      onClick={() => nastaviAnimacije(!vklop)}
      className="group/sw flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] pl-1.5 pr-1.5 backdrop-blur-md transition-all duration-300 hover:border-fines-400/40 hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fines-400 sm:pr-3"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
          vklop
            ? "bg-[linear-gradient(135deg,#f19a66,#ca5010_60%,#8f380b)] shadow-[0_0_16px_-2px_rgb(238_122_58/0.8),inset_0_1px_0_rgb(255_255_255/0.3)]"
            : "bg-ink-700 shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)]"
        }`}
      >
        <span
          className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-snow shadow-[0_2px_6px_rgb(0_0_0/0.5)] transition-all duration-300 ease-[cubic-bezier(0.3,1.5,0.5,1)] ${
            vklop ? "left-[22px] text-fines-500" : "left-0.5 text-ink-400"
          }`}
        >
          <Sparkles className={`h-3 w-3 transition-transform duration-300 ${vklop ? "rotate-0 scale-100" : "-rotate-45 scale-75"}`} aria-hidden />
        </span>
      </span>
      <span className={`hidden text-xs font-semibold transition-colors sm:inline ${vklop ? "text-ink-100" : "text-ink-400"}`}>Animacije</span>
    </button>
  );
}
