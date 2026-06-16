#!/usr/bin/env node
/**
 * 确保本机有 iOS Distribution 证书 + App Store Provisioning Profile（不经 Expo）。
 * 使用 ASC API Key 创建证书、下载 profile，并安装到本机 keychain / Provisioning Profiles。
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
const BUNDLE_ID = "me.askbible";
const TEAM_ID = "AJ2998VZH6";

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

function generateCsr() {
  const keyPath = path.join(SIGNING_DIR, "distribution.key");
  const csrPath = path.join(SIGNING_DIR, "distribution.csr");
  if (!fs.existsSync(keyPath)) {
    execFileSync("openssl", [
      "genrsa",
      "-out",
      keyPath,
      "2048",
    ]);
    chmod600(keyPath);
  }
  if (!fs.existsSync(csrPath)) {
    execFileSync("openssl", [
      "req",
      "-new",
      "-key",
      keyPath,
      "-out",
      csrPath,
      "-subj",
      `/emailAddress=josh.zeng.ca@gmail.com/CN=iOS Distribution/C=CA`,
    ]);
  }
  return {
    keyPath,
    csrPath,
    csrContent: fs.readFileSync(csrPath, "utf8"),
  };
}

function chmod600(filePath) {
  fs.chmodSync(filePath, 0o600);
}

async function getBundleIdResource() {
  const res = await ascRequest("GET", `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=1`);
  const item = res.body?.data?.[0];
  if (!item?.id) throw new Error(`Bundle ID not found: ${BUNDLE_ID}`);
  return item.id;
}

async function getDistributionCert() {
  const res = await ascRequest("GET", "/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=20");
  const certs = res.body?.data ?? [];
  if (certs.length === 0) return null;
  certs.sort((a, b) => String(b.attributes?.expirationDate).localeCompare(String(a.attributes?.expirationDate)));
  return certs[0];
}

async function createDistributionCert(csrContent) {
  const res = await ascRequest("POST", "/v1/certificates", {
    data: {
      type: "certificates",
      attributes: {
        certificateType: "DISTRIBUTION",
        csrContent,
      },
    },
  });
  if (res.status >= 400) {
    throw new Error(`Create distribution certificate failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

function importCertificate(certBase64, keyPath) {
  const certPath = path.join(SIGNING_DIR, "distribution.cer");
  fs.writeFileSync(certPath, Buffer.from(certBase64, "base64"));

  for (const [filePath, label] of [
    [certPath, "certificate"],
    [keyPath, "private key"],
  ]) {
    try {
      execFileSync(
        "security",
        [
          "import",
          filePath,
          "-k",
          `${os.homedir()}/Library/Keychains/login.keychain-db`,
          "-T",
          "/usr/bin/codesign",
        ],
        { stdio: "pipe" },
      );
    } catch (err) {
      const msg = String(err?.stderr ?? err?.message ?? err);
      if (!msg.includes("already exists")) {
        console.error(`Failed to import ${label}: ${msg}`);
        throw err;
      }
    }
  }
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

async function findProfileByUuid(uuid) {
  const res = await ascRequest("GET", `/v1/profiles?filter[uuid]=${encodeURIComponent(uuid)}&limit=1`);
  return res.body?.data?.[0] ?? null;
}

async function resolveAppStoreProfile(certificateId, bundleIdResourceId) {
  const manifestPath = path.join(SIGNING_DIR, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (
      manifest.bundleId === BUNDLE_ID &&
      manifest.certificateId === certificateId &&
      manifest.profileUuid
    ) {
      const existing = await findProfileByUuid(manifest.profileUuid);
      if (existing?.attributes?.profileState === "ACTIVE") {
        console.log(`→ 复用 App Store Profile：${existing.attributes?.name}`);
        return existing;
      }
    }
  }

  const res = await ascRequest(
    "GET",
    `/v1/profiles?filter[profileType]=IOS_APP_STORE&limit=50&include=certificates,bundleId`,
  );
  const profiles = res.body?.data ?? [];
  const matching = profiles.filter((p) => {
    const certIds = p.relationships?.certificates?.data?.map((c) => c.id) ?? [];
    const profileBundleId = p.relationships?.bundleId?.data?.id;
    return certIds.includes(certificateId) && profileBundleId === bundleIdResourceId;
  });
  matching.sort((a, b) => String(b.attributes?.createdDate).localeCompare(String(a.attributes?.createdDate)));
  if (matching[0]) {
    console.log(`→ 使用已有 App Store Profile：${matching[0].attributes?.name}`);
    return matching[0];
  }

  console.log("→ 创建 App Store Provisioning Profile…");
  return createAppStoreProfile(bundleIdResourceId, certificateId);
}

async function createAppStoreProfile(bundleIdResourceId, certId) {
  const profileName = `AskBible.me AppStore ${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const res = await ascRequest("POST", "/v1/profiles", {
    data: {
      type: "profiles",
      attributes: {
        name: profileName,
        profileType: "IOS_APP_STORE",
      },
      relationships: {
        bundleId: {
          data: { type: "bundleIds", id: bundleIdResourceId },
        },
        certificates: {
          data: [{ type: "certificates", id: certId }],
        },
      },
    },
  });
  if (res.status >= 400) {
    throw new Error(`Create provisioning profile failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function main() {
  if (!fs.existsSync(ASC_API_KEY_PATH)) {
    throw new Error(`ASC API key not found: ${ASC_API_KEY_PATH}`);
  }
  ensureDir(SIGNING_DIR);

  let cert = await getDistributionCert();
  const { keyPath, csrContent } = generateCsr();

  if (!cert) {
    console.log("→ 创建 iOS Distribution 证书…");
    cert = await createDistributionCert(csrContent);
  }

  const certContent = cert.attributes?.certificateContent;
  if (!certContent) throw new Error("Missing certificate content from Apple API");
  console.log(`→ 安装 Distribution 证书 (${cert.attributes?.serialNumber ?? cert.id})…`);
  importCertificate(certContent, keyPath);

  const bundleIdResourceId = await getBundleIdResource();
  let profile = await resolveAppStoreProfile(cert.id, bundleIdResourceId);

  const profileContent = profile.attributes?.profileContent;
  if (!profileContent) throw new Error("Missing provisioning profile content");
  const profilePath = installProvisioningProfile(profileContent, profile.attributes?.name ?? "AskBibleAppStore");
  const profileName = profile.attributes?.name;
  const profileUuid = profile.attributes?.uuid;

  const manifest = {
    teamId: TEAM_ID,
    bundleId: BUNDLE_ID,
    certificateId: cert.id,
    certificateSerial: cert.attributes?.serialNumber ?? null,
    profileName,
    profileUuid,
    profilePath,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(SIGNING_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
