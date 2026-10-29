# FIN:OS - navodila projekta

> FIN:OS = **Fines Operating System**: sistem za notranje vodenje podjetja FINES d.o.o.
> Skupna pravila so v `../FINES_Standardi/app_instructions.md`. Ta datoteka jih **dopolni in, kjer je to izrecno napisano, nadomesti**.
> Vizualni slog (prelivi, animacije, sence) in vsi popravki uporabnika so v **`finos_stil.txt`** - ta ima prednost pred razdelkom "Standardne komponente" v skupnih navodilih.

## Deli aplikacije
- **FIN:OS** - začetna stran in ogrodje (uvodna animacija, navigacija).
- **FIN:OS Admin** - v aplikaciji napisano **"Administracija"**: vodje in kadrovska.
- **FIN:ME** - v aplikaciji napisano **"Moj Fines"**: portal za zaposlene.
- **FIN:DOOR** - podprogram za prostore: dostopi do prostorov, urejanje dostopov, kartice zaposlenih.
- Funkcije: beleženje delovnega časa, dopusti, prosti čas, bolniška, dostopi do prostorov, urejanje dostopov, kartice zaposlenih.
- Imena podprogramov se vedno pišejo `FIN:<IME>` (velike črke, dvopičje), v znaku komponenta `Znak` (`src/components/Znak.tsx`).
- Slogan: **People Bake for People**.

## Baza (Supabase, enaka kot ostali Fines projekti)
- Tabele: `fos_...` (npr. `fos_zaposleni`, `fos_delovni_cas`, `fos_dopusti`).
- Povezovalne tabele: `ln_fos_{tabela1}_{tabela2}` (npr. `ln_fos_zaposleni_prostori`).
- Tabele podprograma FIN:DOOR prav tako s predpono `fos_` (npr. `fos_door_prostori`, `fos_door_dostopi`, `fos_door_kartice`).
- Ostala pravila baze (brez brisanja - `visible`, ID-ji, RLS samo `authenticated`) veljajo iz skupnih navodil.
- Spremenljivke okolja: `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) - nikoli v git.

## Tehnologija
- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS 4.
- Animacije: `motion` (`import { motion } from "motion/react"`), CSS keyframes v `globals.css`, canvas za ozadja.
- Ikone: `lucide-react`.
- Grafi (ko bodo potrebni): po pravilih iz `finos_stil.txt` (prelivi, animiran izris).
- Lokalno: port **3010** (`next start -H 0.0.0.0 -p 3010`), da ne trči z ostalimi Fines projekti.

## Struktura
- `src/app/globals.css` - barvni žetoni + FinOS razredi (`fos-glass`, `fos-text-grad`, `fos-text-fines`, `fos-fines-fill`, `fos-shine`, `fos-border-anim`, `fos-grid`, `fos-noise`).
- `src/components/ui/` - standardne komponente (Button, IconButton, Modal) v FinOS slogu.
- `src/components/` - Intro, Ozadje, Glava, Znak, Ura, VstopKartica, Moduli, Domov.
- `src/lib/verzije.ts` - verzije za okno "i".

## Stanje
- 1.01: samo začetna stran. Gumbi Administracija / Moj Fines / Izhod še ne vodijo nikamor.
- Prijava (Supabase Auth) se doda, preden gre aplikacija v uporabo - takrat tudi Izhod = odjava.
