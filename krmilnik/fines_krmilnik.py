#!/usr/bin/env python3
"""
FIN:OS krmilnik (Raspberry Pi) - beleženje delovnega časa s kartico.

Kako deluje:
  * Ta program teče v ozadju (systemd storitev "fines-krmilnik") in na naslovu http://127.0.0.1:8080 streže zaslon
    krmilnika (mapa ui/). Brskalnik Chromium ga ob zagonu odpre čez cel zaslon (kiosk).
  * Čitalec kartic je USB naprava, ki se obnaša kot tipkovnica: številko kartice "natipka" in pritisne Enter.
    Zaslon jo prebere in pošlje temu programu skupaj z izbrano tipko (npr. Odmor).
  * Vsak žig se NAJPREJ zapiše na kartico SD (SQLite) in zaslon TAKOJ pokaže potrdilo. Pošiljanje v FIN:OS
    (/api/krmilnik s ključem naprave) teče v ozadju po vrsti - zaslon nato dopiše ime / opozorilo (/api/rezultat).
    Več ljudi zapored: vsak žig gre v vrsto, nič se ne izgubi in nič se ne podvoji (lokalni_id). Brez wifija žigi
    počakajo in se pošljejo sami, ko se povezava vrne.
  * DNEVNIK: vsak dogodek (prebrana kartica, odgovor FIN:OS, izpad povezave, nastavitve, napake ...) se zapiše v
    lokalno tabelo dnevnik in se pošlje v FIN:OS (Nastavitve registracije -> Dnevnik krmilnikov).
  * Vsako minuto prebere nastavitve (tipke s prikazom "Krmilnik") in se javi FIN:OS-u (Nastavitve -> Krmilnik -> Naprave).

Samo standardna knjižnica Python 3 (na Raspberry Pi OS je že nameščen) - brez dodatnih paketov.
Nastavitve: /etc/fines-krmilnik/config.json (ali pot v FINES_KRMILNIK_CONFIG, za preizkus na računalniku ./config.json).
"""

import http.client
import json
import os
import platform
import socket
import sqlite3
import sys
import threading
import time
import urllib.parse
import uuid
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VERZIJA = "1.3.0"
MAPA = os.path.dirname(os.path.abspath(__file__))
UI = os.path.join(MAPA, "ui")


def beri_config():
    pot = os.environ.get("FINES_KRMILNIK_CONFIG") or ("/etc/fines-krmilnik/config.json" if os.path.exists("/etc/fines-krmilnik/config.json") else os.path.join(MAPA, "config.json"))
    with open(pot, encoding="utf-8") as f:
        c = json.load(f)
    c.setdefault("port", 8080)
    c.setdefault("podatki", "/var/lib/fines-krmilnik/krmilnik.db" if os.path.isdir("/var/lib/fines-krmilnik") else os.path.join(MAPA, "krmilnik.db"))
    c["streznik"] = c["streznik"].rstrip("/")
    return c


CONFIG = beri_config()
ZAKLEP = threading.Lock()  # pošiljanje žigov (ena pošiljka naenkrat)
POSLJI = threading.Event()  # nov žig -> nit pošiljanja se zbudi takoj
STANJE = {
    "naprava": {"ime": CONFIG.get("ime", "Krmilnik"), "lokacija": ""},
    "tipke": CONFIG.get("tipke_rezerva", []),  # dokler se nastavitve ne preberejo (ali brez povezave)
    "na_zvezi": False,
    "zadnji_stik": None,
    "napaka": None,
    "brez_od": None,  # monotonic: od kdaj ni povezave
    "napaka_zapisana": 0.0,  # monotonic: zadnji zapis "brez povezave" v dnevnik
    "poskusov": 0,
    "dnevnik_premor_do": 0.0,  # FIN:OS dnevnika (še) ne sprejme -> poskusi spet čez 5 min
    "ura_zapisana": 0.0,
}
# Odgovori FIN:OS za zadnje žige (zaslon jih bere prek /api/rezultat in dopiše ime / opozorilo).
REZULTATI = OrderedDict()
NAPAKE_ZIGOV = {}  # lokalni_id -> zadnja napaka (v dnevnik se zapiše samo nova)


def log(*s):
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), *s, flush=True)


def zdaj_iso():
    return datetime.now(timezone.utc).isoformat()


def ms(od):
    return int((time.monotonic() - od) * 1000)


