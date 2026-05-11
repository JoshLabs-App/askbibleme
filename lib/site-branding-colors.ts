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

/** 静湖系：天青画布 + 深蓝字 + 湖水点缀（全站默认，偏 Calm 式自然界面气质） */
export const DEFAULT_BRAND_COLORS: BrandColors = {
  canvas: "#E4F1FA",
  surface: "#CFE6F4",
  border: "#9BC4DC",
  muted: "#4A6274",
  ink: "#132A3A",
  sand: "#3D8AB8",
  adminBg: "#EAF4FB",
  adminPanel: "#DDEEF8",
  adminLine: "#B3D0E6",
  adminFg: "#132A3A",
  adminMuted: "#4A6274",
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
    canvas: "#E6EBF0",
    surface: "#D5DEE8",
    border: "#A8B6C4",
    muted: "#4E5A66",
    ink: "#1A2229",
    sand: "#5B7A94",
    adminBg: "#ECEFF3",
    adminPanel: "#DFE6EE",
    adminLine: "#C5CED8",
    adminFg: "#1A2229",
    adminMuted: "#4E5A66",
  },
  dusk: {
    canvas: "#DDE8F2",
    surface: "#C8DAEA",
    border: "#88A8C2",
    muted: "#3D4F5E",
    ink: "#0F1F2C",
    sand: "#2E6D8F",
    adminBg: "#E4EDF5",
    adminPanel: "#D3E2EF",
    adminLine: "#9FB8CC",
    adminFg: "#0F1F2C",
    adminMuted: "#3D4F5E",
  },
  forest: {
    canvas: "#E2F0ED",
    surface: "#CCE8E2",
    border: "#8FC4B8",
    muted: "#3D5A52",
    ink: "#102820",
    sand: "#2A8C78",
    adminBg: "#E8F4F1",
    adminPanel: "#D8EDE8",
    adminLine: "#A8D4C8",
    adminFg: "#102820",
    adminMuted: "#3D5A52",
  },
};

export const BRAND_PRESET_LABELS: Record<BrandPresetId, string> = {
  parchment: "静湖（默认）",
  mist: "雾蓝",
  dusk: "暮青",
  forest: "苔青",
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
