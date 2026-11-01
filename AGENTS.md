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
- **Osnutki** baze gredo v `supabase/osnutki/` - samo za pregled, NE zaganjaj. Uporabnik vsako tabelo pregleda in potrdi,
  šele nato gre (po korakih) v `migrations/`. Dokler ni potrjeno, UI dela s testnimi podatki (značka "Testni podatki").
  - `010_urniki.sql`: `fos_dnevi`, `fos_intervali` (okno `cas_od`-`cas_do`, obvezna `id_statistike`, `vrstni_red`; stolpca `velja_od` / `velja_do` sta v bazi, a se ne uporabljata - interval velja vedno),
    `ln_fos_intervali_dnevi`, `fos_urniki` (`vrstni_red`), `ln_fos_urniki_intervali`, `fos_prazniki` (samo posebni dela prosti dnevi -
    standardne izračuna `src/lib/prazniki.ts`), `ln_fos_zaposleni_urniki` = urnik zaposlenega (EN viden zapis na
    zaposlenega, ob menjavi se star skrije -> zgodovina, `velja_od`); piše se SAMO prek `fos_nastavi_urnik(id_zaposlenega,
    id_urnika)`. Brez posebnih skupin (kot v starem sistemu) - zaposleni se veže neposredno na urnik.
  - Registracija časa - dogovor: interval = časovno okno z NATANKO eno statistiko in VRSTO (014): Prihod (okno prihoda,
    čas od prihoda do izhoda gre v statistiko), Izhod (okno izhoda) - oba brez tipke, samodejno ob prislonu kartice -
    in Tipka (obvezna tipka; malica, odmor, poslovni, privatni ...). En urnik = intervali vseh treh vrst (Režija ima
    ločen Prihod in Izhod 00:00-23:59). Brez toleranc. Dogodek = štempljanje (čas, tipka ali brez, vir: Krmilnik, Ročni
    popravek, Online aplikacija - `VIRI` v cas.ts).
    Delo čez polnoč se VEDNO šteje v dan začetka (prihoda): časi > 1440 min v dnevu prihoda; okno intervala
    `cas_do < cas_od` = čez polnoč (`cezPolnoc()`).
  - `011_pravila_obveznost.sql` (migrations, zaženi po 014): pravila knjiženja v `fos_intervali`
    po vrsti - prihod: `zacetek_ne_prej`, `zacetek_zaokrozi`, `zacetek_korak`; izhod: `konec_ne_pozneje`, `konec_zaokrozi`,
    `konec_korak`, `presezek`, `presezek_korak`; tipka: `trajanje_max` (seštej trajanje, min na dan) +
    `id_statistike_prekoracitve` (npr. Zamuda) + `ln_fos_urniki_dnevi` (obveznost urnika po dnevih v minutah, piše se prek `fos_nastavi_obveznost`).
    Dokler ni zagnan, aplikacija pravila / obveznost bere ločeno (`naloziPravila`) in pade na testne (`virPravil` = "test",
    samo v brskalniku) - urniki iz 010 delajo naprej.
  - Knjiženje (`src/lib/knjizenje.ts`, čista funkcija `knjizi`): krmilnik VEDNO zapiše dejanski čas, knjižen čas je izračun.
    Smer žiga samodejna (odsoten -> prihod, prisoten -> izhod); `Zig` = čas, `id_tipke` (null = brez), vir. Izmena = prihod
    brez tipke do izhoda brez tipke. Interval prihoda = prvi interval vrste Prihod (vrstni red), ki velja na dan in v okno
    katerega pade prihod; izven oken = dejanski čas + napaka, izmena se šteje normalno (najbližje okno). Izhod brez tipke =
    prvi interval vrste Izhod z oknom, ki vsebuje izhod (pravila konca + presežka); izven = dejanski čas + napaka.
    Žig s tipko -> interval urnika s to tipko -> njegova statistika do naslednjega žiga; OBA žiga v oknu, sicer napaka;
    tipka brez intervala = napaka (čas ni razvrščen). Seštej trajanje: odseki tipke v dnevu skupaj do `trajanje_max`,
    preostanek v `id_statistike_prekoracitve`. Napake: `NapakaKnjizenja` (rdeča oznaka). KASNEJE: Dovolilnice - izničijo
    napake in pravila (velja dejanski čas). Dnevni saldo = delo - obveznost (presežek in manjko gresta v saldo, vse
    presežke štejemo enako); presežek PO IZMENAH: izmene po vrsti seštevajo delo, presežek, ki ga ustvari izmena, se
    prizna po pravilu NJENEGA izhoda (npr. delo od doma brez zaokroževanja - kot stari sistem). Dan se VEDNO računa po
    trenutnih nastavitvah (preračun za nazaj kasneje z gumbom).
  - `012_saldo.sql` (migrations): `fos_saldo_zacetno` (en viden zapis na zaposlenega: `saldo_min`, `datum` = od tega dne se
    štejejo dnevni saldi) in `fos_saldo_meseci` (zaposleni + `mesec` 1. v mesecu: `izplacilo_min`, `zaznamki`); piše se prek
    `fos_nastavi_zacetni_saldo` / `fos_nastavi_mesec_salda`. Brskalnik: `src/lib/saldo.ts` (`useSaldo`, `shraniSaldo`).
    Prenos iz prejšnjega obdobja = začetno stanje + dnevni saldi od datuma do začetka obdobja - izplačila preteklih mesecev
    (računa RegistracijaCasa); stanje na koncu = prenos + saldo obdobja - izplačilo meseca.
  - 4-izmensko delo (obveznost v ciklu namesto po dnevih v tednu) - ZAENKRAT NE; obveznost je po dnevih v tednu.
  - `013_krmilnik.sql` (migrations, uporabnik zažene): `fos_tipke` (`tipka` 1 ... N enolična med vidnimi, `besedilo` = napis na
    krmilniku) + `fos_intervali.id_tipke`. Tipka je DEL INTERVALA (statistika je samo za izračun v ozadju); interval brez
    tipke = prihod / izhod, samodejno ob prislonu kartice; vsi ostali intervali imajo tipko (ista tipka je lahko v več
    intervalih). Nastavitve -> Krmilnik (`Krmilnik.tsx`, `shraniTipke`), izbira v podrobnostih intervala (`IzbiraTipke`).
  - `014_vrsta_intervala.sql` (migrations): `fos_intervali.vrsta` ('prihod' / 'izhod' / 'tipka'; tipka obvezna natanko pri
    'tipka'), `fos_tipke.prikaz` (text[]: 'krmilnik', 'fin_me'; prazno = nikjer), `fos_tipke.funkcija` ('info', 'preklici'
    ali null = tipka za interval). Tipke, ki jo uporablja interval, ni mogoče skriti ne ji dati funkcije.
    Brez 013 so tipke testne; brez 014 se 013 prebere, vrsta se ugiba (kot v migraciji), `virTipk` = "test" (samo brskalnik).
  - `016_prihod_izhod_s_tipko.sql`: tipka je obvezna pri vrsti 'tipka', pri 'prihod' / 'izhod' NEOBVEZNA = drug prihod / izhod,
    ki ga izbere tipka (npr. 3 Izredno: nadure brez napake, dejanski čas, presežek 15 min). Knjiženje: žig s tipko -> po
    smeri prihod / izhod s to tipko, sicer odsotnost (vrsta Tipka). Samodejni prihod / izhod = intervali BREZ tipke.
    Izredno je začasno (navodilo zaposlenim) - kasneje ga nadomestijo Dovolilnice (potrjene nadure izničijo napako).
  - `017_uvoz_zaposlenih.sql`: enkraten uvoz iz poročila oktober 2026 - kartice 15 obstoječim (Drinić = Drnić, Muzar = Mužar,
    Živanič = Živanić), 24 novih zaposlenih z oddelkom, urnik samo tistim brez urnika. Izpuščen Prokhorov (Nezaposleni);
    serviserji brez urnika (urnika "Gibljivo 24 ur servis" v bazi ni). Pri uvozu dogodkov izpusti Napaka, Nedovoljen vhod, Test.
  - `001_zaposleni.sql`: `fos_oddelek` (id, ime_oddelka), `fos_zaposleni` (id, ime, priimek, st_kartice, id_oddelek, id_vodja).
    Kartica je enolična med vidnimi zaposlenimi.
  - `002_vodje.sql`: `fos_vodje` (id, id_zaposlenega) = kdo je vodja; `ln_fos_zaposleni_vodja` (id_zaposlenega, id_vodja -> fos_vodje.id)
    = kdo je vodja posameznemu zaposlenemu (en viden zapis na zaposlenega, ob menjavi se star skrije -> zgodovina).
    Piše se samo prek funkcij `fos_nastavi_vodjo` in `fos_nastavi_je_vodja` (aplikacija jih kliče ob shranjevanju).
    Stolpca `fos_zaposleni.id_vodja` ni več (002 ga prenese v ln tabelo in odstrani) - en vir podatka o vodji.
  - `006_dostopi_aplikacije.sql`: `fos_aplikacije` (ime, `predpone` tabel, `kosare` za datoteke) + `ln_fos_zaposleni_aplikacije`
    (zaposleni -> Dostopi, stikalo na aplikacijo). Na VSAKI tabeli v public in storage omejevalna politika `fos_dostop`
    (`fos_ima_dostop(ime)`): račun, povezan z zaposlenim, sme samo v vklopljene aplikacije, v fos_ tabele samo kot Super Admin;
    računi brez zaposlenega (npr. fines@fines.si) delajo kot prej. **Nove tabele dobijo politiko same** (dogodek `fos_nova_tabela`
    ob CREATE TABLE) - migracije ni treba ponavljati. Nova aplikacija = nova vrstica v `fos_aplikacije`.
    Ko FIN:OS poveže obstoječi račun (npr. vodja v Production), zaposleni dobi vklopljene vse aplikacije.
  - `007_kadrovsko.sql`: `fos_zaposleni_kadrovsko` (en viden zapis na zaposlenega): osebni podatki (EMŠO, davčna, ZZZS),
    stalno / začasno prebivališče (vsako s km do dela), TRR, kontakt v sili, zaposlitev (pogodba, delovno mesto, tedenske ure, dopust,
    izobrazba). Ločeno od fos_zaposleni (občutljivo, ne bere se za seznam). Polja opisuje `RAZDELKI` v `src/lib/kadrovsko.ts`.
  - `008_funkcije.sql`: funkcije (pravice) uporabnikov: `fos_funkcije` (koda, ime, opis, `obsega`) +
    `ln_fos_zaposleni_funkcije` - piše SAMO strežnik (`/api/pravice`), aplikacija bere. `fos_ima_funkcijo(koda)`,
    `fos_moje_funkcije()`; `fos_je_super_admin()` = funkcija `super_admin` (stolpca `fos_zaposleni.super_admin` ni več).
    Funkcija `kadrovanje`: omejevalna politika `fos_kadrovanje` na `fos_zaposleni_kadrovsko` - brez nje baza osebnih
    podatkov ne vrne (tudi Super Adminu ne). `fos_zaposleni_zaposlitev` = pogodba, ure, dopust, izobrazba (iz 007, brez Kadrovanja).
    Nova funkcija = nova vrstica v `fos_funkcije` (v 008) + ikona v `IKONE` (`src/lib/funkcije.ts`) + preverjanje v bazi.
  - `005_super_admin.sql`: (zgodovina) stolpec `super_admin` + `fos_je_super_admin()`; po 008 se ne izvede več.
  - `004_hierarhija.sql`: `fos_nastavi_vodjo` zavrne krog v hierarhiji (vodja, ki je posredno podrejen zaposlenemu).
  - `009_statistike.sql`: `fos_lastnosti` (kvadratki statistik), `fos_statistike` (koda enolična med vidnimi, barva, ikona),
    `ln_fos_statistike_lastnosti` + 12 začetnih statistik. ZAGNANO - aplikacija bere in piše (casNastavitve.ts:
    `naloziStatistike`, `shraniStatistiko`, `skrijStatistiko`; brez baze pade na testne podatke z značko).
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
- Pravice = **funkcije** (Nastavitve -> Pravice in dostopi, `PraviceDostopi`, `/api/pravice`, `src/lib/klicatelj.ts`).
  V Administracijo sme funkcija **Super Admin** (prijava z e-mailom / uporabniškim imenom + geslom). **Kadrovanje** = osebni
  podatki zaposlenih (zaščita v bazi); dodeli / odvzame jo samo, kdor jo ima (ali zasilni račun). V brskalniku `useFunkcija(koda)`. `NEXT_PUBLIC_FOS_UREDNIKI` je zasilni seznam (npr. fines@fines.si), da se ne
  zaklenemo ven (`src/lib/uredniki.ts`, `useDostop()` / `useLahkoUreja()`). Super Admin sebi ne more odvzeti pravice. To je zaklep v aplikaciji; v bazi RLS za zdaj dovoli pisanje vsem prijavljenim.

