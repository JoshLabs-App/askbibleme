/** 与 Tailwind `theme.extend.colors` 中前台 + 后台语义色一致，供 CSS 变量与 manifest 使用 */

export type BrandColors = {
  canvas: string;
  surface: string;
  border: string;
  muted: string;
  ink: string;
  sand: string;
  /** 浅色应用区（如壳内浅底、模板主区）；与 `appDark` 成对 */
  appLight: string;
  /** 深色应用区：**底栏**、与自然页顶/底压层同源深色 */
  appDark: string;
  adminBg: string;
  adminPanel: string;
  adminLine: string;
  adminFg: string;
  adminMuted: string;
};

/** 深青画布 + 浅色字；`appDark` 与底栏、自然页压层同色族 */
export const DEFAULT_BRAND_COLORS: BrandColors = {
  canvas: "#143C60",
  surface: "#183A52",
  border: "#295878",
  muted: "#9BB0C2",
  ink: "#F1F5F9",
  sand: "#7EB8E0",
  appLight: "#DCECF7",
  appDark: "#143C60",
  adminBg: "#0E2438",
  adminPanel: "#152F45",
  adminLine: "#2A5572",
  adminFg: "#EEF3F8",
  adminMuted: "#94A9B8",
};

export type BrandPresetId = "parchment" | "mist" | "dusk" | "forest" | "custom";

export type SiteBrandingState = {
  /** 顶栏 LOGO 文件上次更新时间（与图标母版无关） */
  updatedAt: string;
  originalName: string;
  logoKind: "svg" | "raster";
  presetId: BrandPresetId;
  colors: BrandColors;
  /** 网站 / PWA 图标包（由 app-icon 母版生成） */
  appIconsUpdatedAt?: string;
  appIconOriginalName?: string;
};

export const BRAND_PRESETS: Record<Exclude<BrandPresetId, "custom">, BrandColors> = {
  parchment: { ...DEFAULT_BRAND_COLORS },
  mist: {
    canvas: "#152838",
    surface: "#1C3244",
    border: "#2A4A62",
    muted: "#96AAB8",
    ink: "#EEF2F6",
    sand: "#72B0D8",
    appLight: "#D4E2ED",
    appDark: "#0F1F2E",
    adminBg: "#0C1F30",
    adminPanel: "#132A3E",
    adminLine: "#264E68",
    adminFg: "#E8EDF2",
    adminMuted: "#8FA0AE",
  },
  dusk: {
    canvas: "#122A42",
    surface: "#17334A",
    border: "#264E6E",
    muted: "#9AAFC0",
    ink: "#F0F4F8",
    sand: "#84BFE8",
    appLight: "#DDE6F2",
    appDark: "#0A1F35",
    adminBg: "#0B1E32",
    adminPanel: "#12283C",
    adminLine: "#244A66",
    adminFg: "#EAF0F6",
    adminMuted: "#92A4B4",
  },
  forest: {
    canvas: "#133A36",
    surface: "#1A4540",
    border: "#2A5E56",
    muted: "#9BB8B2",
    ink: "#EEF6F4",
    sand: "#5EC4A8",
    appLight: "#DDF0EA",
    appDark: "#0C2623",
    adminBg: "#0E2E2A",
    adminPanel: "#153833",
    adminLine: "#285A52",
    adminFg: "#E8F3F0",
    adminMuted: "#93ADA6",
  },
};

export const BRAND_PRESET_LABELS: Record<BrandPresetId, string> = {
  parchment: "深青（默认）",
  mist: "雾蓝",
  dusk: "暮青",
  forest: "苔青",
  custom: "自定义",
};

export const BRAND_COLOR_GROUPS: { label: string; keys: (keyof BrandColors)[] }[] = [
  {
    label: "前台主站",
    keys: ["canvas", "surface", "border", "muted", "ink", "sand", "appLight", "appDark"],
  },
  {
    label: "后台 Admin",
    keys: ["adminBg", "adminPanel", "adminLine", "adminFg", "adminMuted"],
  },
];

export const BRAND_COLOR_LABELS: Record<keyof BrandColors, string> = {
  canvas: "画布 canvas",
  surface: "表面 surface",
  border: "细线 border",
  muted: "次要字 muted",
  ink: "正文 ink",
  sand: "点缀 sand",
  appLight: "浅色应用 appLight",
  appDark: "深色应用 / 底栏 appDark",
  adminBg: "后台底 adminBg",
  adminPanel: "后台板 adminPanel",
  adminLine: "后台线 adminLine",
  adminFg: "后台字 adminFg",
  adminMuted: "后台次要 adminMuted",
};

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export function isValidHex6(s: string): boolean {
  return HEX6.test(s.trim());
}

export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) return "244 235 217";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "244 235 217";
  return `${r} ${g} ${b}`;
}

export function normalizeBrandColors(raw: Partial<BrandColors> | null | undefined): BrandColors {
  const out = { ...DEFAULT_BRAND_COLORS };
  if (!raw || typeof raw !== "object") return out;
  (Object.keys(DEFAULT_BRAND_COLORS) as (keyof BrandColors)[]).forEach((k) => {
    const v = raw[k];
    if (typeof v === "string" && isValidHex6(v)) {
      out[k] = v.trim();
    }
  });
  return out;
}

export function brandColorsToCssVars(c: BrandColors): Record<string, string> {
  const vars: Record<string, string> = {};
  (Object.keys(c) as (keyof BrandColors)[]).forEach((key) => {
    const hex = c[key];
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    vars[`--brand-${cssKey}`] = hex;
    vars[`--brand-${cssKey}-rgb`] = hexToRgbTriplet(hex);
  });
  return vars;
}
