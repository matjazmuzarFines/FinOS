#!/usr/bin/env bash
# Zaslon krmilnika čez cel zaslon (zažene ga namizje ob prijavi). Počaka, da program v ozadju odgovori.
# Samo en zagon hkrati (autostart je lahko vpisan v več namizij).
exec 9>/tmp/fines-kiosk.lock
flock -n 9 || exit 0

for _ in $(seq 1 60); do
  curl -fs http://127.0.0.1:8080/api/stanje >/dev/null 2>&1 && break
  sleep 1
done

BRSKALNIK="$(command -v chromium || command -v chromium-browser)"
while true; do
  "$BRSKALNIK" --kiosk --noerrdialogs --disable-infobars --no-first-run --incognito \
    --disable-features=Translate,TranslateUI --overscroll-history-navigation=0 --disable-pinch \
    --check-for-update-interval=31536000 --autoplay-policy=no-user-gesture-required \
    http://127.0.0.1:8080
  # če se brskalnik zapre (ali sesuje), se odpre znova
  sleep 2
done