## Tehnologija
- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS 4.
- Animacije: `motion` (`import { motion } from "motion/react"`), CSS keyframes v `globals.css`, canvas za ozadja.
- Ikone: `lucide-react`.
- Povleci in spusti: `@dnd-kit/core` (miška, dotik, tipkovnica), za zlaganje seznamov `@dnd-kit/sortable`.
- Grafi (ko bodo potrebni): po pravilih iz `finos_stil.txt` (prelivi, animiran izris).
- Lokalno: port **3010** (`next start -H 0.0.0.0 -p 3010`), da ne trči z ostalimi Fines projekti.

## Struktura
- `src/app/globals.css` - barvni žetoni + FinOS razredi (`fos-glass`, `fos-text-grad`, `fos-text-fines`, `fos-fines-fill`, `fos-shine`, `fos-border-anim`, `fos-grid`, `fos-noise`).
- `src/components/ui/` - standardne komponente (Button, IconButton, Modal) v FinOS slogu.
- `src/components/` - Intro, Ozadje, Glava, Znak, Ura, VstopKartica, Moduli, Domov.
- Široke strani (veliko nastavitev): `SIROKE_STRANI` / `sirinaStrani()` v nav.ts (Okvir in Glava) - nova = nov vnos.
- Dogodki (štempljanja): `src/lib/dogodki.ts` - `useDogodki(oseba, od, do)` bere `fos_dogodki` po osebi in obdobju
  (RegistracijaCasa: od začetnega stanja salda do konca obdobja), `podatkiDne` = dogodki dneva (brez baze testna
  štempljanja), `dodajDogodek` (vir rocno) in `spregledaj` (`fos_spreglej_dogodek`), po zapisu ponovno branje.
  Izračun spregledanih ne vidi (`izracunajDan`). Dogodka se ne briše in ne ureja. Dan z ročnim / spregledanim = oznaka popravek.
  `015_dogodki.sql` (`fos_dogodki`: cas = dejanski trenutek, datum = dan prihoda, id_tipke, vir krmilnik / online / rocno /
  uvoz, st_kartice; update samo stolpcev spregleda). Čas v aplikaciji = minute od polnoči dneva `datum` (> 1440 = naslednji dan).
  `018_uvoz_dogodkov_oktober.sql`: 2429 žigov iz poročila starega sistema (data/fullreport xlsx oktober.xlsx) - rekonstrukcija:
  vrstica = par začetek-konec z imenom intervala, "(*HH:MM)" = dejanski čas; "Zamuda" vrstice = izračunan del odmora;
  Izhod + Vhod ob istem času brez (*) = izračunana razdelitev izmene (ni žigov); Napaka / Nedovoljen / Test izpuščeni.
  `019_uvoz_delo_od_doma.sql`: uvoženim koncem dela od doma (10) doda tipko 101 - delo od doma je Prihod + Izhod s tipko
  101 (izhod: presežek šteje ves), kot v starem sistemu.
  Primerjava z izračunom starega sistema (oktober, po 019 in nastavitvah delo od doma): delovni čas enak na 656 / 671 dneh;
  razlike = nadure brez tipke Izredno (stari sistem: dovolilnice / popravki), servis (Kosi), praznik 31.10., samo vhod.
