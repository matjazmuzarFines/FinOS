/** Verzije in spremembe (ikona "i" v glavi). Najnovejša na vrhu. */
export type Verzija = { verzija: string; datum: string; spremembe: string[] };

export const VERZIJE: Verzija[] = [
  {
    verzija: "8.07",
    datum: "13. 11. 2026",
    spremembe: [
      "FIN:TV: komponente workflowa plana se imenujejo »Delovni plan · oddelek«.",
      "FIN:TV: nova komponenta »Delo - prejšnji dan« za vsak oddelek - Production ob uvozu poročanega dela objavi stran s krogom štempljanih ur proti planu za vsako celico (zeleno do 100 %, rumeno do 110 %, rdeče nad). Stran velja samo na dan objave. Potrebna migracija 027.",
    ],
  },
  {
    verzija: "8.06",
    datum: "13. 11. 2026",
    spremembe: [
      "FIN:TV: »Zapolni zaslon« pri PDF in komponentah ne reže več strani - ena stran je en zaslon, cela stran se raztegne do robov (ležeča A4 zapolni ves zaslon, pokončna ima ob strani bel rob). Nov PDF ima privzeto Zapolni zaslon.",
      "Popravek FIN:TV: Predvajaj tukaj ni odprl ničesar (brskalnik je novo okno tiho zavrnil) - zdaj je gumb povezava, ki se vedno odpre v novem zavihku (deluje tudi srednji klik).",
    ],
  },
  {
    verzija: "8.05",
    datum: "13. 11. 2026",
    spremembe: [
      "FIN:TV: Delovni plan - workflow je zdaj enako kot pregled komponenta za vsak oddelek posebej in po tednih - Production ob Shrani plan objavi workflow in pregled za vsak teden plana, TV kaže tekoči teden. Potrebna migracija 026.",
    ],
  },
  {
    verzija: "8.04",
    datum: "12. 11. 2026",
    spremembe: [
      "FIN:TV: komponenta ima lahko strani za več tednov naprej - TV kaže samo tekoči teden in v ponedeljek sam preklopi na naslednjega, brez ponovnega shranjevanja. Strani prihodnjih tednov TV prenese vnaprej (deluje tudi brez povezave).",
      "FIN:TV: Delovni plan - pregled je komponenta za vsak oddelek posebej (Proizvodnja, Montaža, Elektro, Testiranje). Production ob Shrani plan objavi pregled za vsak teden plana.",
      "FIN:TV: kartica komponente brez strani za danes pokaže »Danes ni strani (ni plana za ta teden)«; okno komponente pove, koliko tednov je objavljenih. Potrebna migracija 025.",
      "Popravek: Super Admin lahko nalaga datoteke v FIN:TV tudi brez vklopljene aplikacije FIN:TV (migracija 024).",
    ],
  },
  {
    verzija: "8.03",
    datum: "12. 11. 2026",
    spremembe: [
      "Administracija: nov vstop - Področja (Registracija časa, FIN:TV, kmalu FIN:DOOR) s stanjem na prvi pogled (na delu zdaj, zahtevki čakajo, neznane kartice, zasloni na zvezi, zadnja objava) in bližnjicami; Ljudje z opozorili (brez urnika, kartice, računa); Sistem kot vrstica povezav.",
      "Iskanje po vsej Administraciji: Ctrl+K ali gumb Išči - strani, nastavitve in zaposleni; Enter odpre.",
      "Nastavitve registracije in Nastavitve: meni levo na vseh njihovih straneh (Pregled, Urniki, Statistike ... / Podatki baze, Pravice). Meni se zloži na ikone, brskalnik si zapomni.",
      "Urniki: podrobnosti intervala v dveh stolpcih šele na zelo širokem zaslonu (od 1760 px), da je ob meniju dovolj prostora.",
      "Pregled nastavitev: pravokotne, manjše ploščice, ki se ob meniju ne lomijo; naslov menija se ne skrije več pod gumb za zlaganje.",
    ],
  },
  {
    verzija: "8.02",
    datum: "12. 11. 2026",
    spremembe: [
      "FIN:TV: pred vsakim oknom naslovna stran - prehod 2 s, naslov na sredini 4 s, prehod 2 s na vsebino (vklop / izklop v oknu). Vsi prehodi so počasnejši (2 s).",
      "FIN:TV: pokončne strani PDF pri »Zapolni zaslon« se pokažejo čez celo širino, razrezane na dele - stran med deli zdrsne navzgor. Pokončen PDF se ob nalaganju nastavi sam.",
      "FIN:TV: obvestilo ima lahko prilogo (slika, video ali PDF) desno zgoraj; naslov in besedilo sta manjša.",
      "FIN:TV: panel Komponente - dokumenti iz drugih projektov (Delovni plan - workflow, Delovni plan - pregled), ki jih povlečeš v seznam predvajanja. Na TV-ju se vrti zadnja objava; stikalo komponento vklopi / izklopi na vseh TV-jih. Baza komponent je osnutek (023).",
    ],
  },
  {
    verzija: "8.01",
    datum: "12. 11. 2026",
    spremembe: [
      "Nov modul FIN:TV (Administracija): zasloni za televizorje v proizvodnji - vsak TV ima svoj seznam predvajanja.",
      "Seznam predvajanja: slike, videi, PDF (vsaka stran se vrti posebej) in obvestila z besedilom; vrstni red s povleci in spusti, trajanje, prehod (pojemanje, drsenje, povečava, zavesa), velja od-do, vklop / izklop.",
      "Poveži: več TV-jev kaže isto vsebino in vrti isto okno ob istem času; Odveži da zaslonu kopijo.",
      "Predvajalnik /tv čez cel zaslon (4K): vsebina se osveži sama v 20 s, datoteke se prenesejo enkrat (wifi), brez povezave vrti zadnje stanje; miška pokaže vrstico Ustavi, Osveži, Pomanjšaj.",
      "Zaslon: ključ in zagon za Windows (dvoklik = predvajanje čez cel zaslon), Pokaži ime, Osveži TV, stanje na zvezi in kaj se vrti.",
      "Baza je osnutek (022) - do potrditve FIN:TV dela s testnimi podatki v tem brskalniku.",
    ],
  },
  {
    verzija: "7.03",
    datum: "4. 11. 2026",
    spremembe: [
      "Moj Fines: trak »Ogled kot« je privzeto skrit - Super Admin ga vklopi z ikono epruvete v glavi (testni pogled).",
      "Moj Fines: oblački ikon se odprejo ob strani (Odsotnosti in Dovolilnice desno, Moj čas in Popravki levo), pri spodnjih ikonah rastejo navzgor - brez drsenja.",
      "Moj Fines: krog je na širokem zaslonu bližje Delovni uri; oblaček znaka FIN:ME je pod znakom v krogu.",
    ],
  },
  {
    verzija: "7.02",
    datum: "4. 11. 2026",
    spremembe: [
      "Tabela tipk: vsaka stvar ima svoje stalno mesto (številka levo, besedilo in funkcija, pod njima prikaz in intervali, X desno); cela besedila funkcij.",
      "Nastavitve -> Krmilnik razpolovljeno: levo tipke (zbito, vsaka v dveh vrsticah - prikaz in intervali pod besedilom), desno predogled krmilnika in naprave.",
      "Predogled krmilnika: zaslon naprave kot na Raspberry Pi (ura, tipke s prikazom Krmilnik - tudi neshranjene), velikost zaslona 7\" / 7\" HD / 10\", klik na tipko, preizkus kartice in brez povezave.",
    ],
  },
  {
    verzija: "7.01",
    datum: "4. 11. 2026",
    spremembe: [
      "Baza za produkcijo: migracija 020 (FIN:ME - zahtevki, dopust, nastavitve, žig iz Mojega Finesa, dostopi po hierarhiji) in 021 (krmilniki).",
      "Krmilnik Raspberry Pi (mapa krmilnik/): program z zaslonom na dotik in čitalcem kartic - ura, tipke iz FIN:OS, pozdrav ob žigu, Info in Prekliči; brez wifija žigi počakajo in se pošljejo kasneje.",
      "Nastavitve -> Krmilnik -> Naprave: dodaj krmilnik (ključ se pokaže enkrat), na zvezi / zadnji stik, verzija programa, nov ključ, onemogoči.",
      "FIN:OS /api/krmilnik: žigi s krmilnika s ključem naprave; kartica se prepozna tudi z ničlami spredaj, neznana kartica se vseeno zapiše.",
      "Naprave: Prenesi nastavitve (config.json) - namestitev na Raspberry Pi z dvoklikom, brez tipkanja ukazov.",
    ],
  },
  {
    verzija: "6.03",
    datum: "4. 11. 2026",
    spremembe: [
      "Moj Fines: pozdrav in znak FIN:ME sta na sredini kroga, krog je čisto zgoraj; desno Delovna ura.",
      "Delovna ura (virtualni krmilnik): ura in stanje, velik gumb Prihod / Odhod (smer samodejna), tipke s prikazom FIN:ME, Info (današnji žigi in ure), Prekliči zadnji žig. Deluje samo z vklopljenim virtualnim beleženjem.",
      "Odsotnosti in dovolilnice: Uredi in Izbriši tudi pri potrjenih zahtevkih - sprememba gre ponovno v potrditev, izbris mora potrditi vodja (do takrat star zahtevek velja). Vodja ureja in briše zahtevke ekipe takoj.",
      "List zaposlenega: Oddelek in vodja (s podrejenimi) je zdaj razdelek v Podatkih (med Prijavo v FIN:ME in Osebnimi podatki).",
      "List zaposlenega: Pravice so na vrhu zavihka Dostopi; namesto Nastavitev je zavihek FIN:ME s kvadratkom »Virtualno beleženje delovnega časa«.",
      "Zaposleni: gumb »Izvoz pravic po uporabnikih« - Excel z vsemi pravicami in dostopi (DA / NE) za prikazane zaposlene in list z opisom pravic.",
      "Izvozi: en gumb odpre okno s seznamom vseh izvozov; ob vsakem izbira tipa datoteke (ikona in končnica) in gumb Izvozi, ki se omogoči, ko je tip izbran.",
    ],
  },
  {
    verzija: "6.02",
    datum: "4. 11. 2026",
    spremembe: [
      "Moj Fines: namesto štirih kartic velik krog s prekinjeno črto, na sredini znak FIN:ME, na krožnici ikone strani z naslovom.",
      "Miška na ikoni: ikona se strese in poveča, ob njej oblaček s ključnimi besedami; na sredini prizor Fineseka (z vklopljenimi animacijami): ura, otok s palmo, palica s culico, posnetek registracije.",
      "Miška na znaku FIN:ME: znak se strese, oblaček s tvojimi podatki (oddelek, vodja, ekipa, kaj čaka).",
      "Vsa okna, meniji, spustni seznami in obvestila so temnejši (skoraj neprosojni) - besedilo pod njimi ne moti več.",
      "Odsotnosti in dovolilnice: »Zakaj?« je obvezno.",
      "Potrjena celodnevna odsotnost je na koledarju od 6:30 (uradni delovni čas 6:30-14:30).",
    ],
  },
  {
    verzija: "6.01",
    datum: "4. 11. 2026",
    spremembe: [
      "FIN:ME (Moj Fines): vstop z domače strani, prijava zaposlenega; velike kartice Moj čas, Odsotnosti, Dovolilnice, Popravki - ob miški oblaček s ključnimi besedami.",
      "Moj čas: isti pogled kot Registracija časa - zaposleni vidi sebe, vodja še svojo (posredno) ekipo iz hierarhije in ureja njene dneve (sebe ne).",
      "Desni klik na dan: Oddaj popravek, Najavi odsotnost, Dovolilnica. Popravek dneva = predlog žigov / žig ne velja / cel dan v statistiki, vodja potrdi.",
      "Odsotnosti in Dovolilnice: nov zahtevek v treh korakih (kaj, kdaj, opomba) in seznam s statusi Oddano / Potrjeno / Zavrnjeno; vodja v zavihku Ekipa potrdi ali zavrne (z razlogom).",
      "Potrjena odsotnost se pokaže na koledarju; oddan zahtevek in dovolilnica sta oznaki dneva.",
      "Registracija časa: okno Dopust (letni in lanski: porabljeno / vse, ostane, čaka) pod Po statistikah; vse dni vpiše Administracija.",
      "Statistike: novi kvadratki Celodnevna odsotnost, Razlog dovolilnice, Štej letni dopust; testni statistiki Očetovski dopust in Koriščenje ur.",
      "Osnutek baze 020: zahtevki, dopust po letih in dostopi po hierarhiji (zaposleni samo sebe, vodja ekipo). Do potrditve testni podatki v brskalniku.",
      "Super Admin: v FIN:ME »Ogled kot« - pogled katerega koli zaposlenega ali vodje (za preizkus).",
    ],
  },
  {
    verzija: "5.09",
    datum: "1. 11. 2026",
    spremembe: [
      "Registracija časa bere prava štempljanja iz baze (dogodki); testna samo, dokler baze dogodkov ni.",
      "Ročni dogodki in spregledi se shranijo v bazo (kdo in kdaj); dan s popravkom ima oznako.",
      "Uvoz štempljanj za oktober 2026 iz starega sistema (migracija 018).",
      "Nov urnik dobi privzeto delovno obveznost (8 h pon-pet).",
      "Presežek nad obveznostjo se računa po izmenah - vsaka izmena po pravilu svojega izhoda (npr. delo od doma brez zaokroževanja).",
      "Registracija časa čez celo širino zaslona; v izboru oseb filter oddelkov ne prekriva več seznama.",
      "Registracija: širši seznam oseb in desni stolpec; Saldo in povzetek zbita po višini.",
      "Izbor oseb: filtra po oddelku in po vodji (neposredni podrejeni), iskanje tudi po vodji, gumb Ponastavi.",
      "Izbor oseb: kvadratki za označevanje oseb in Označi vse (za kasnejše izvoze).",
      "Izbor oseb: še širši stolpec, vrstica osebe v eni vrsti (več oseb na zaslonu).",
    ],
  },
  {
    verzija: "5.08",
    datum: "1. 11. 2026",
    spremembe: [
      "Pravila knjiženja: kartica Kako deluje - trak dneva (dejanski čas, knjiži se ob meji, napaka) in razlaga v stavkih; opozorilo, ko »ne prej / ne pozneje kot« nima učinka.",
      "Popravljeni primeri pod »ne prej kot« in »ne pozneje kot«.",
      "Urniki, Statistike, Krmilnik in Delovna obveznost so čez celo širino zaslona; podrobnosti intervala v dveh stolpcih.",
      "Registracija časa: vse manjše in bolj zbito; puščica levo od dneva razpre dogodke (interval, knjižen in dejanski čas, statistika).",
      "Okno dneva: ročni popravki - Spreglej (dogodek se ne upošteva, ostane prečrtan) in Dodaj dogodek (datum, čas, tipka, komentar). Do potrditve baze dogodkov samo v brskalniku.",
      "Prihod in izhod imata lahko tipko - drug prihod / izhod, ki ga izbere tipka (npr. Izredno za nadure: dejanski čas brez napake).",
      "Uvoz zaposlenih in kartic iz starega sistema (migracija 017).",
    ],
  },
  {
    verzija: "5.07",
    datum: "1. 11. 2026",
    spremembe: [
      "Nova nastavitev Krmilnik: seznam tipk (številka in besedilo, ki se izpiše na krmilniku). Prihod in izhod nimata tipke - delujeta samodejno ob prislonu kartice.",
      "Urniki: v podrobnostih intervala izbira tipke na krmilniku (brez tipke = prihod / izhod).",
      "Urniki: gumb Kopiraj interval (oranžen krog ob Nov interval) - nov interval z vsemi nastavitvami izbranega, ime s pripono _KOPIJA.",
      "Interval ima vrsto: Prihod, Izhod (oba brez tipke, samodejno) ali Tipka (obvezna tipka). Okno izhoda je okno intervala Izhod.",
      "Tipka: oba žiga (s tipko in vrnitev) morata biti v oknu intervala, sicer napaka. Seštej trajanje (npr. odmor 00:30 na dan) - čas nad tem gre v izbrano statistiko (npr. Zamuda).",
      "Pravila knjiženja po vrsti: Prihod = začetek, Izhod = konec in presežek, Tipka = trajanje; Preizkus pravil za vsako vrsto.",
      "Krmilnik: pri tipki izbereš, kje se pokaže (Krmilnik, FIN:ME) in funkcijo (Info, Prekliči) namesto intervala. Tipke, ki jo uporablja interval, ni mogoče odstraniti.",
      "Koledar: napake za žig tipke izven okna in tipko, ki je urnik nima; v oknu dneva prekoračitev trajanja.",
      "Tipke in vrsta so do zagona migracij 013 in 014 testne (samo v brskalniku).",
    ],
  },
  {
    verzija: "5.06",
    datum: "1. 11. 2026",
    spremembe: [
      "Smer žiga je samodejna: odsoten = prihod, prisoten = izhod. Izhod s tipko (malica, službeni, zasebni) se zaključi z naslednjim žigom.",
      "Intervali: pravila knjiženja - Začetek (dejanski / ne prej kot, zaokroževanje), Konec (dejanski / ne pozneje kot, zaokroževanje), Presežek nad obveznostjo (šteje / zaokroži navzdol / ne šteje) in Preizkus pravil.",
      "Okno prihoda (prihod od-do) in okno izhoda (kadarkoli / od-do): prihod ali izhod izven okna se knjiži z dejanskim časom in dobi rdečo napako; zamuda ostane v svoji izmeni.",
      "Nova nastavitev Delovna obveznost: ure po dnevih za vsak urnik (0 = prost dan).",
      "Koledar: knjižen čas (dejanski prečrtan), dnevni saldo pod stanjem, oznaki Napaka in Manjka odhod; okno dneva z obveznostjo in saldom; povzetek s presežkom, manjkom in saldom obdobja.",
      "Intervali nimajo več veljavnosti (Velja od / do) - interval je vedno v uporabi.",
      "Spustno okno statistike se ne odreže več (odpre se nad vsem, ob dnu zaslona navzgor).",
      "Registracija časa: okno Saldo desno zgoraj - začetno stanje (saldo pred FIN:OS in datum), prenos v izplačilo in mesečni zaznamki.",
      "Povzetek: prenos iz prejšnjega obdobja, saldo obdobja, prenos v izplačilo in stanje na koncu obdobja.",
      "Pravila, obveznost in saldo so do potrditve osnutkov 011 in 012 testni (samo v brskalniku).",
    ],
  },
  {
    verzija: "5.05",
    datum: "31. 10. 2026",
    spremembe: [
      "Urniki, intervali, dnevi, posebni prazniki in vrstni red intervalov se shranjujejo v bazo.",
      "Urniki: gumb Urniki zaposlenih - seznam vseh zaposlenih (vodje s krono) in izbira urnika za vsakega, Shrani. Brez posebnih skupin.",
      "Urniki zaposlenih: razvrščanje po imenu in po oddelku (naraščajoče / padajoče) ter ločeno iskanje po imenu in po oddelku.",
      "Urniki zaposlenih: Prekliči in Shrani sta v nogi okna (ne prekrivata več seznama).",
      "Urniki: seznam urnikov levo se zlaga s povleci in spusti, imena urnikov so vedno cela; ikona je v naslovu URNIKI.",
      "Ob menjavi urnika zaposlenega ostane zgodovina (prejšnji urnik se skrije, nov velja od danes).",
      "Koledar registracije uporablja urnik zaposlenega iz baze (štempljanja so še testna).",
    ],
  },
  {
    verzija: "5.04",
    datum: "31. 10. 2026",
    spremembe: [
      "Urniki: intervale zlagaš s povleci in spusti (ročaj levo) - npr. prihodi na vrhu, izhodi na koncu.",
      "Urniki: v seznamih je glavno ime (PRIHOD_PISARNA) vedno celo; prikazno ime (Prihod) je za krmilnik.",
      "Urniki: čas Od / Do eno pod drugim; v vrstici intervala samo ime (brez dodatnih podatkov pod njim); brez razpiranja vrstic.",
    ],
  },
  {
    verzija: "5.03",
    datum: "31. 10. 2026",
    spremembe: [
      "Statistike se berejo in shranjujejo v bazo (dodaj, kopiraj, uredi, izbriši, kvadratki).",
      "Delo čez polnoč (npr. 22:00-01:00) se šteje v dan prihoda; na časovni liniji puščica, da se nadaljuje naslednji dan. Interval je lahko čez polnoč (+1).",
      "Koledar: datum v dveh vrsticah (dd.mm, pod njim dan), malice in prevozi čisto desno eno pod drugim, daljša časovna linija, tanka siva črta med tedni.",
      "Urniki: na sredini vedno seznam vseh intervalov (iskanje, Vsi / V urniku / Ostali); + doda interval v izbran urnik, kljukica ga odstrani.",
    ],
  },
  {
    verzija: "5.02",
    datum: "31. 10. 2026",
    spremembe: [
      "Urniki: interval je časovno okno od-do (npr. prihod 06:00-09:00) z obvezno eno statistiko; tip intervala in potek dneva odstranjena.",
      "Urniki: mreža intervalov se ne prekriva več, gumb Odstrani je vedno viden; razprt interval pokaže okno na časovni liniji.",
      "Urniki: gumb Prazniki - standardni dela prosti dnevi po zakonu za vsako leto in dodajanje posebnih (npr. dan solidarnosti).",
      "Štempljanje ima vir: Krmilnik, Online aplikacija, Ročni popravek.",
      "Baza: pripravljena migracija 009 za statistike; urniki, intervali in prazniki ostajajo v osnutku.",
    ],
  },
  {
    verzija: "5.01",
    datum: "31. 10. 2026",
    spremembe: [
      "Administracija: nova ploščica Registracija časa (na prvem mestu), zobnik na ploščici odpre njene nastavitve.",
      "Registracija časa: koledar cel mesec ali teden po dnevih - stanje z ikono, datum, časovna linija 00-24 v barvah statistik, malice, prevozi, stanje z besedo, prostor za oznake.",
      "Izbor oseb z iskanjem in filtrom oddelka, povzetek obdobja (ure, malice, prevozi, po statistikah, dnevi), klik na dan odpre podrobnosti.",
      "Nastavitve -> Urniki: urniki, intervali (tip, veljavnost, dnevi s prazniki, statistika), potek dneva z urejanjem, povezovanje obstoječih intervalov.",
      "Nastavitve -> Statistike: koda, ime, opis, barva, ikona in kvadratki (delovna obveznost, prevozi, malice, lanski dopust); dodaj, kopiraj, uredi, izbriši.",
      "Za zdaj testni podatki (označeno) - baza je v osnutku za pregled.",
    ],
  },
  {
    verzija: "4.02",
    datum: "31. 10. 2026",
    spremembe: ["Ploščice: naslov se vedno vidi cel - v eni vrsti velik, če je predolg, v dveh vrsticah z manjšo pisavo (brez \"...\")."],
  },
  {
    verzija: "4.01",
    datum: "31. 10. 2026",
    spremembe: [
      "Nastavitve -> Pravice in dostopi: uporabniki FIN:OS / FIN:ME z zadnjo prijavo in kvadratki za funkcije, Shrani v spodnji vrstici.",
      "Funkcije z opisom, kaj obsegajo: Super Admin (prestavljen iz Nastavitev zaposlenega) in nova Kadrovanje.",
      "Brez funkcije Kadrovanje so osebni podatki zaposlenih skriti - tudi Super Adminu; zaščito izvaja baza.",
      "Kadrovanje lahko dodeli ali odvzame samo uporabnik, ki ga ima.",
      "Podatki o zaposlitvi (pogodba, ure, dopust) so v svoji tabeli in niso pod Kadrovanjem.",
    ],
  },
  {
    verzija: "3.03",
    datum: "31. 10. 2026",
    spremembe: [
      "Popravek: v skrita polja (EMŠO, davčna, ZZZS, TRR) se da pisati naprej - skrita so samo, ko jih ne urejaš.",
      "Napaka pri polju se pokaže šele, ko polje zapustiš (ali ob shranjevanju), ne med tipkanjem.",
      "Polja v vrsti ostanejo poravnana: napaka pod poljem zamakne celo vrstico.",
      "Kilometri do dela pri stalnem in pri začasnem prebivališču.",
    ],
  },
  {
    verzija: "3.02",
    datum: "31. 10. 2026",
    spremembe: [
      "List zaposlenega -> Podatki: osebni podatki (EMŠO, davčna, številka zdravstvenega zavarovanja, rojstvo, kontakt), stalno in začasno prebivališče, kilometri do dela, TRR, kontakt v sili.",
      "Nov zavihek Zaposlitev: pogodba, delovno mesto, tedenske ure, letni dopust, delovna doba, izobrazba; povzetek staža v Fines.",
      "EMŠO, davčna in TRR se preverijo s kontrolno števko; EMŠO sam izpolni datum rojstva in spol.",
      "Občutljive številke so skrite (vidne zadnje 3 števke), oko jih pokaže.",
    ],
  },
  {
    verzija: "3.01",
    datum: "31. 10. 2026",
    spremembe: [
      "Administracija: nova ploščica Nastavitve (poleg Zaposlenih) s podmenijem splošnih nastavitev.",
      "Nastavitve -> Podatki baze: meni tabel (Oddelki, Aplikacije), pregled vrstic z iskanjem, razvrščanjem in prikazom skritih.",
      "Dodaj vrstico / uredi vrstico: polje za vsak stolpec z imenom, tipom in opisom, stikalo Prikazana (brez brisanja).",
      "Uvoz CSV: povleci in spusti, predogled (nova / posodobi / brez sprememb / napaka), obstoječe vrstice se posodobijo po ključu.",
      "Navodila za vsako tabelo: stolpci, tipi, obvezni podatki, primer datoteke in predloga CSV; izvoz tabele v CSV.",
    ],
  },
  {
    verzija: "2.10",
    datum: "29. 10. 2026",
    spremembe: [
      "Dostopi zaposlenega: stikala za aplikacije (Fines - Production, Kontrolne točke, Rabljena oprema), FIN:OS prek Super Admina.",
      "Baza sama zaščiti vsako novo tabelo - ob novih tabelah ni treba ničesar ponavljati.",
      "Seznam zaposlenih: Super Admini imajo ikono ščita pred kvadratkom z začetnicami.",
    ],
  },
  {
    verzija: "2.08",
    datum: "29. 10. 2026",
    spremembe: [
      "Nastavitve zaposlenega: stikalo Super Admin - z njim ima zaposleni s svojim računom dostop do Administracije.",
      "Zaposlenega z že obstoječim računom (ista prijava kot druge Fines aplikacije) se poveže z njegovim računom.",
    ],
  },
  {
    verzija: "2.07",
    datum: "29. 10. 2026",
    spremembe: [
      "Hierarhija: platno je visoko po vsebini, \"Brez vodje\" je tik pod njim - vse je hkrati na zaslonu.",
      "Spuščanje kartic je natančnejše pri vsaki povečavi in premiku platna.",
    ],
  },
  {
    verzija: "2.06",
    datum: "29. 10. 2026",
    spremembe: [
      "Hierarhija na platnu: kolešček miške poveča / pomanjša (okoli kazalca), vlečenje ozadja premakne pogled.",
      "Gumbi za povečavo: -, +, 100 % in Prilagodi (celotna hierarhija na zaslon).",
    ],
  },
  {
    verzija: "2.05",
    datum: "29. 10. 2026",
    spremembe: [
      "Hierarhija: lestvice so okna drug ob drugem (vodoravno, čez celo širino zaslona).",
      "Vsak vodja ima svoje okno z imenom oddelka, ki ga vodi, in številom ljudi v ekipi.",
    ],
  },
  {
    verzija: "2.04",
    datum: "29. 10. 2026",
    spremembe: [
      "Prikaz hierarhije (gumb na Zaposlenih): vse lestvice vodij kot drevesa s povezavami.",
      "Prazna mesta s +: dodaj novega ali obstoječega zaposlenega pod vodjo ali v novo lestvico.",
      "Povleci in spusti: zaposleni (s podrejenimi) gre k drugemu vodji, v novo lestvico ali med Brez vodje.",
      "Hierarhija ne dovoli krogov (vodja ne more biti podrejen svojemu zaposlenemu).",
    ],
  },
  {
    verzija: "2.03",
    datum: "29. 10. 2026",
    spremembe: [
      "Začetna stran FIN:OS je brez prijave; prijava je potrebna samo za Administracijo (za zdaj samo fines@fines.si).",
      "Zaposleni ima e-mail, uporabniško ime in geslo za prijavo v FIN:ME (razdelek Podatki na listu zaposlenega).",
      "Geslo se shrani zaščiteno v Supabase Auth in ga ni mogoče prebrati - lahko ga samo zamenjaš.",
      "Prijava z e-mailom ali uporabniškim imenom.",
    ],
  },
  {
    verzija: "2.02",
    datum: "29. 10. 2026",
    spremembe: [
      "Dodaj zaposlenega: okno z vsemi podatki (ime, priimek, kartica, oddelek, vodja, je vodja).",
      "List zaposlenega se ureja (razen ID), spremembe se shranijo s Shrani v spodnji vrstici.",
      "Vodje so v svoji tabeli; ob izbiri vodje se zapiše povezava zaposleni - vodja (z zgodovino).",
      "Gumb Nazaj je v vrsti s potjo do strani ob desnem robu; gumba Osveži ni več.",
      "Puščica na ploščici ne prekrije več opisa.",
    ],
  },
  {
    verzija: "2.01",
    datum: "29. 10. 2026",
    spremembe: [
      "Prijava z e-mailom in geslom (Supabase Auth); Izhod = odjava, e-mail uporabnika v glavi.",
      "Svetla in temna tema: gumb s soncem / luno desno zgoraj, izbira se zapomni v brskalniku.",
      "Administracija: mreža ploščic modulov, prvi modul Zaposleni.",
      "Seznam zaposlenih: iskanje, filter po oddelkih in vodji, razvrščanje po imenu, priimku in oddelku.",
      "List zaposlenega z razdelki: podatki, oddelek in vodja (s podrejenimi), dostopi, nastavitve.",
      "Gumb nazaj in pot do strani (drobtine) na vseh podstraneh.",
      "Prizor s Finesekom teče vsake 3 minute (prej 30 s); uvod se ne ponovi ob vrnitvi na domačo stran.",
    ],
  },
  {
    verzija: "1.03",
    datum: "29. 10. 2026",
    spremembe: [
      "Stikalo Animacije levo zgoraj: ustavi dodatne animacije (Finesek, uvod, ozadje, trak, bleščice) in zmanjša porabo.",
      "Gumbi, okna in prehodi delajo naprej; izbira se zapomni v brskalniku.",
    ],
  },
  {
    verzija: "1.02",
    datum: "29. 10. 2026",
    spremembe: [
      "Maskota Finesek na začetni strani: sestavljen iz delov (telo spredaj in s strani, roke, noge), z animiranim tekom in mahanjem.",
      "Prizor vsakih 30 s: Finesek priteče, potegne stikalo, FIN:OS zasveti, Finesek pomaha in steče naprej; FIN:OS nato počasi ugasne.",
    ],
  },
  {
    verzija: "1.01",
    datum: "29. 10. 2026",
    spremembe: [
      "Postavljen projekt FIN:OS (Next.js, Tailwind, Motion).",
      "Uvodna animacija, ki zloži napis FIN:OS, s sloganom People Bake for People.",
      "Začetna stran z gibljivim ozadjem, uro in vstopnima karticama Administracija (FIN:OS Admin) in Moj Fines (FIN:ME).",
      "Predogled prihajajočih modulov: delovni čas, dopusti, prosti čas, bolniška, FIN:DOOR, kartice.",
    ],
  },
];

export const APP_VERSION = VERZIJE[0].verzija;
