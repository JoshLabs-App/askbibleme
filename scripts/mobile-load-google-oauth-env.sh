#!/usr/bin/env bash
# Load Google OAuth env from repo env files into the current shell (release builds).
load_mobile_google_oauth_env() {
  local root="${1:-}"
  if [[ -z "$root" ]]; then
    echo "load_mobile_google_oauth_env: missing repo root" >&2
    return 1
  fi

  local file line key value
  for file in "$root/.env.local" "$root/apps/askbible-mobile/.env.local"; do
    [[ -f "$file" ]] || continue
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%%#*}"
      line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      [[ -z "$line" ]] && continue
      [[ "$line" =~ ^(EXPO_PUBLIC_GOOGLE_|NEXT_PUBLIC_GOOGLE_|GOOGLE_OAUTH_|GOOGLE_WEB_CLIENT_ID=) ]] || \
      [[ "$line" =~ ^(EXPO_PUBLIC_SUPABASE_|NEXT_PUBLIC_SUPABASE_) ]] || continue
      export "$line"
    done < "$file"
  done

  # Mirror web client ID across Expo / Next / legacy names for app.config + runtime.
  value="${EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:-${NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID:-${GOOGLE_OAUTH_WEB_CLIENT_ID:-${GOOGLE_WEB_CLIENT_ID:-}}}}"
  if [[ -n "$value" ]]; then
    export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="$value"
    export NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID="$value"
  fi

  if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" && -z "${EXPO_PUBLIC_SUPABASE_URL:-}" ]]; then
    export EXPO_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
  fi
  if [[ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" && -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
    export NEXT_PUBLIC_SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL"
  fi
  if [[ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" && -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
    export EXPO_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
  fi
  if [[ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" && -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
    export NEXT_PUBLIC_SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY"
  fi
}
