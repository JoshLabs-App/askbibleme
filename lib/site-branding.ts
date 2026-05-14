import fs from "node:fs/promises";
import path from "node:path";
import type { MetadataRoute } from "next";
import { SITE_METADATA_DEFAULT_TITLE } from "@/lib/site-metadata-defaults";
import type { BrandColors, BrandPresetId, SiteBrandingState } from "@/lib/site-branding-colors";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND_COLORS,
  normalizeBrandColors,
} from "@/lib/site-branding-colors";

export type { SiteBrandingState } from "@/lib/site-branding-colors";

const cwd = process.cwd();
export const BRANDING_PUBLIC_DIR = path.resolve(cwd, "public", "branding");
export const BRANDING_STATE_PATH = path.resolve(cwd, "data", "branding.json");

const VALID_PRESET: Set<BrandPresetId> = new Set([
  "parchment",
  "mist",
  "dusk",
  "forest",
  "custom",
]);

function coercePreset(id: unknown): BrandPresetId {
  return typeof id === "string" && VALID_PRESET.has(id as BrandPresetId)
    ? (id as BrandPresetId)
    : "parchment";
}

function coerceLogoKind(v: unknown): "svg" | "raster" {
  return v === "svg" ? "svg" : "raster";
}

export async function readBrandingState(): Promise<SiteBrandingState | null> {
  try {
    const raw = await fs.readFile(BRANDING_STATE_PATH, "utf-8");
    const j = JSON.parse(raw) as Partial<SiteBrandingState>;
    if (typeof j.updatedAt !== "string" || typeof j.originalName !== "string") return null;
    const base: SiteBrandingState = {
      updatedAt: j.updatedAt,
      originalName: j.originalName,
      logoKind: coerceLogoKind(j.logoKind),
      presetId: coercePreset(j.presetId),
      colors: normalizeBrandColors(j.colors),
    };
    if (typeof j.appIconsUpdatedAt === "string" && j.appIconsUpdatedAt.trim()) {
      base.appIconsUpdatedAt = j.appIconsUpdatedAt.trim();
    }
    if (typeof j.appIconOriginalName === "string" && j.appIconOriginalName.trim()) {
      base.appIconOriginalName = j.appIconOriginalName.trim();
    }
    return base;
  } catch {
    return null;
  }
}

export async function writeBrandingState(state: SiteBrandingState): Promise<void> {
  await fs.mkdir(path.dirname(BRANDING_STATE_PATH), { recursive: true });
  await fs.writeFile(BRANDING_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

/** 无 branding.json 时使用默认色；有文件则合并校验。 */
export async function getResolvedBrandColors(): Promise<BrandColors> {
  const st = await readBrandingState();
  if (!st) return DEFAULT_BRAND_COLORS;
  return normalizeBrandColors(st.colors);
}

export async function brandingAssetsExist(): Promise<boolean> {
  try {
    await fs.access(path.join(BRANDING_PUBLIC_DIR, "icon-192.png"));
    await fs.access(path.join(BRANDING_PUBLIC_DIR, "icon-512.png"));
    return true;
  } catch {
    return false;
  }
}

/** 顶栏用：存在 `logo.svg` 或 `logo.png` */
export async function brandingLogoExists(): Promise<boolean> {
  try {
    await fs.access(path.join(BRANDING_PUBLIC_DIR, "logo.svg"));
    return true;
  } catch {
    try {
      await fs.access(path.join(BRANDING_PUBLIC_DIR, "logo.png"));
      return true;
    } catch {
      return false;
    }
  }
}

/** 配色保存时：若可找到图标母版则重新栅格化（母版为 app-icon.png，或过渡期内仅有 logo.png） */
export async function canRegenerateBrandedAppIcons(): Promise<boolean> {
  for (const rel of ["app-icon.png", "logo.png"]) {
    try {
      await fs.access(path.join(BRANDING_PUBLIC_DIR, rel));
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

export function resolveColorsFromPreset(
  presetId: BrandPresetId,
  custom?: Partial<BrandColors> | null,
): BrandColors {
  if (presetId !== "custom") {
    return { ...BRAND_PRESETS[presetId] };
  }
  return normalizeBrandColors(custom ?? {});
}

export function buildManifestIcons(useBranding: boolean): MetadataRoute.Manifest["icons"] {
  const base = useBranding ? "/branding" : "/icons";
  return [
    {
      src: `${base}/icon-192.png`,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: `${base}/icon-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: `${base}/icon-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];
}

export async function buildManifestBody(): Promise<MetadataRoute.Manifest> {
  const useBranding = await brandingAssetsExist();
  const colors = await getResolvedBrandColors();
  const canvas = colors.canvas;
  return {
    id: "/",
    scope: "/",
    name: SITE_METADATA_DEFAULT_TITLE,
    short_name: SITE_METADATA_DEFAULT_TITLE,
    description: "安静回到经文的入口 — 正在成型。",
    start_url: "/",
    /** `fullscreen` 会隐藏 Android 状态栏（含系统时间）；`standalone` 与 iOS 主屏「半透明顶栏」观感更接近 */
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "fullscreen"],
    background_color: canvas,
    theme_color: canvas,
    lang: "zh-CN",
    icons: buildManifestIcons(useBranding),
  };
}
