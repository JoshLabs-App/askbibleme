#!/usr/bin/env node
/**
 * 「读后两版」内容库（陪你探索 / 查找资料）→ 两端原生。
 * 真源：apps/askbible-mobile/assets/content/info-edition.sqlite（由 npm run build:info-edition-sqlite 从
 * data/bible/info-edition-v1-published.json 生成，RN 与原生共用同一份；产物不入库）。
 * 同时复制两张入口插画 assets/images/post-reading/*.png。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "apps/askbible-mobile/assets/content/info-edition.sqlite");
if (!fs.existsSync(src)) {
  console.error("找不到 apps/askbible-mobile/assets/content/info-edition.sqlite，先跑 npm run build:info-edition-sqlite / sync-mobile-content");
  process.exit(1);
}
const copies = [
  [src, "apps/askbible-ios/AskBible/Resources/info-edition.sqlite"],
  [src, "apps/askbible-android/app/src/main/assets/info-edition.sqlite"],
  ["apps/askbible-mobile/assets/images/post-reading/discover-self.png", "apps/askbible-ios/AskBible/Resources/post-reading-discover.png"],
  ["apps/askbible-mobile/assets/images/post-reading/consult-materials.png", "apps/askbible-ios/AskBible/Resources/post-reading-consult.png"],
  ["apps/askbible-mobile/assets/images/post-reading/discover-self.png", "apps/askbible-android/app/src/main/assets/images/post-reading-discover.png"],
  ["apps/askbible-mobile/assets/images/post-reading/consult-materials.png", "apps/askbible-android/app/src/main/assets/images/post-reading-consult.png"],
];
for (const [from, to] of copies) {
  const a = path.resolve(root, from), b = path.resolve(root, to);
  if (fs.existsSync(b) && fs.statSync(b).size === fs.statSync(a).size && fs.readFileSync(a).equals(fs.readFileSync(b))) continue;
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.copyFileSync(a, b);
  console.log(`复制 ${to}`);
}
console.log(`读后两版内容库：${(fs.statSync(src).size / 1048576).toFixed(1)} MB，已同步到两端`);
