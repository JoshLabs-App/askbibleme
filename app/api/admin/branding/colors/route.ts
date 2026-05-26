import { NextResponse } from "next/server";
import { regenerateBrandingIcons } from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  canRegenerateBrandedAppIcons,
  readBrandingState,
  resolveColorsFromPreset,
  writeBrandingState,
} from "@/lib/site-branding";
import {
  BRAND_PRESET_ORDER,
  coerceBrandPresetId,
  LEGACY_BRAND_PRESET_IDS,
  type BrandColors,
  type BrandPresetId,
  type SiteBrandingState,
} from "@/lib/site-branding-colors";

function isValidPresetInput(raw: string): boolean {
  if (raw === "custom") return true;
  if ((BRAND_PRESET_ORDER as readonly string[]).includes(raw)) return true;
  if (raw in LEGACY_BRAND_PRESET_IDS) return true;
  return false;
}

/**
 * 保存品牌配色预设或自定义色值；若已生成过图标则用当前 canvas 底色重新栅格化一遍。
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体需为 JSON。" }, { status: 400 });
  }

  const rawPresetId = (body as { presetId?: unknown }).presetId;
  if (typeof rawPresetId !== "string" || !isValidPresetInput(rawPresetId)) {
    return NextResponse.json({ error: "无效 presetId。" }, { status: 400 });
  }
  const presetId = coerceBrandPresetId(rawPresetId);

  const customRaw = (body as { colors?: unknown }).colors;
  const custom =
    presetId === "custom" && customRaw && typeof customRaw === "object" && !Array.isArray(customRaw)
      ? (customRaw as Partial<BrandColors>)
      : undefined;

  const colors = resolveColorsFromPreset(presetId, custom);
  const prev = await readBrandingState();

  const next: SiteBrandingState = {
    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
    originalName: prev?.originalName ?? "（尚未上传 LOGO）",
    logoKind: prev?.logoKind ?? ("raster" as const),
    presetId,
    colors,
    ...(prev?.logoBackground ? { logoBackground: prev.logoBackground } : {}),
    ...(prev?.logoTextAccent ? { logoTextAccent: prev.logoTextAccent } : {}),
    ...(prev?.appIconsUpdatedAt ? { appIconsUpdatedAt: prev.appIconsUpdatedAt } : {}),
    ...(prev?.appIconOriginalName ? { appIconOriginalName: prev.appIconOriginalName } : {}),
  };

  try {
    await writeBrandingState(next);
    if (await canRegenerateBrandedAppIcons()) {
      await regenerateBrandingIcons(colors.canvas);
      const bumped: SiteBrandingState = {
        ...next,
        appIconsUpdatedAt: new Date().toISOString(),
        appIconOriginalName: prev?.appIconOriginalName ?? next.appIconOriginalName,
      };
      await writeBrandingState(bumped);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, presetId: next.presetId, colors: next.colors });
}
