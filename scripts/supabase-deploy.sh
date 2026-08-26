#!/usr/bin/env bash
# Apply all supabase/migrations/*.sql in order via Supabase Management API.
# Requires: SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)
# Optional: SUPABASE_PROJECT_REF (default tgobadhdylarhssudplc)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${SUPABASE_PROJECT_REF:-tgobadhdylarhssudplc}"
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens"
  exit 1
fi

apply_sql() {
  local file="$1"
  local sql
  sql="$(cat "$file")"
  echo "Applying $(basename "$file") ..."
  local body
  body="$(python3 - <<PY
import json, sys
print(json.dumps({"query": sys.stdin.read()}))
PY
<<<"$sql")"
  local res
  res="$(curl -fsS -X POST "https://api.supabase.com/v1/projects/${REF}/database/query" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$body")"
  if echo "$res" | grep -qi 'error'; then
    echo "$res"
    echo "Failed: $(basename "$file")"
    exit 1
  fi
}

for file in "$ROOT"/supabase/migrations/*.sql; do
  [[ -f "$file" ]] || continue
  apply_sql "$file"
done

echo "All migrations applied."

if command -v npx >/dev/null 2>&1; then
  echo "Deploying edge functions ..."
  cd "$ROOT"
  npx supabase functions deploy delete-account --project-ref "$REF"
fi

echo "Done. Run: npm run supabase:verify"