# ---------------------------------------------------------------------------------------------------------------
# Lokalna baza (čakalna vrsta žigov, dnevnik in zadnje nastavitve)
# ---------------------------------------------------------------------------------------------------------------
def baza():
    b = sqlite3.connect(CONFIG["podatki"], timeout=10)
    b.row_factory = sqlite3.Row
    # žig je na kartici SD, ko se zapis konča - tudi ob izpadu elektrike takoj po prislonu (WAL nastavi pripravi_bazo)
    b.execute("pragma synchronous = FULL")
    return b


def pripravi_bazo():
    os.makedirs(os.path.dirname(CONFIG["podatki"]) or ".", exist_ok=True)
    b0 = baza()
    b0.execute("pragma journal_mode = WAL")  # odporno na izpad elektrike, zapis ne čaka branja (trajna nastavitev datoteke)
    b0.close()
    with baza() as b:
        b.execute(
            """create table if not exists zigi (
                 lokalni_id text primary key, st_kartice text not null, cas text not null, tipka integer,
                 poslano integer not null default 0, preklican integer not null default 0, odgovor text, ustvarjen text not null)"""
        )
        b.execute(
            """create table if not exists dnevnik (
                 lokalni_id text primary key, cas text not null, vrsta text not null, st_kartice text, tipka integer,
                 id_ziga text, uspeh integer, sporocilo text, trajanje_ms integer, podatki text,
                 poslano integer not null default 0)"""
        )
        b.execute("create index if not exists dnevnik_poslano on dnevnik (poslano, cas)")
        b.execute("create table if not exists nastavitve (kljuc text primary key, vrednost text not null)")
        vr = b.execute("select vrednost from nastavitve where kljuc = 'stanje'").fetchone()
        if vr:
            shranjeno = json.loads(vr["vrednost"])
            STANJE["tipke"] = shranjeno.get("tipke", STANJE["tipke"])
            STANJE["naprava"] = shranjeno.get("naprava", STANJE["naprava"])
    pocisti()


def pocisti():
    """Poslani žigi po 60 dneh, poslan dnevnik po 30 dneh; neposlan dnevnik največ 20000 vrstic (kartica SD)."""
    with baza() as b:
        b.execute("delete from zigi where poslano = 1 and cas < ?", ((datetime.now(timezone.utc) - timedelta(days=60)).isoformat(),))
        b.execute("delete from dnevnik where poslano = 1 and cas < ?", ((datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),))
        b.execute("delete from dnevnik where lokalni_id in (select lokalni_id from dnevnik where poslano = 0 order by cas desc limit -1 offset 20000)")


def dnevnik(vrsta, sporocilo=None, uspeh=None, st_kartice=None, tipka=None, id_ziga=None, trajanje_ms=None, podatki=None, b=None):
    """Zapis v dnevnik krmilnika (pošlje se v FIN:OS). Napaka dnevnika nikoli ne ustavi žiga."""
    log(f"[{vrsta}]", sporocilo or "", f"kartica {st_kartice}" if st_kartice else "", f"{trajanje_ms} ms" if trajanje_ms is not None else "")
    vrstica = (uuid.uuid4().hex, zdaj_iso(), vrsta, st_kartice, tipka, id_ziga, None if uspeh is None else int(bool(uspeh)), sporocilo, trajanje_ms, json.dumps(podatki or {}, ensure_ascii=False, default=str))
    try:
        if b is not None:
            b.execute("insert into dnevnik (lokalni_id, cas, vrsta, st_kartice, tipka, id_ziga, uspeh, sporocilo, trajanje_ms, podatki) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", vrstica)
        else:
            with baza() as bb:
                bb.execute("insert into dnevnik (lokalni_id, cas, vrsta, st_kartice, tipka, id_ziga, uspeh, sporocilo, trajanje_ms, podatki) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", vrstica)
    except Exception as e:
        log("Napaka dnevnika:", e)


# ---------------------------------------------------------------------------------------------------------------
# FIN:OS
# ---------------------------------------------------------------------------------------------------------------
# Ena povezava do FIN:OS ostane odprta (keep-alive): vsak žig prihrani novo povezavo in TLS (na Pi nekaj sto ms).
# Kličeta jo nit pošiljanja in zaslon (Info / Prekliči) - zato svoj zaklep.
POVEZAVA = {"c": None}
ZAKLEP_POVEZAVE = threading.Lock()
PREKINJENA = (http.client.HTTPException, OSError)  # zaprta / prekinjena povezava (iztek časa se ne ponovi)


