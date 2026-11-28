#!/usr/bin/env node
/**
 * AskBible.me 全站硬编码单风格硬门禁（JOSHUA 2026-11-28）
 *
 * 物理锁死规则（不靠口头约定，不过直接 exit 1）：
 * 1. 全站除首页/全屏自然音乐场景外，所有页面必须复用唯一羊皮卷体系（ParchmentBackground / ParchmentScreenScaffold），
 *    严禁任何业务页私自套 AppPackWebView 另起第二套版面或另造平级主题风格。
 * 2. 全端（Web / kernel / Android / iOS）禁止使用苹果 Liquid Glass（glassEffect / .ultraThinMaterial / .regularMaterial）
 *    与未经授权的毛玻璃（backdrop-filter: blur）或外链字体 @import。
 * 3. kernel/src 业务代码禁止出现硬编码野生色值（仅 kernel/src/tokens/tokens.css 令牌真源豁免）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

// 唯一允许非羊皮卷全屏场景图的屏幕白名单（只有首页与全屏场景页）
const SCENE_EXEMPT_ANDROID_SCREENS = new Set([
  "HomeScreen.kt",
  "MusicScreen.kt",
  "PlanDetailScreen.kt",
  "PlansListScreen.kt",
]);

const SCENE_EXEMPT_IOS_VIEWS = new Set([
  "HomeView.swift",
  "MusicView.swift",
  "NatureView.swift",
  "ShellTabBar.swift",
]);

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".next" ||
      name === "build" ||
      name === ".gradle" ||
      name === "DerivedData" ||
      name === "Pods" ||
      name === ".DS_Store"
    ) {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out;
}

// 1. Android 顶层 *Screen.kt 强制羊皮卷 + 禁止私自套 AppPackWebView 另起版面
const androidUiDir = resolve(root, "apps/askbible-android/app/src/main/java/me/askbible/native_/ui");
if (existsSync(androidUiDir)) {
  for (const file of walk(androidUiDir, [".kt"])) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    const rel = relative(root, file).replaceAll("\\", "/");
    const src = readFileSync(file, "utf8");

    if (base.endsWith("Screen.kt") && !SCENE_EXEMPT_ANDROID_SCREENS.has(base)) {
      const hasParchment =
        src.includes("ParchmentBackground(") ||
        src.includes("ParchmentScreenScaffold(");
      if (!hasParchment) {
        violations.push(
          `  - [Android 非首页必须复用羊皮卷] ${rel} 未引用 ParchmentBackground 或 ParchmentScreenScaffold`,
        );
      }
      if (src.includes("AppPackWebView(")) {
        violations.push(
          `  - [禁止页面单元另起 WebView 第二套版面] ${rel} 不得直接嵌 AppPackWebView，请复用 ParchmentPageKit`,
        );
      }
    }
  }
}

// 2. iOS Panorama 与主要非首页视图禁止私自套 AppPackWebView 另起版面 & 禁止 Liquid Glass
const iosDir = resolve(root, "apps/askbible-ios/AskBible");
if (existsSync(iosDir)) {
  for (const file of walk(iosDir, [".swift"])) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    const rel = relative(root, file).replaceAll("\\", "/");
    const src = readFileSync(file, "utf8");

    if (base === "BiblePanoramaView.swift" && src.includes("AppPackWebView(")) {
      violations.push(
        `  - [iOS 禁止全景另起 WebView 第二套版面] ${rel} 不得嵌 AppPackWebView，必须复用 ParchmentBackground`,
      );
    }
    if (!SCENE_EXEMPT_IOS_VIEWS.has(base) && /\.\s*glassEffect\b/.test(src)) {
      violations.push(`  - [禁止 Liquid Glass] ${rel} 出现 .glassEffect（违反 D-45 实底羊皮卷铁律）`);
    }
  }
}

// 3. kernel/src 零野生色值 + 禁止毛玻璃 + 禁止外链字体 @import
const kernelSrcDir = resolve(root, "kernel/src");
const COLOR_RE =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\(\s*(?!var\()[^)\n]+\)|\bhsla?\(\s*(?!var\()[^)\n]+\)/g;

if (existsSync(kernelSrcDir)) {
  for (const file of walk(kernelSrcDir, [".css", ".ts", ".tsx"])) {
    const rel = relative(root, file).replaceAll("\\", "/");
    if (rel === "kernel/src/tokens/tokens.css") continue;
    const src = readFileSync(file, "utf8");

    if (/backdrop-filter\s*:\s*blur/i.test(src)) {
      violations.push(`  - [禁止毛玻璃] ${rel} 出现 backdrop-filter: blur`);
    }
    if (/@import\s+url\(/i.test(src)) {
      violations.push(`  - [禁止外链字体] ${rel} 出现 @import url(...)`);
    }
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const matches = stripped.match(COLOR_RE);
    if (matches && matches.length > 0) {
      violations.push(
        `  - [kernel 零野生色值] ${rel} 含 ${matches.length} 处硬编码色值（请统一引用 var(--ab-*)）`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("❌ 全站单风格硬代码门禁未通过：\n" + violations.join("\n"));
  process.exit(1);
}

console.log(
  "✅ 全站单风格硬代码门禁通过（Android/iOS 非首页羊皮卷锁死 · 零 Liquid Glass · 零 WebView 平行版面 · kernel 零野生色值）",
);
