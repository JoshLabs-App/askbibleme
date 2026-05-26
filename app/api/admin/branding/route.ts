import { NextResponse } from "next/server";
import {
  brandingAssetsExist,
  brandingLogoExists,
  brandingSplashExists,
  getResolvedBrandColors,
  getResolvedLogoBackground,
  getResolvedLogoTextAccent,
  readBrandingState,
} from "@/lib/site-branding";
import { BRAND_PRESET_LABELS } from "@/lib/site-branding-colors";

/** 供后台读取标识状态与配色（无需写权限）。 */
export async function GET() {
  const state = await readBrandingState();
  const iconsReady = await brandingAssetsExist();
  const logoReady = await brandingLogoExists();
  const colors = await getResolvedBrandColors();
  const logoBackground = await getResolvedLogoBackground();
  const logoTextAccent = await getResolvedLogoTextAccent();
  const splashReady = await brandingSplashExists();
  return NextResponse.json({
    state,
    colors,
    logoBackground,
    logoTextAccent,
    splashReady,
    presetLabels: BRAND_PRESET_LABELS,
    iconsReady,
    logoReady,
    urls:
      logoReady || iconsReady
        ? {
            ...(logoReady ? { logo: "/branding/logo.png" } : {}),
            ...(iconsReady
              ? {
                  icon192: "/branding/icon-192.png",
                  icon512: "/branding/icon-512.png",
                  appleTouch: "/branding/apple-touch-icon.png",
                  favicon32: "/branding/favicon-32.png",
                }
              : {}),
            ...(state?.logoKind === "svg" ? { vector: "/branding/logo.svg" as const } : {}),
            ...(splashReady ? { splash: "/branding/splash-icon.png" as const } : {}),
          }
        : null,
  });
}
