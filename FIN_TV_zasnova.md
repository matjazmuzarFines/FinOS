# FIN:TV - zasnova (predaja iz pogovora v FINES_Production, 2026-11-12)

Status: **faza 1 zgrajena (8.01, lokalno), baza je osnutek `supabase/osnutki/022_fin_tv.sql`** - do potrditve FIN:TV dela
s testnimi podatki v brskalniku. Odgovori uporabnika v razdelkih 3 in 5.

---

## 1. Kaj želi uporabnik (izvirna zahteva, povzetek)

V proizvodnjo se bodo montirali televizorji za prikaz vsebin. Ob vsakem TV-ju bo **računalnik**, TV je samo zaslon.

Vsebine (brainstorming):
- produktivnost celic ali oddelkov,
- kakovostna obvestila in reklamacije,
- delovni plan in prioritete,
- grafi in KPI-ji (produktivnost, cilji),
- datumi izobraževanj ljudi,
- razna obvestila: kadrovska (prihod nove osebe), kolektivni dopusti, dela na cesti / zaprte ceste ipd.

~95 % podatkov izvira iz aplikacije **FINES_Production** (isti Supabase projekt, tabele `fp_` / `spl_`).

Potrebna sta **2 modula**:
1. **Predvajalnik** - čez cel zaslon, se sam vrti in posodablja; prikazuje samo to, kar je nastavljeno v urejevalniku.
2. **Urejevalnik (grid)** - vsako okno ima drag & drop / upload (slika, video), vrstni red (drag & drop ali nastavljiv),
   nastavitve (koliko časa se prikazuje), vrsto prehoda kot v PowerPointu. Poleg slike / videa še **komponenta, ki se
   poveže na podatke iz projekta** - npr. delovni plan montaže vsak dan za tekoči in naslednji teden (videz bo drugačen
   kot sedanji predogled v Production; točen videz uporabnik napiše kasneje).

---

## 2. Predlog

### 2.1 Kam: FinOS -> Administracija -> FIN:TV (POTRJENO)

- Vzorec naprav iz krmilnika (`021_krmilnik_naprave.sql`, `/api/krmilnik`): naprava s ključem (sha256), na zvezi /
  zadnji stik, API s service_role. TV = nova vrsta naprave.
- Dostop: nova vrstica v `fos_aplikacije` (FIN:TV), kadrovska dobi FIN:TV brez Production.
- Brez PNG izvoza - TV riše podatke v živo iz JSON (ostro na 4K, brez generiranja slik na strežniku).

### 2.2 Zasloni in povezovanje (odgovor 4)

- Vsak TV ima **svoj seznam predvajanja** (ustvari se sam z zaslonom).
- Gumb **Poveži** (ikona verige) na zaslonu: izbereš drug TV -> oba kažeta ISTI seznam (urejanje enega = oba).
  Povezani zasloni so v seznamu zaslonov združeni v skupino z verigo.
- **Odveži**: zaslon dobi kopijo skupne vsebine (nadaljuje z istim, a ločeno).
- Povezani TV-ji vrtijo **sinhrono** (isto okno ob istem času): položaj v seznamu se izračuna iz ure
  (čas od polnoči mod skupno trajanje) - brez komunikacije med TV-ji.
- **Kopiraj na ...** pri oknu: okno se kopira na drug (nepovezan) zaslon.

### 2.3 Računalniki ob TV-jih (odgovora 2, 3)

- 2 TV-ja, 4K, **wifi**. PC je samo za TV, a ga je treba po potrebi pomanjšati in uporabljati kot navaden računalnik.
- **Ne kiosk** (`--kiosk` se zapre samo s Ctrl+Alt+Del). Namesto tega okno aplikacije čez cel zaslon:
  `msedge --app=https://<finos>/tv?k=KLJUČ --start-fullscreen` (bližnjica v Startup, samodejna prijava v Windows,
  izklopljeno spanje in ohranjevalnik zaslona).
