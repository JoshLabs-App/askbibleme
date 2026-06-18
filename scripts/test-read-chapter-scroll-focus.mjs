#!/usr/bin/env node
/**
 * 朗读跟读 scrollTo 数学冒烟：高亮经节中心应对齐可读区中心。
 */
import {
  nextScrollYFromWindowDelta,
  readVerseScrollFocusRatio,
  scrollDeltaToCenterVerseInWindow,
  scrollYToCenterVerse,
} from "../lib/read/read-chapter-verse-scroll-focus.ts";

const viewportHeight = 700;
const audioOpts = { topInsetRatio: 0.22, bottomInsetRatio: 0.36 };
const focusRatio = readVerseScrollFocusRatio(audioOpts);

function assertNear(label, actual, expected, tolerance = 2) {
  if (Math.abs(actual - expected) > tolerance) {
    console.error(`FAIL ${label}: got ${actual}, expected ~${expected}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`OK ${label}: ${actual}`);
  return true;
}

// 经节在 content y=2000, height=40
const layout = { y: 2000, height: 40 };
const scrollY = scrollYToCenterVerse(layout, viewportHeight, {
  ...audioOpts,
  contentHeight: 5000,
});

// 滚动后，经节中心在视口中的 y 应 ≈ viewportHeight * focusRatio
const verseCenterContent = layout.y + layout.height / 2;
const verseCenterInViewport = verseCenterContent - scrollY;
assertNear("verse center in viewport", verseCenterInViewport, viewportHeight * focusRatio);

// 屏幕坐标 delta：经节已在目标中心时 delta=0
const scrollWindowY = 100;
const scrollOffset = scrollY;
const verseWindowY = scrollWindowY + (verseCenterContent - scrollOffset) - layout.height / 2;
const delta = scrollDeltaToCenterVerseInWindow({
  verseWindowY,
  verseHeight: layout.height,
  scrollWindowY,
  scrollViewportHeight: viewportHeight,
  ...audioOpts,
});
assertNear("window delta at center", delta, 0);

const nextY = nextScrollYFromWindowDelta(scrollOffset, delta, viewportHeight, 5000);
assertNear("window delta scroll unchanged", nextY, scrollOffset);

// 边界：顶部经节不应负 scroll
const topScroll = scrollYToCenterVerse({ y: 0, height: 30 }, viewportHeight, { contentHeight: 5000, ...audioOpts });
if (topScroll < 0) {
  console.error("FAIL top scroll negative", topScroll);
  process.exitCode = 1;
} else {
  console.log("OK top scroll clamped:", topScroll);
}

if (process.exitCode) {
  process.exit(1);
}
console.log("All scroll-focus checks passed.");
