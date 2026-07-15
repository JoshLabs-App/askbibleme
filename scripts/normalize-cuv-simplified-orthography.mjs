#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  findLegacyCuvSimplifiedOrthography,
  normalizeCuvSimplifiedOrthography,
} from "../lib/bible/cuv-simplified-orthography.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  path.join(repoRoot, "data", "bible", "uploads", "cuv-simp.json"),
  path.join(repoRoot, "apps", "askbible-mobile", "src", "bible", "generated", "cuv-simp.json"),
];

const localizedJsonTargets = [
  path.join(repoRoot, "data", "explore-modules", "bundle.json"),
  path.join(repoRoot, "apps", "askbible-mobile", "src", "explore", "explore-modules-bundled.json"),
  path.join(repoRoot, "data", "explore-featured-articles", "bundle.json"),
  path.join(
    repoRoot,
    "apps",
    "askbible-mobile",
    "src",
    "explore",
    "explore-featured-articles-localized.json",
  ),
];

for (const root of [
  path.join(repoRoot, "public", "data", "home-prayer-pools"),
  path.join(repoRoot, "apps", "askbible-mobile", "assets", "content", "home-prayer-pools"),
]) {
  if (!fs.existsSync(root)) continue;
  for (const scope of fs.readdirSync(root)) {
    const scopeDir = path.join(root, scope);
    if (!fs.statSync(scopeDir).isDirectory()) continue;
    for (const name of fs.readdirSync(scopeDir)) {
      if (/^chunk-\d+\.json$/.test(name)) localizedJsonTargets.push(path.join(scopeDir, name));
    }
  }
}

function normalizeAllStrings(value, findings) {
  if (typeof value === "string") {
    for (const finding of findLegacyCuvSimplifiedOrthography(value)) {
      findings.set(
        `${finding.legacy}\0${finding.modern}`,
        (findings.get(`${finding.legacy}\0${finding.modern}`) ?? 0) + finding.count,
      );
    }
    return normalizeCuvSimplifiedOrthography(value);
  }
  if (Array.isArray(value)) return value.map((entry) => normalizeAllStrings(entry, findings));
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      value[key] = normalizeAllStrings(entry, findings);
    }
  }
  return value;
}

function normalizeSimplifiedBranches(value, findings) {
  if (Array.isArray(value)) {
    for (const entry of value) normalizeSimplifiedBranches(entry, findings);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "zh" || key === "zh-CN" || key === "cuv-simp") {
      value[key] = normalizeAllStrings(entry, findings);
    } else {
      normalizeSimplifiedBranches(entry, findings);
    }
  }
}

let total = 0;
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  const source = fs.readFileSync(target, "utf8");
  const findings = findLegacyCuvSimplifiedOrthography(source);
  const count = findings.reduce((sum, finding) => sum + finding.count, 0);
  if (count === 0) {
    console.log(`${path.relative(repoRoot, target)}: already normalized`);
    continue;
  }
  fs.writeFileSync(target, normalizeCuvSimplifiedOrthography(source), "utf8");
  total += count;
  console.log(
    `${path.relative(repoRoot, target)}: normalized ${count} occurrences (${findings
      .map(({ legacy, modern, count: findingCount }) => `${legacy}→${modern} ×${findingCount}`)
      .join(", ")})`,
  );
}

for (const target of localizedJsonTargets) {
  if (!fs.existsSync(target)) continue;
  const source = fs.readFileSync(target, "utf8");
  const payload = JSON.parse(source);
  const findings = new Map();
  normalizeSimplifiedBranches(payload, findings);
  const count = [...findings.values()].reduce((sum, findingCount) => sum + findingCount, 0);
  let versionChanged = false;
  if (typeof payload.contentVersion === "string") {
    const versionPayload = { ...payload };
    delete versionPayload.contentVersion;
    const nextContentVersion = createHash("sha256")
      .update(JSON.stringify(versionPayload))
      .digest("hex")
      .slice(0, 16);
    versionChanged = payload.contentVersion !== nextContentVersion;
    payload.contentVersion = nextContentVersion;
  }
  if (count === 0 && !versionChanged) continue;
  const pretty = source.startsWith("{\n  ");
  const trailingNewline = source.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(target, `${JSON.stringify(payload, null, pretty ? 2 : 0)}${trailingNewline}`, "utf8");
  total += count;
  console.log(
    `${path.relative(repoRoot, target)}: normalized ${count} localized occurrences${
      versionChanged ? ", refreshed contentVersion" : ""
    } (${[...findings]
      .map(([pair, findingCount]) => {
        const [legacy, modern] = pair.split("\0");
        return `${legacy}→${modern} ×${findingCount}`;
      })
      .join(", ")})`,
  );
}

console.log(`Normalized ${total} legacy-form occurrences.`);