- **Pomanjšaj**: ob premiku miške se na TV-ju pokaže vrstica (fos-popup) z gumbi Pomanjšaj, Ustavi / Nadaljuj, Osveži.
  OPOMBA: brskalnik iz strani ne more sam zapustiti celozaslonskega načina, zagnanega s `--start-fullscreen` -
  "Pomanjšaj" je zato F11 (gumb pokaže namig) ali pa stran preklaplja s Fullscreen API. Preizkusiti na pravem PC-ju
  pred odločitvijo. Na namizju bližnjica **FIN:TV** = nazaj čez cel zaslon.
- Po želji: po N minutah brez miške / tipkovnice se predvajanje samo vrne čez cel zaslon (Windows Task Scheduler).
- **4K**: predvajalnik riše na logičnem platnu 1920 × 1080, povečanem ×2 (besedilo in grafi ostri, en videz za
  1080p in 4K). Slike: priporočeno 3840 × 2160. Video: 1080p H.264 zadošča.
- **Wifi**: vse datoteke (slike, video, PDF strani) v lokalni predpomnilnik brskalnika (service worker / Cache API),
  prenesejo se enkrat. Brez povezave TV vrti zadnje stanje; v FinOS zaslon kaže "Brez povezave od ...".
  Osveževanje (zgrajeno): TV pozove `/api/tv` vsakih 20 s z verzijo vsebine (nespremenjeno = brez prenosa) - Realtime
  ni mogoč, ker TV nima prijave (samo ključ); 20 s je za 2 TV-ja zanemarljivo. Ponovna naložitev vsako noč ~4:00.
  Datoteke v Cache API (ne service worker - video potrebuje cel blob).

### 2.4 Urejevalnik (grid)

- Okno (16:9 sličica, vrstni red z vlečenjem): vrsta
  - **slika** (png, jpg, webp),
  - **video** (mp4; trajanje = dolžina videa, utišano),
  - **PDF** (odgovor 5: Word / Excel -> izvoz v PDF -> upload; vsaka stran = svoje okno ali ena stran na okno -
    strani se ob nalaganju v brskalniku izrišejo v slike 4K, pdf.js),
  - **obvestilo** (besedilo z oblikovanjem - kadrovska ne riše slik),
  - **vir podatkov** (plan montaže, produktivnost ... - glej 2.5).
- Trajanje, prehod (brez / pojemanje / drsenje / povečava ...), velja od-do, vklop / izklop, predogled.
- Reklamacije in kakovost zaenkrat kot PDF / slika; kasneje orodja v Production -> vir podatkov.

### 2.5 Viri podatkov in objava (odgovor 6)

Načelo: **oseba, ki dela plan, ne gre v FinOS**. TV se posodobi iz gumba, ki ga že uporablja (npr. zelen
"Shrani plan" v Production). FinOS ima register virov (kaj in kako), projekti imajo v svojih gumbih samo klic objave.

**V FinOS -> FIN:TV -> Viri podatkov** (en vir = en prikaz iz drugega projekta):
- koda (`plan_montaze`), ime, projekt (Production), opis, **vklop / izklop** (izklopljen = okno se na TV preskoči),
- način: **Ob objavi** (iz gumba v projektu) ali **V živo** (vsakih N min, npr. produktivnost - brez gumba),
- **nastavitve prikaza** (kateri podatki in kako): npr. obdobje (ta + naslednji teden), stolpci, vrstic na stran,
  ločen prikaz po tednih ... - jsonb, izbere se v FinOS,
- zadnja objava (kdaj, kdo, iz katerega gumba), zgodovina objav, predogled.

**Kako teče objava:**
```
Production: "Shrani plan" -> shrani kot zdaj -> rpc fos_tv_objavi('plan_montaze')
                                                   |
                         SQL: fp_tv_plan_montaze(nastavitve vira) -> JSON
                                                   |
                         fos_tv_objave (posnetek JSON + kdo + kdaj)
                                                   |
                         Realtime -> TV-ji z oknom tega vira se osvežijo (sekunde)
```
- Logika podatkov je v SQL funkciji (`fp_tv_*`, migracija v Production) - projekt ne generira ničesar, gumb samo
  sproži objavo. Nov vir = nova SQL funkcija + vrstica v `fos_tv_viri` + izris v FinOS predvajalniku + klic v gumbu.
