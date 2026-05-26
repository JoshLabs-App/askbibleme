import { NextResponse } from "next/server";
import { regenerateSplashPack } from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  canRegenerateBrandedAppIcons,
  getResolvedLogoBackground,
  readBrandingState,
  writeBrandingState,
} from "@/lib/site-branding";
import {
  DEFAULT_BRAND_COLORS,
  isValidHex6,
  normalizeBrandColors,
} from "@/lib/site-branding-colors";
import type { SiteBrandingState } from "@/lib/site-branding-colors";

/** 保存顶栏 LOGO 方块底色（与品牌 `canvas` / 图标母版底色独立）。 */
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体需为 JSON。" }, { status: 400 });
  }

  const raw = (body as { logoBackground?: unknown }).logoBackground;
  if (typeof raw !== "string" || !isValidHex6(raw)) {
    return NextResponse.json({ error: "logoBackground 须为 #RRGGBB 格式。" }, { status: 400 });
  }
  const logoBackground = raw.trim().toUpperCase();

  const prev = await readBrandingState();
  const next: SiteBrandingState = {
    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
    originalName: prev?.originalName ?? "（尚未上传 LOGO）",
    logoKind: prev?.logoKind ?? "raster",
    presetId: prev?.presetId ?? "parchment",
    colors: normalizeBrandColors(prev?.colors ?? DEFAULT_BRAND_COLORS),
    logoBackground,
    ...(prev?.logoTextAccent ? { logoTextAccent: prev.logoTextAccent } : {}),
    ...(prev?.appIconsUpdatedAt ? { appIconsUpdatedAt: prev.appIconsUpdatedAt } : {}),
    ...(prev?.appIconOriginalName ? { appIconOriginalName: prev.appIconOriginalName } : {}),
  };

  try {
    await writeBrandingState(next);
    if (await canRegenerateBrandedAppIcons()) {
      const colors = normalizeBrandColors(next.colors);
      await regenerateSplashPack(colors.canvas, logoBackground);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    logoBackground: await getResolvedLogoBackground(),
    splashSynced: await canRegenerateBrandedAppIcons(),
    splashUrl: "/branding/splash-icon.png",
  });
}
