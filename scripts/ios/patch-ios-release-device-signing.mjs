#!/usr/bin/env node
/**
 * Patch AskBibleme.xcodeproj Release configs for USB device install
 * (Apple Development + Development Profile — App Store/Beta profile cannot USB-install).
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
if (!manifest.devProfileName) {
  console.error("Missing devProfileName in manifest. Run: node scripts/ios/ensure-ios-development-signing.mjs");
  process.exit(1);
}

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
  const injection = `
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Development";
\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "${profileName}";`;
  pbx = pbx.replace(re, `$1${settings}${injection}\n\t\t\t$3`);
}

patchReleaseBlock("13B07F951A680F5B00A75B9A", manifest.devProfileName);
if (manifest.devWidgetProfileName) {
  patchReleaseBlock("XXFB13F6E7E48D9B2550ABXX", manifest.devWidgetProfileName);
}

fs.writeFileSync(PBX, pbx);
console.log("Patched Release development signing into AskBibleme.xcodeproj (USB device install)");
