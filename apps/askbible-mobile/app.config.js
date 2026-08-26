/** @type {import('expo/config').ExpoConfig} */
const fs = require("fs");
const path = require("path");
const appConfigBase = require("./expo-static-config.js");
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
const googleWebClientId = google.webClientId || "827770827257-cigkgaq8k1m8qiu9ogq6n60d4s5uqili.apps.googleusercontent.com";
const googleIosClientId = google.iosClientId || "827770827257-cq823rmvbvmcc9hccbn5s8d72gqdfv7v.apps.googleusercontent.com";
const googleIosUrlScheme = google.iosUrlScheme || "com.googleusercontent.apps.827770827257-cq823rmvbvmcc9hccbn5s8d72gqdfv7v";
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://tgobadhdylarhssudplc.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb2JhZGhkeWxhcmhzc3VkcGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTMwMDAsImV4cCI6MjA5Njc4OTAwMH0.5EqC5hJFmydZaVBmpXJk1ddJNGX_fY2hN83k5IzAO3I";

const plugins = [
  ...(appConfigBase.expo.plugins || []),
  "expo-apple-authentication",
  "expo-web-browser",
  ["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }],
];

/** Preview OTA only. Store/production builds leave ASKBIBLE_OTA_CHANNEL unset → updates stay off. */
const otaChannel = (process.env.ASKBIBLE_OTA_CHANNEL || "").trim();
const baseUpdates = appConfigBase.expo.updates || {};
const updates = otaChannel
  ? {
      ...baseUpdates,
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
      requestHeaders: {
        ...(baseUpdates.requestHeaders || {}),
        "expo-channel-name": otaChannel,
      },
    }
  : {
      ...baseUpdates,
      enabled: false,
      checkAutomatically: "NEVER",
      fallbackToCacheTimeout: 0,
    };

module.exports = {
  expo: {
    ...appConfigBase.expo,
    updates,
    experiments: {
      autolinkingModuleResolution: true,
    },
    ios: {
      ...appConfigBase.expo.ios,
      usesAppleSignIn: true,
    },
    plugins,
    extra: {
      ...(appConfigBase.expo.extra || {}),
      supabaseUrl: supabaseUrl || null,
      supabaseAnonKey: supabaseAnonKey || null,
      googleAuth: {
        webClientId: googleWebClientId,
        iosClientId: googleIosClientId,
        androidClientId: google.androidClientId || null,
        iosUrlScheme: googleIosUrlScheme,
      },
      askbibleOtaChannel: otaChannel || null,
    },
  },
};
