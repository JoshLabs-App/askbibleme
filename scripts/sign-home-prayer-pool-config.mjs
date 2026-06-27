#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createSign } from "node:crypto";

const DEFAULT_SCOPE_ID = "explore-curated-700";
const DEFAULT_OUT_FILE = "public/data/home-prayer-pools/pool-config.signed.json";

function readArg(name) {
  const prefix = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(prefix)) return a.slice(prefix.length).trim();
  }
  return undefined;
}

function mustReadArg(name) {
  const v = readArg(name);
  if (!v) {
    throw new Error(`缺少参数 --${name}=...`);
  }
  return v;
}

function normalizeScopeId(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (!/^theme-repeat-[a-z0-9-]+$/i.test(v)) return null;
  return v;
}

function parseAllowlist(raw, selectedScopeId) {
  const out = new Set([DEFAULT_SCOPE_ID, selectedScopeId]);
  const input = String(raw ?? "")
    .split(",")
    .map((s) => normalizeScopeId(s))
    .filter(Boolean);
  for (const scope of input) out.add(scope);
  return [...out];
}

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function ensureParentDir(absFile) {
  const dir = path.dirname(absFile);
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const selectedRaw = mustReadArg("selected");
  const selectedScopeId = normalizeScopeId(selectedRaw);
  if (!selectedScopeId) {
    throw new Error(`selected scope 非法：${selectedRaw}`);
  }

  const privateKeyFile = mustReadArg("private-key");
  const privateKeyPem = fs.readFileSync(path.resolve(process.cwd(), privateKeyFile), "utf8");
  if (!/BEGIN (EC )?PRIVATE KEY/.test(privateKeyPem)) {
    throw new Error("私钥文件不是有效 PEM（需 EC P-256 私钥）");
  }

  const allowlistedScopeIds = parseAllowlist(readArg("allowlist"), selectedScopeId);
  if (!allowlistedScopeIds.includes(selectedScopeId)) {
    throw new Error("allowlist 必须包含 selectedScopeId");
  }

  const payloadObject = {
    version: 1,
    selectedScopeId,
    allowlistedScopeIds,
  };
  const payload = JSON.stringify(payloadObject);

  const signatureRaw = createSign("SHA256")
    .update(payload)
    .end()
    .sign({
      key: privateKeyPem,
      dsaEncoding: "ieee-p1363",
    });

  const envelope = {
    version: 1,
    algorithm: "ECDSA_P256_SHA256",
    payload,
    signature: base64UrlEncode(signatureRaw),
  };

  const outRel = readArg("out") || DEFAULT_OUT_FILE;
  const outAbs = path.resolve(process.cwd(), outRel);
  ensureParentDir(outAbs);
  fs.writeFileSync(outAbs, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");

  console.log(`[home-prayer-pool-sign] selected=${selectedScopeId}`);
  console.log(`[home-prayer-pool-sign] allowlist=${allowlistedScopeIds.join(",")}`);
  console.log(`[home-prayer-pool-sign] out=${outAbs}`);
}

try {
  main();
} catch (err) {
  console.error(
    "[home-prayer-pool-sign] failed:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
}
