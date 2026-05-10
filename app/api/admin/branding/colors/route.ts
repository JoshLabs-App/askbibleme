import { NextResponse } from "next/server";
import { regenerateBrandingIcons } from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  brandingAssetsExist,
  readBrandingState,
  resolveColorsFromPreset,
  writeBrandingState,
} from "@/lib/site-branding";
import type { BrandColors, BrandPresetId, SiteBrandingState } from "@/lib/site-branding-colors";

const VALID_PRESET = new Set<BrandPresetId>([
  "parchment",
  "mist",
  "dusk",
  "forest",
  "custom",
]);

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

  const presetId = (body as { presetId?: unknown }).presetId;
  if (typeof presetId !== "string" || !VALID_PRESET.has(presetId as BrandPresetId)) {
    return NextResponse.json({ error: "无效 presetId。" }, { status: 400 });
  }

  const customRaw = (body as { colors?: unknown }).colors;
  const custom =
    presetId === "custom" && customRaw && typeof customRaw === "object" && !Array.isArray(customRaw)
      ? (customRaw as Partial<BrandColors>)
      : undefined;

  const colors = resolveColorsFromPreset(presetId as BrandPresetId, custom);
  const prev = await readBrandingState();

  const next: SiteBrandingState = {
    updatedAt: new Date().toISOString(),
    originalName: prev?.originalName ?? "（尚未上传 LOGO）",
    logoKind: prev?.logoKind ?? ("raster" as const),
    presetId: presetId as BrandPresetId,
    colors,
  };

  try {
    await writeBrandingState(next);
    if (await brandingAssetsExist()) {
      await regenerateBrandingIcons(colors.canvas);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, presetId: next.presetId, colors: next.colors });
}
