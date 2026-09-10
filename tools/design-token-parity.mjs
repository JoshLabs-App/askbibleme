#!/usr/bin/env node
/**
 * 三端设计 token 对拍。
 *
 * 纯双写方案下，颜色 / 字号 / 壳层几何在每一端都是手抄的一份。手抄不会报错，
 * 只会悄悄漂移。这个脚本以 RN 的 TS 源为唯一真源，解析各原生端的常量并逐值比对，
 * 不一致就非零退出。
 *
 * 目前覆盖 iOS（Swift）与 Android（Kotlin :core，零依赖所以能直接文本解析）。
 *
 *   node tools/design-token-parity.mjs
 *
 * 新增一端时：加一个 readXxx() 解析器 + 在 SUITES 里挂上即可。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RN = path.join(ROOT, "apps/askbible-mobile");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const AND = path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data");

const read = (p) => readFileSync(p, "utf8");

/* ---------- 颜色归一化：两端写法不同，比的是 RGBA 数值 ---------- */

function normalizeColor(raw) {
  const s = String(raw).trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return { ...hexToRgb(m[1]), a: 1 };
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  return null;
}

function hexToRgb(hex) {
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

const sameColor = (a, b) =>
  a && b && a.r === b.r && a.g === b.g && a.b === b.b && Math.abs(a.a - b.a) < 0.005;

const fmtColor = (c) =>
  c ? `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})` : "<解析失败>";

/* ---------- 真源：RN 的 TS ---------- */

/** 从 `const light = { ... }` 这类块里抓 key: "value" */
function tsObjectStrings(src, blockName) {
  const start = src.indexOf(`const ${blockName} = {`);
  if (start < 0) throw new Error(`TS 源里找不到 ${blockName}`);
  const body = sliceBraces(src, src.indexOf("{", start));
  const out = {};
  for (const m of body.matchAll(/^\s*(\w+)\s*:\s*"([^"]+)"\s*,/gm)) out[m[1]] = m[2];
  return out;
}

/** 从 TS 抓 `key: 123` 数值 */
function tsNumbers(src, blockName) {
  const start = src.indexOf(blockName);
  if (start < 0) throw new Error(`TS 源里找不到 ${blockName}`);
  const body = sliceBraces(src, src.indexOf("{", start));
  const out = {};
  for (const m of body.matchAll(/(\w+)\s*:\s*(-?[\d.]+)\s*,/g)) out[m[1]] = Number(m[2]);
  return out;
}

/** TS 的 PX 排版表：size -> {字段: 数值} */
function tsTypographyTable(src) {
  const start = src.indexOf("const PX: Record<ReadBibleSizeId, ReadBibleTypographyPx> = {");
  if (start < 0) throw new Error("找不到 PX 排版表");
  const body = sliceBraces(src, src.indexOf("{", start));
  const out = {};
  for (const m of body.matchAll(/(\w+):\s*\{([^}]*)\}/g)) {
    const fields = {};
    for (const f of m[2].matchAll(/(\w+)\s*:\s*(-?[\d.]+)/g)) fields[f[1]] = Number(f[2]);
    out[m[1]] = fields;
  }
  return out;
}

function sliceBraces(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  throw new Error("大括号未闭合");
}

/* ---------- iOS：Swift ---------- */

/** `canvas: Color(rgb: 0xecd9b9),` / `border: Color(rgb: 0x78350f, opacity: 0.28),` */
function swiftPalette(src, staticName) {
  const start = src.indexOf(`static let ${staticName} = Parchment(`);
  if (start < 0) throw new Error(`Swift 里找不到 ${staticName}`);
  const body = sliceParens(src, src.indexOf("(", start));
  const out = {};
  for (const m of body.matchAll(
    /(\w+)\s*:\s*Color\(rgb:\s*0x([0-9a-f]{6})(?:\s*,\s*opacity:\s*([\d.]+))?\)/gi
  )) {
    out[m[1]] = { ...hexToRgb(m[2]), a: m[3] === undefined ? 1 : Number(m[3]) };
  }
  return out;
}

