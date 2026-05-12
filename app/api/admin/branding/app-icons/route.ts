import { NextResponse } from "next/server";
import { writeAppIconMasterFromRaster } from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { normalizeBrandColors } from "@/lib/site-branding-colors";
import type { SiteBrandingState } from "@/lib/site-branding-colors";
import {
  readBrandingState,
  writeBrandingState,
} from "@/lib/site-branding";

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

/**
 * 上传**网站 / PWA 图标**母版（栅格）→ 写入 `app-icon.png` 并生成 favicon / Apple / PWA 尺寸。
 * 与顶栏 LOGO（`logo.svg` / `logo.png`）完全独立。
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

  let form: Awaited<ReturnType<Request["formData"]>>;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求体须为 multipart/form-data。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段。" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `文件过大（上限 ${Math.round(MAX_BYTES / 1024 / 1024)} MB）。` },
      { status: 400 },
    );
  }

  const origName = file.name || "app-icon";
  const ext = extFromName(origName);
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `图标母版须为栅格：${[...ALLOWED_EXT].join(" ")}（不支持 SVG）。` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const prev = await readBrandingState();
  const colors = normalizeBrandColors(prev?.colors);

  try {
    await writeAppIconMasterFromRaster(buf, colors.canvas);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const next: SiteBrandingState = {
    updatedAt: prev?.updatedAt ?? new Date().toISOString(),
    originalName: prev?.originalName ?? "（尚未上传 LOGO）",
    logoKind: prev?.logoKind ?? "raster",
    presetId: prev?.presetId ?? "parchment",
    colors,
    appIconsUpdatedAt: new Date().toISOString(),
    appIconOriginalName: origName,
  };
  await writeBrandingState(next);

  return NextResponse.json({
    ok: true,
    appIconsUpdatedAt: next.appIconsUpdatedAt,
    appIconOriginalName: next.appIconOriginalName,
    urls: {
      icon192: "/branding/icon-192.png",
      icon512: "/branding/icon-512.png",
      appleTouch: "/branding/apple-touch-icon.png",
      favicon32: "/branding/favicon-32.png",
    },
  });
}
