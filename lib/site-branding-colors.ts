/** 与 Tailwind `theme.extend.colors` 中前台 + 后台语义色一致，供 CSS 变量与 manifest 使用 */

/**
 * 真源对齐：`app/(app-shell)/read/read-parchment-background.css` 的 `--read-parchment-bg-canvas`
 * 与 `apps/askbible-mobile/src/read/readParchmentTheme.ts`。
 * 预设色板来自产品「羊皮卷风格配色参考」；`canvas` 即图标 / manifest 底色。
 */
export const READ_PARCHMENT_CANVAS_LIGHT = "#ECD9B9";
export const READ_PARCHMENT_CANVAS_DARK = "#1A1512";

export type BrandColors = {
  canvas: string;
  surface: string;
  border: string;
  muted: string;
  ink: string;
  sand: string;
  appLight: string;
  appDark: string;
  adminBg: string;
  adminPanel: string;
  adminLine: string;
  adminFg: string;
  adminMuted: string;
};

const ADMIN_WARM: Pick<
  BrandColors,
  "adminBg" | "adminPanel" | "adminLine" | "adminFg" | "adminMuted"
> = {
  adminBg: "#3D2E24",
  adminPanel: "#4A382C",
  adminLine: "#6E5240",
  adminFg: "#F4EBE1",
  adminMuted: "#B9A896",
};

/** 设计稿 + 读经页默认真源（顺序即后台展示顺序） */
export const BRAND_PRESET_CATALOG = [
  { id: "parchment", label: "读经羊皮（默认）", canvas: "#ECD9B9" },
  { id: "deep-brown", label: "羊皮深棕", canvas: "#5B4636" },
  { id: "scroll-brown", label: "古卷棕", canvas: "#7A5A3A" },
  { id: "scroll-ochre", label: "卷轴黄棕", canvas: "#C1925B" },
  { id: "rice-brown", label: "羊皮米棕", canvas: "#E6D6B8" },
  { id: "paper-beige", label: "古纸米色", canvas: "#F0E6CE" },
  { id: "paper-white", label: "纸张灰白", canvas: "#F7F3E9" },
  { id: "dune-beige", label: "沙丘米", canvas: "#D8C7A6" },
  { id: "lime-paper", label: "石灰纸", canvas: "#CEC6B6" },
  { id: "warm-cream", label: "暖光米黄", canvas: "#F3E2B3" },
  { id: "sun-paper", label: "日晒纸", canvas: "#F2D8B6" },
  { id: "gray-brown-paper", label: "灰褐纸", canvas: "#D9D1C4" },
  { id: "earth-gray", label: "泥土灰棕", canvas: "#A89A86" },
  { id: "aged-mid", label: "旧羊皮（中）", canvas: "#9C7447" },
  { id: "aged-light", label: "旧羊皮（浅）", canvas: "#C9A672" },
  { id: "parchment-light", label: "羊皮纸（浅）", canvas: "#EAD9B7" },
  { id: "ancient-warm", label: "古纸（暖）", canvas: "#E6D1AA" },
  { id: "ancient-cool", label: "古纸（冷）", canvas: "#D7D1C3" },
] as const;

export const BRAND_PRESET_ORDER = BRAND_PRESET_CATALOG.map((e) => e.id);

export type BrandPresetId = (typeof BRAND_PRESET_ORDER)[number] | "custom";

export const BRAND_PRESET_CANVAS: Record<Exclude<BrandPresetId, "custom">, string> =
  Object.fromEntries(BRAND_PRESET_CATALOG.map((e) => [e.id, e.canvas])) as Record<
    Exclude<BrandPresetId, "custom">,
    string
  >;

