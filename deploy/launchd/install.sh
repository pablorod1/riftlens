#!/usr/bin/env bash
# Instala el crawler como servicio de usuario en macOS (launchd): arranca al
# iniciar sesión, se relanza si se cae y escribe el log en data/logs/.
#
#   deploy/launchd/install.sh            # instala y arranca
#   deploy/launchd/install.sh uninstall  # para y desinstala
set -euo pipefail

LABEL="com.riftlens.crawler"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [[ "${1:-}" == "uninstall" ]]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Desinstalado $LABEL"
  exit 0
fi

BUN="$(command -v bun || true)"
[[ -n "$BUN" ]] || { echo "No encuentro bun en el PATH" >&2; exit 1; }
[[ -f "$ROOT/.env" ]] || { echo "Falta $ROOT/.env (RIOT_API_KEY…)" >&2; exit 1; }
mkdir -p "$ROOT/data/logs" "$(dirname "$PLIST")"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$ROOT/apps/worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>$BUN</string><string>--env-file=../../.env</string><string>src/crawl.ts</string>
  </array>
  <key>RunAtLoad</key><true/>
  <!-- Se relanza siempre que termine; como mucho una vez cada 10 min (clave caducada, sin red…) -->
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>600</integer>
  <!-- Tiempo para publicar los agregados al parar -->
  <key>ExitTimeOut</key><integer>120</integer>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>$ROOT/data/logs/crawler.log</string>
  <key>StandardErrorPath</key><string>$ROOT/data/logs/crawler.log</string>
</dict>
</plist>
PLIST

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "Instalado $LABEL. Log: tail -f data/logs/crawler.log"
echo "Parar: launchctl kill TERM $DOMAIN/$LABEL (se relanza) · desinstalar: $0 uninstall"
