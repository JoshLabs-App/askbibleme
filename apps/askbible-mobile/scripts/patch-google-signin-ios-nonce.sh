#!/usr/bin/env bash
# Free @react-native-google-signin does not forward `nonce` on iOS, but GIDSignIn
# supports it. Without a custom nonce, AppAuth still embeds one in the id_token and
# Supabase signInWithIdToken fails. Forward options[@"nonce"] to the native API.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/node_modules/@react-native-google-signin/google-signin/ios/RNGoogleSignin.mm"
if [[ ! -f "$TARGET" ]]; then
  exit 0
fi
if grep -q 'AskBible: forward nonce to GIDSignIn' "$TARGET"; then
  exit 0
fi
python3 - "$TARGET" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
old = """      NSString* hint = options[@\"loginHint\"];
      NSArray* scopes = self.scopes;

#if DEBUG
    @try {
#endif
      [GIDSignIn.sharedInstance signInWithPresentingViewController:presentingViewController hint:hint additionalScopes:scopes completion:^(GIDSignInResult * _Nullable signInResult, NSError * _Nullable error) {
        [self handleCompletion:signInResult withError:error withResolver:resolve withRejector:reject fromCallsite:@\"signIn\"];
      }];
"""
new = """      NSString* hint = options[@\"loginHint\"];
      // AskBible: forward nonce to GIDSignIn (required for Supabase id_token).
      NSString* nonce = options[@\"nonce\"];
      NSArray* scopes = self.scopes;

#if DEBUG
    @try {
#endif
      if (nonce.length > 0) {
        [GIDSignIn.sharedInstance signInWithPresentingViewController:presentingViewController hint:hint additionalScopes:scopes nonce:nonce completion:^(GIDSignInResult * _Nullable signInResult, NSError * _Nullable error) {
          [self handleCompletion:signInResult withError:error withResolver:resolve withRejector:reject fromCallsite:@\"signIn\"];
        }];
      } else {
        [GIDSignIn.sharedInstance signInWithPresentingViewController:presentingViewController hint:hint additionalScopes:scopes completion:^(GIDSignInResult * _Nullable signInResult, NSError * _Nullable error) {
          [self handleCompletion:signInResult withError:error withResolver:resolve withRejector:reject fromCallsite:@\"signIn\"];
        }];
      }
"""
if old not in text:
    print(f"warn: google-signin iOS nonce patch skipped (pattern mismatch): {path}", file=sys.stderr)
    sys.exit(0)
open(path, "w", encoding="utf-8").write(text.replace(old, new, 1))
print(f"patched google-signin iOS nonce: {path}")
PY
