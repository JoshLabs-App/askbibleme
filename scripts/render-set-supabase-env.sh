#!/usr/bin/env bash
# Set Supabase env vars on Render askbible service and trigger deploy.
# Requires: RENDER_API_KEY from https://dashboard.render.com/u/settings#api-keys
#
# Usage:
#   export RENDER_API_KEY=rnd_...
#   export RENDER_SERVICE_ID=srv_...   # optional if SERVICE_NAME=askbible resolves
#   bash scripts/render-set-supabase-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${RENDER_SERVICE_NAME:-askbible}"

if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' "$ROOT/.env.local" | sed 's/\r$//')
  set +a
fi

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "Missing RENDER_API_KEY. Create one at https://dashboard.render.com/u/settings#api-keys"
  exit 1
fi

for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing $key (set in environment or .env.local)"
    exit 1
  fi
done

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" "https://api.render.com/v1$path" \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -fsS -X "$method" "https://api.render.com/v1$path" \
      -H "Authorization: Bearer $RENDER_API_KEY"
  fi
}

SERVICE_ID="${RENDER_SERVICE_ID:-}"
if [[ -z "$SERVICE_ID" ]]; then
  echo "Resolving service id for name=$SERVICE_NAME ..."
  SERVICE_ID="$(api GET "/services?limit=100" | python3 -c "
import json,sys
name=sys.argv[1]
for item in json.load(sys.stdin):
    s=item.get('service') or item
    if (s.get('name') or '').lower()==name.lower():
        print(s.get('id',''))
        break
" "$SERVICE_NAME")"
fi

if [[ -z "$SERVICE_ID" ]]; then
  echo "Could not find Render service named $SERVICE_NAME. Set RENDER_SERVICE_ID=srv_..."
  exit 1
fi

echo "Using service: $SERVICE_ID"

BODY="$(python3 - <<PY
import json, os
print(json.dumps([
  {"key": "NEXT_PUBLIC_SUPABASE_URL", "value": os.environ["NEXT_PUBLIC_SUPABASE_URL"]},
  {"key": "NEXT_PUBLIC_SUPABASE_ANON_KEY", "value": os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]},
  {"key": "SUPABASE_SERVICE_ROLE_KEY", "value": os.environ["SUPABASE_SERVICE_ROLE_KEY"]},
]))
PY
)"

echo "Updating environment variables..."
api PUT "/services/$SERVICE_ID/env-vars" "$BODY" >/dev/null

echo "Triggering deploy..."
DEPLOY_ID="$(api POST "/services/$SERVICE_ID/deploys" '{"clearCache":"do_not_clear"}' | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')"
echo "Deploy started: ${DEPLOY_ID:-(check dashboard)}"
echo "Dashboard: https://dashboard.render.com/web/$SERVICE_ID"
