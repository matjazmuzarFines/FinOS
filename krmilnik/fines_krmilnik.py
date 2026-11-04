#!/usr/bin/env python3
"""
FIN:OS krmilnik (Raspberry Pi) - beleženje delovnega časa s kartico.

Kako deluje:
  * Ta program teče v ozadju (systemd storitev "fines-krmilnik") in na naslovu http://127.0.0.1:8080 streže zaslon
    krmilnika (mapa ui/). Brskalnik Chromium ga ob zagonu odpre čez cel zaslon (kiosk).
  * Čitalec kartic je USB naprava, ki se obnaša kot tipkovnica: številko kartice "natipka" in pritisne Enter.
    Zaslon jo prebere in pošlje temu programu skupaj z izbrano tipko (npr. Odmor).
  * Vsak žig se NAJPREJ zapiše na kartico SD (SQLite), nato se pošlje v FIN:OS (/api/krmilnik s ključem naprave).
    Če wifija ni, žigi počakajo in se pošljejo sami, ko se povezava vrne - nič se ne izgubi in nič se ne podvoji.
  * Vsako minuto prebere nastavitve (tipke s prikazom "Krmilnik") in se javi FIN:OS-u (Nastavitve -> Krmilnik -> Naprave).

Samo standardna knjižnica Python 3 (na Raspberry Pi OS je že nameščen) - brez dodatnih paketov.
Nastavitve: /etc/fines-krmilnik/config.json (ali pot v FINES_KRMILNIK_CONFIG, za preizkus na računalniku ./config.json).
"""

import json
import os
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VERZIJA = "1.0.0"
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
ZAKLEP = threading.Lock()
STANJE = {
    "naprava": {"ime": CONFIG.get("ime", "Krmilnik"), "lokacija": ""},
    "tipke": CONFIG.get("tipke_rezerva", []),  # dokler se nastavitve ne preberejo (ali brez povezave)
    "na_zvezi": False,
    "zadnji_stik": None,
    "napaka": None,
}


def log(*s):
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), *s, flush=True)


# ---------------------------------------------------------------------------------------------------------------
# Lokalna baza (čakalna vrsta žigov in zadnje nastavitve)
# ---------------------------------------------------------------------------------------------------------------
def baza():
    b = sqlite3.connect(CONFIG["podatki"], timeout=10)
    b.row_factory = sqlite3.Row
    return b


def pripravi_bazo():
    os.makedirs(os.path.dirname(CONFIG["podatki"]) or ".", exist_ok=True)
    with baza() as b:
        b.execute(
            """create table if not exists zigi (
                 lokalni_id text primary key, st_kartice text not null, cas text not null, tipka integer,
                 poslano integer not null default 0, preklican integer not null default 0, odgovor text, ustvarjen text not null)"""
        )
        b.execute("create table if not exists nastavitve (kljuc text primary key, vrednost text not null)")
        vr = b.execute("select vrednost from nastavitve where kljuc = 'stanje'").fetchone()
        if vr:
            shranjeno = json.loads(vr["vrednost"])
            STANJE["tipke"] = shranjeno.get("tipke", STANJE["tipke"])
            STANJE["naprava"] = shranjeno.get("naprava", STANJE["naprava"])
        # starejši poslani žigi (60 dni) se pobrišejo - FIN:OS jih ima
        meja = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        b.execute("delete from zigi where poslano = 1 and cas < ?", (meja,))


# ---------------------------------------------------------------------------------------------------------------
# FIN:OS
# ---------------------------------------------------------------------------------------------------------------
def klic(metoda, telo=None, cakaj=8):
    zahteva = urllib.request.Request(
        CONFIG["streznik"] + "/api/krmilnik",
        method=metoda,
        data=json.dumps(telo).encode() if telo is not None else None,
        headers={"Authorization": "Bearer " + CONFIG["kljuc"], "Content-Type": "application/json", "X-Verzija": VERZIJA, "User-Agent": "FinesKrmilnik/" + VERZIJA},
    )
    try:
        with urllib.request.urlopen(zahteva, timeout=cakaj) as odg:
            return json.loads(odg.read().decode())
    except urllib.error.HTTPError as e:
        try:
            sporocilo = json.loads(e.read().decode()).get("napaka")
        except Exception:
            sporocilo = None
        raise RuntimeError(f"FIN:OS {e.code}: {sporocilo or e.reason}") from None


def oznaci_zvezo(ok, napaka=None):
    STANJE["na_zvezi"] = ok
    STANJE["napaka"] = napaka
    if ok:
        STANJE["zadnji_stik"] = datetime.now(timezone.utc).isoformat()


def preberi_nastavitve():
    try:
        d = klic("GET")
        STANJE["tipke"] = d.get("tipke", [])
        STANJE["naprava"] = d.get("naprava", STANJE["naprava"])
        oznaci_zvezo(True)
        with baza() as b:
            b.execute("insert or replace into nastavitve (kljuc, vrednost) values ('stanje', ?)", (json.dumps({"tipke": STANJE["tipke"], "naprava": STANJE["naprava"]}),))
        # ura krmilnika naj se ujema s strežnikom (NTP); opozorilo, če se razlikuje za več kot 2 min
        if d.get("cas"):
            razlika = abs((datetime.fromisoformat(d["cas"].replace("Z", "+00:00")) - datetime.now(timezone.utc)).total_seconds())
            if razlika > 120:
                log(f"OPOZORILO: ura krmilnika se razlikuje od strežnika za {int(razlika)} s - preveri NTP / časovni pas.")
    except Exception as e:  # brez povezave
        oznaci_zvezo(False, str(e))


