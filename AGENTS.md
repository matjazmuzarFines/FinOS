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
- Migracije (SQL) so v `supabase/migrations/` (številčene, idempotentne); uporabnik jih zažene v Supabase -> SQL Editor.
  - `001_zaposleni.sql`: `fos_oddelek` (id, ime_oddelka), `fos_zaposleni` (id, ime, priimek, st_kartice, id_oddelek, id_vodja).
    Kartica je enolična med vidnimi zaposlenimi.
  - `002_vodje.sql`: `fos_vodje` (id, id_zaposlenega) = kdo je vodja; `ln_fos_zaposleni_vodja` (id_zaposlenega, id_vodja -> fos_vodje.id)
    = kdo je vodja posameznemu zaposlenemu (en viden zapis na zaposlenega, ob menjavi se star skrije -> zgodovina).
    Piše se samo prek funkcij `fos_nastavi_vodjo` in `fos_nastavi_je_vodja` (aplikacija jih kliče ob shranjevanju).
    Stolpca `fos_zaposleni.id_vodja` ni več (002 ga prenese v ln tabelo in odstrani) - en vir podatka o vodji.
  - `005_super_admin.sql`: `fos_zaposleni.super_admin` (piše samo strežnik) + `fos_je_super_admin()` (za zaklep).
  - `004_hierarhija.sql`: `fos_nastavi_vodjo` zavrne krog v hierarhiji (vodja, ki je posredno podrejen zaposlenemu).
  - `003_zaposleni_prijava.sql`: `fos_zaposleni.email`, `uporabnisko_ime`, `id_uporabnika` (auth.users). GESLA NI v naših tabelah:
    hrani ga Supabase Auth (bcrypt). Račun ustvari / spremeni samo strežnik (`/api/zaposleni/racun`, ključ service_role);
    aplikacija teh treh stolpcev ne sme pisati (pravice po stolpcih). Nov urejljiv stolpec fos_zaposleni -> dodaj ga v `grant` v 003.
- Pravila za nove tabele: ID `bigint generated always as identity`, tuji ključi `id_<tabela>`, `visible`, `created_at`, `updated_at`
  (trigger `fos_set_updated_at`), RLS select/insert/update samo `authenticated` (brez delete). Podatke iz tabel z več vrednostmi
  na zapis (npr. dostopi do prostorov) vedno v svoje / povezovalne tabele, ne v stolpce `fos_zaposleni`.
- Spremenljivke okolja: `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FOS_UREDNIKI`,
  `SUPABASE_SERVICE_ROLE_KEY`) - nikoli v git; enake vpiši tudi na Vercelu. `SUPABASE_SERVICE_ROLE_KEY` je samo za strežnik
  (`src/lib/supabaseStreznik.ts`, API poti) - nikoli `NEXT_PUBLIC_`, nikoli v komponento za brskalnik.
- Prijava: domača stran FIN:OS brez prijave; Administracija zaklenjena (`Zaklep` v `administracija/layout.tsx`).
- Pravice (do tabele dostopov): v Administracijo sme **Super Admin** (stikalo v Nastavitvah zaposlenega, `fos_zaposleni.super_admin`,
  prijava z e-mailom / uporabniškim imenom + geslom). `NEXT_PUBLIC_FOS_UREDNIKI` je zasilni seznam (npr. fines@fines.si), da se ne
  zaklenemo ven (`src/lib/uredniki.ts`, `useDostop()` / `useLahkoUreja()`). Super Admin sebi ne more odvzeti pravice. To je zaklep v aplikaciji; v bazi RLS za zdaj dovoli pisanje vsem prijavljenim.

## Tehnologija
- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS 4.
- Animacije: `motion` (`import { motion } from "motion/react"`), CSS keyframes v `globals.css`, canvas za ozadja.
- Ikone: `lucide-react`.
- Povleci in spusti: `@dnd-kit/core` (miška, dotik, tipkovnica).
- Grafi (ko bodo potrebni): po pravilih iz `finos_stil.txt` (prelivi, animiran izris).
- Lokalno: port **3010** (`next start -H 0.0.0.0 -p 3010`), da ne trči z ostalimi Fines projekti.

