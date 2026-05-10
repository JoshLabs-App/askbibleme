import fs from "node:fs/promises";
import path from "node:path";
import type { MetadataRoute } from "next";
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
    return {
      updatedAt: j.updatedAt,
      originalName: j.originalName,
      logoKind: coerceLogoKind(j.logoKind),
      presetId: coercePreset(j.presetId),
      colors: normalizeBrandColors(j.colors),
    };
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
    name: "Selah.my",
    short_name: "Selah.my",
    description: "安静回到经文的入口 — 正在成型。",
    start_url: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui"],
    background_color: canvas,
    theme_color: canvas,
    lang: "zh-CN",
    icons: buildManifestIcons(useBranding),
  };
}
