#!/usr/bin/env node
/**
 * 「读后两版」插画（陪你探索 / 查找资料）→ 两端原生。
 * info-edition.sqlite 已改为按需从 R2 下载（bible/info-edition.sqlite），不再随包内置，此脚本不再复制 sqlite。
 * 只复制两张入口插画 assets/images/post-reading/*.png。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const copies = [
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
console.log("读后两版插画已同步到两端（info-edition.sqlite 按需从 R2 下载，不内置）");
