import type { BrandColors } from "@/lib/site-branding-colors";
import { brandColorsToCssVars, DEFAULT_BRAND_COLORS } from "@/lib/site-branding-colors";

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function mainFillRgbComponents(pageCanvasHex: string): { r: number; g: number; b: number } {
  const raw = parseHexRgb(pageCanvasHex) ?? parseHexRgb(DEFAULT_BRAND_COLORS.appDark)!;
  const lum = (raw.r * 299 + raw.g * 587 + raw.b * 114) / 1000;
  if (lum >= 130) {
    const t = 0.34;
    return {
      r: Math.round(raw.r + (255 - raw.r) * t),
      g: Math.round(raw.g + (255 - raw.g) * t),
      b: Math.round(raw.b + (255 - raw.b) * t),
    };
  }
  const t = 0.22;
  return {
    r: Math.round(raw.r * (1 - t)),
    g: Math.round(raw.g * (1 - t)),
    b: Math.round(raw.b * (1 - t)),
  };
}

/**
 * 壳模板页 `main` 铺色：在 JS 里把 `pageCanvas` 略向白/黑偏一点得到 `rgb()`，
 * 避免 `color-mix()` 在部分 WebView 失效；渐变叠在其上才有稳定对比。
 */
export function shellTemplateMainFillFromPageCanvas(pageCanvasHex: string): string {
  const f = mainFillRgbComponents(pageCanvasHex);
  return `rgb(${f.r},${f.g},${f.b})`;
}

function isLightPageCanvas(pageCanvasHex: string): boolean {
  const raw = parseHexRgb(pageCanvasHex) ?? parseHexRgb(DEFAULT_BRAND_COLORS.appDark)!;
  const lum = (raw.r * 299 + raw.g * 587 + raw.b * 114) / 1000;
  return lum >= 130;
}

/** 壳模板顶/底压边可视化调节；可调并存 `localStorage`（见 shell-template-chrome-tune-storage） */
export type ShellTemplateChromeTune = {
  topHeightRem: number;
  topHeightMinPx: number;
  bottomHeightRem: number;
  bottomHeightMinPx: number;
  /** 顶渐变：全不透明 `rgb(appDark)` 占高度比例的上限位置（%） */
  topSolidEndPct: number;
  /** 底渐变（to top）：靠底全实色占比例上限（%） */
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

export const DEFAULT_SHELL_TEMPLATE_CHROME_TUNE: ShellTemplateChromeTune = {
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampShellTemplateChromeTune(t: ShellTemplateChromeTune): ShellTemplateChromeTune {
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

/**
 * 壳模板页顶/底压边：单层 `appDark` → `transparent`；**tune** 控制高度与渐变节点。
 * 深壳时对半透明段 alpha 乘 **0.52**，避免过重。
 */
export function shellTemplateChromeScrimBackgrounds(
  appLightHex: string,
  appDarkHex: string,
  tune: ShellTemplateChromeTune = DEFAULT_SHELL_TEMPLATE_CHROME_TUNE,
): {
  fillBackgroundColor: string;
  topBackground: string;
  bottomBackground: string;
} {
  const d = clampShellTemplateChromeTune(tune);
  const dockRgb = parseHexRgb(appDarkHex) ?? parseHexRgb(DEFAULT_BRAND_COLORS.appDark)!;
  const { r, g, b } = dockRgb;
  const f = mainFillRgbComponents(appLightHex);
  const fillStr = `rgb(${f.r},${f.g},${f.b})`;
  const light = isLightPageCanvas(appLightHex);
  const aMul = light ? 1 : 0.52;
  const a1t = Math.round(d.topStop1Alpha * aMul * 1000) / 1000;
  const a2t = Math.round(d.topStop2Alpha * aMul * 1000) / 1000;
  const a1b = Math.round(d.bottomStop1Alpha * aMul * 1000) / 1000;
  const a2b = Math.round(d.bottomStop2Alpha * aMul * 1000) / 1000;

  const topBackground = `linear-gradient(to bottom, rgb(${r},${g},${b}) 0%, rgb(${r},${g},${b}) ${d.topSolidEndPct}%, rgba(${r},${g},${b},${a1t}) ${d.topStop1Pct}%, rgba(${r},${g},${b},${a2t}) ${d.topStop2Pct}%, transparent 100%)`;

  const bottomBackground = `linear-gradient(to top, rgb(${r},${g},${b}) 0%, rgb(${r},${g},${b}) ${d.bottomSolidEndPct}%, rgba(${r},${g},${b},${a1b}) ${d.bottomStop1Pct}%, rgba(${r},${g},${b},${a2b}) ${d.bottomStop2Pct}%, transparent 100%)`;

  return { fillBackgroundColor: fillStr, topBackground, bottomBackground };
}

/** 壳模板页预览主题色板；可选经左菜单写入本机并由 `AppSkinProvider` 全站覆盖 `--brand-*` */
export type ShellTemplatePreviewThemeId =
  | "lagoonPaper"
  | "lightBlue"
  | "pinkBloom"
  | "graphite"
  | "creamPaper"
  | "sageGrove"
  | "lavenderFog"
  | "claySand"
  | "mistSlate"
  | "deskAsh"
  | "deskWarm"
  | "deskMist";

export type ShellTemplatePreviewTheme = {
  id: ShellTemplatePreviewThemeId;
  /** 壳内浅色主区基准，与 `colors.appLight` 一致 */
  pageCanvas: string;
  colors: BrandColors;
};

const ADMIN_LIGHT: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#0E2438",
  adminPanel: "#152F45",
  adminLine: "#2A5572",
  adminFg: "#EEF3F8",
  adminMuted: "#94A9B8",
};

const ADMIN_PINK: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#2A1420",
  adminPanel: "#3A1F2C",
  adminLine: "#5C3848",
  adminFg: "#FDF5F8",
  adminMuted: "#C4A8B4",
};

const ADMIN_GRAPHITE: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#0F0D0C",
  adminPanel: "#181614",
  adminLine: "#3A3632",
  adminFg: "#F2EFEB",
  adminMuted: "#9C9690",
};

