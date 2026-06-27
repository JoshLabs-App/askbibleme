#!/usr/bin/env node
/**
 * Enable App Groups on me.askbible (+ optional extension bundle ids) via ASC API.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP_GROUP = "group.me.askbible.shared";
const BUNDLE_IDS = ["me.askbible", "me.askbible.widget"];
const CAPABILITY_TYPES = ["APP_GROUPS", "PUSH_NOTIFICATIONS"];

const ASC_API_KEY_ID = process.env.ASC_API_KEY_ID?.trim() || "9HDA27WY8C";
const ASC_API_KEY_ISSUER_ID =
  process.env.ASC_API_KEY_ISSUER_ID?.trim() || "a56f0624-e4a4-438d-be5d-92403dd9969b";
const ASC_API_KEY_PATH =
  process.env.ASC_API_KEY_PATH?.trim() || path.join(ROOT, "AA/AuthKey_9HDA27WY8C.p8");

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

async function getBundleIdResource(identifier) {
  const res = await ascRequest("GET", `/v1/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=20`);
  const items = res.body?.data ?? [];
  const item = items.find((entry) => entry.attributes?.identifier === identifier);
  if (!item?.id) return null;
  return item;
}

async function getAppGroupResource(identifier = APP_GROUP) {
  const res = await ascRequest(
    "GET",
    `/v1/appGroupIdentifiers?filter[identifier]=${encodeURIComponent(identifier)}&limit=1`,
  );
  const item = res.body?.data?.[0];
  if (!item?.id) return null;
  return item;
}

async function createAppGroupResource(identifier = APP_GROUP) {
  const res = await ascRequest("POST", "/v1/appGroupIdentifiers", {
    data: {
      type: "appGroupIdentifiers",
      attributes: {
        identifier,
        name: "AskBible Shared",
      },
    },
  });
  if (res.status >= 400) {
    const detail = JSON.stringify(res.body);
    if (res.status === 409 || detail.includes("already")) {
      return await getAppGroupResource(identifier);
    }
    throw new Error(`Create app group failed (${identifier}): ${detail}`);
  }
  return res.body.data;
}

async function ensureAppGroupOnBundle(bundleIdResourceId, identifier) {
  // App Group identifier linking is not exposed on ASC API; Xcode automatic signing handles it.
  console.log(`→ App group ${APP_GROUP} for ${identifier}: configure in Developer portal if profiles lack App Groups`);
}

async function createBundleId(identifier, name) {
  const res = await ascRequest("POST", "/v1/bundleIds", {
    data: {
      type: "bundleIds",
      attributes: {
        identifier,
        name,
        platform: "IOS",
      },
    },
  });
  if (res.status >= 400) {
    throw new Error(`Create bundle id failed (${identifier}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

async function listCapabilities(bundleIdResourceId) {
  const res = await ascRequest(
    "GET",
    `/v1/bundleIds/${bundleIdResourceId}/bundleIdCapabilities`,
  );
  return res.body?.data ?? [];
}

async function ensureCapability(bundleIdResourceId, identifier, capabilityType) {
  const caps = await listCapabilities(bundleIdResourceId);
  const existing = caps.find((c) => c.attributes?.capabilityType === capabilityType);
  if (existing) {
    console.log(`→ ${capabilityType} already enabled: ${identifier}`);
    return;
  }
  console.log(`→ Enabling ${capabilityType} on ${identifier}…`);
  const res = await ascRequest("POST", "/v1/bundleIdCapabilities", {
    data: {
      type: "bundleIdCapabilities",
      attributes: {
        capabilityType,
      },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundleIdResourceId } },
      },
    },
  });
  if (res.status >= 400) {
    const detail = JSON.stringify(res.body);
    if (res.status === 409 || detail.includes("already") || detail.includes("DUPLICATE")) {
      console.log(`→ ${capabilityType} likely already enabled (${identifier})`);
      return;
    }
    throw new Error(`Enable ${capabilityType} failed (${identifier}): ${detail}`);
  }
}

async function ensureAppGroupsCapability(bundleIdResourceId, identifier) {
  const caps = await listCapabilities(bundleIdResourceId);
  const existing = caps.find((c) => c.attributes?.capabilityType === "APP_GROUPS");
  const settings = [
    {
      key: "APP_GROUP_IDS",
      options: [{ key: APP_GROUP, enabled: true }],
    },
  ];
  if (existing?.id) {
    console.log(`→ Updating App Groups settings on ${identifier}…`);
    const res = await ascRequest("PATCH", `/v1/bundleIdCapabilities/${existing.id}`, {
      data: {
        type: "bundleIdCapabilities",
        id: existing.id,
        attributes: { settings },
      },
    });
    if (res.status >= 400) {
      console.warn(`→ App Groups settings update skipped (${identifier}): portal config is sufficient`);
      return;
    }
    return;
  }
  console.log(`→ Enabling App Groups on ${identifier}…`);
  const res = await ascRequest("POST", "/v1/bundleIdCapabilities", {
    data: {
      type: "bundleIdCapabilities",
      attributes: {
        capabilityType: "APP_GROUPS",
        settings,
      },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundleIdResourceId } },
      },
    },
  });
  if (res.status >= 400) {
    const detail = JSON.stringify(res.body);
    if (res.status === 409 || detail.includes("already") || detail.includes("DUPLICATE")) {
      const retryCaps = await listCapabilities(bundleIdResourceId);
      const retryExisting = retryCaps.find((c) => c.attributes?.capabilityType === "APP_GROUPS");
      if (retryExisting?.id) {
        console.log(`→ App Groups exists; updating settings on ${identifier}…`);
        const patchRes = await ascRequest("PATCH", `/v1/bundleIdCapabilities/${retryExisting.id}`, {
          data: {
            type: "bundleIdCapabilities",
            id: retryExisting.id,
            attributes: { settings },
          },
        });
        if (patchRes.status >= 400) {
          throw new Error(`Update App Groups failed (${identifier}): ${JSON.stringify(patchRes.body)}`);
        }
        return;
      }
      console.log(`→ App Groups likely already enabled (${identifier})`);
      return;
    }
    throw new Error(`Enable App Groups failed (${identifier}): ${detail}`);
  }
}

async function main() {
  if (!fs.existsSync(ASC_API_KEY_PATH)) {
    throw new Error(`ASC API key not found: ${ASC_API_KEY_PATH}`);
  }
  for (const identifier of BUNDLE_IDS) {
    let bundle = await getBundleIdResource(identifier);
    if (!bundle) {
      console.log(`→ Creating bundle id ${identifier}…`);
      bundle = await createBundleId(identifier, identifier === "me.askbible" ? "AskBible.me" : "AskBible Daily Verse Widget");
    }
    await ensureAppGroupsCapability(bundle.id, identifier);
    if (identifier === "me.askbible") {
      await ensureCapability(bundle.id, identifier, "PUSH_NOTIFICATIONS");
    }
  }
  console.log("App Group capabilities ready.");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