- Registracija časa (`src/components/cas/`, skupno Administraciji in kasneje FIN:ME):
  - `RegistracijaCasa` (prop `obseg`: Administracija `{nacin: "vsi"}`, FIN:ME `{nacin: "moji", idZaposlenega}` = sebe + vse
    podrejene, `vidniZaposleni()` v zaposleni.ts), `IzbiraOseb`, `Koledar` (vrstica dneva), `CasovnaLinija`, `DanOkno`, `Povzetek`.
  - Nastavitve (zobnik na ploščici, `REGISTRACIJA_NASTAVITVE` v nav.ts): `Urniki` (+ `IntervalOkna`: izbira statistike,
    okno urnika; `PrazniciOkno`; `UrnikiZaposlenih`), `Statistike` (baza 009). Skupno: `Skupno.tsx` (TestniPodatki, IkonaStatistike, CipStatistike, Panel), `Polja.tsx`.
  - `src/lib/cas.ts` - datumi, izračun dneva (`izracunajDan`: odseki, ure, malice, prevozi, stanje), `STANJA`, `OZNAKE`, `PRAVILA`.
  - `src/lib/casNastavitve.ts` - statistike (009) in urniki (010) iz baze: branje (`naloziStatistike`, `naloziUrnike`),
    pisanje (vse funkcije async, po zapisu ponovno branje). Brez tabel pade na testne podatke (`vir` / `virUrnikov` = "test",
    značka na strani). `imePraznika()` = poseben ali standarden, `urnikZaposlenega()`. `src/lib/casTest.ts` - testna štempljanja.
  - `src/lib/knjizenje.ts` - smer žigov, izmene, pravila intervalov, presežek / saldo (`knjizi`, `preizkusi` za Preizkus pravil).
  - `SaldoPanel` (okno Saldo + `useSaldoOsnutek`, SaveBar na strani), `Povzetek` (prenos, izplačilo, stanje na koncu).
  - Nastavitve še: `PravilaKnjizenja` (v podrobnostih intervala), `Obveznost` (Delovna obveznost urnikov po dnevih).
  - `src/lib/prazniki.ts` - slovenski dela prosti dnevi (izračun; kasneje tabela praznikov).
  - Barve in ikone stanj na koledarju dajejo statistike (ni trdo kodirano); osnovna stanja (Prisoten, Ni vnosa, Prost dan ...) so v `STANJA`.
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
- `src/app/administracija/nastavitve/` - Nastavitve (podmeni `NASTAVITVE_RAZDELKI` v nav.ts) -> `podatki` = Podatki baze.
- `src/lib/tabeleBaze.ts` - tabele, ki se urejajo v Podatkih baze (`TABELE`: stolpci, tip, ključ za uvoz, primeri, opombe),
  branje / pisanje, priprava uvoza CSV. Nova tabela za urejanje = nov vnos v `TABELE` (navodila in predloga se naredijo sama).
  `src/lib/csv.ts` - branje (ločilo ; ali ,) in pisanje CSV. Komponente: PodatkiBaze, VrsticaObrazec, UvozCsv, NavodilaTabele.
