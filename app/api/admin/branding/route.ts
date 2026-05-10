import { NextResponse } from "next/server";
import {
  brandingAssetsExist,
  getResolvedBrandColors,
  readBrandingState,
} from "@/lib/site-branding";
import { BRAND_PRESET_LABELS } from "@/lib/site-branding-colors";

/** 供后台读取标识状态与配色（无需写权限）。 */
export async function GET() {
  const state = await readBrandingState();
  const assetsReady = await brandingAssetsExist();
  const colors = await getResolvedBrandColors();
  return NextResponse.json({
    state,
    colors,
    presetLabels: BRAND_PRESET_LABELS,
    assetsReady,
    urls: assetsReady
      ? {
          logo: "/branding/logo.png",
          vector: "/branding/logo.svg",
          icon192: "/branding/icon-192.png",
          icon512: "/branding/icon-512.png",
          appleTouch: "/branding/apple-touch-icon.png",
          favicon32: "/branding/favicon-32.png",
        }
      : null,
  });
}
