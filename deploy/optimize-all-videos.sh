#!/usr/bin/env bash
# Queue all unoptimized / missing-HLS videos for background compress + adaptive HLS.
# Usage (on server or local):
#   export ADMIN_EMAIL='admin@example.com'
#   export ADMIN_PASSWORD='your-password'
#   ./optimize-all-videos.sh
#
# Optional:
#   API_BASE=https://api.drsalahalzait.me/api/v1 ./optimize-all-videos.sh
#   ACCESS_TOKEN='eyJ...' ./optimize-all-videos.sh   # skip login

set -euo pipefail

API_BASE="${API_BASE:-https://api.drsalahalzait.me/api/v1}"
DEVICE_ID="${DEVICE_ID:-optimize-script}"
DEVICE_NAME="${DEVICE_NAME:-optimize-all-videos.sh}"

echo "API: $API_BASE"

if [[ -z "${ACCESS_TOKEN:-}" ]]; then
  if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
    echo "Set ADMIN_EMAIL and ADMIN_PASSWORD, or pass ACCESS_TOKEN."
    echo "Example:"
    echo "  ADMIN_EMAIL=admin@you.com ADMIN_PASSWORD='***' $0"
    exit 1
  fi

  echo "Logging in as $ADMIN_EMAIL ..."
  LOGIN_JSON=$(curl -sS -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"deviceId\":\"$DEVICE_ID\",\"deviceName\":\"$DEVICE_NAME\"}")

  ACCESS_TOKEN=$(printf '%s' "$LOGIN_JSON" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "Login failed:"
    echo "$LOGIN_JSON"
    exit 1
  fi
  echo "Login OK"
fi

echo "Queueing optimize-all ..."
RESP=$(curl -sS -X POST "$API_BASE/admin/videos/optimize-all" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json")

echo "$RESP"
echo
echo "Done. Watch API logs for 🎬 / ✅ Optimized lesson …"
echo "  docker compose logs -f api"
