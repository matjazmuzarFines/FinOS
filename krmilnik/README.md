# FIN:OS krmilnik (Raspberry Pi)

Krmilnik ob vhodu: zaposleni prisloni kartico (po želji prej pritisne tipko, npr. *Odmor*), žig gre v FIN:OS.

## Kako je sestavljen

```
 [čitalec kartic USB] --(številka kartice kot tipkovnica)--> [zaslon: Chromium čez cel zaslon]
                                                                   |
                                                         http://127.0.0.1:8080 (samo na napravi)
                                                                   |
                                         [program fines_krmilnik.py - teče v ozadju]
                                           | najprej zapiše žig na kartico SD (čakalna vrsta)
                                           | nato pošlje: HTTPS -> FIN:OS /api/krmilnik (ključ naprave)
                                                                   |
                                                       [FIN:OS na Vercelu] -> [Supabase: fos_dogodki]
```

* Raspberry Pi je majhen računalnik z Linuxom - **ne poganja .exe**. Program je ena Python datoteka (Python je na
  Raspberry Pi že nameščen) in spletna stran za zaslon. Namestitveni skript poskrbi, da se vse zažene samo ob vklopu.
* **Brez wifija ne izgubimo nič**: žigi čakajo na napravi in se pošljejo sami, ko se povezava vrne (na zaslonu piše
  "Brez povezave · čaka 3"). Isti žig se nikoli ne zapiše dvakrat.
* **Ura**: krmilnik vzame čas iz interneta (NTP). Če je ura krmilnika v prihodnosti, FIN:OS vzame svoj čas.
* **Varnost**: krmilnik nima gesla do baze. Ima samo svoj ključ, s katerim zna oddati žig - nič brati ne more. Ukraden
  ključ v FIN:OS zamenjaš (Nov ključ) ali napravo onemogočiš.
* **Tipke** na zaslonu so iz FIN:OS (Registracija časa -> Nastavitve -> Krmilnik, tipke s prikazom *Krmilnik*).
  Spremembe se na krmilniku pokažejo v 1 minuti.

## Kaj kupiti (za prvi krmilnik)

| Kaj | Opomba |
|---|---|
| Raspberry Pi 4 (2 GB) ali Raspberry Pi 5 | Pi 4 je dovolj |
| Uradni napajalnik (USB-C) | slab napajalnik = nestabilno delovanje |
| Kartica microSD 32 GB (A1/A2, znana znamka) | |
| Zaslon na dotik: uradni Raspberry Pi Touch Display 2 (7") ali podoben HDMI/DSI zaslon 800 × 480 ali več | |
| Ohišje za Pi + zaslon (stensko) | |
| USB čitalec kartic, **ki se obnaša kot tipkovnica** ("USB HID keyboard emulation") | glej spodaj |

### Čitalec kartic - pred nakupom preveri vrsto kartic

Številke kartic v FIN:OS so npr. `3207141`. To je značilno za kartice **125 kHz (EM4100 / EM4102)**, ki jih čitalec
izpiše kot 10-mestno številko `0003207141` - krmilnik vodilne ničle zanemari, zato se ujema.

Preizkus brez Raspberry Pi: čitalec priklopi v navaden računalnik, odpri Beležnico in prisloni kartico. Izpisati se
mora številka + nova vrstica. Če je številka enaka kot pri zaposlenem v FIN:OS (brez ničel spredaj), je čitalec pravi.
Če kartice niso 125 kHz (npr. Mifare 13,56 MHz), potrebuješ čitalec za to frekvenco - ostalo ostane enako.

## Namestitev (enkrat, ~30 minut) - brez tipkanja ukazov

Pogoj: v Supabase sta zagnani migraciji `020_fin_me.sql` in `021_krmilnik_naprave.sql`.

**Na računalniku:**

1. FIN:OS -> *Registracija časa -> Nastavitve -> Krmilnik -> Naprave -> **Dodaj napravo*** (ime, lokacija).
2. V oknu s ključem klikni **Prenesi nastavitve (config.json)**.
3. Na USB ključek skopiraj mapo `krmilnik` in vanjo daj preneseno datoteko `config.json`
   (v mapi so zdaj `namesti.sh`, `config.json`, `fines_krmilnik.py` ...).
4. Kartica SD za Raspberry Pi: namesti program **Raspberry Pi Imager** (raspberrypi.com/software), izberi
   napravo (Pi 4 / Pi 5), sistem **Raspberry Pi OS (64-bit)** in kartico SD. Ko vpraša za nastavitve, klikni *Uredi* in
   vpiši: uporabnika in geslo, **wifi podjetja** (ime in geslo), državo SI, časovni pas Europe/Ljubljana. Zapiši.

**Na Raspberry Pi:**

5. Vstavi kartico SD, priklopi zaslon, čitalec kartic, miško in napajanje. Počakaj na namizje (prvič nekaj minut).
6. Vtakni USB ključek, odpri mapo `krmilnik` in **dvakrat klikni `namesti.sh`** -> izberi **Execute in Terminal**
   (Izvedi v terminalu). Odpre se črno okno, v katerem se izpisuje napredek - počakaj (5-15 min, potrebuje internet).
7. Na koncu se Raspberry Pi **sam ponovno zažene** in odpre zaslon krmilnika. V FIN:OS pri napravi piše **na zvezi**.
   Miško lahko odklopiš.

USB ključek po namestitvi ni več potreben (program se skopira na Raspberry Pi).

> Kaj je "sudo"? Na Linuxu je to "zaženi kot skrbnik" (kot "Zaženi kot skrbnik" v Windows). Namestitev mora
> nameščati programe in nastaviti samodejni zagon, zato potrebuje skrbniške pravice - `namesti.sh` si jih vzame sam.
>
> Če dvoklik ne ponudi "Execute in Terminal": v mapi `krmilnik` desni klik na prazno -> *Open in Terminal* in vpiši
> `bash namesti.sh` ter pritisni Enter.

## Vsakdanje

| Kaj | Kako |
|---|---|
| Ali dela? | FIN:OS -> Krmilnik -> Naprave: "na zvezi" / zadnji stik |
| Posodobitev programa | nova mapa `krmilnik` na USB ključku, dvoklik `namesti.sh` (nastavitve in čakajoči žigi ostanejo) |
| Dnevnik | `journalctl -u fines-krmilnik -f` |
| Ponovni zagon programa | `sudo systemctl restart fines-krmilnik` |
| Zamenjava ključa | FIN:OS -> Nov ključ -> Prenesi nastavitve, nov `config.json` v mapo `krmilnik` na USB, dvoklik `namesti.sh` |
| Izhod iz celega zaslona (vzdrževanje) | priklopi tipkovnico, `Alt+F4` (zaslon se čez 2 s odpre znova - za delo: `sudo systemctl stop fines-krmilnik`) |

## Datoteke

* `fines_krmilnik.py` - program (čakalna vrsta SQLite v `/var/lib/fines-krmilnik`, lokalni strežnik zaslona, pošiljanje)
* `ui/` - zaslon (ura, tipke, potrdilo žiga: "Dober dan, Matej!" / "Nasvidenje, Matej!", Info, Prekliči)
* `namesti.sh` - namestitev / posodobitev, `kiosk.sh` - zažene zaslon čez cel zaslon
* `config.example.json` - primer nastavitev (prava so v `/etc/fines-krmilnik/config.json`)

Preizkus na računalniku (brez Raspberry Pi): `config.example.json` skopiraj v `config.json`, vpiši naslov in ključ,
zaženi `python fines_krmilnik.py` in odpri http://127.0.0.1:8080 - številko kartice natipkaj in pritisni Enter.
