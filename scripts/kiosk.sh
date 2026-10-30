#!/usr/bin/env bash
set -euo pipefail
kiosk_url="${ATMOSPHERE_URL:-http://127.0.0.1:3000/display}"
browser_binary="${CHROMIUM_BIN:-chromium}"
if ! command -v "$browser_binary" >/dev/null; then
  echo "Set CHROMIUM_BIN to your installed Chromium executable." >&2
  exit 1
fi
for attempt in {1..60}; do
  if curl --fail --silent --output /dev/null "$kiosk_url"; then
    exec "$browser_binary" --kiosk --no-first-run --no-default-browser-check \
      --user-data-dir="${XDG_DATA_HOME:-$HOME/.local/share}/atmosphere-kiosk" "$kiosk_url"
  fi
  sleep 1
done
echo "Atmosphere did not become ready at $kiosk_url" >&2
exit 1
