#!/usr/bin/env node
/** Tab-bar home↔read flicker check (Maestro tap + rapid simctl screenshots). */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const OUT = "/tmp/askbible-tab-flicker";
const FLICKER_MAX = 22;
const STABLE_MAX = 5;
const WHITE_MEAN_MIN = 240;

function run(cmd) {
  execSync(cmd, { stdio: "pipe" });
}

function shot(name) {
  const p = path.join(OUT, `${name}.png`);
  run(`xcrun simctl io booted screenshot "${p}"`);
  return p;
}

function openUrl(url) {
  run(`xcrun simctl openurl booted "${url}"`);
}

function sleep(ms) {
  execSync(`sleep ${(ms / 1000).toFixed(3)}`);
}

function tapRead() {
  run("maestro test /Users/joshua/Desktop/APP/01AskBible/scripts/maestro/ios-tap-read-tab.yaml");
}

function tapHome() {
  run("maestro test /Users/joshua/Desktop/APP/01AskBible/scripts/maestro/ios-tap-home-tab.yaml");
}

function loadRgb(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  return { width: png.width, height: png.height, data: png.data };
}

function meanAbsDiff(aPath, bPath) {
  const a = loadRgb(aPath);
  const b = loadRgb(bPath);
  const h = Math.min(a.height, b.height);
  const w = Math.min(a.width, b.width);
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * a.width + x) * 4;
      const j = (y * b.width + x) * 4;
      sum += Math.abs(a.data[i] - b.data[j]);
      sum += Math.abs(a.data[i + 1] - b.data[j + 1]);
      sum += Math.abs(a.data[i + 2] - b.data[j + 2]);
      n += 3;
    }
  }
  return sum / n;
}

function meanRgb(file) {
  const img = loadRgb(file);
  let r = 0;
  let g = 0;
  let b = 0;
  const n = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    r += img.data[i];
    g += img.data[i + 1];
    b += img.data[i + 2];
  }
  return { r: r / n, g: g / n, b: b / n };
}

function isMostlyWhite(file) {
  const m = meanRgb(file);
  return m.r >= WHITE_MEAN_MIN && m.g >= WHITE_MEAN_MIN && m.b >= WHITE_MEAN_MIN;
}

function captureBurst(label, tapFn, frames = 14, intervalMs = 35) {
  tapFn();
  const paths = [];
  for (let i = 0; i < frames; i++) {
    paths.push(shot(`${label}-${String(i).padStart(2, "0")}`));
    sleep(intervalMs);
  }
  const deltas = [];
  for (let i = 1; i < paths.length; i++) {
    deltas.push(meanAbsDiff(paths[i - 1], paths[i]));
  }
  const whiteFrames = paths.filter(isMostlyWhite).length;
  return { deltas, whiteFrames, paths };
}

function report(label, result) {
  const max = Math.max(...result.deltas);
  const mean = result.deltas.reduce((a, b) => a + b, 0) / result.deltas.length;
  console.log(
    `${label}: max=${max.toFixed(2)} mean=${mean.toFixed(2)} whiteFrames=${result.whiteFrames}/${result.deltas.length + 1}`,
  );
  result.deltas.forEach((delta, index) => {
    console.log(`  frame ${String(index + 1).padStart(2, "0")}→${String(index + 2).padStart(2, "0")}: ${delta.toFixed(2)}`);
  });
  return { max, whiteFrames: result.whiteFrames };
}

fs.mkdirSync(OUT, { recursive: true });

console.log("Warm up on home…");
openUrl("askbible://");
sleep(2500);
tapRead();
sleep(2000);
tapHome();
sleep(1500);

const toRead = report("tab-tap to-read", captureBurst("tap-read", tapRead));
sleep(800);
const toHome = report("tab-tap to-home", captureBurst("tap-home", tapHome));

openUrl("askbible://read");
sleep(1500);
const stableRead = report("stable read", captureBurst("stable-read", tapRead));
sleep(800);
openUrl("askbible://");
sleep(1500);
const stableHome = report("stable home", captureBurst("stable-home", tapHome));

const bad = [];
if (toRead.max > FLICKER_MAX) bad.push(`to-read max ${toRead.max.toFixed(1)}`);
if (toHome.max > FLICKER_MAX) bad.push(`to-home max ${toHome.max.toFixed(1)}`);
if (toRead.whiteFrames > 1) bad.push(`to-read white frames ${toRead.whiteFrames}`);
if (toHome.whiteFrames > 1) bad.push(`to-home white frames ${toHome.whiteFrames}`);
if (stableRead.max > STABLE_MAX) bad.push(`stable-read ${stableRead.max.toFixed(1)}`);
if (stableHome.max > STABLE_MAX) bad.push(`stable-home ${stableHome.max.toFixed(1)}`);

if (bad.length) {
  console.error("\nFAIL:", bad.join("; "));
  process.exit(1);
}
console.log("\nPASS: tab-bar transitions OK");
