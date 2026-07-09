#!/usr/bin/env bash
# Print SHA-1 fingerprints and GCP steps for AskBible Google Sign-In (me.askbible).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/apps/askbible-mobile"
ANDROID_APP="$MOBILE/android/app"

echo "=== AskBible Google Sign-In setup ==="
echo ""
echo "Supabase Google Provider uses the Web client in GCP project joshmoney:"
echo "  https://console.cloud.google.com/apis/credentials?project=joshmoney"
echo ""
echo "Create / verify these OAuth clients (same GCP project as the Web client):"
echo ""
echo "1) Web application (already used by Supabase + mobile webClientId)"
echo "   Client ID → EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID"
echo ""
echo "2) iOS client"
echo "   Bundle ID: me.askbible"
echo "   Client ID → EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
echo "   URL scheme is auto-derived as com.googleusercontent.apps.<prefix>"
echo ""
echo "3) Android client (one or two entries for debug + release SHA-1)"
echo "   Package name: me.askbible"
echo "   SHA-1 fingerprints:"

if command -v keytool >/dev/null 2>&1; then
  if [[ -f "$ANDROID_APP/debug.keystore" ]]; then
    echo "   [debug keystore]"
    keytool -list -v -keystore "$ANDROID_APP/debug.keystore" -alias androiddebugkey \
      -storepass android -keypass android 2>/dev/null | rg "SHA1:" || true
  fi

  PROPS="$MOBILE/android/keystore.properties"
  if [[ -f "$PROPS" && -f "$ANDROID_APP/upload.keystore" ]]; then
    STORE_PASS="$(grep '^MYAPP_UPLOAD_STORE_PASSWORD=' "$PROPS" | cut -d= -f2-)"
    KEY_ALIAS="$(grep '^MYAPP_UPLOAD_KEY_ALIAS=' "$PROPS" | cut -d= -f2-)"
    echo "   [Play upload keystore — release / internal testing builds]"
    keytool -list -v -keystore "$ANDROID_APP/upload.keystore" \
      -storepass "$STORE_PASS" -alias "$KEY_ALIAS" 2>/dev/null | rg "SHA1:" || true
  else
    echo "   (upload keystore missing — run: npm run mobile:setup:android:keystore)"
  fi
else
  echo "   (install JDK for keytool)"
fi

echo ""
echo "   Android client ID → EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (optional; webClientId is required)"
echo ""
echo "4) App 端 Google 登录（无需 GCP iOS/Android client 也能用）："
echo "   已接入 Supabase 浏览器 OAuth，回调复用 /auth/callback"
echo "   确保 Supabase Redirect URLs 含："
echo "     https://askbible.me/auth/callback"
echo "     https://askbible.me/auth/mobile-callback"
echo "     http://127.0.0.1:3450/auth/mobile-callback"
echo "     askbible://auth/callback"
echo ""
echo "   在 .env.local 与 apps/askbible-mobile/.env.local 配置："
echo "   EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY"
echo "   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID（可选；原生 Sign-In 才需要 iOS client）"
echo ""
echo "5) Apple Sign-In (Supabase Auth, native iOS):"
echo "   Apple Developer → Identifiers → App ID me.askbible → Sign In with Apple 已启用"
echo "   Supabase → Authentication → Providers → Apple → Client IDs 必须包含："
echo "     me.askbible"
echo "   （若另有 Web Services ID，逗号追加，例如 me.askbible,me.askbible.service）"
echo "   只配 Services ID 不配 Bundle ID 时，App 会报 apple_not_configured / audience 错误。"
echo ""
echo "6) Rebuild native app (URL scheme / plugin change requires native rebuild):"
echo "   cd apps/askbible-mobile && npx expo run:ios --configuration Release --no-bundler"
echo "   npm run mobile:build:ios:production   # store / TestFlight"
echo "   npm run mobile:build:android:production"
echo ""