- Posnetek (snapshot) je JSON, ne slika: TV kaže **objavljeno stanje**, dokler ni nove objave (pol narejen plan
  se ne pokaže).
- `fos_tv_objavi` = security definer, preveri dostop klicatelja do projekta vira (fos_ tabele so sicer samo za
  Super Admina).

**V projektu (Production, kasneje ostali) - skupna komponenta `TvStatus`** (v glavi poleg "Podatki iz ERP"):
- značka TV: zelena = objavljeno in aktualno, rumena = podatki spremenjeni, niso objavljeni, siva = izklopljeno iz TV.
- Klik -> okno: zadnja objava (kdaj, kdo), trenutno stanje (objavljeno / neobjavljene spremembe), **predogled** točno
  tako, kot bo na TV-ju (isti izris iz FinOS v iframe, podatke pošlje projekt), stikalo Vklop / izklop, gumb Objavi zdaj.
- Ob "Shrani plan", ko je vir vklopljen: okno "Posodobili boste podatke na TV" -> **Nadaljuj** (zelen) /
  **Izklopi iz TV** (rdeč). Izklopljen vir: shrani brez vprašanja in brez objave.
- Komponenta + pomožna funkcija `tvObjavi(koda)` gresta v `FINES_Standardi` (enaka v vseh projektih).

### 2.6 Baza (osnutek, `fos_tv_*`)

- `fos_tv_zasloni`: ime, lokacija, kljuc_hash, id_seznama, zadnji_stik, trenutno_okno, verzija, omogocen.
- `fos_tv_seznami`: seznam predvajanja (povezani zasloni = isti id_seznama).
- `fos_tv_okna`: id_seznama, vrsta, vrstni_red, trajanje_s, prehod, velja_od, velja_do, aktivno, id_vira,
  nastavitve (jsonb), datoteka (Storage košara `fos-tv`).
- `fos_tv_viri`: koda, ime, projekt, opis, vklopljen, nacin (objava / zivo), interval_min, funkcija (`fp_tv_...`),
  nastavitve (jsonb).
- `fos_tv_objave`: id_vira, podatki (jsonb), id_objavil, izvor (npr. "Production: Shrani plan").

### 2.7 Faze

1. **Osnova:** zasloni s ključi, povezovanje zaslonov, okna (slika, video, PDF, obvestilo), grid z vlečenjem,
   predvajalnik s prehodi (4K, predpomnilnik, sinhrono), vrstica Pomanjšaj, navodila za PC (bližnjica, Startup).
2. **Viri in objava:** `fos_tv_viri` / `fos_tv_objave`, `fos_tv_objavi`, Viri podatkov v FinOS, `TvStatus` v
   Standardih, prvi vir **plan montaže** + opozorilo ob "Shrani plan" v Production.
3. **Ostali viri:** produktivnost (v živo), prioritete, izobraževanja, KPI s cilji, kasneje kakovost in reklamacije.

---

## 3. Odgovori uporabnika (2026-11-12)

1. FinOS -> Administracija -> FIN:TV: **da**.
2. PC samo za TV, potreben gumb za pomanjšanje -> po potrebi navaden računalnik.
3. Zaenkrat 2 TV-ja, 4K, wifi.
4. Vsak TV posebej, gumb "Link" poveže več TV-jev na isto vsebino.
5. Reklamacije / kakovost: orodja kasneje (nadgradnja); do takrat Word / Excel -> PDF ali PNG.
6. Vsaka sprememba ima gumb objavi, ki sproži posodobitev - samodejno iz gumbov v projektih (npr. Shrani plan),
   ne v FinOS. V FinOS komponenta, kjer poveš, katere podatke in kako; v projektih TV status ob "Podatki iz ERP"
   (zadnje stanje, zdajšnje stanje, predogled), vklop / izklop, opozorilo ob shranjevanju.