const ADMIN_CREAM: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#2A241C",
  adminPanel: "#3A3229",
  adminLine: "#5C5348",
  adminFg: "#FAF7F2",
  adminMuted: "#A89F94",
};

const ADMIN_SAGE: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#13251C",
  adminPanel: "#1B3328",
  adminLine: "#355648",
  adminFg: "#EEF6F1",
  adminMuted: "#93AB9E",
};

const ADMIN_LAVENDER: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#221B38",
  adminPanel: "#2E2648",
  adminLine: "#4A3F6E",
  adminFg: "#F6F3FC",
  adminMuted: "#ADA3C8",
};

const ADMIN_CLAY: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#2E221A",
  adminPanel: "#3F2F24",
  adminLine: "#5E4A3D",
  adminFg: "#FBF6F2",
  adminMuted: "#C4A896",
};

const ADMIN_SLATE: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#1A2433",
  adminPanel: "#243044",
  adminLine: "#3D4D64",
  adminFg: "#F0F4F9",
  adminMuted: "#94A3B8",
};

/** Notion 类极淡工作台：中性深灰后台，与浅纸面前台成套 */
const ADMIN_DESK: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#2C2C2C",
  adminPanel: "#383838",
  adminLine: "#555555",
  adminFg: "#F5F5F4",
  adminMuted: "#9C9C9C",
};

