#!/usr/bin/env node
/**
 * Write expo-updates native knobs from resolved Expo config.
 *
 * - Default / store: ASKBIBLE_OTA_CHANNEL unset → updates disabled
 * - Preview shell: ASKBIBLE_OTA_CHANNEL=preview → enabled + channel header
 *
 * Usage:
 *   node scripts/sync-mobile-ota-native-config.mjs
 *   ASKBIBLE_OTA_CHANNEL=preview node scripts/sync-mobile-ota-native-config.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MOBILE = path.join(ROOT, "apps/askbible-mobile");
const EXPO_PLIST = path.join(MOBILE, "ios/AskBibleme/Supporting/Expo.plist");
const ANDROID_MANIFEST = path.join(MOBILE, "android/app/src/main/AndroidManifest.xml");
const ANDROID_STRINGS = path.join(MOBILE, "android/app/src/main/res/values/strings.xml");

function readExpoConfig() {
  const r = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], {
    cwd: MOBILE,
    encoding: "utf8",
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`expo config failed:\n${r.stderr || r.stdout}`);
  }
  const raw = String(r.stdout || "").trim();
  const start = raw.indexOf("{");
  if (start < 0) throw new Error("expo config returned no JSON");
  return JSON.parse(raw.slice(start));
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function writeExpoPlist({ enabled, checkOnLaunch, launchWaitMs, runtimeVersion, updatesUrl, channel }) {
  const requestHeaders =
    channel &&
    `    <key>EXUpdatesRequestHeaders</key>
    <dict>
      <key>expo-channel-name</key>
      <string>${escapeXml(channel)}</string>
    </dict>
`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>EXUpdatesCheckOnLaunch</key>
    <string>${escapeXml(checkOnLaunch)}</string>
    <key>EXUpdatesEnabled</key>
    <${enabled ? "true" : "false"}/>
    <key>EXUpdatesLaunchWaitMs</key>
    <integer>${launchWaitMs}</integer>
    <key>EXUpdatesRuntimeVersion</key>
    <string>${escapeXml(runtimeVersion)}</string>
    <key>EXUpdatesURL</key>
    <string>${escapeXml(updatesUrl)}</string>
${requestHeaders || ""}  </dict>
</plist>
`;
  fs.writeFileSync(EXPO_PLIST, body);
}

function upsertAndroidMeta(manifest, name, value) {
  const re = new RegExp(
    `<meta-data android:name="${name.replace(/\./g, "\\.")}" android:value="[^"]*"/>`,
  );
  const tag = `<meta-data android:name="${name}" android:value="${escapeXml(value)}"/>`;
  if (re.test(manifest)) return manifest.replace(re, tag);
  // Insert after application opening tag's first updates meta block if missing
  return manifest.replace(
    /(<application\b[^>]*>)/,
    `$1\n    ${tag}`,
  );
}

function removeAndroidMeta(manifest, name) {
  const re = new RegExp(
    `\\s*<meta-data android:name="${name.replace(/\./g, "\\.")}" android:value="[^"]*"/>`,
    "g",
  );
  return manifest.replace(re, "");
}

function writeAndroid({ enabled, checkOnLaunch, launchWaitMs, runtimeVersion, updatesUrl, channel }) {
  let manifest = fs.readFileSync(ANDROID_MANIFEST, "utf8");
  manifest = upsertAndroidMeta(manifest, "expo.modules.updates.ENABLED", enabled ? "true" : "false");
  manifest = upsertAndroidMeta(
    manifest,
    "expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH",
    checkOnLaunch,
  );
  manifest = upsertAndroidMeta(
    manifest,
    "expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS",
    String(launchWaitMs),
  );
  manifest = upsertAndroidMeta(manifest, "expo.modules.updates.EXPO_UPDATE_URL", updatesUrl);
  manifest = upsertAndroidMeta(
    manifest,
    "expo.modules.updates.EXPO_RUNTIME_VERSION",
    "@string/expo_runtime_version",
  );
  const headersKey = "expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY";
  if (channel) {
    const headersJson = JSON.stringify({ "expo-channel-name": channel });
    manifest = upsertAndroidMeta(manifest, headersKey, headersJson);
  } else {
    manifest = removeAndroidMeta(manifest, headersKey);
  }
  fs.writeFileSync(ANDROID_MANIFEST, manifest);

  let strings = fs.readFileSync(ANDROID_STRINGS, "utf8");
  if (/<string name="expo_runtime_version">/.test(strings)) {
    strings = strings.replace(
      /<string name="expo_runtime_version">[^<]*<\/string>/,
      `<string name="expo_runtime_version">${escapeXml(runtimeVersion)}</string>`,
    );
  } else {
    strings = strings.replace(
      /<resources>/,
      `<resources>\n  <string name="expo_runtime_version">${escapeXml(runtimeVersion)}</string>`,
    );
  }
  fs.writeFileSync(ANDROID_STRINGS, strings);
}

function main() {
  const cfg = readExpoConfig();
  const updates = cfg.updates || {};
  const channel =
    (process.env.ASKBIBLE_OTA_CHANNEL || "").trim() ||
    updates.requestHeaders?.["expo-channel-name"] ||
    "";
  const enabled = updates.enabled === true && Boolean(channel);
  const checkOnLaunch = enabled ? updates.checkAutomatically || "ON_LOAD" : "NEVER";
  const launchWaitMs = Number(updates.fallbackToCacheTimeout ?? 0) || 0;
  const runtimeVersion = String(cfg.runtimeVersion || cfg.version || "");
  const updatesUrl = String(updates.url || "");
  if (!runtimeVersion) throw new Error("Missing runtimeVersion in Expo config");
  if (!updatesUrl) throw new Error("Missing updates.url in Expo config");

  writeExpoPlist({
    enabled,
    checkOnLaunch,
    launchWaitMs,
    runtimeVersion,
    updatesUrl,
    channel: enabled ? channel : "",
  });
  writeAndroid({
    enabled,
    checkOnLaunch,
    launchWaitMs,
    runtimeVersion,
    updatesUrl,
    channel: enabled ? channel : "",
  });

  console.log(
    `→ OTA native config: enabled=${enabled} channel=${channel || "(none)"} runtime=${runtimeVersion}`,
  );
}

main();
