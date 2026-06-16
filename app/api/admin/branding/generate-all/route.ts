import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  assertSafeSvgText,
  generateAllBrandAssets,
} from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  brandingAssetsExist,
  brandingLogoExists,
  brandingSplashExists,
  BRANDING_PUBLIC_DIR,
  readBrandingState,
  writeBrandingState,
} from "@/lib/site-branding";
import { readMultipartForm, type MultipartForm } from "@/lib/http/multipart-form";
import {
  DEFAULT_BRAND_COLORS,
  isValidHex6,
  normalizeBrandColors,
} from "@/lib/site-branding-colors";
import type { SiteBrandingState } from "@/lib/site-branding-colors";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * 上传透明 SVG + 设置底色 → 一键生成顶栏 LOGO、PWA / 安装图标、启动屏。
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

  let form: MultipartForm;
  try {
    form = await readMultipartForm(req);
  } catch {
    return NextResponse.json({ error: "请求体须为 multipart/form-data。" }, { status: 400 });
  }

  const bgRaw = form.get("logoBackground");
  if (typeof bgRaw !== "string" || !isValidHex6(bgRaw)) {
    return NextResponse.json({ error: "logoBackground 须为 #RRGGBB。" }, { status: 400 });
  }
  const logoBackground = bgRaw.trim().toUpperCase();
  const textAccentRaw = form.get("logoTextAccent");
  if (typeof textAccentRaw !== "string" || !isValidHex6(textAccentRaw)) {
    return NextResponse.json({ error: "logoTextAccent 须为 #RRGGBB。" }, { status: 400 });
  }
  const logoTextAccent = textAccentRaw.trim().toUpperCase();

  const file = form.get("file");
  const prev = await readBrandingState();
  const colors = normalizeBrandColors(prev?.colors ?? DEFAULT_BRAND_COLORS);
  const brandCanvas = colors.canvas;

  const dir = BRANDING_PUBLIC_DIR;
  await fs.mkdir(dir, { recursive: true });
  const svgPath = path.join(dir, "logo.svg");
  const pngPath = path.join(dir, "logo.png");

  let originalName = prev?.originalName ?? "logo.svg";

  if (file && file instanceof File) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `文件过大（上限 ${Math.round(MAX_BYTES / 1024 / 1024)} MB）。` },
        { status: 400 },
      );
    }
    const name = file.name || "logo.svg";
    if (!name.toLowerCase().endsWith(".svg")) {
      return NextResponse.json({ error: "请上传 SVG 文件（透明底、仅白色图形）。" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      assertSafeSvgText(buf);
      await fs.unlink(pngPath).catch(() => {});
      await fs.writeFile(svgPath, buf);
      originalName = name;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else if (!(await brandingLogoExists())) {
    return NextResponse.json({ error: "请先上传 LOGO（SVG）。" }, { status: 400 });
  }

  const baseState: SiteBrandingState = {
    updatedAt: new Date().toISOString(),
    originalName,
    logoKind: "svg",
    presetId: prev?.presetId ?? "parchment",
    colors,
    logoBackground,
    logoTextAccent,
  };

  try {
    await writeBrandingState(baseState);
    const gen = await generateAllBrandAssets(logoBackground, brandCanvas);
    const saved: SiteBrandingState = {
      ...baseState,
      appIconsUpdatedAt: new Date().toISOString(),
      appIconOriginalName: `from-logo:${originalName}`,
    };
    await writeBrandingState(saved);

    const iconsReady = await brandingAssetsExist();
    const splashReady = await brandingSplashExists();

    return NextResponse.json({
      ok: true,
      logoBackground,
      logoTextAccent,
      iconBackground: gen.iconBackground,
      brandCanvas: gen.brandCanvas,
      updatedAt: saved.updatedAt,
      appIconsUpdatedAt: saved.appIconsUpdatedAt,
      logoKind: "svg" as const,
      originalName: saved.originalName,
      iconsReady,
      splashReady,
      urls: {
        vector: "/branding/logo.svg" as const,
        ...(await fs
          .access(path.join(dir, "logo.png"))
          .then(() => ({ logo: "/branding/logo.png" as const }))
          .catch(() => ({}))),
        ...(iconsReady
          ? {
              icon192: "/branding/icon-192.png",
              icon512: "/branding/icon-512.png",
              appleTouch: "/branding/apple-touch-icon.png",
              favicon32: "/branding/favicon-32.png",
            }
          : {}),
        ...(splashReady ? { splash: "/branding/splash-icon.png" as const } : {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
