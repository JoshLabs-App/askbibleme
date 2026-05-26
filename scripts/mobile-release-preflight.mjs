#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const strict = process.argv.includes("--strict");
const baseUrlArg = process.argv.find((arg) => arg.startsWith("--base-url="));
const baseUrl = baseUrlArg ? baseUrlArg.slice("--base-url=".length).trim() : "";

const errors = [];
const warnings = [];
const infos = [];

function addError(msg) {
  errors.push(msg);
}

function addWarning(msg) {
  warnings.push(msg);
}

function addInfo(msg) {
  infos.push(msg);
}

function optionalEnv(name, reason) {
  const value = (process.env[name] ?? "").trim();
  if (!value) addWarning(`${name} not set: ${reason}`);
  else addInfo(`${name} set`);
  return value;
}

function checkPathWritable(targetPath, label) {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    fs.accessSync(targetPath, fs.constants.W_OK);
    addInfo(`${label} writable: ${targetPath}`);
    return true;
  } catch (err) {
    addError(`${label} not writable (${targetPath}): ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function checkEndpoint(url, label) {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      addError(`${label} failed (${res.status}) ${url}`);
      return;
    }
    addInfo(`${label} ok (${res.status})`);
  } catch (err) {
    addError(`${label} request error ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  addInfo("Checking mobile release preflight");

  const dataRoot = (process.env.DATA_ROOT ?? "").trim();
  if (!dataRoot) {
    const msg = "DATA_ROOT not set: Render persistent disk mount path is required for production feedback/telemetry.";
    if (strict) addError(msg);
    else addWarning(msg);
  } else {
    addInfo("DATA_ROOT set");
  }
  if (dataRoot) {
    checkPathWritable(path.resolve(dataRoot), "DATA_ROOT");
  }

  optionalEnv("INFO_EDITION_DISK_SAVE", "Set to 1 when enabling online info-edition generation.");
  optionalEnv("ASC_API_KEY_PATH", "Required for iOS EAS submit from CI/local release terminal.");
  optionalEnv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH", "Required for Android Play EAS submit.");

  if ((process.env.MEMBER_REGISTER_ENABLED ?? "").trim() === "1") {
    const sqlitePath = (process.env.ASKBIBLE_AUTH_SQLITE_PATH ?? "").trim();
    if (!sqlitePath && !dataRoot) {
      addError("MEMBER_REGISTER_ENABLED=1 requires ASKBIBLE_AUTH_SQLITE_PATH or DATA_ROOT.");
    } else if (sqlitePath && !fs.existsSync(path.resolve(sqlitePath))) {
      addError(`ASKBIBLE_AUTH_SQLITE_PATH not found: ${sqlitePath}`);
    } else {
      addInfo("Member register storage path looks configured");
    }
  }

  if (baseUrl) {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
    await checkEndpoint(`${normalizedBaseUrl}/api/health`, "Health endpoint");
    await checkEndpoint(`${normalizedBaseUrl}/api/mobile/content/manifest`, "Mobile content manifest");
    await checkEndpoint(`${normalizedBaseUrl}/api/mobile/resource-pack/nature/manifest`, "Nature manifest");
    await checkEndpoint(`${normalizedBaseUrl}/api/music/companion`, "Music companion");
  } else {
    addWarning("No --base-url provided; skipped live endpoint checks.");
  }

  process.stdout.write("\n[mobile:release:preflight] info\n");
  for (const msg of infos) process.stdout.write(`  - ${msg}\n`);

  if (warnings.length > 0) {
    process.stdout.write("\n[mobile:release:preflight] warnings\n");
    for (const msg of warnings) process.stdout.write(`  - ${msg}\n`);
  }

  if (errors.length > 0) {
    process.stdout.write("\n[mobile:release:preflight] errors\n");
    for (const msg of errors) process.stdout.write(`  - ${msg}\n`);
  }

  if (errors.length > 0 || (strict && warnings.length > 0)) {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`[mobile:release:preflight] fatal: ${err instanceof Error ? err.stack || err.message : String(err)}\n`);
  process.exit(1);
});
