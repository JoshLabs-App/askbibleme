#!/usr/bin/env node
/**
 * 首页自然场景素材 + 场景表：
 *   npm run gen:nature-scenes    把 RN assets/nature 的 海报 / 柔焦海报 / 循环视频 复制进两端安装包
 *                                （Android assets/nature/<类别>/<id>.*；iOS Resources/nature/nature-<类别>-<id>.*，
 *                                iOS 工程用文件系统同步组会把子目录摊平进包根，同名会撞，所以带前缀）
 *   npm run check:nature-scenes  对拍 Swift `NatureScenes.scenes` / Kotlin `NatureScenes.scenes` 与
 *                                RN assets/content/nature-settings.json（id 顺序、标题、activeVideoId），
 *                                以及两端素材文件齐全（9 × 3）。
 * 素材（~33MB）不入库（.gitignore），克隆后跑 gen 即可。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RN = path.join(ROOT, "apps/askbible-mobile");
const SETTINGS = JSON.parse(readFileSync(path.join(RN, "assets/content/nature-settings.json"), "utf8"));
const ANDROID = path.join(ROOT, "apps/askbible-android/app/src/main/assets/nature");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible/Resources/nature");
const KINDS = [
  ["posters", "jpg", "poster"],
  ["posters-soft", "jpg", "soft"],
  ["videos", "mp4", "video"],
];
const check = process.argv.includes("--check");
const videos = SETTINGS.videos;
/**
 * 视频只内置默认景，其余走 R2 流播（DECISIONS「自然场景视频：只保留默认景内置」）；海报两类 9 景全内置。
 * 所以「该有的没有」和「不该有的有了」都算问题。
 */
const bundled = (dir, v) => dir !== "videos" || v.id === SETTINGS.activeVideoId;

if (!check) {
  let copied = 0;
  for (const [dir, ext, prefix] of KINDS) {
    mkdirSync(path.join(ANDROID, dir), { recursive: true });
    mkdirSync(IOS, { recursive: true });
    for (const v of videos) {
      if (!bundled(dir, v)) continue;
      const src = path.join(RN, "assets/nature", dir, `${v.id}.${ext}`);
      if (!existsSync(src)) throw new Error(`RN 素材缺失：${path.relative(ROOT, src)}`);
      copyFileSync(src, path.join(ANDROID, dir, `${v.id}.${ext}`));
      copyFileSync(src, path.join(IOS, `nature-${prefix}-${v.id}.${ext}`));
      copied += 2;
    }
  }
  console.log(`已复制 ${copied} 个文件（${videos.length} 景海报 × 2 类 + 默认景视频，× 2 端）`);
  process.exit(0);
}

const problems = [];
const expectIds = videos.map((v) => v.id);
const expectTitles = videos.map((v) => v.title);

function tableFrom(file, re) {
  const src = readFileSync(file, "utf8");
  const ids = [], titles = [];
  for (const m of src.matchAll(re)) { ids.push(m[1]); titles.push(m[2]); }
  return { ids, titles };
}
const swift = tableFrom(path.join(ROOT, "apps/askbible-ios/AskBible/Model/NatureScenes.swift"),
  /NatureScene\(id: "([^"]+)", title: "([^"]+)"/g);
const kotlin = tableFrom(path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/NatureScenes.kt"),
  /NatureScene\("([^"]+)", "([^"]+)"/g);
for (const [label, t] of [["Swift", swift], ["Kotlin", kotlin]]) {
  if (JSON.stringify(t.ids) !== JSON.stringify(expectIds)) problems.push(`${label} 场景 id 顺序与 nature-settings.json 不同：${t.ids.join(",")}`);
  if (JSON.stringify(t.titles) !== JSON.stringify(expectTitles)) problems.push(`${label} 场景标题与 nature-settings.json 不同：${t.titles.join(",")}`);
}
const swiftSrc = readFileSync(path.join(ROOT, "apps/askbible-ios/AskBible/Model/NatureScenes.swift"), "utf8");
const kotlinSrc = readFileSync(path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/NatureScenes.kt"), "utf8");
if (!swiftSrc.includes(`defaultSceneId = "${SETTINGS.activeVideoId}"`)) problems.push("Swift defaultSceneId ≠ activeVideoId");
if (!kotlinSrc.includes(`DEFAULT_SCENE_ID = "${SETTINGS.activeVideoId}"`)) problems.push("Kotlin DEFAULT_SCENE_ID ≠ activeVideoId");

for (const [dir, ext, prefix] of KINDS) {
  for (const v of videos) {
    const a = path.join(ANDROID, dir, `${v.id}.${ext}`);
    const i = path.join(IOS, `nature-${prefix}-${v.id}.${ext}`);
    if (bundled(dir, v)) {
      if (!existsSync(a)) problems.push(`Android 缺素材 ${path.relative(ROOT, a)}`);
      if (!existsSync(i)) problems.push(`iOS 缺素材 ${path.relative(ROOT, i)}`);
    } else {
      if (existsSync(a)) problems.push(`Android 多打了视频（应走 R2 流播）${path.relative(ROOT, a)}`);
      if (existsSync(i)) problems.push(`iOS 多打了视频（应走 R2 流播）${path.relative(ROOT, i)}`);
    }
  }
}
const iosExtra = existsSync(IOS) ? readdirSync(IOS).filter((f) => !/^nature-(poster|soft|video)-[0-9a-f-]+\.(jpg|mp4)$/.test(f)) : [];
if (iosExtra.length) problems.push(`iOS Resources/nature 里有不认识的文件：${iosExtra.join(",")}`);

if (problems.length) {
  console.error("nature-scenes 对拍失败：\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`nature-scenes 对拍通过：${videos.length} 景，Swift / Kotlin 表与 nature-settings.json 一致，两端素材齐全（海报 ${videos.length * 2} + 默认景视频 1）`);
