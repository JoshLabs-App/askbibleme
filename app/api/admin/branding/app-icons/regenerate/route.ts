import { NextResponse } from "next/server";
import { regenerateBrandingIcons } from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  canRegenerateBrandedAppIcons,
  getResolvedBrandColors,
  readBrandingState,
  writeBrandingState,
} from "@/lib/site-branding";
import { isValidHex6 } from "@/lib/site-branding-colors";
import type { SiteBrandingState } from "@/lib/site-branding-colors";

/**
 * 从现有图标母版（`app-icon.png` 或过渡期的 `logo.png`）按画布色重新生成 favicon / PWA / 原生资源。
 */
export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许写磁盘：开发环境默认可写；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
      },
      { status: 403 },
    );
  }

  if (!(await canRegenerateBrandedAppIcons())) {
    return NextResponse.json(
      { error: "缺少图标母版：请先上传「网站与 App 图标」或顶栏 LOGO（PNG / SVG）。" },
      { status: 400 },
    );
  }

  let canvasHex = (await getResolvedBrandColors()).canvas;
  try {
    const body = (await req.json()) as { canvas?: unknown };
    if (typeof body.canvas === "string" && isValidHex6(body.canvas)) {
      canvasHex = body.canvas.trim().toUpperCase();
    }
  } catch {
    /* 无 body 时用已保存品牌 canvas */
  }

  const prev = await readBrandingState();

  let iconBackground = canvasHex;
  try {
    const result = await regenerateBrandingIcons(canvasHex);
    iconBackground = result.iconBackground;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const next: SiteBrandingState = {
    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
    originalName: prev?.originalName ?? "（尚未上传 LOGO）",
    logoKind: prev?.logoKind ?? "raster",
    presetId: prev?.presetId ?? "parchment",
    colors: prev?.colors ?? (await getResolvedBrandColors()),
    ...(prev?.logoBackground ? { logoBackground: prev.logoBackground } : {}),
    ...(prev?.logoTextAccent ? { logoTextAccent: prev.logoTextAccent } : {}),
    appIconsUpdatedAt: new Date().toISOString(),
    appIconOriginalName: prev?.appIconOriginalName ?? "regenerate",
  };
  await writeBrandingState(next);

  return NextResponse.json({
    ok: true,
    canvas: canvasHex,
    iconBackground,
    appIconsUpdatedAt: next.appIconsUpdatedAt,
    appIconOriginalName: next.appIconOriginalName,
    mobileNativeSynced: true,
    urls: {
      icon192: "/branding/icon-192.png",
      icon512: "/branding/icon-512.png",
      appleTouch: "/branding/apple-touch-icon.png",
      favicon32: "/branding/favicon-32.png",
    },
  });
}
