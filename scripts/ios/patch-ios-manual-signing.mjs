#!/usr/bin/env node
/**
 * Patch AskBibleme.xcodeproj Release configs for manual App Store signing.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const IOS_DIR = path.join(ROOT, "apps/askbible-mobile/ios");
const PBX = path.join(IOS_DIR, "AskBibleme.xcodeproj/project.pbxproj");
const MANIFEST = path.join(IOS_DIR, ".local-signing/manifest.json");

if (!fs.existsSync(MANIFEST)) {
  console.error(`Missing signing manifest: ${MANIFEST}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
let pbx = fs.readFileSync(PBX, "utf8");

function patchReleaseBlock(blockId, profileName) {
  const re = new RegExp(
    `(${blockId} /\\* Release \\*/ = \\{[\\s\\S]*?buildSettings = \\{)([\\s\\S]*?)(\\n\t\t\t\\};\\s*\\n\t\t\tname = Release;)`,
    "m",
  );
  const match = pbx.match(re);
  if (!match) {
    console.warn(`Release block not found: ${blockId}`);
    return;
  }
  let settings = match[2];
  settings = settings.replace(/\n\t\t\t\tCODE_SIGN_STYLE = [^;]+;/g, "");
  settings = settings.replace(/\n\t\t\t\t"CODE_SIGN_IDENTITY\[sdk=iphoneos\*\]" = [^;]+;/g, "");
  settings = settings.replace(/\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = [^;]+;/g, "");
  settings = settings.replace(/\n\t\t\t\tCURRENT_PROJECT_VERSION = 1;/g, "\n\t\t\t\tCURRENT_PROJECT_VERSION = 50;");
  const injection = `
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";
\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "${profileName}";`;
  pbx = pbx.replace(re, `$1${settings}${injection}\n\t\t\t$3`);
}

patchReleaseBlock("13B07F951A680F5B00A75B9A", manifest.profileName);
if (manifest.widgetProfileName) {
  patchReleaseBlock("XXFB13F6E7E48D9B2550ABXX", manifest.widgetProfileName);
}

fs.writeFileSync(PBX, pbx);
console.log("Patched manual signing profiles into AskBibleme.xcodeproj");