class NapakaStreznika(RuntimeError):
    """FIN:OS je odgovoril z napako (4xx / 5xx) - povezava dela."""

    def __init__(self, status, sporocilo):
        super().__init__(f"FIN:OS {status}: {sporocilo}")
        self.status = status


def zapri_povezavo():
    if POVEZAVA["c"] is not None:
        try:
            POVEZAVA["c"].close()
        except Exception:
            pass
    POVEZAVA["c"] = None


def klic(metoda, telo=None, cakaj=8):
    url = urllib.parse.urlsplit(CONFIG["streznik"])
    pot = url.path.rstrip("/") + "/api/krmilnik"
    podatki = json.dumps(telo).encode() if telo is not None else None
    glave = {"Authorization": "Bearer " + CONFIG["kljuc"], "Content-Type": "application/json", "X-Verzija": VERZIJA, "User-Agent": "FinesKrmilnik/" + VERZIJA}
    with ZAKLEP_POVEZAVE:
        for poskus in (1, 2):
            nova = POVEZAVA["c"] is None
            if nova:
                vrsta = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
                POVEZAVA["c"] = vrsta(url.hostname, url.port, timeout=cakaj)
            c = POVEZAVA["c"]
            c.timeout = cakaj
            try:
                if c.sock is not None:
                    c.sock.settimeout(cakaj)
                c.request(metoda, pot, body=podatki, headers=glave)
                odg = c.getresponse()
            except (TimeoutError, socket.timeout):  # Python 3.9: socket.timeout ni TimeoutError
                zapri_povezavo()
                raise
            except PREKINJENA:
                zapri_povezavo()
                # strežnik je zaprl staro povezavo, preden je odgovoril - poskusi enkrat z novo
                if nova or poskus == 2:
                    raise
                continue
            except Exception:
                zapri_povezavo()
                raise
            try:
                vsebina = odg.read()  # odgovor je že prišel - brez ponovnega poskusa (ne pošlje dvakrat)
            except Exception:
                zapri_povezavo()
                raise
            if odg.will_close:
                zapri_povezavo()
            if odg.status >= 400:
                try:
                    sporocilo = json.loads(vsebina.decode()).get("napaka")
                except Exception:
                    sporocilo = None
                raise NapakaStreznika(odg.status, sporocilo or odg.reason)
            return json.loads(vsebina.decode())


def oznaci_zvezo(ok, napaka=None):
    """Stanje povezave; v dnevnik gre izpad (nato vsakih 5 min, dokler traja) in ponovna vzpostavitev."""
    bila = STANJE["na_zvezi"]
    STANJE["na_zvezi"] = ok
    STANJE["napaka"] = napaka
    zdaj = time.monotonic()
    if ok:
        STANJE["zadnji_stik"] = zdaj_iso()
        if STANJE["brez_od"] is not None:
            trajalo = int(zdaj - STANJE["brez_od"])
            dnevnik("povezava", f"Povezava spet dela (brez povezave {trajalo} s, {STANJE['poskusov']} neuspelih poskusov)", True, podatki={"brez_s": trajalo, "poskusov": STANJE["poskusov"], "cakajo": cakajo()})
        STANJE["brez_od"] = None
        STANJE["poskusov"] = 0
        return
    STANJE["poskusov"] += 1
    if STANJE["brez_od"] is None:
        STANJE["brez_od"] = zdaj
    if bila or zdaj - STANJE["napaka_zapisana"] > 300:
        STANJE["napaka_zapisana"] = zdaj
        dnevnik("povezava", f"Brez povezave: {napaka}", False, podatki={"napaka": napaka, "poskusov": STANJE["poskusov"], "brez_s": int(zdaj - STANJE["brez_od"]), "cakajo": cakajo()})