/** 读经羊皮（默认）：与 `--read-parchment-bg-canvas` 白天一致 */
export const DEFAULT_BRAND_COLORS: BrandColors = {
  canvas: READ_PARCHMENT_CANVAS_LIGHT,
  surface: "#F5EBE0",
  border: "#C9A672",
  muted: "#5C4030",
  ink: "#1C1410",
  sand: "#9C7447",
  appLight: "#F7F3E9",
  appDark: "#5B4636",
  ...ADMIN_WARM,
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex6(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function toHex6(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => clampByte(x).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function mixHex(a: string, b: string, t: number): string {
  const c0 = parseHex6(a);
  const c1 = parseHex6(b);
  if (!c0 || !c1) return a.toUpperCase();
  const u = Math.max(0, Math.min(1, t));
  return toHex6(
    c0.r + (c1.r - c0.r) * u,
    c0.g + (c1.g - c0.g) * u,
    c0.b + (c1.b - c0.b) * u,
  );
}

/** 由画布色推导整套品牌语义色（自定义预设保存时亦可用） */
export function deriveBrandColorsFromCanvas(canvas: string): BrandColors {
  const c = canvas.trim().toUpperCase();
  const dark = brandCanvasColorScheme(c) === "dark";
  if (dark) {
    return {
      canvas: c,
      surface: mixHex(c, "#7A5A3A", 0.32),
      border: mixHex(c, "#9C7447", 0.42),
      muted: mixHex(c, "#E6D6B8", 0.58),
      ink: "#F4EBE1",
      sand: "#C9A672",
      appLight: mixHex(c, "#E6D6B8", 0.38),
      appDark: "#3D2E24",
      ...ADMIN_WARM,
    };
  }
  return {
    canvas: c,
    surface: mixHex(c, "#FFFFFF", 0.32),
    border: mixHex(c, "#9C7447", 0.52),
    muted: "#5C4030",
    ink: "#1C1410",
    sand: mixHex(c, "#7A5A3A", 0.62),
    appLight: mixHex(c, "#F7F3E9", 0.48),
    appDark: "#5B4636",
    ...ADMIN_WARM,
  };
}

function buildBrandPresets(): Record<Exclude<BrandPresetId, "custom">, BrandColors> {
  const out = {} as Record<Exclude<BrandPresetId, "custom">, BrandColors>;
  for (const entry of BRAND_PRESET_CATALOG) {
    out[entry.id] =
      entry.id === "parchment" ? { ...DEFAULT_BRAND_COLORS } : deriveBrandColorsFromCanvas(entry.canvas);
  }
  return out;
}

export const BRAND_PRESETS = buildBrandPresets();

export const BRAND_PRESET_LABELS: Record<BrandPresetId, string> = {
  ...Object.fromEntries(BRAND_PRESET_CATALOG.map((e) => [e.id, e.label])),
  custom: "自定义",
} as Record<BrandPresetId, string>;

/** 旧后台预设 id → 新色板（迁移 branding.json / localStorage） */
export const LEGACY_BRAND_PRESET_IDS: Record<string, Exclude<BrandPresetId, "custom">> = {
  mist: "paper-beige",
  dusk: "deep-brown",
  forest: "scroll-ochre",
};

export function coerceBrandPresetId(id: unknown): BrandPresetId {
  if (typeof id !== "string") return "parchment";
  if (id === "custom") return "custom";
  if ((BRAND_PRESET_ORDER as readonly string[]).includes(id)) return id as BrandPresetId;
  const legacy = LEGACY_BRAND_PRESET_IDS[id];
  if (legacy) return legacy;
  return "parchment";
}

export function brandPresetLabel(id: BrandPresetId | "site"): string {
  if (id === "site") return "跟随站点";
  return BRAND_PRESET_LABELS[id] ?? id;
}

export type SiteBrandingState = {
  updatedAt: string;
  originalName: string;
  logoKind: "svg" | "raster";
  presetId: BrandPresetId;
  colors: BrandColors;
  /** 顶栏 LOGO 方块底色；缺省时前台回退为 `colors.canvas` */
  logoBackground?: string;
  /** 前台阅读强调色（旧约/新约切换、统计数字等）。 */
  logoTextAccent?: string;
  appIconsUpdatedAt?: string;
  appIconOriginalName?: string;
};

export function logoBackgroundToCssVars(hex: string): Record<string, string> {
  const h = hex.trim().toUpperCase();
  return {
    "--brand-logo-background": h,
    "--brand-logo-background-rgb": hexToRgbTriplet(h),
  };
}

export function brandCanvasColorScheme(canvas: string): "light" | "dark" {
  const rgb = parseHex6(canvas);
  if (!rgb) return "light";
  const lum = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return lum >= 140 ? "light" : "dark";
}

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
  const rgb = parseHex6(hex);
  if (!rgb) return "236 217 185";
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

export function normalizeBrandColors(raw: Partial<BrandColors> | null | undefined): BrandColors {
  const out = { ...DEFAULT_BRAND_COLORS };
  if (!raw || typeof raw !== "object") return out;
  (Object.keys(DEFAULT_BRAND_COLORS) as (keyof BrandColors)[]).forEach((k) => {
    const v = raw[k];
    if (typeof v === "string" && isValidHex6(v)) {
      out[k] = v.trim().toUpperCase();
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
