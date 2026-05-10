/** 与 Tailwind `theme.extend.colors` 中前台 + 后台语义色一致，供 CSS 变量与 manifest 使用 */

export type BrandColors = {
  canvas: string;
  surface: string;
  border: string;
  muted: string;
  ink: string;
  sand: string;
  adminBg: string;
  adminPanel: string;
  adminLine: string;
  adminFg: string;
  adminMuted: string;
};

export const DEFAULT_BRAND_COLORS: BrandColors = {
  canvas: "#F4EBD9",
  surface: "#E8DCC8",
  border: "#C9B899",
  muted: "#6E5E45",
  ink: "#1F1A12",
  sand: "#B8945A",
  adminBg: "#F5F1EA",
  adminPanel: "#EBE6DC",
  adminLine: "#D4CBB8",
  adminFg: "#1F1A12",
  adminMuted: "#6E5E45",
};

export type BrandPresetId = "parchment" | "mist" | "dusk" | "forest" | "custom";

export type SiteBrandingState = {
  updatedAt: string;
  originalName: string;
  logoKind: "svg" | "raster";
  presetId: BrandPresetId;
  colors: BrandColors;
};

export const BRAND_PRESETS: Record<Exclude<BrandPresetId, "custom">, BrandColors> = {
  parchment: { ...DEFAULT_BRAND_COLORS },
  mist: {
    canvas: "#EAE8E4",
    surface: "#DEDBD6",
    border: "#B8B4AC",
    muted: "#5C5850",
    ink: "#1A1815",
    sand: "#8B7D62",
    adminBg: "#EFEDE9",
    adminPanel: "#E3E0DA",
    adminLine: "#CAC6BE",
    adminFg: "#1A1815",
    adminMuted: "#5C5850",
  },
  dusk: {
    canvas: "#EDE4D8",
    surface: "#DCCFBE",
    border: "#A89278",
    muted: "#5E4F3D",
    ink: "#16120E",
    sand: "#9A7348",
    adminBg: "#EFE8DE",
    adminPanel: "#E0D5C8",
    adminLine: "#C4B09A",
    adminFg: "#16120E",
    adminMuted: "#5E4F3D",
  },
  forest: {
    canvas: "#E8EDE6",
    surface: "#D5DFD6",
    border: "#A3B0A3",
    muted: "#4D574E",
    ink: "#121814",
    sand: "#6B7F68",
    adminBg: "#ECEFEB",
    adminPanel: "#DEE5DF",
    adminLine: "#B8C2B8",
    adminFg: "#121814",
    adminMuted: "#4D574E",
  },
};

export const BRAND_PRESET_LABELS: Record<BrandPresetId, string> = {
  parchment: "羊皮纸（默认）",
  mist: "雾灰",
  dusk: "暮色",
  forest: "苔绿",
  custom: "自定义",
};

export const BRAND_COLOR_GROUPS: { label: string; keys: (keyof BrandColors)[] }[] = [
  { label: "前台主站", keys: ["canvas", "surface", "border", "muted", "ink", "sand"] },
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