## Struktura
- `src/app/globals.css` - barvni žetoni + FinOS razredi (`fos-glass`, `fos-text-grad`, `fos-text-fines`, `fos-fines-fill`, `fos-shine`, `fos-border-anim`, `fos-grid`, `fos-noise`).
- `src/components/ui/` - standardne komponente (Button, IconButton, Modal) v FinOS slogu.
- `src/components/` - Intro, Ozadje, Glava, Znak, Ura, VstopKartica, Moduli, Domov.
- `src/components/finesek/` - maskota Finesek (`Finesek` = lik iz delov, `ZnakPrizor` = prizor s stikalom ob znaku FIN:OS).
- `public/finesek/` - obdelani deli Fineseka (WebP); izvorne slike v `data/finesek` in `data/finesek_deli`.
- `src/lib/animacije.ts` + `src/components/ui/AnimacijeStikalo.tsx` - stikalo dodatnih animacij (`useAnimacije()`, CSS `fos-deko`).
- `src/lib/verzije.ts` - verzije za okno "i".
- `src/lib/tema.ts` + `src/components/ui/TemaStikalo.tsx` - svetla / temna tema (`useTema()`, `<html data-tema>`); `src/lib/nastavitev.ts` - skupna shramba nastavitev brskalnika.
- `src/lib/supabase.ts`, `src/components/Seja.tsx` (zaklep s prijavo, `useSeja()`, `odjava`), `src/components/Prijava.tsx`.
- `src/lib/nav.ts` - navigacija (ploščice Administracije, gumb nazaj); `src/components/Okvir.tsx` - okvir podstrani.
- `src/app/administracija/` - Administracija; `src/components/admin/` (Ploscice, SeznamZaposlenih, ListZaposlenega).
- `src/lib/zaposleni.ts` - branje zaposlenih in oddelkov (`useZaposleni()`, skupen predpomnilnik), `hierarhija()`, `premakniZaposlenega()`.
- `src/components/admin/Hierarhija.tsx` - Prikaz hierarhije (drevo, prazna mesta, povleci in spusti).
- `src/components/ui/` še: GlavaStrani (+ NaslovRazdelka, gumb Nazaj), Polje (POLJE, IskalnoPolje, Izbira, Stikalo), Avatar,
  PraznoStanje, SaveBar, Obvestila (`obvesti()`). `src/components/admin/ZaposleniObrazec.tsx` - polja zaposlenega + okno Dodaj.

## Stanje
- 2.01: prijava (Supabase Auth, cela aplikacija), svetla / temna tema, Administracija -> Zaposleni (seznam in list).
- 2.02: dodajanje in urejanje zaposlenih v aplikaciji (vodje prek fos_vodje + ln_fos_zaposleni_vodja).
- 2.03: FIN:OS brez prijave, Administracija samo fines@fines.si; prijava zaposlenih v FIN:ME (e-mail / uporabniško ime + geslo).
- 2.08: Super Admin (stikalo v Nastavitvah) - dostop do Administracije z računom zaposlenega.
- 2.04: Prikaz hierarhije (drevo vodij, dodajanje na prazna mesta, povleci in spusti).
- ODPRTO (varnost): računi zaposlenih so v istem Supabase projektu kot ostale Fines aplikacije, kjer RLS dovoli vse vlogi
  `authenticated`. Zaposleni s FIN:ME računom bi z javnim ključem lahko bral / pisal tudi te tabele. Pred prvim računom FIN:ME
  zaostriti RLS (npr. izključiti `app_metadata.fos_vloga = 'zaposleni'`) v vseh Fines projektih in v fos_ tabelah.
- Moj Fines še ne vodi nikamor.