- `src/components/ui/` še: GlavaStrani (+ NaslovRazdelka, gumb Nazaj), Polje (POLJE, IskalnoPolje, Izbira, Stikalo), Avatar,
  PraznoStanje, SaveBar, Obvestila (`obvesti()`). `src/components/admin/ZaposleniObrazec.tsx` - polja zaposlenega + okno Dodaj.

## Stanje
- 2.01: prijava (Supabase Auth, cela aplikacija), svetla / temna tema, Administracija -> Zaposleni (seznam in list).
- 2.02: dodajanje in urejanje zaposlenih v aplikaciji (vodje prek fos_vodje + ln_fos_zaposleni_vodja).
- 2.03: FIN:OS brez prijave, Administracija samo fines@fines.si; prijava zaposlenih v FIN:ME (e-mail / uporabniško ime + geslo).
- 2.08: Super Admin (stikalo v Nastavitvah) - dostop do Administracije z računom zaposlenega.
- 2.04: Prikaz hierarhije (drevo vodij, dodajanje na prazna mesta, povleci in spusti).
- 2.10: dostop do aplikacij po zaposlenem (Dostopi), samodejna zaščita novih tabel; oznaka Super Admina v seznamu.
- 4.01: Pravice in dostopi - funkcije Super Admin in Kadrovanje, osebni podatki samo s Kadrovanjem (008).
- 3.02: kadrovski podatki na listu zaposlenega (Podatki: osebno, prebivališče, izplačilo, kontakt v sili; zavihek Zaposlitev).
- 3.01: Nastavitve -> Podatki baze (fos_oddelek, fos_aplikacije): dodaj / uredi vrstico, uvoz in izvoz CSV, navodila.
- FIN:ME: ko bo narejen, dodaj politike za lastne podatke zaposlenega (zdaj ima račun zaposlenega brez Super Admina dostop do ničesar).
- 5.01: Registracija časa - koledar (testni podatki), nastavitve Urniki in Statistike (testni podatki), osnutek baze.
- 5.02: interval = okno od-do z obvezno statistiko, Prazniki (standardni + posebni), migracija 009 statistike.
- 5.05: urniki, intervali, prazniki v bazi (010); Urniki zaposlenih (zaposleni -> urnik). Štempljanja še testna.
- 5.04: Urniki - povleci in spusti za vrstni red intervalov (`@dnd-kit/sortable`, `preurediIntervale`), glavno ime v seznamih.
- 5.06: samodejna smer žiga, pravila knjiženja intervalov + Preizkus, Delovna obveznost, dnevni saldo (osnutek 011, testno);
  okno Saldo (začetno stanje, izplačilo, zaznamki) in prenos salda v povzetku (osnutek 012, testno). En interval na izmeno
  (npr. REZIJA_DELO 00:00-23:59) z začetkom in koncem - ločenih intervalov za prihod / izhod ni; okno izhoda in napake.
- 5.07: Nastavitve -> Krmilnik (tipke, 013), vrsta intervala Prihod / Izhod / Tipka (014), knjiženje tipk (okno za oba
  žiga, seštej trajanje + prekoračitev), Kopiraj interval.
- 5.03: Statistike v bazi; delo čez polnoč v dan prihoda; Urniki = seznam vseh intervalov s + v urnik; koledar bolj zbit.
- Moj Fines še ne vodi nikamor.
