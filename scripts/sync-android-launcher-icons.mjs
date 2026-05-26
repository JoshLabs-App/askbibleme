#!/usr/bin/env node
/**
 * 将 `assets/icon.png` / `adaptive-icon.png` 写入 Android `mipmap-*`（Gradle 不读 app.json 图标）。
 * 上传后台 app-icon 后请先 `npm run mobile:sync-icons`，再运行本脚本。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = path.join(repoRoot, "apps", "askbible-mobile");
const resRoot = path.join(mobileRoot, "android", "app", "src", "main", "res");
const iconPath = path.join(mobileRoot, "assets", "icon.png");
const adaptivePath = path.join(mobileRoot, "assets", "adaptive-icon.png");
const canvasHex = "#ECD9B9";

const LAUNCHER_SIZES = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const FOREGROUND_SIZES = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

function parseRgb(hex) {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

async function squarePng(from, size, bgHex) {
  const BG = parseRgb(bgHex);
  return sharp(from)
    .resize(size, size, { fit: "contain", position: "center", background: { ...BG, alpha: 1 } })
    .png()
    .toBuffer();
}

async function foregroundPng(from, size) {
  const inner = Math.max(1, Math.round(size * 0.66));
  const icon = await sharp(from)
    .resize(inner, inner, { fit: "contain", position: "center", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: icon, gravity: "center" }])
    .png()
    .toBuffer();
}

function removeLegacyWebp(dir, baseName) {
  for (const ext of [".webp", ".png"]) {
    const p = path.join(dir, `${baseName}${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

async function writeMipmap(folder, baseName, buf) {
  const dir = path.join(resRoot, folder);
  fs.mkdirSync(dir, { recursive: true });
  removeLegacyWebp(dir, baseName);
  const out = path.join(dir, `${baseName}.png`);
  await fs.promises.writeFile(out, buf);
}

async function main() {
  if (!fs.existsSync(iconPath)) {
    console.error(`Missing ${iconPath}. Run: npm run mobile:sync-icons`);
    process.exit(1);
  }
  const iconBuf = await fs.promises.readFile(iconPath);
  const adaptiveBuf = fs.existsSync(adaptivePath)
    ? await fs.promises.readFile(adaptivePath)
    : iconBuf;

  for (const [folder, size] of Object.entries(LAUNCHER_SIZES)) {
    const png = await squarePng(iconBuf, size, canvasHex);
    await writeMipmap(folder, "ic_launcher", png);
    await writeMipmap(folder, "ic_launcher_round", png);
    console.log(`✓ ${folder}/ic_launcher.png (${size}px)`);
  }

  for (const [folder, size] of Object.entries(FOREGROUND_SIZES)) {
    const png = await foregroundPng(adaptiveBuf, size);
    await writeMipmap(folder, "ic_launcher_foreground", png);
    console.log(`✓ ${folder}/ic_launcher_foreground.png (${size}px)`);
  }

  console.log("Android launcher mipmaps updated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