def poslji_cakajoce(najvec=50):
    """Pošlje neposlane žige (najstarejše najprej). Vrne rezultate po lokalni_id."""
    with ZAKLEP:
        with baza() as b:
            vrstice = b.execute("select * from zigi where poslano = 0 and preklican = 0 order by cas limit ?", (najvec,)).fetchall()
        if not vrstice:
            return {}
        try:
            d = klic("POST", {"zigi": [{"lokalni_id": v["lokalni_id"], "st_kartice": v["st_kartice"], "cas": v["cas"], "tipka": v["tipka"]} for v in vrstice]})
            oznaci_zvezo(True)
        except Exception as e:
            oznaci_zvezo(False, str(e))
            return {}
        rezultati = {r.get("lokalni_id"): r for r in d.get("rezultati", [])}
        with baza() as b:
            for lid, r in rezultati.items():
                if r.get("trajno"):
                    b.execute("update zigi set poslano = 1, odgovor = ? where lokalni_id = ?", (json.dumps(r), lid))
        return rezultati


def sinhronizacija():
    zadnje_nastavitve = 0
    while True:
        try:
            if time.time() - zadnje_nastavitve > 60:
                preberi_nastavitve()
                zadnje_nastavitve = time.time()
            poslji_cakajoce()
        except Exception as e:
            log("Napaka sinhronizacije:", e)
        time.sleep(5)


def funkcija_tipke(tipka):
    return next((t.get("funkcija") for t in STANJE["tipke"] if t.get("tipka") == tipka), None)


def cakajo():
    with baza() as b:
        return b.execute("select count(*) from zigi where poslano = 0 and preklican = 0").fetchone()[0]


def zig(st_kartice, tipka):
    """Žig s kartico (in tipko). Vrne odgovor za zaslon."""
    st_kartice = "".join(ch for ch in str(st_kartice) if ch.isalnum())[:40]
    if len(st_kartice) < 3:
        return {"ok": False, "napaka": "Kartica ni prebrana - poskusi znova."}
    funkcija = funkcija_tipke(tipka) if tipka is not None else None
    zdaj = datetime.now(timezone.utc).isoformat()

    if funkcija in ("info", "preklici"):
        # potrebuje FIN:OS; brez povezave odgovori iz lokalne vrste
        try:
            d = klic("POST", {"zigi": [{"lokalni_id": "f-" + uuid.uuid4().hex, "st_kartice": st_kartice, "cas": zdaj, "tipka": tipka}]}, cakaj=5)
            oznaci_zvezo(True)
            return {**d["rezultati"][0], "poslano": True}
        except Exception as e:
            oznaci_zvezo(False, str(e))
            with baza() as b:
                if funkcija == "preklici":
                    meja = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
                    v = b.execute("select lokalni_id from zigi where st_kartice = ? and poslano = 0 and preklican = 0 and cas > ? order by cas desc limit 1", (st_kartice, meja)).fetchone()
                    if not v:
                        return {"ok": False, "napaka": "Brez povezave - preklic ni mogoč."}
                    b.execute("update zigi set preklican = 1 where lokalni_id = ?", (v["lokalni_id"],))
                    return {"ok": True, "akcija": "preklic", "poslano": False}
                danes = datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
                vr = b.execute("select cas, tipka from zigi where st_kartice = ? and preklican = 0 and cas >= ? order by cas", (st_kartice, danes)).fetchall()
                imena = {t.get("tipka"): t.get("besedilo") for t in STANJE["tipke"]}
                return {
                    "ok": True,
                    "akcija": "info",
                    "poslano": False,
                    "zigi": [{"cas": datetime.fromisoformat(r["cas"]).astimezone().strftime("%H:%M"), "tipka": imena.get(r["tipka"])} for r in vr],
                }

    lid = uuid.uuid4().hex
    with baza() as b:
        b.execute("insert into zigi (lokalni_id, st_kartice, cas, tipka, ustvarjen) values (?, ?, ?, ?, ?)", (lid, st_kartice, zdaj, tipka, zdaj))
    log("Žig", st_kartice, "tipka", tipka)
    # takoj poskusi poslati (pozdrav z imenom); sicer ostane v vrsti
    r = poslji_cakajoce().get(lid)
    if r:
        return {**r, "poslano": True}
    return {"ok": True, "akcija": "zig", "poslano": False}


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
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/zig"):
            try:
                d = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                tipka = d.get("tipka")
                return self.poslji_json(zig(d.get("st_kartice", ""), int(tipka) if tipka is not None else None))
            except Exception as e:
                log("Napaka žiga:", e)
                return self.poslji_json({"ok": False, "napaka": "Napaka krmilnika - poskusi znova."}, 500)
        self.send_error(404)


def main():
    if not CONFIG.get("kljuc") or not CONFIG.get("streznik"):
        log("V config.json manjka streznik ali kljuc.")
        sys.exit(1)
    pripravi_bazo()
    threading.Thread(target=sinhronizacija, daemon=True).start()
    log(f"FIN:OS krmilnik {VERZIJA} - zaslon na http://127.0.0.1:{CONFIG['port']} , strežnik {CONFIG['streznik']}")
    ThreadingHTTPServer(("127.0.0.1", CONFIG["port"]), Streznik).serve_forever()


if __name__ == "__main__":
    main()
