import { theme } from "../theme";

/** 与网站 `DEFAULT_SHELL_TEMPLATE_CHROME_TUNE` / `shellTemplateChromeScrimBackgrounds` 同源 */
export type ShellChromeTune = {
  topHeightRem: number;
  topHeightMinPx: number;
  bottomHeightRem: number;
  bottomHeightMinPx: number;
  topSolidEndPct: number;
  bottomSolidEndPct: number;
  topStop1Pct: number;
  topStop1Alpha: number;
  topStop2Pct: number;
  topStop2Alpha: number;
  bottomStop1Pct: number;
  bottomStop1Alpha: number;
  bottomStop2Pct: number;
  bottomStop2Alpha: number;
};

export const DEFAULT_SHELL_CHROME_TUNE: ShellChromeTune = {
  topHeightRem: 5.25,
  topHeightMinPx: 88,
  bottomHeightRem: 13,
  bottomHeightMinPx: 200,
  topSolidEndPct: 2,
  bottomSolidEndPct: 5,
  topStop1Pct: 26,
  topStop1Alpha: 0.42,
  topStop2Pct: 58,
  topStop2Alpha: 0.14,
  bottomStop1Pct: 30,
  bottomStop1Alpha: 0.38,
  bottomStop2Pct: 58,
  bottomStop2Alpha: 0.12,
};

const APP_DARK = theme.appDark;

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampShellChromeTune(t: ShellChromeTune): ShellChromeTune {
  const topSolidEndPct = clamp(t.topSolidEndPct, 0.25, 22);
  const topStop1Pct = clamp(t.topStop1Pct, topSolidEndPct + 0.5, 94);
  const topStop2Pct = clamp(t.topStop2Pct, topStop1Pct + 0.5, 99.5);
  const bottomSolidEndPct = clamp(t.bottomSolidEndPct, 0.25, 24);
  const bottomStop1Pct = clamp(t.bottomStop1Pct, bottomSolidEndPct + 0.5, 94);
  const bottomStop2Pct = clamp(t.bottomStop2Pct, bottomStop1Pct + 0.5, 99.5);
  return {
    topHeightRem: clamp(t.topHeightRem, 2, 18),
    topHeightMinPx: Math.round(clamp(t.topHeightMinPx, 48, 200)),
    bottomHeightRem: clamp(t.bottomHeightRem, 4, 28),
    bottomHeightMinPx: Math.round(clamp(t.bottomHeightMinPx, 120, 360)),
    topSolidEndPct,
    bottomSolidEndPct,
    topStop1Pct,
    topStop1Alpha: clamp(t.topStop1Alpha, 0, 1),
    topStop2Pct,
    topStop2Alpha: clamp(t.topStop2Alpha, 0, 1),
    bottomStop1Pct,
    bottomStop1Alpha: clamp(t.bottomStop1Alpha, 0, 1),
    bottomStop2Pct,
    bottomStop2Alpha: clamp(t.bottomStop2Alpha, 0, 1),
  };
}

export function chromeScrimGradientColors(
  tune: ShellChromeTune = DEFAULT_SHELL_CHROME_TUNE,
): {
  top: { colors: string[]; locations: number[] };
  bottom: { colors: string[]; locations: number[] };
  topHeightPx: number;
  bottomHeightPx: number;
} {
  const d = clampShellChromeTune(tune);
  const { r, g, b } = parseHex(APP_DARK);
  const aMul = 0.52;
  const a1t = d.topStop1Alpha * aMul;
  const a2t = d.topStop2Alpha * aMul;
  const a1b = d.bottomStop1Alpha * aMul;
  const a2b = d.bottomStop2Alpha * aMul;

  const solid = `rgba(${r},${g},${b},1)`;
  const topColors = [
    solid,
    solid,
    `rgba(${r},${g},${b},${a1t})`,
    `rgba(${r},${g},${b},${a2t})`,
    `rgba(${r},${g},${b},0)`,
  ];
  const topLocations = [
    0,
    d.topSolidEndPct / 100,
    d.topStop1Pct / 100,
    d.topStop2Pct / 100,
    1,
  ];

  const bottomColors = [
    solid,
    solid,
    `rgba(${r},${g},${b},${a1b})`,
    `rgba(${r},${g},${b},${a2b})`,
    `rgba(${r},${g},${b},0)`,
  ];
  const bottomLocations = [
    0,
    d.bottomSolidEndPct / 100,
    d.bottomStop1Pct / 100,
    d.bottomStop2Pct / 100,
    1,
  ];

  return {
    top: { colors: topColors, locations: topLocations },
    bottom: { colors: bottomColors, locations: bottomLocations },
    topHeightPx: Math.max(d.topHeightMinPx, d.topHeightRem * 16),
    bottomHeightPx: Math.max(d.bottomHeightMinPx, d.bottomHeightRem * 16),
  };
}

/** 底栏羊皮渐隐：与网站 `shellTemplateChromeScrimBackgrounds` 底缘同源；单段 rgba 渐隐，避免 RN 上 rgb/rgba 混用呈色块。 */
export function parchmentTabBarBottomGradient(
  tune: ShellChromeTune = DEFAULT_SHELL_CHROME_TUNE,
): {
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
} {
  const d = clampShellChromeTune(tune);
  const { r, g, b } = parseHex(APP_DARK);
  const aMul = 0.52;
  const a1 = d.bottomStop1Alpha * aMul;
  const a2 = d.bottomStop2Alpha * aMul;
  const c = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const solidEnd = d.bottomStop1Pct / 100;
  const fadeMid = solidEnd + ((d.bottomStop2Pct / 100 - solidEnd) * 0.5);

  return {
    colors: [c(1), c(1), c(a1), c(a2), c(0)],
    locations: [0, solidEnd, fadeMid, d.bottomStop2Pct / 100, 1],
  };
}
