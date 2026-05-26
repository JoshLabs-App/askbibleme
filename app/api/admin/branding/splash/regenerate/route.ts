import { NextResponse } from "next/server";
import { regenerateSplashPack } from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  canRegenerateBrandedAppIcons,
  getResolvedBrandColors,
  getResolvedLogoBackground,
  readBrandingState,
  writeBrandingState,
} from "@/lib/site-branding";
import { isValidHex6 } from "@/lib/site-branding-colors";
import type { SiteBrandingState } from "@/lib/site-branding-colors";

/** 按 LOGO 底色重绘 App 冷启动屏与内嵌加载占位（不改动网站 PWA 图标）。 */
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

  const colors = await getResolvedBrandColors();
  let splashBackground = await getResolvedLogoBackground();

  try {
    const body = (await req.json()) as { splashBackground?: unknown; logoBackground?: unknown };
    const raw = body.splashBackground ?? body.logoBackground;
    if (typeof raw === "string" && isValidHex6(raw)) {
      splashBackground = raw.trim().toUpperCase();
    }
  } catch {
    /* 无 body */
  }

  try {
    await regenerateSplashPack(colors.canvas, splashBackground);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const prev = await readBrandingState();
  const next: SiteBrandingState = {
    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
    originalName: prev?.originalName ?? "（尚未上传 LOGO）",
    logoKind: prev?.logoKind ?? "raster",
    presetId: prev?.presetId ?? "parchment",
    colors: prev?.colors ?? colors,
    logoBackground: splashBackground,
    ...(prev?.logoTextAccent ? { logoTextAccent: prev.logoTextAccent } : {}),
    ...(prev?.appIconsUpdatedAt ? { appIconsUpdatedAt: prev.appIconsUpdatedAt } : {}),
    ...(prev?.appIconOriginalName ? { appIconOriginalName: prev.appIconOriginalName } : {}),
  };
  await writeBrandingState(next);

  return NextResponse.json({
    ok: true,
    splashBackground,
    canvas: colors.canvas,
    splashUrl: "/branding/splash-icon.png",
  });
}