def preberi_nastavitve(prvic=False):
    t = time.monotonic()
    try:
        d = klic("GET")
    except NapakaStreznika as e:
        oznaci_zvezo(False, str(e))
        return
    except Exception as e:  # brez povezave
        oznaci_zvezo(False, str(e))
        return
    oznaci_zvezo(True)
    tipke = d.get("tipke", [])
    naprava = d.get("naprava", STANJE["naprava"])
    if prvic or tipke != STANJE["tipke"] or naprava != STANJE["naprava"]:
        opis = ", ".join(f"{x.get('tipka')} {x.get('besedilo')}" for x in tipke) or "brez tipk"
        dnevnik("nastavitve", ("Nastavitve prebrane" if prvic else "Nastavitve spremenjene") + f": {naprava.get('ime')} · tipke: {opis}", True, trajanje_ms=ms(t), podatki={"naprava": naprava, "tipke": tipke, "prej": None if prvic else STANJE["tipke"]})
    STANJE["tipke"] = tipke
    STANJE["naprava"] = naprava
    with baza() as b:
        b.execute("insert or replace into nastavitve (kljuc, vrednost) values ('stanje', ?)", (json.dumps({"tipke": tipke, "naprava": naprava}),))
    # ura krmilnika naj se ujema s strežnikom (NTP); opozorilo, če se razlikuje za več kot 2 min (v dnevnik enkrat na uro)
    if d.get("cas"):
        razlika = (datetime.fromisoformat(d["cas"].replace("Z", "+00:00")) - datetime.now(timezone.utc)).total_seconds()
        if abs(razlika) > 120 and time.monotonic() - STANJE["ura_zapisana"] > 3600:
            STANJE["ura_zapisana"] = time.monotonic()
            dnevnik("ura", f"Ura krmilnika se razlikuje od strežnika za {int(razlika)} s - preveri NTP / časovni pas.", False, podatki={"razlika_s": int(razlika), "streznik": d["cas"], "krmilnik": zdaj_iso()})


def opis_odgovora(r):
    if not r.get("ok"):
        return r.get("napaka") or "Napaka"
    ime = " ".join(x for x in (r.get("ime"), r.get("priimek")) if x)
    if r.get("akcija") == "zig" and r.get("znana") is False:
        return "Kartica ni dodeljena"
    if r.get("akcija") == "zig":
        return f"{ime} · {r.get('smer') or ''}{' · ' + r['tipka'] if r.get('tipka') else ''}"
    return f"{r.get('akcija')} · {ime}"


def poslji_cakajoce(najvec=50, cakaj=8, cakaj_zaklep=None):
    """Pošlje neposlane žige (najstarejše najprej). Vrne rezultate po lokalni_id; vsak odgovor gre v dnevnik.
    cakaj_zaklep: največ toliko s čaka, če pošiljanje že teče (Info / Prekliči ne smeta dolgo čakati)."""
    if not ZAKLEP.acquire(timeout=-1 if cakaj_zaklep is None else cakaj_zaklep):
        return {}
    try:
        return _poslji_cakajoce(najvec, cakaj)
    finally:
        ZAKLEP.release()


def _poslji_cakajoce(najvec, cakaj):
    with baza() as b:
        vrstice = b.execute("select * from zigi where poslano = 0 and preklican = 0 order by cas limit ?", (najvec,)).fetchall()
    if not vrstice:
        return {}
    t = time.monotonic()
    try:
        d = klic("POST", {"zigi": [{"lokalni_id": v["lokalni_id"], "st_kartice": v["st_kartice"], "cas": v["cas"], "tipka": v["tipka"]} for v in vrstice]}, cakaj=cakaj)
        oznaci_zvezo(True)
    except NapakaStreznika as e:
        oznaci_zvezo(False, str(e))
        for v in vrstice:
            if NAPAKE_ZIGOV.get(v["lokalni_id"]) != str(e):
                NAPAKE_ZIGOV[v["lokalni_id"]] = str(e)
                dnevnik("odgovor", f"FIN:OS ni sprejel žiga: {e}", False, v["st_kartice"], v["tipka"], v["lokalni_id"], ms(t), {"status": e.status, "napaka": str(e), "paket": len(vrstice)})
        return {}
    except Exception as e:
        oznaci_zvezo(False, str(e))
        return {}
    trajanje = ms(t)
    rezultati = {r.get("lokalni_id"): r for r in d.get("rezultati", [])}
    with baza() as b:
        for v in vrstice:
            lid = v["lokalni_id"]
            r = rezultati.get(lid)
            if r is None:
                continue
            cakal = int((datetime.now(timezone.utc) - datetime.fromisoformat(v["cas"])).total_seconds() * 1000)
            if r.get("trajno"):
                b.execute("update zigi set poslano = 1, odgovor = ? where lokalni_id = ?", (json.dumps(r), lid))
                NAPAKE_ZIGOV.pop(lid, None)
                dnevnik("odgovor", opis_odgovora(r), r.get("ok") and r.get("znana") is not False, v["st_kartice"], v["tipka"], lid, trajanje,
                        {"odgovor": r, "paket": len(vrstice), "od_prislona_ms": cakal, "streznik_ms": d.get("ms")}, b=b)
            elif NAPAKE_ZIGOV.get(lid) != r.get("napaka"):
                NAPAKE_ZIGOV[lid] = r.get("napaka")
                dnevnik("odgovor", f"Napaka (poskusi znova): {r.get('napaka')}", False, v["st_kartice"], v["tipka"], lid, trajanje, {"odgovor": r, "paket": len(vrstice), "od_prislona_ms": cakal}, b=b)
    for lid, r in rezultati.items():
        REZULTATI[lid] = r
    while len(REZULTATI) > 200:
        REZULTATI.popitem(last=False)
    return rezultati


