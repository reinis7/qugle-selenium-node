#!/usr/bin/env bash
set -euo pipefail

# Move to project root
cd "$(dirname "$0")/.."

# Load .env variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Default values if not set
DISPLAY="${DISPLAY:-:1}"
SCREEN="${SCREEN:-1440x900x24}"
echo $DISPLAY;
echo $SCREEN;

# Start Xvfb if not already up
if ! xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  echo "start xvfb"
  nohup Xvfb "$DISPLAY" -screen 0 "$SCREEN" -nolisten tcp -noreset >/tmp/xvfb.log 2>&1 &
  # small wait for server to come up
  for i in {1..20}; do
    xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && break
    sleep 0.2
  done
fi

export DISPLAY

# # OPTIONAL: start XFCE session if you really need a full desktop
# if ! pgrep -u "$USER" -f "xfce4-session" >/dev/null 2>&1; then
#   nohup startxfce4 >/tmp/xfce.log 2>&1 &
#   # give it a moment but don't block your app
#   sleep 1
# fi

