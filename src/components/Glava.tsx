"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Info, LogOut } from "lucide-react";
import { Button, IconButton } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Znak } from "./Znak";
import { APP_VERSION, VERZIJE } from "@/lib/verzije";

/** Glava aplikacije: logo (bela steklena ploščica), znak FIN:OS, "i" (spremembe), Izhod; spodaj oranžna črta s prelivom. */
export function Glava() {
  const [info, setInfo] = useState(false);

  return (
    <>
      <motion.header
        className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/55 backdrop-blur-xl"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.1 }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-1.5 px-3 sm:gap-3 sm:px-6">
          <Link
            href="/"
            title="Domača stran FIN:OS"
            className="group relative flex min-w-0 items-center rounded-xl bg-white px-2.5 py-1.5 shadow-[0_6px_20px_-6px_rgb(0_0_0/0.7),inset_0_-2px_0_rgb(0_0_0/0.06)] transition-transform duration-300 hover:-translate-y-0.5 sm:px-3.5 sm:py-2"
          >
            <Image src="/fines-logo.png" alt="FINES d.o.o. logotip" width={136} height={36} priority className="h-auto w-20 sm:w-[110px]" />
          </Link>
          <span aria-hidden className="mx-1 hidden h-7 w-px bg-white/15 sm:block" />
          <span className="hidden sm:block">
            <Znak className="text-2xl" />
          </span>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-ink-300 md:inline" title="Trenutna verzija aplikacije">
              v{APP_VERSION}
            </span>
            <IconButton hint="Prikaži verzije in spremembe aplikacije" icon={Info} onClick={() => setInfo(true)} />
            <Button hint="Odjava bo na voljo s prijavo" variant="primary" icon={LogOut} className="max-sm:w-10 max-sm:px-0">
              <span className="max-sm:hidden">Izhod</span>
            </Button>
          </div>
        </div>
        {/* 4 px oranžna črta (standard) - s prelivom in bleščico */}
        <div aria-hidden className="relative h-1 overflow-hidden bg-[linear-gradient(90deg,#8f380b,#ca5010_30%,#ee7a3a_60%,#ca5010)]">
          <span className="fos-shine absolute inset-0" />
        </div>
      </motion.header>

      <Modal open={info} title="Verzije in spremembe" onClose={() => setInfo(false)}>
        <div className="flex flex-col gap-5">
          {VERZIJE.map((v) => (
            <section key={v.verzija} className="relative border-l-2 border-fines-500/60 pl-4">
              <span aria-hidden className="fos-fines-fill absolute -left-[5px] top-1.5 h-2 w-2 rounded-full" />
              <h3 className="flex items-baseline gap-2">
                <span className="fos-text-fines font-display text-base font-bold">Verzija {v.verzija}</span>
                <span className="text-xs text-ink-400">{v.datum}</span>
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-200 marker:text-fines-400">
                {v.spremembe.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}