def poslji_dnevnik(najvec=100):
    """Pošlje neposlan dnevnik v FIN:OS. Če ga FIN:OS ne sprejme (stara verzija / ni migracije 033), čez 5 min znova."""
    if time.monotonic() < STANJE["dnevnik_premor_do"]:
        return
    with baza() as b:
        vrstice = b.execute("select * from dnevnik where poslano = 0 order by cas limit ?", (najvec,)).fetchall()
    if not vrstice:
        return
    paket = [
        {
            "lokalni_id": v["lokalni_id"], "cas": v["cas"], "vrsta": v["vrsta"], "st_kartice": v["st_kartice"], "tipka": v["tipka"], "id_ziga": v["id_ziga"],
            "uspeh": None if v["uspeh"] is None else bool(v["uspeh"]), "sporocilo": v["sporocilo"], "trajanje_ms": v["trajanje_ms"], "podatki": json.loads(v["podatki"] or "{}"),
        }
        for v in vrstice
    ]
    try:
        d = klic("POST", {"dnevnik": paket})
    except NapakaStreznika as e:
        STANJE["dnevnik_premor_do"] = time.monotonic() + 300
        log("FIN:OS ne sprejme dnevnika:", e)
        return
    except Exception as e:
        oznaci_zvezo(False, str(e))
        return
    if (d.get("dnevnik") or {}).get("ok"):
        with baza() as b:
            b.executemany("update dnevnik set poslano = 1 where lokalni_id = ?", [(v["lokalni_id"],) for v in vrstice])
    else:
        STANJE["dnevnik_premor_do"] = time.monotonic() + 300
        log("FIN:OS ne sprejme dnevnika:", (d.get("dnevnik") or {}).get("napaka") or "stara verzija FIN:OS")


def sinhronizacija():
    zadnje_nastavitve = 0
    zadnje_ciscenje = time.time()
    prvic = True
    while True:
        POSLJI.clear()
        try:
            poslji_cakajoce()
            if time.time() - zadnje_nastavitve > 60:
                preberi_nastavitve(prvic)
                prvic = False
                zadnje_nastavitve = time.time()
            if not POSLJI.is_set():  # nov žig ima prednost pred dnevnikom
                poslji_dnevnik()
            if time.time() - zadnje_ciscenje > 86400:
                pocisti()
                zadnje_ciscenje = time.time()
        except Exception as e:
            log("Napaka sinhronizacije:", e)
            dnevnik("napaka", f"Napaka sinhronizacije: {e}", False, podatki={"napaka": repr(e)})
        POSLJI.wait(5)


def funkcija_tipke(tipka):
    return next((t.get("funkcija") for t in STANJE["tipke"] if t.get("tipka") == tipka), None)


def cakajo():
    with baza() as b:
        return b.execute("select count(*) from zigi where poslano = 0 and preklican = 0").fetchone()[0]


