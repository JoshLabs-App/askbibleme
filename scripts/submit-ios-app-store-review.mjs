#!/usr/bin/env node
/**
 * 原生 iOS App Store Connect 自动挂载构建、更新 What's New 并提交审核（AFTER_APPROVAL）。
 * 直接从 apps/askbible-ios/AskBible.xcodeproj/project.pbxproj 读取默认版本与构建号。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PBXPROJ = fs.readFileSync(
  path.join(ROOT, "apps/askbible-ios/AskBible.xcodeproj/project.pbxproj"),
  "utf8",
);
const defaultMarketing = PBXPROJ.match(/MARKETING_VERSION\s*=\s*([0-9.]+);/)?.[1] ?? "1.1.11";
const defaultBuild = PBXPROJ.match(/CURRENT_PROJECT_VERSION\s*=\s*(\d+);/)?.[1] ?? "151";

const TARGET_VERSION = process.env.ASC_TARGET_VERSION?.trim() || defaultMarketing;
const TARGET_BUILD = process.env.ASC_TARGET_BUILD?.trim() || defaultBuild;
const BUNDLE_ID = process.env.ASC_BUNDLE_ID?.trim() || "me.askbible";
const RELEASE_TYPE = process.env.ASC_RELEASE_TYPE?.trim() || "AFTER_APPROVAL";
const RELEASE_NOTES_DIR = path.join(ROOT, "store/ios-release-notes");

const ASC_API_KEY_ID = process.env.ASC_API_KEY_ID?.trim() || "9HDA27WY8C";
const ASC_API_KEY_ISSUER_ID =
  process.env.ASC_API_KEY_ISSUER_ID?.trim() || "a56f0624-e4a4-438d-be5d-92403dd9969b";

function resolveKeyPath() {
  const candidates = [
    process.env.ASC_API_KEY_PATH?.trim(),
    path.join(ROOT, "AA/AuthKey_9HDA27WY8C.p8"),
    path.join(os.homedir(), ".appstoreconnect/private_keys/AuthKey_9HDA27WY8C.p8"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error("Missing AuthKey_9HDA27WY8C.p8 in AA/ or ~/.appstoreconnect/private_keys/");
}

const ASC_API_KEY_PATH = resolveKeyPath();

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
    const req = https.request(
      `https://api.appstoreconnect.apple.com${apiPath}`,
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

function fail(label, res) {
  throw new Error(
    `${label} → ${res.status}: ${typeof res.raw === "string" ? res.raw.slice(0, 800) : JSON.stringify(res.body)}`,
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function releaseNotesForLocale(locale) {
  const lang = locale.split("-")[0].toLowerCase();
  const file = path.join(RELEASE_NOTES_DIR, `${lang}.txt`);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8").trim();
  return text || null;
}

async function findApp() {
  const res = await ascRequest(
    "GET",
    `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=1`,
  );
  if (res.status !== 200) fail("list apps", res);
  const app = res.body?.data?.[0];
  if (!app) throw new Error(`App not found: ${BUNDLE_ID}`);
  return app;
}

async function findVersion(appId) {
  const res = await ascRequest(
    "GET",
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=20`,
  );
  if (res.status !== 200) fail("list versions", res);
  const versions = res.body?.data ?? [];
  const match = versions.find((v) => v.attributes?.versionString === TARGET_VERSION);
  if (match) return match;

  const create = await ascRequest("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString: TARGET_VERSION, releaseType: RELEASE_TYPE },
      relationships: { app: { data: { type: "apps", id: appId } } },
    },
  });
  if (create.status === 201) {
    console.log(`→ Created App Store version ${TARGET_VERSION}`);
    return create.body?.data;
  }

  const open = versions.find((v) =>
    ["REJECTED", "PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "METADATA_REJECTED"].includes(
      v.attributes?.appStoreState,
    ),
  );
  if (!open) fail("create version", create);
  return open;
}

async function setReleaseType(versionId) {
  const res = await ascRequest("PATCH", `/v1/appStoreVersions/${versionId}`, {
    data: { type: "appStoreVersions", id: versionId, attributes: { releaseType: RELEASE_TYPE } },
  });
  if (res.status !== 200) fail("set release type", res);
  console.log(`→ Release type: ${RELEASE_TYPE}`);
}

async function waitForBuild(appId) {
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    const res = await ascRequest(
      "GET",
      `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=15`,
    );
    if (res.status !== 200) fail("list builds", res);
    const builds = res.body?.data ?? [];
    const match = builds.find(
      (b) =>
        String(b.attributes?.version) === TARGET_BUILD &&
        (b.attributes?.expired === false || b.attributes?.expired == null),
    );
    if (match) {
      const state = match.attributes?.processingState;
      console.log(`→ Build ${TARGET_BUILD}: ${state}`);
      if (state === "VALID") return match;
      if (state === "INVALID") throw new Error(`Build ${TARGET_BUILD} processing failed`);
    } else {
      console.log(`→ Waiting for build ${TARGET_BUILD} to appear…`);
    }
    await sleep(30_000);
  }
  throw new Error(`Timed out waiting for build ${TARGET_BUILD} to process`);
}

async function assignBuild(versionId, buildId) {
  const res = await ascRequest("PATCH", `/v1/appStoreVersions/${versionId}`, {
    data: {
      type: "appStoreVersions",
      id: versionId,
      relationships: { build: { data: { type: "builds", id: buildId } } },
    },
  });
  if (res.status !== 200) fail("assign build", res);
  console.log("→ Build assigned to App Store version");
}

async function ensureWhatsNew(versionId) {
  const res = await ascRequest(
    "GET",
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
  );
  if (res.status !== 200) fail("list version localizations", res);
  const locs = res.body?.data ?? [];
  for (const loc of locs) {
    const locale = loc.attributes?.locale;
    const whatsNew = releaseNotesForLocale(locale);
    if (!whatsNew) continue;
    const patch = await ascRequest("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew } },
    });
    if (patch.status !== 200) fail(`patch version loc ${locale}`, patch);
    console.log(`→ What's New (${locale})`);
  }
}

async function findOpenReviewSubmission(appId) {
  const res = await ascRequest("GET", `/v1/apps/${appId}/reviewSubmissions?limit=10`);
  if (res.status !== 200) fail("list review submissions", res);
  const submissions = res.body?.data ?? [];
  const unresolved = submissions.find((s) => s.attributes?.state === "UNRESOLVED_ISSUES");
  if (unresolved) return { submission: unresolved };
  const draft = submissions.find((s) => s.attributes?.state === "READY_FOR_REVIEW");
  if (draft) return { submission: draft };
  return null;
}

async function submitForReview(appId, versionId) {
  const open = await findOpenReviewSubmission(appId);
  let submissionId;

  if (open) {
    submissionId = open.submission.id;
    console.log(`→ Reusing review submission ${submissionId}`);
    const item = await ascRequest("POST", "/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submissionId } },
          appStoreVersion: { data: { type: "appStoreVersions", id: nowStr(versionId) } },
        },
      },
    });
    if (item.status !== 201 && !JSON.stringify(item.body).includes("already")) {
      fail("add review submission item", item);
    }
  } else {
    const create = await ascRequest("POST", "/v1/reviewSubmissions", {
      data: {
        type: "reviewSubmissions",
        attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: appId } } },
      },
    });
    if (create.status !== 201) fail("create review submission", create);
    submissionId = create.body?.data?.id;
    console.log(`→ Review submission ${submissionId}`);

    const item = await ascRequest("POST", "/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submissionId } },
          appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
        },
      },
    });
    if (item.status !== 201) fail("add review submission item", item);
  }

  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    const submit = await ascRequest("PATCH", `/v1/reviewSubmissions/${submissionId}`, {
      data: { type: "reviewSubmissions", id: submissionId, attributes: { submitted: true } },
    });
    if (submit.status === 200) {
      console.log("→ Submitted for App Review");
      return;
    }
    const detail = submit.body?.errors?.[0]?.detail ?? submit.status;
    console.log(`→ Not ready yet: ${detail}`);
    await sleep(60_000);
  }
  throw new Error("Timed out submitting for review.");
}

function nowStr(s) {
  return String(s);
}

async function main() {
  const app = await findApp();
  console.log(`→ App ${app.attributes?.name} (${BUNDLE_ID})`);

  const version = await findVersion(app.id);
  console.log(`→ Version ${version.attributes?.versionString} [${version.attributes?.appStoreState}]`);

  const build = await waitForBuild(app.id);
  await assignBuild(version.id, build.id);
  await setReleaseType(version.id);
  await ensureWhatsNew(version.id);
  await submitForReview(app.id, version.id);

  console.log(`Done. ${TARGET_VERSION} (${TARGET_BUILD}) submitted for App Review (${RELEASE_TYPE}).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
