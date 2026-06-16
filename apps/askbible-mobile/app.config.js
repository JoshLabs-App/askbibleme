/** @type {import('expo/config').ExpoConfig} */
const fs = require("fs");
const path = require("path");
const appJson = require("./app.json");
const { resolveGoogleOAuthEnv } = require("./google-oauth.env.js");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const mobileRoot = __dirname;
const repoRoot = path.join(mobileRoot, "../..");
loadEnvFile(path.join(mobileRoot, ".env.local"));
loadEnvFile(path.join(mobileRoot, ".env"));
loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

const google = resolveGoogleOAuthEnv();
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

const plugins = [
  ...(appJson.expo.plugins || []),
  "expo-apple-authentication",
  "expo-web-browser",
];
if (google.iosUrlScheme) {
  plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: google.iosUrlScheme }]);
} else if (google.webClientId) {
  plugins.push("@react-native-google-signin/google-signin");
}

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      usesAppleSignIn: true,
    },
    extra: {
      ...(appJson.expo.extra || {}),
      supabaseUrl: supabaseUrl || null,
      supabaseAnonKey: supabaseAnonKey || null,
      googleAuth: {
        webClientId: google.webClientId || null,
        iosClientId: google.iosClientId || null,
        androidClientId: google.androidClientId || null,
        iosUrlScheme: google.iosUrlScheme || null,
      },
    },
    plugins,
  },
};