def info_preklic(st_kartice, tipka, funkcija, zdaj, citalec_ms):
    """Info / Prekliči potrebujeta FIN:OS (zaslon počaka odgovor, največ ~6 s); brez povezave TAKOJ odgovor iz lokalne vrste."""
    vrsta = "info" if funkcija == "info" else "preklic"
    t = time.monotonic()
    try:
        if not STANJE["na_zvezi"]:
            raise ConnectionError("brez povezave (zadnji poskus ni uspel)")
        poslji_cakajoce(cakaj=3, cakaj_zaklep=1)  # najprej žigi iz vrste - preklic mora videti zadnji žig
        if not STANJE["na_zvezi"]:
            raise ConnectionError(STANJE["napaka"] or "brez povezave")
        d = klic("POST", {"zigi": [{"lokalni_id": "f-" + uuid.uuid4().hex, "st_kartice": st_kartice, "cas": zdaj, "tipka": tipka}]}, cakaj=3)
        oznaci_zvezo(True)
        r = {**d["rezultati"][0], "poslano": True}
        dnevnik(vrsta, opis_odgovora(r), r.get("ok"), st_kartice, tipka, trajanje_ms=ms(t), podatki={"odgovor": r, "citalec_ms": citalec_ms, "streznik_ms": d.get("ms")})
        return r
    except Exception as e:
        oznaci_zvezo(False, str(e))
        with baza() as b:
            if funkcija == "preklici":
                meja = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
                v = b.execute("select lokalni_id from zigi where st_kartice = ? and poslano = 0 and preklican = 0 and cas > ? order by cas desc limit 1", (st_kartice, meja)).fetchone()
                if not v:
                    r = {"ok": False, "napaka": "Brez povezave - preklic ni mogoč."}
                else:
                    b.execute("update zigi set preklican = 1 where lokalni_id = ?", (v["lokalni_id"],))
                    r = {"ok": True, "akcija": "preklic", "poslano": False}
                dnevnik(vrsta, f"Brez povezave - {'preklican lokalni žig' if r['ok'] else 'ni žiga za preklic'}", r["ok"], st_kartice, tipka, v["lokalni_id"] if v else None, ms(t), {"odgovor": r, "napaka": str(e)}, b=b)
                return r
            danes = datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
            vr = b.execute("select cas, tipka from zigi where st_kartice = ? and preklican = 0 and cas >= ? order by cas", (st_kartice, danes)).fetchall()
            imena = {x.get("tipka"): x.get("besedilo") for x in STANJE["tipke"]}
            r = {
                "ok": True,
                "akcija": "info",
                "poslano": False,
                "zigi": [{"cas": datetime.fromisoformat(x["cas"]).astimezone().strftime("%H:%M"), "tipka": imena.get(x["tipka"])} for x in vr],
            }
            dnevnik(vrsta, f"Brez povezave - lokalni žigi ({len(vr)})", True, st_kartice, tipka, trajanje_ms=ms(t), podatki={"odgovor": r, "napaka": str(e)}, b=b)
            return r


def cas_zaslona(cas):
    """Čas prislona, ki ga pošlje zaslon (ista ura naprave): velja, če ni v prihodnosti in ni starejši od 7 dni."""
    try:
        c = datetime.fromisoformat(str(cas).replace("Z", "+00:00"))
        if c.tzinfo is None:
            return None
        zdaj = datetime.now(timezone.utc)
        return c.astimezone(timezone.utc).isoformat() if zdaj - timedelta(days=7) <= c <= zdaj + timedelta(minutes=2) else None
    except Exception:
        return None


