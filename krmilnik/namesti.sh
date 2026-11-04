#!/usr/bin/env bash
# =====================================================================
# FIN:OS krmilnik - namestitev na Raspberry Pi (Raspberry Pi OS z namizjem, Bookworm ali novejši)
#
# NAJLAŽJE: v mapo krmilnik daj config.json (FIN:OS -> Krmilnik -> Naprave -> Prenesi nastavitve), na Raspberry Pi
# dvakrat klikni to datoteko in izberi "Execute in Terminal" (Izvedi v terminalu). Nič ni treba tipkati.
# (Ali v terminalu:  bash namesti.sh  - skrbniške pravice si skript vzame sam.)
# Posodobitev = nove datoteke v to mapo in ponovno zaženi (nastavitve in čakajoči žigi ostanejo).
#
# Kaj naredi:
#   1. namesti Chromium (brskalnik za zaslon), nastavi časovni pas Europe/Ljubljana in uro prek interneta (NTP)
#   2. skopira program v /opt/fines-krmilnik, nastavitve v /etc/fines-krmilnik/config.json (vpraša naslov in ključ)
#   3. storitev "fines-krmilnik" (teče v ozadju, ob napaki ali izpadu elektrike se sama znova zažene)
#   4. ob zagonu namizja se zaslon krmilnika odpre čez cel zaslon (kiosk), zaslon se ne ugaša
# =====================================================================
set -euo pipefail

# skrbniške pravice (na Raspberry Pi OS brez gesla) - skript se zažene znova kot skrbnik
if [[ $EUID -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi
MAPA="$(cd "$(dirname "$0")" && pwd)"
UPORABNIK="${SUDO_USER:-pi}"
DOM="$(getent passwd "$UPORABNIK" | cut -d: -f6)"
CILJ=/opt/fines-krmilnik
NAST=/etc/fines-krmilnik

echo "== FIN:OS krmilnik: namestitev (uporabnik namizja: $UPORABNIK) =="

echo "-- 1/4 paketi, čas"
apt-get update -y
apt-get install -y python3 || true
apt-get install -y chromium || apt-get install -y chromium-browser
timedatectl set-timezone Europe/Ljubljana || true
timedatectl set-ntp true || true

echo "-- 2/4 program in nastavitve"
mkdir -p "$CILJ" "$NAST" /var/lib/fines-krmilnik
cp -r "$MAPA/fines_krmilnik.py" "$MAPA/ui" "$CILJ/"
cp "$MAPA/kiosk.sh" "$CILJ/kiosk.sh"
chmod +x "$CILJ/kiosk.sh" "$CILJ/fines_krmilnik.py"

if [[ -f "$MAPA/config.json" ]]; then
  # nastavitve iz FIN:OS (Prenesi nastavitve) - zamenjajo prejšnje (npr. nov ključ)
  cp "$MAPA/config.json" "$NAST/config.json"
  chmod 600 "$NAST/config.json"
  echo "Nastavitve prebrane iz config.json v mapi krmilnik."
elif [[ ! -f "$NAST/config.json" ]]; then
  if [[ ! -t 0 ]]; then
    echo "V mapi krmilnik ni config.json - prenesi ga v FIN:OS (Krmilnik -> Naprave -> Prenesi nastavitve)."
    sleep 30
    exit 1
  fi
  echo
  read -r -p "Naslov FIN:OS [https://finos-mu.vercel.app]: " STREZNIK
  STREZNIK="${STREZNIK:-https://finos-mu.vercel.app}"
  read -r -p "Ključ naprave (FIN:OS -> Registracija časa -> Nastavitve -> Krmilnik -> Naprave, začne se s fk_): " KLJUC
  read -r -p "Ime krmilnika na zaslonu (npr. Vhod proizvodnja): " IME
  python3 - "$NAST/config.json" "$STREZNIK" "$KLJUC" "$IME" <<'PY'
import json, sys
pot, streznik, kljuc, ime = sys.argv[1:5]
json.dump({"streznik": streznik.strip().rstrip("/"), "kljuc": kljuc.strip(), "ime": ime.strip() or "Krmilnik", "port": 8080}, open(pot, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY
  chmod 600 "$NAST/config.json"
  echo "Nastavitve shranjene v $NAST/config.json"
else
  echo "Nastavitve že obstajajo ($NAST/config.json) - ostanejo."
fi

echo "-- 3/4 storitev v ozadju"
cat > /etc/systemd/system/fines-krmilnik.service <<UNIT
[Unit]
Description=FIN:OS krmilnik (beleženje delovnega časa)
After=network-online.target time-sync.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/python3 $CILJ/fines_krmilnik.py
Environment=FINES_KRMILNIK_CONFIG=$NAST/config.json
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable fines-krmilnik
systemctl restart fines-krmilnik

echo "-- 4/4 zaslon čez cel zaslon ob zagonu"
# samodejna prijava v namizje, zaslon se ne ugaša
if command -v raspi-config >/dev/null; then
  raspi-config nonint do_boot_behaviour B4 || true
  raspi-config nonint do_blanking 1 || true
fi
# labwc (Raspberry Pi OS 2024+)
mkdir -p "$DOM/.config/labwc"
touch "$DOM/.config/labwc/autostart"
grep -q "fines-krmilnik" "$DOM/.config/labwc/autostart" || echo "$CILJ/kiosk.sh &  # fines-krmilnik" >> "$DOM/.config/labwc/autostart"
# wayfire (Raspberry Pi OS 2023)
if [[ -f "$DOM/.config/wayfire.ini" ]] && ! grep -q "fines-krmilnik" "$DOM/.config/wayfire.ini"; then
  printf '\n[autostart]\nfines-krmilnik = %s\n' "$CILJ/kiosk.sh" >> "$DOM/.config/wayfire.ini"
fi
# X11 / LXDE (starejši)
mkdir -p "$DOM/.config/autostart"
cat > "$DOM/.config/autostart/fines-krmilnik.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=FIN:OS krmilnik
Exec=$CILJ/kiosk.sh
DESK
chown -R "$UPORABNIK":"$UPORABNIK" "$DOM/.config"

echo
echo "== Končano. Stanje programa:  systemctl status fines-krmilnik   (dnevnik: journalctl -u fines-krmilnik -f)"
echo "== Raspberry Pi se čez 15 sekund ponovno zažene, nato se odpre zaslon krmilnika. (Ctrl+C = brez ponovnega zagona)"
sleep 15
reboot