---

## 4. Opombe za Claude v FinOS

- Upoštevaj `AGENTS.md`, `finos_stil.txt` (ima prednost pred Standardne komponente) in
  `../FINES_Standardi/app_instructions.md`.
- Podatke iz Production beri prek SQL funkcij (`fp_tv_*`), migracije za te funkcije spadajo v
  `../FINES_Production/supabase/migrations/`; FIN:TV tabele (`fos_tv_*`) v `supabase/migrations/` FinOS
  (najprej osnutek v `supabase/osnutki/`).
- Vzorec naprave / ključa / API kopiraj iz krmilnika (021, `src/app/api/krmilnik`).

---

## 5. Odgovori (2026-11-12, drugi krog)

1. Opozorilo ob "Shrani plan": tudi tretji gumb **"Shrani brez objave"** - DA.
2. TV status / objava v projektih: zaenkrat vsi; omejitev da obstoječi razdelek pravic projekta (kdor ne sme urejati
   plana, ga tudi ne objavi - lahko pa npr. posodobi kakovost).
3. Samodejna vrnitev čez cel zaslon: NE. Predvajanje je ena stran v FinOS (`/tv`), ne posebna aplikacija; v njej je
   vedno gumb čez cel zaslon / pomanjšaj.
4. PDF z več stranmi = ena okno, ki zavrti strani po vrsti (trajanje na stran).

## 6. Zgrajeno - faza 1 (8.01)

- Administracija -> FIN:TV: zasloni (dodaj -> ključ + prenos zagona `.cmd`), Poveži (izbira, katero vsebino obdržita) /
  Odveži, Predvajaj tukaj, Pokaži ime, Osveži TV, Nov ključ, Onemogoči.
- Seznam predvajanja: slika, video (trajanje = dolžina), PDF (strani -> WebP 3840 px v brskalniku), obvestilo; povleci in
  spusti, trajanje, 5 prehodov, prilagoditev, velja od-do, vklop, kopiraj na drug zaslon.
- `/tv?k=KLJUČ`: oder 1920 × 1080 (4K ×2), položaj iz ure (povezani sinhrono), predpomnilnik, brez povezave zadnje stanje.
- Odprto za preizkus na pravem PC-ju: Edge `--app --start-fullscreen` + F11, samodejna prijava, spanje.
- Naslednje: potrditev 022 -> migrations; faza 2 (viri podatkov, `fos_tv_objavi`, `TvStatus` v Standardih, plan montaže).

## 7. Drugi krog (8.02, 2026-11-12)

- 022 potrjen -> `supabase/migrations/022_fin_tv.sql`.
- Naslovna stran pred vsakim oknom (2 s + 4 s + 2 s), pokončen PDF pri Zapolni razrezan na ležeče dele, obvestilo s prilogo.
- **Predefinirane komponente** - odločitev: panel Komponente levo pod Zasloni, komponento povlečeš v seznam (ali zelen +).
  Brez dodatnega kataloga za "+": seznam komponent JE katalog, ki ga definiramo s programiranjem v projektih
  (`fos_tv_viri`, osnutek 023) - pokažejo se same; v panelu je opomba, da se nove dodajo s programiranjem.
  Komponenta = PDF, ki ga projekt ustvari ob gumbu; objavi se kot slike strani (`fos_tv_objavi`). Excel / Word / txt
  se na TV-ju ne izrišejo - projekt jih izvozi kot PDF.
- Prvi komponenti: `fp_plan_workflow` (obstoječ PDF - workflow) in `fp_plan_pregled` (nov PDF - pregled / roki,
  Production 35.01: časovnica po celicah, krovni od začetka do roka, nalogi + kosi, danes, rdeče po odpremi).
- Naslednje (faza 2): potrditev 023; v Production ob "Shrani plan" objava obeh PDF (opozorilo Nadaljuj / Shrani brez
  objave / Izklopi iz TV) in značka TV ob "Podatki iz ERP" (`TvStatus`, zadnja objava, predogled, vklop).