def zig(st_kartice, tipka, citalec_ms=None, lokalni_id=None, cas=None, zamik_ms=None):
    """Žig s kartico (in tipko). Navaden žig: zapiše na SD in TAKOJ vrne (pošiljanje v ozadju); Info / Prekliči počakata FIN:OS.
    lokalni_id + cas pošlje zaslon: žig je najprej v vrsti zaslona (localStorage) - če program ni odgovoril (ponovni
    zagon), ga zaslon pošlje znova; isti lokalni_id se zapiše samo enkrat."""
    surovo = str(st_kartice)
    st_kartice = "".join(ch for ch in surovo if ch.isalnum())[:40]
    if len(st_kartice) < 3:
        dnevnik("kartica", "Kartica ni prebrana (prekratka številka)", False, st_kartice or None, tipka, podatki={"surovo": surovo[:60], "citalec_ms": citalec_ms})
        return {"ok": False, "napaka": "Kartica ni prebrana - poskusi znova."}
    funkcija = funkcija_tipke(tipka) if tipka is not None else None
    zdaj = zdaj_iso()

    if funkcija in ("info", "preklici"):
        return info_preklic(st_kartice, tipka, funkcija, zdaj, citalec_ms)

    lid = "".join(ch for ch in str(lokalni_id or "") if ch.isalnum() or ch == "-")[:64] or uuid.uuid4().hex
    cas_ziga = cas_zaslona(cas) or zdaj
    t = time.monotonic()
    with baza() as b:
        nov = b.execute("insert or ignore into zigi (lokalni_id, st_kartice, cas, tipka, ustvarjen) values (?, ?, ?, ?, ?)", (lid, st_kartice, cas_ziga, tipka, zdaj)).rowcount
        if nov:
            zakasnjen = zamik_ms is not None and zamik_ms > 3000
            opis = "Kartica prebrana, žig shranjen"
            if zakasnjen:
                opis += f" (iz vrste zaslona - program ni odgovoril, {round(zamik_ms / 1000)} s po prislonu)"
            elif not STANJE["na_zvezi"]:
                opis += " (brez povezave - čaka v vrsti)"
            dnevnik("kartica", opis, None, st_kartice, tipka, lid, None,
                    {"citalec_ms": citalec_ms, "na_zvezi": STANJE["na_zvezi"], "cas_ziga": cas_ziga, "zaslon_zamik_ms": zamik_ms}, b=b)
    sd_ms = ms(t)
    POSLJI.set()  # nit pošiljanja pošlje takoj
    return {"ok": True, "akcija": "zig", "poslano": False, "takoj": True, "lokalni_id": lid, "na_zvezi": STANJE["na_zvezi"], "sd_ms": sd_ms}


# ---------------------------------------------------------------------------------------------------------------
# Lokalni spletni strežnik (zaslon krmilnika)
# ---------------------------------------------------------------------------------------------------------------
class Streznik(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=UI, **k)

    def log_message(self, *a):  # brez izpisa vsake zahteve
        pass

    def poslji_json(self, d, status=200):
        telo = json.dumps(d).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(telo)))
        self.end_headers()
        self.wfile.write(telo)

    def do_GET(self):
        if self.path.startswith("/api/stanje"):
            return self.poslji_json(
                {"verzija": VERZIJA, "naprava": STANJE["naprava"], "tipke": STANJE["tipke"], "na_zvezi": STANJE["na_zvezi"], "zadnji_stik": STANJE["zadnji_stik"], "cakajo": cakajo(), "napaka": STANJE["napaka"]}
            )
        if self.path.startswith("/api/rezultat"):
            lid = (urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("id") or [""])[0]
            r = REZULTATI.get(lid)
            if r is not None:
                return self.poslji_json({**r, "stanje": "koncano", "poslano": bool(r.get("trajno"))})
            return self.poslji_json({"stanje": "caka", "na_zvezi": STANJE["na_zvezi"]})
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/zig"):
            try:
                d = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                tipka = d.get("tipka")
                cm, zm = d.get("citalec_ms"), d.get("zamik_ms")
                stevilo = lambda x: int(x) if isinstance(x, (int, float)) else None  # noqa: E731
                return self.poslji_json(zig(d.get("st_kartice", ""), int(tipka) if tipka is not None else None, stevilo(cm), d.get("lokalni_id"), d.get("cas"), stevilo(zm)))
            except Exception as e:
                log("Napaka žiga:", e)
                dnevnik("napaka", f"Napaka žiga: {e}", False, podatki={"napaka": repr(e)})
                return self.poslji_json({"ok": False, "napaka": "Napaka krmilnika - poskusi znova."}, 500)
        self.send_error(404)


def main():
    if not CONFIG.get("kljuc") or not CONFIG.get("streznik"):
        log("V config.json manjka streznik ali kljuc.")
        sys.exit(1)
    pripravi_bazo()
    dnevnik("zagon", f"Program {VERZIJA} zagnan", True, podatki={"verzija": VERZIJA, "python": sys.version.split()[0], "sistem": platform.platform(), "naprava": platform.node(), "streznik": CONFIG["streznik"], "cakajo": cakajo()})
    threading.Thread(target=sinhronizacija, daemon=True).start()
    log(f"FIN:OS krmilnik {VERZIJA} - zaslon na http://127.0.0.1:{CONFIG['port']} , strežnik {CONFIG['streznik']}")
    ThreadingHTTPServer(("127.0.0.1", CONFIG["port"]), Streznik).serve_forever()


if __name__ == "__main__":
    main()