export const SHELL_TEMPLATE_PREVIEW_THEMES: ShellTemplatePreviewTheme[] = [
  {
    id: "lagoonPaper",
    pageCanvas: "#D8ECF7",
    colors: {
      canvas: "#D8ECF7",
      surface: "#EFF6FB",
      border: "#B0CDE3",
      muted: "#5B7A90",
      ink: "#102A40",
      sand: "#2A7CB0",
      appLight: "#D8ECF7",
      appDark: "#0E3554",
      ...ADMIN_LIGHT,
    },
  },
  {
    id: "lightBlue",
    pageCanvas: "#C8E6FF",
    colors: {
      canvas: "#C8E6FF",
      surface: "#EAF4FF",
      border: "#98C8EB",
      muted: "#476985",
      ink: "#0A2338",
      sand: "#1E7FD4",
      appLight: "#C8E6FF",
      appDark: "#082842",
      ...ADMIN_LIGHT,
    },
  },
  {
    id: "pinkBloom",
    pageCanvas: "#FFE5EF",
    colors: {
      canvas: "#FFE5EF",
      surface: "#FFF5F9",
      border: "#E8A8C0",
      muted: "#8E5A6C",
      ink: "#3A1522",
      sand: "#D4487A",
      appLight: "#FFE5EF",
      appDark: "#4A1F32",
      ...ADMIN_PINK,
    },
  },
  {
    id: "graphite",
    pageCanvas: "#E6E2DC",
    colors: {
      canvas: "#DCD7D1",
      surface: "#EEEBE6",
      border: "#C5BFBA",
      muted: "#6F6963",
      ink: "#252220",
      sand: "#8A7E74",
      appLight: "#E6E2DC",
      appDark: "#0D0B09",
      ...ADMIN_GRAPHITE,
    },
  },
  {
    id: "deskAsh",
    pageCanvas: "#FAFAF9",
    colors: {
      canvas: "#FAFAF9",
      surface: "#FFFFFF",
      border: "#E8E7E5",
      muted: "#9B9A97",
      ink: "#37352F",
      sand: "#8A9BA8",
      appLight: "#FAFAF9",
      appDark: "#37352F",
      ...ADMIN_DESK,
    },
  },
  {
    id: "deskWarm",
    pageCanvas: "#FBFAF8",
    colors: {
      canvas: "#FBFAF8",
      surface: "#FFFDFB",
      border: "#EDEAE4",
      muted: "#969188",
      ink: "#3F3D39",
      sand: "#9A9086",
      appLight: "#FBFAF8",
      appDark: "#3F3D39",
      ...ADMIN_DESK,
    },
  },
  {
    id: "deskMist",
    pageCanvas: "#F7F8FA",
    colors: {
      canvas: "#F7F8FA",
      surface: "#FCFCFD",
      border: "#E5E7EB",
      muted: "#8B8F97",
      ink: "#2F333A",
      sand: "#7D8B9A",
      appLight: "#F7F8FA",
      appDark: "#2F333A",
      ...ADMIN_DESK,
    },
  },
  {
    id: "creamPaper",
    pageCanvas: "#F4EFE6",
    colors: {
      canvas: "#F4EFE6",
      surface: "#FAF7F2",
      border: "#D9D1C4",
      muted: "#6E665C",
      ink: "#2C2620",
      sand: "#9A6B3A",
      appLight: "#F4EFE6",
      appDark: "#3D3429",
      ...ADMIN_CREAM,
    },
  },
  {
    id: "sageGrove",
    pageCanvas: "#E5EDE5",
    colors: {
      canvas: "#E5EDE5",
      surface: "#F2F7F2",
      border: "#A8C4A8",
      muted: "#4A6350",
      ink: "#1A2E1F",
      sand: "#2F6D47",
      appLight: "#E5EDE5",
      appDark: "#1E3A28",
      ...ADMIN_SAGE,
    },
  },
  {
    id: "lavenderFog",
    pageCanvas: "#EDE8F4",
    colors: {
      canvas: "#EDE8F4",
      surface: "#F6F3FB",
      border: "#C4B8DC",
      muted: "#6B5F80",
      ink: "#2A2240",
      sand: "#6B4FB8",
      appLight: "#EDE8F4",
      appDark: "#31255A",
      ...ADMIN_LAVENDER,
    },
  },
  {
    id: "claySand",
    pageCanvas: "#F0E8E0",
    colors: {
      canvas: "#F0E8E0",
      surface: "#FAF4EE",
      border: "#D4C2B4",
      muted: "#7A6558",
      ink: "#3A2A22",
      sand: "#B85A32",
      appLight: "#F0E8E0",
      appDark: "#5C3D2E",
      ...ADMIN_CLAY,
    },
  },
  {
    id: "mistSlate",
    pageCanvas: "#E8ECF1",
    colors: {
      canvas: "#E8ECF1",
      surface: "#F4F6F9",
      border: "#B8C0CC",
      muted: "#556070",
      ink: "#1C2430",
      sand: "#3B5FA8",
      appLight: "#E8ECF1",
      appDark: "#1E2A3D",
      ...ADMIN_SLATE,
    },
  },
];

export function shellTemplatePreviewThemeById(id: ShellTemplatePreviewThemeId): ShellTemplatePreviewTheme {
  const found = SHELL_TEMPLATE_PREVIEW_THEMES.find((x) => x.id === id);
  return found ?? SHELL_TEMPLATE_PREVIEW_THEMES[0];
}

export function shellTemplatePreviewCssVars(theme: ShellTemplatePreviewTheme): Record<string, string> {
  return brandColorsToCssVars(theme.colors);
}

export function isShellTemplatePreviewThemeId(id: string): id is ShellTemplatePreviewThemeId {
  return SHELL_TEMPLATE_PREVIEW_THEMES.some((t) => t.id === id);
}
