#!/usr/bin/env node
/**
 * 双端商店版本真源：app.json → 同步 iOS / Android 原生工程。
 *
 * Usage:
 *   node scripts/bump-mobile-store-version.mjs 1.0.7 63
 *   node scripts/bump-mobile-store-version.mjs --build 63
 *   node scripts/bump-mobile-store-version.mjs --next-build
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MOBILE = path.join(ROOT, "apps", "askbible-mobile");
const APP_JSON = path.join(MOBILE, "app.json");
const GRADLE = path.join(MOBILE, "android", "app", "build.gradle");
const INFO_PLIST = path.join(MOBILE, "ios", "AskBibleme", "Info.plist");
const PBXPROJ = path.join(MOBILE, "ios", "AskBibleme.xcodeproj", "project.pbxproj");

function usage(exitCode = 1) {
  console.error(`Usage:
  node scripts/bump-mobile-store-version.mjs <marketingVersion> <buildNumber>
  node scripts/bump-mobile-store-version.mjs --marketing <version>
  node scripts/bump-mobile-store-version.mjs --build <number>
  node scripts/bump-mobile-store-version.mjs --next-build`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith("-"));
  let marketing = null;
  let build = null;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--marketing") marketing = argv[++i] ?? usage();
    else if (a === "--build") build = argv[++i] ?? usage();
    else if (a === "--next-build") build = "__next__";
    else if (a.startsWith("-")) usage();
  }

  if (positional.length === 2) {
    marketing = positional[0];
    build = positional[1];
  } else if (positional.length === 1) usage();

  return { marketing, build };
}

async function readCurrent() {
  const app = JSON.parse(await fs.readFile(APP_JSON, "utf8"));
  const marketing = String(app.expo?.version ?? "").trim();
  const build = Number(app.expo?.ios?.buildNumber ?? app.expo?.android?.versionCode ?? 0);
  return { marketing, build };
}

async function writeAppJson(marketing, build) {
  const raw = await fs.readFile(APP_JSON, "utf8");
  const app = JSON.parse(raw);
  app.expo.version = marketing;
  app.expo.runtimeVersion = marketing;
  app.expo.ios = { ...app.expo.ios, buildNumber: String(build) };
  app.expo.android = { ...app.expo.android, versionCode: build };
  await fs.writeFile(APP_JSON, `${JSON.stringify(app, null, 2)}\n`);
}

async function writeGradle(marketing, build) {
  let gradle = await fs.readFile(GRADLE, "utf8");
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${build}`);
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${marketing}"`);
  await fs.writeFile(GRADLE, gradle);
}

async function writeInfoPlist(marketing, build) {
  let plist = await fs.readFile(INFO_PLIST, "utf8");
  plist = plist.replace(
    /<key>CFBundleShortVersionString<\/key>\s*\n\s*<string>[^<]*<\/string>/,
    `<key>CFBundleShortVersionString</key>\n    <string>${marketing}</string>`,
  );
  plist = plist.replace(
    /<key>CFBundleVersion<\/key>\s*\n\s*<string>[^<]*<\/string>/,
    `<key>CFBundleVersion</key>\n    <string>${build}</string>`,
  );
  await fs.writeFile(INFO_PLIST, plist);
}

async function writePbxproj(marketing, build) {
  let pbx = await fs.readFile(PBXPROJ, "utf8");
  pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${marketing};`);
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
  await fs.writeFile(PBXPROJ, pbx);
}

async function main() {
  const { marketing: marketingArg, build: buildArg } = parseArgs(process.argv.slice(2));
  const current = await readCurrent();

  const marketing = marketingArg ?? current.marketing;
  if (!/^\d+\.\d+\.\d+$/.test(marketing)) {
    console.error(`Invalid marketing version: ${marketing} (expected semver like 1.0.7)`);
    process.exit(1);
  }

  let build;
  if (buildArg === "__next__") {
    build = current.build + 1;
  } else if (buildArg != null) {
    build = Number(buildArg);
  } else {
    build = current.build;
  }
  if (!Number.isInteger(build) || build < 1) {
    console.error(`Invalid build number: ${buildArg}`);
    process.exit(1);
  }

  await writeAppJson(marketing, build);
  await writeGradle(marketing, build);
  await writeInfoPlist(marketing, build);
  await writePbxproj(marketing, build);

  console.log(`Mobile store version synced: ${marketing} (${build})`);
  console.log("  app.json, build.gradle, Info.plist, project.pbxproj");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
