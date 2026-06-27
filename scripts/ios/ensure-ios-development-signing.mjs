#!/usr/bin/env node
/**
 * Create iOS App Development provisioning profiles for Debug device installs (Metro hot reload).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import https from "node:https";

const ROOT = path.resolve(import.meta.dirname, "../..");
const IOS_DIR = path.join(ROOT, "apps/askbible-mobile/ios");
const SIGNING_DIR = path.join(IOS_DIR, ".local-signing");
const MANIFEST_PATH = path.join(SIGNING_DIR, "manifest.json");
const TEAM_ID = "AJ2998VZH6";
const BUNDLE_ID = "me.askbible";
const WIDGET_BUNDLE_ID = "me.askbible.widget";

const ASC_API_KEY_ID = process.env.EXPO_ASC_KEY_ID?.trim() || process.env.ASC_API_KEY_ID?.trim() || "9HDA27WY8C";
const ASC_API_KEY_ISSUER_ID =
  process.env.EXPO_ASC_ISSUER_ID?.trim() ||
  process.env.ASC_API_KEY_ISSUER_ID?.trim() ||
  "a56f0624-e4a4-438d-be5d-92403dd9969b";
const ASC_API_KEY_PATH =
  process.env.ASC_API_KEY_PATH?.trim() ||
  process.env.EXPO_ASC_API_KEY_PATH?.trim() ||
  path.join(ROOT, "AA/AuthKey_9HDA27WY8C.p8");

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function ascToken() {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: ASC_API_KEY_ID, typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      iss: ASC_API_KEY_ISSUER_ID,
      iat: now,
      exp: now + 1200,
      aud: "appstoreconnect-v1",
    }),
  );
  const data = `${header}.${payload}`;
  const key = fs.readFileSync(ASC_API_KEY_PATH, "utf8");
  const sig = crypto.sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" });
  return `${data}.${sig.toString("base64url")}`;
}

function ascRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.appstoreconnect.apple.com${apiPath}`);
    const req = https.request(
      url,
      {
        method,
        headers: {
          Authorization: `Bearer ${ascToken()}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed, raw });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function installProvisioningProfile(base64Content, profileName) {
  const profilePath = path.join(SIGNING_DIR, `${profileName.replace(/[^\w.-]+/g, "_")}.mobileprovision`);
  const buf = Buffer.from(base64Content, "base64");
  fs.writeFileSync(profilePath, buf);
  const profilesDir = path.join(os.homedir(), "Library/MobileDevice/Provisioning Profiles");
  ensureDir(profilesDir);
  const installedPath = path.join(profilesDir, `${crypto.createHash("md5").update(buf).digest("hex")}.mobileprovision`);
  fs.writeFileSync(installedPath, buf);
  return profilePath;
}

async function getBundleIdResource(identifier) {
  const res = await ascRequest("GET", `/v1/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=20`);
  const item = (res.body?.data ?? []).find((entry) => entry.attributes?.identifier === identifier);
  if (!item?.id) throw new Error(`Bundle ID not found: ${identifier}`);
  return item.id;
}

async function getDevelopmentCert() {
  const res = await ascRequest("GET", "/v1/certificates?filter[certificateType]=DEVELOPMENT&limit=20");
  const certs = res.body?.data ?? [];
  certs.sort((a, b) => String(b.attributes?.expirationDate).localeCompare(String(a.attributes?.expirationDate)));
  return certs[0] ?? null;
}

async function resolveDeviceId(udid) {
  const res = await ascRequest("GET", `/v1/devices?filter[udid]=${encodeURIComponent(udid)}&limit=1`);
  const device = res.body?.data?.[0];
  if (device?.id) return device.id;

  console.log(`→ Register device ${udid} …`);
  const create = await ascRequest("POST", "/v1/devices", {
    data: {
      type: "devices",
      attributes: {
        name: `AskBible Dev ${udid.slice(-6)}`,
        platform: "IOS",
        udid,
      },
    },
  });
  if (create.status >= 400) {
    throw new Error(`Register device failed (${create.status}): ${JSON.stringify(create.body)}`);
  }
  return create.body.data.id;
}

async function findActiveDevProfile(bundleIdResourceId, certId) {
  const res = await ascRequest(
    "GET",
    `/v1/profiles?filter[profileType]=IOS_APP_DEVELOPMENT&limit=50&include=bundleId,certificates,devices`,
  );
  const profiles = res.body?.data ?? [];
  const matching = profiles.filter((p) => {
    const profileBundleId = p.relationships?.bundleId?.data?.id;
    const certIds = p.relationships?.certificates?.data?.map((c) => c.id) ?? [];
    return profileBundleId === bundleIdResourceId && certIds.includes(certId) && p.attributes?.profileState === "ACTIVE";
  });
  matching.sort((a, b) => String(b.attributes?.createdDate).localeCompare(String(a.attributes?.createdDate)));
  return matching[0] ?? null;
}

async function createDevProfile({ bundleIdentifier, bundleIdResourceId, certId, deviceId }) {
  const profileName = `AskBible ${bundleIdentifier} Development ${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const res = await ascRequest("POST", "/v1/profiles", {
    data: {
      type: "profiles",
      attributes: {
        name: profileName,
        profileType: "IOS_APP_DEVELOPMENT",
      },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundleIdResourceId } },
        certificates: { data: [{ type: "certificates", id: certId }] },
        devices: { data: [{ type: "devices", id: deviceId }] },
      },
    },
  });
  if (res.status >= 400) {
    throw new Error(`Create development profile failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function ensureDevProfile(bundleIdentifier, bundleIdResourceId, certId, deviceId) {
  const existing = await findActiveDevProfile(bundleIdResourceId, certId);
  if (existing) {
    console.log(`→ 复用 Development Profile：${existing.attributes?.name}`);
    return existing;
  }
  console.log(`→ 创建 Development Profile（${bundleIdentifier}）…`);
  return createDevProfile({ bundleIdentifier, bundleIdResourceId, certId, deviceId });
}

const DEFAULT_IOS_DEVICE_NAME = "home";
const DEFAULT_IOS_DEVICE_UDID = "00008101-001641020C98001E";

function readManifestDevUdid() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    return String(manifest.devDeviceUdid || "").trim() || null;
  } catch {
    return null;
  }
}

function isDeviceNameAvailable(name) {
  try {
    const out = execFileSync("xcrun", ["devicectl", "list", "devices"], { encoding: "utf8" });
    return out
      .split("\n")
      .some((line) => line.startsWith(`${name} `) && line.includes("available (paired)"));
  } catch {
    return false;
  }
}

function detectPairedDeviceUdid() {
  const preferredName = process.env.IOS_DEVICE?.trim() || DEFAULT_IOS_DEVICE_NAME;
  const envUdid = process.env.IOS_DEVICE_UDID?.trim();
  if (envUdid) return envUdid;

  const manifestUdid = readManifestDevUdid() || DEFAULT_IOS_DEVICE_UDID;
  if (isDeviceNameAvailable(preferredName)) {
    return manifestUdid;
  }
  try {
    const traceOut = execFileSync("xcrun", ["xctrace", "list", "devices"], { encoding: "utf8" });
    const udidRe = /\(([0-9A-Fa-f]{8}-[0-9A-Fa-f]{16})\)/;
    for (const line of traceOut.split("\n")) {
      if (line.includes("Simulator") || line.includes("MacBook") || line.includes("Mac Pro")) continue;
      const udidMatch = line.match(udidRe);
      if (!udidMatch) continue;
      const name = line.split("(")[0]?.trim();
      if (!name || name.startsWith("==")) continue;
      if (preferredName && name !== preferredName) continue;
      return udidMatch[1];
    }
  } catch {
    // fall through
  }

  try {
    const out = execFileSync("xcrun", ["devicectl", "list", "devices"], { encoding: "utf8" });
    const row = out
      .split("\n")
      .find((line) => line.includes("available (paired)") && (!preferredName || line.startsWith(`${preferredName} `)));
    const name = row?.trim().split(/\s+/)[0];
    if (name) {
      const traceOut = execFileSync("xcrun", ["xctrace", "list", "devices"], { encoding: "utf8" });
      for (const line of traceOut.split("\n")) {
        if (!line.startsWith(name)) continue;
        const udidMatch = line.match(/\(([0-9A-Fa-f]{8}-[0-9A-Fa-f]{16})\)/);
        if (udidMatch) return udidMatch[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function main() {
  if (!fs.existsSync(ASC_API_KEY_PATH)) {
    throw new Error(`ASC API key not found: ${ASC_API_KEY_PATH}`);
  }
  ensureDir(SIGNING_DIR);

  const deviceUdid =
    process.env.IOS_DEVICE_UDID?.trim() ||
    readManifestDevUdid() ||
    detectPairedDeviceUdid();
  if (!deviceUdid) {
    throw new Error("No paired iPhone found. Connect device and trust this Mac.");
  }

  const cert = await getDevelopmentCert();
  if (!cert?.id) {
    throw new Error("No iOS Development certificate in App Store Connect. Create one in Xcode → Settings → Accounts.");
  }
  console.log(`→ Development certificate: ${cert.attributes?.serialNumber ?? cert.id}`);

  const deviceId = await resolveDeviceId(deviceUdid);
  const bundleIdResourceId = await getBundleIdResource(BUNDLE_ID);
  const profile = await ensureDevProfile(BUNDLE_ID, bundleIdResourceId, cert.id, deviceId);
  const profilePath = installProvisioningProfile(profile.attributes.profileContent, profile.attributes.name);

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
    : { teamId: TEAM_ID, bundleId: BUNDLE_ID };
  manifest.devCertificateId = cert.id;
  manifest.devProfileName = profile.attributes.name;
  manifest.devProfileUuid = profile.attributes.uuid;
  manifest.devProfilePath = profilePath;
  manifest.devDeviceUdid = deviceUdid;
  manifest.devUpdatedAt = new Date().toISOString();

  try {
    const widgetBundleIdResourceId = await getBundleIdResource(WIDGET_BUNDLE_ID);
    const widgetProfile = await ensureDevProfile(WIDGET_BUNDLE_ID, widgetBundleIdResourceId, cert.id, deviceId);
    const widgetProfilePath = installProvisioningProfile(widgetProfile.attributes.profileContent, widgetProfile.attributes.name);
    manifest.devWidgetProfileName = widgetProfile.attributes.name;
    manifest.devWidgetProfileUuid = widgetProfile.attributes.uuid;
    manifest.devWidgetProfilePath = widgetProfilePath;
  } catch (err) {
    console.warn(`→ Widget development profile skipped: ${err?.message ?? err}`);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