/** `.xs: .init(verseFontSize: 15, ...)` */
function swiftTypographyTable(src) {
  const start = src.indexOf("static let table:");
  if (start < 0) throw new Error("Swift 里找不到 table");
  const body = sliceBraces(src, src.indexOf("[", start) >= 0 ? src.indexOf("[", start) : src.indexOf("{", start));
  const out = {};
  for (const m of src.slice(start).matchAll(/\.(\w+):\s*\.init\(([^)]*)\)/g)) {
    const fields = {};
    for (const f of m[2].matchAll(/(\w+)\s*:\s*(-?[\d.]+)/g)) fields[f[1]] = Number(f[2]);
    out[m[1]] = fields;
  }
  void body;
  return out;
}

/** `static let topChromeButton: CGFloat = 50` */
function swiftStaticNumbers(src) {
  const out = {};
  for (const m of src.matchAll(/static let (\w+):\s*CGFloat\s*=\s*(-?[\d.]+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

function sliceParens(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  throw new Error("小括号未闭合");
}

/* ---------- Android：Kotlin ---------- */

/** `canvas = Rgba(0xecd9b9),` / `border = Rgba(0x78350f, 0.28),` */
function kotlinPalette(src, valName) {
  const start = src.indexOf(`val ${valName} = Parchment(`);
  if (start < 0) throw new Error(`Kotlin 里找不到 ${valName}`);
  const body = sliceParens(src, src.indexOf("(", start));
  const out = {};
  for (const m of body.matchAll(
    /(\w+)\s*=\s*Rgba\(0x([0-9a-f]{6})(?:\s*,\s*([\d.]+))?\)/gi
  )) {
    out[m[1]] = { ...hexToRgb(m[2]), a: m[3] === undefined ? 1 : Number(m[3]) };
  }
  return out;
}

/** `XS("xs", ReadTypographyMetrics(15f, 26f, 14f, 21f, 16f, 22f)),` —— 按位置对应字段 */
function kotlinTypographyTable(src) {
  const FIELDS = ["verseFontSize", "verseLineHeight", "verseNumFontSize",
                  "chapterTitleSize", "catalogBookSize", "catalogBookLine"];
  const out = {};
  for (const m of src.matchAll(/\w+\("(\w+)",\s*ReadTypographyMetrics\(([^)]*)\)\)/g)) {
    const nums = [...m[2].matchAll(/(-?[\d.]+)f/g)].map((x) => Number(x[1]));
    const fields = {};
    FIELDS.forEach((f, i) => { if (nums[i] !== undefined) fields[f] = nums[i]; });
    out[m[1]] = fields;
  }
  return out;
}

/** `const val topChromeButton = 50f` */
function kotlinConstNumbers(src) {
  const out = {};
  for (const m of src.matchAll(/const val (\w+)\s*=\s*(-?[\d.]+)f/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

/* ---------- 比对 ---------- */

const failures = [];
let checked = 0;

/** natives: { iOS: value, Android: value } —— 某端缺这一项就跳过它 */
/**
 * 登记在案的故意偏离：Josh 实机看过后要求原生端改掉、但 RN 工作树不动的值。
 * 原生端等于这里登记的值就算通过（并在结果里点名）；改回 RN 值或再漂到别的值都会报。
 */
const KNOWN_DEVIATIONS = {
  "播放坞 · playIconNudge → playIconNudge": { value: 0, why: "2026-09-09 三星实机：播放三角看着偏右，原生端归零（RN 仍是 3）" },
};
const deviationsHit = [];

function compare(suite, key, tsVal, natives, fmt = String) {
  for (const [impl, nativeVal] of Object.entries(natives)) {
    if (nativeVal === undefined) continue;
    checked++;
    const dev = KNOWN_DEVIATIONS[`${suite} · ${key}`];
    if (dev && nativeVal === dev.value) { deviationsHit.push(`${suite} · ${key}（${impl}）= ${fmt(nativeVal)}，RN ${fmt(tsVal)}：${dev.why}`); continue; }
    const same =
      typeof tsVal === "object" ? sameColor(tsVal, nativeVal) : tsVal === nativeVal;
    if (!same) {
      failures.push(`${suite} · ${key}\n    TS 真源 : ${fmt(tsVal)}\n    ${impl.padEnd(7)}: ${fmt(nativeVal)}`);
    }
  }
}

/* ---------- 各套 ---------- */

// 1. 羊皮卷色板
{
  const tsSrc = read(path.join(RN, "src/read/readParchmentTheme.ts"));
  const swiftSrc = read(path.join(IOS, "Theme/ParchmentTheme.swift"));

  const kotlinSrc = read(path.join(AND, "ParchmentPalette.kt"));
  for (const mode of ["light", "dark"]) {
    const ts = tsObjectStrings(tsSrc, mode);
    const ios = swiftPalette(swiftSrc, mode);
    const and = kotlinPalette(kotlinSrc, mode);
    for (const [key, raw] of Object.entries(ts)) {
      // 某端未采用的键跳过（两端都没有则这一项不参与对拍）
      compare(`色板 ${mode}`, key, normalizeColor(raw),
              { iOS: ios[key], Android: and[key] }, fmtColor);
    }
  }
}

// 2. 排版 15 档
{
  const tsSrc = read(path.join(RN, "src/read/read-bible-typography-prefs.ts"));
  const swiftSrc = read(path.join(IOS, "Theme/ReadTypography.swift"));
  const ts = tsTypographyTable(tsSrc);
  const ios = swiftTypographyTable(swiftSrc);
  const and = kotlinTypographyTable(read(path.join(AND, "ReadTypography.kt")));
  const FIELDS = ["verseFontSize", "verseLineHeight", "verseNumFontSize", "chapterTitleSize", "catalogBookSize", "catalogBookLine"];

  for (const [size, fields] of Object.entries(ts)) {
    if (!ios[size]) failures.push(`排版档位 · ${size}\n    iOS 侧缺这一档`);
    if (!and[size]) failures.push(`排版档位 · ${size}\n    Android 侧缺这一档`);
    for (const f of FIELDS) {
      if (fields[f] === undefined) continue;
      compare(`排版 ${size}`, f, fields[f], { iOS: ios[size]?.[f], Android: and[size]?.[f] });
    }
  }
}

// 3. 壳层几何。两端命名不同，这张映射表本身就是文档。
{
  const iosNums = swiftStaticNumbers(read(path.join(IOS, "Theme/ReadTypography.swift")));
  const andNums = kotlinConstNumbers(read(path.join(AND, "ReadTypography.kt")));
  const both = (k) => ({ iOS: iosNums[k], Android: andNums[k] });

  const topChromeTs = tsNumbers(read(path.join(RN, "src/read/readTopChrome.ts")), "READ_TOP_CHROME = {");
  const TOP_MAP = {
    topOffset: "topChromeOffset",
    btnSize: "topChromeButton",
    iconSize: "topChromeIcon",
    sizeLabelFontSize: "topChromeSizeLabel",
    gap: "topChromeGap",
    sideInset: "topChromeSideInset",
  };
  for (const [tsKey, iosKey] of Object.entries(TOP_MAP)) {
    compare("读经顶栏", `${tsKey} → ${iosKey}`, topChromeTs[tsKey], both(iosKey));
  }

  const dockSrc = read(path.join(RN, "src/shell/shellPlaybackTransportLayout.ts"));
  const transportTs = tsNumbers(dockSrc, "shellPlaybackTransportMetrics = {");
  const TRANSPORT_MAP = {
    scrubberRowHeight: "scrubberRowHeight",
    scrubberTimeGap: "scrubberTimeGap",
    timeFontSize: "timeFontSize",
    timeLabelMinWidth: "timeLabelMinWidth",
    transportMainGap: "transportMainGap",
    loopBtnSize: "loopButtonSize",
    transportBtnSize: "transportButtonSize",
    playBtnSize: "playButtonSize",
    skipIconSize: "skipIconSize",
    playIconSize: "playIconSize",
    loopIconSize: "loopIconSize",
    speedBtnSize: "speedButtonSize",
    playIconNudge: "playIconNudge",
  };
  for (const [tsKey, iosKey] of Object.entries(TRANSPORT_MAP)) {
    compare("播放坞", `${tsKey} → ${iosKey}`, transportTs[tsKey], both(iosKey));
  }

  const chromeTs = tsNumbers(dockSrc, "shellPlaybackDockChrome = {");
  for (const [tsKey, iosKey] of Object.entries({ paddingTop: "dockPaddingTop", paddingHorizontal: "dockPaddingH", marginBottom: "dockMarginBottom" })) {
    compare("播放坞外框", `${tsKey} → ${iosKey}`, chromeTs[tsKey], both(iosKey));
  }

  // 单独导出的常量
  const rowHeight = Number(dockSrc.match(/SHELL_TAB_ROW_HEIGHT\s*=\s*(\d+)/)?.[1]);
  const dockGap = Number(dockSrc.match(/SHELL_TAB_BAR_DOCK_GAP\s*=\s*(\d+)/)?.[1]);
  compare("底栏", "SHELL_TAB_ROW_HEIGHT → tabRowHeight", rowHeight, both("tabRowHeight"));
  compare("底栏", "SHELL_TAB_BAR_DOCK_GAP → tabBarDockGap", dockGap, both("tabBarDockGap"));

  const tabStyles = read(path.join(RN, "src/shell/shellTabBarStyles.ts"));
  compare("底栏", "row.maxWidth → tabRowMaxWidth",
    Number(tabStyles.match(/maxWidth:\s*(\d+)/)?.[1]), both("tabRowMaxWidth"));
  compare("底栏", "tabBtn.height → tabButtonHeight",
    Number(tabStyles.match(/tabBtn:\s*\{[^}]*height:\s*(\d+)/s)?.[1]), both("tabButtonHeight"));
  compare("底栏", "scriptureFab.width → fabSize",
    Number(tabStyles.match(/scriptureFab:\s*\{[^}]*width:\s*(\d+)/s)?.[1]), both("fabSize"));

  const helpers = read(path.join(RN, "src/shell/shellTabBarHelpers.tsx"));
  compare("底栏", "TAB_ICON_SIZE → tabIconSize",
    Number(helpers.match(/TAB_ICON_SIZE\s*=\s*(\d+)/)?.[1]), both("tabIconSize"));
}

// 4. 品牌色
{
  const brandTs = read(path.join(RN, "src/shell/splash-branding.generated.ts"));
  const swiftSrc = read(path.join(IOS, "Theme/ParchmentTheme.swift"));
  const tsLogo = normalizeColor(brandTs.match(/SPLASH_BACKGROUND\s*=\s*"([^"]+)"/)?.[1]);
  const iosLogo = (() => {
    const m = swiftSrc.match(/static let logo = Color\(rgb:\s*0x([0-9a-f]{6})\)/i);
    return m ? { ...hexToRgb(m[1]), a: 1 } : null;
  })();
  const andLogo = (() => {
    const m = read(path.join(AND, "ParchmentPalette.kt")).match(/val logo = Rgba\(0x([0-9a-f]{6})\)/i);
    return m ? { ...hexToRgb(m[1]), a: 1 } : undefined;
  })();
  compare("品牌", "SPLASH_BACKGROUND → Brand.logo", tsLogo,
          { iOS: iosLogo, Android: andLogo }, fmtColor);
}

/* ---------- 报告 ---------- */

if (failures.length === 0) {
  console.log(`设计 token 对拍通过：${checked} 项，TS 真源与 iOS / Android 一致${deviationsHit.length ? `（${deviationsHit.length} 项登记在案的故意偏离）` : ""}。`);
  for (const d of deviationsHit) console.log("  · " + d);
  process.exit(0);
}
console.error(`设计 token 漂移：${failures.length} / ${checked} 项不一致\n`);
for (const f of failures) console.error("  " + f + "\n");
console.error("真源是 RN 的 TS。改动请同步到各原生端后重跑。");
process.exit(1);
