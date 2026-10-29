"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Barva pove, kaj gumb naredi (app_instructions.md → Barve).
 * FinOS: vsaka barva ima preliv, senco v svoji barvi, dvig ob hoverju in bleščico (finos_stil.txt → Gumbi).
 */
export type ButtonVariant = "primary" | "success" | "danger" | "warning" | "sync" | "neutral";

export const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-[linear-gradient(135deg,#f19a66,#ca5010_55%,#8f380b)] shadow-[0_8px_24px_-8px_rgb(202_80_16/0.8),inset_0_1px_0_rgb(255_255_255/0.3)] hover:shadow-[0_12px_32px_-8px_rgb(238_122_58/0.95),inset_0_1px_0_rgb(255_255_255/0.35)]",
  success:
    "text-white bg-[linear-gradient(135deg,#4ade80,#16a34a_55%,#15803d)] shadow-[0_8px_24px_-8px_rgb(22_163_74/0.8),inset_0_1px_0_rgb(255_255_255/0.3)]",
  danger:
    "text-white bg-[linear-gradient(135deg,#f87171,#dc2626_55%,#b91c1c)] shadow-[0_8px_24px_-8px_rgb(220_38_38/0.8),inset_0_1px_0_rgb(255_255_255/0.3)]",
  warning:
    "text-ink-900 bg-[linear-gradient(135deg,#fde68a,#fbbf24_55%,#f59e0b)] shadow-[0_8px_24px_-8px_rgb(245_158_11/0.8),inset_0_1px_0_rgb(255_255_255/0.4)]",
  sync: "text-white bg-[linear-gradient(135deg,#60a5fa,#2563eb_55%,#1d4ed8)] shadow-[0_8px_24px_-8px_rgb(37_99_235/0.8),inset_0_1px_0_rgb(255_255_255/0.3)]",
  neutral:
    "text-ink-100 border border-white/15 bg-white/[0.06] backdrop-blur-md shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-white/[0.12] hover:border-white/25",
};

const BASE =
  "group/btn relative isolate inline-flex items-center justify-center gap-2 overflow-hidden font-semibold transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fines-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950";

/** Bleščica, ki ob hoverju preleti gumb. */
function Blesk() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 -translate-x-full bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.35)_50%,transparent_70%)] transition-transform duration-700 ease-out group-hover/btn:translate-x-full"
    />
  );
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  /** Hover tekst - kaj točno gumb naredi (max 6-8 besed). Obvezno. */
  hint: string;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  size?: "md" | "lg";
  children?: ReactNode;
};

export function Button({ hint, variant = "primary", icon: Icon, size = "md", className = "", children, type = "button", ...rest }: Props) {
  const sizing = size === "lg" ? "h-12 px-6 text-base rounded-xl" : "h-10 px-4 text-sm rounded-[10px]";
  return (
    <button type={type} title={hint} aria-label={typeof children === "string" ? undefined : hint} className={`${BASE} ${sizing} ${VARIANTS[variant]} ${className}`} {...rest}>
      <Blesk />
      {Icon && <Icon className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover/btn:scale-110" aria-hidden />}
      {children}
    </button>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children"> & {
  hint: string;
  icon: LucideIcon;
  /** `ghost` = steklen okrogel gumb (info / zapri / meni). */
  variant?: "ghost" | ButtonVariant;
};

/** Okrogel gumb samo z ikono, 40 px. */
export function IconButton({ hint, icon: Icon, variant = "ghost", className = "", type = "button", ...rest }: IconButtonProps) {
  const style =
    variant === "ghost"
      ? "text-ink-200 border border-white/10 bg-white/[0.05] backdrop-blur-md hover:text-fines-300 hover:border-fines-400/50 hover:shadow-[0_0_24px_-4px_rgb(238_122_58/0.7)]"
      : VARIANTS[variant];
  return (
    <button type={type} title={hint} aria-label={hint} className={`${BASE} h-10 w-10 shrink-0 rounded-full ${style} ${className}`} {...rest}>
      <Blesk />
      <Icon className="h-5 w-5 transition-transform duration-300 group-hover/btn:rotate-[8deg] group-hover/btn:scale-110" aria-hidden />
    </button>
  );
}
