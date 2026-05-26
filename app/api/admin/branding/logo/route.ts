import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assertSafeSvgText, syncAppIconsFromBarLogo } from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { normalizeBrandColors } from "@/lib/site-branding-colors";
import type { SiteBrandingState } from "@/lib/site-branding-colors";
import {
  BRANDING_PUBLIC_DIR,
  BRANDING_STATE_PATH,
  brandingAssetsExist,
  readBrandingState,
  writeBrandingState,
} from "@/lib/site-branding";

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".svg"]);

function extFromName(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  if (i < 0) return "";
  return n.slice(i);
}

/**
 * 仅上传**顶栏 LOGO**（透明 SVG / 栅格）→ 写入 `logo.svg` 或 `logo.png`。
 * 不修改网站 / PWA 图标（见 `app-icon.png` 与 `/api/admin/branding/app-icons`）。
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

  const origName = file.name || "logo";
  const ext = extFromName(origName);
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `不支持的扩展名 ${ext || "（无）"}。允许：${[...ALLOWED_EXT].join(" ")}` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = BRANDING_PUBLIC_DIR;
  await fs.mkdir(dir, { recursive: true });

  const svgPath = path.join(dir, "logo.svg");
  const pngPath = path.join(dir, "logo.png");

  const prev = await readBrandingState();

  let saved: SiteBrandingState;
  try {
    if (ext === ".svg") {
      assertSafeSvgText(buf);
      await fs.unlink(pngPath).catch(() => {});
      await fs.writeFile(svgPath, buf);
    } else {
      await fs.unlink(svgPath).catch(() => {});
      await fs.writeFile(pngPath, buf);
    }

    const colors = normalizeBrandColors(prev?.colors);
    const next: SiteBrandingState = {
      updatedAt: new Date().toISOString(),
      originalName: origName,
      logoKind: ext === ".svg" ? "svg" : "raster",
      presetId: prev?.presetId ?? "parchment",
      colors,
      ...(prev?.logoBackground ? { logoBackground: prev.logoBackground } : {}),
      ...(prev?.logoTextAccent ? { logoTextAccent: prev.logoTextAccent } : {}),
      ...(prev?.appIconsUpdatedAt ? { appIconsUpdatedAt: prev.appIconsUpdatedAt } : {}),
      ...(prev?.appIconOriginalName ? { appIconOriginalName: prev.appIconOriginalName } : {}),
    };
    await fs.mkdir(path.dirname(BRANDING_STATE_PATH), { recursive: true });
    await writeBrandingState(next);

    try {
      await syncAppIconsFromBarLogo(colors.canvas);
      saved = {
        ...next,
        appIconsUpdatedAt: new Date().toISOString(),
        appIconOriginalName: `from-logo:${origName}`,
      };
      await writeBrandingState(saved);
    } catch (iconErr) {
      const hint = iconErr instanceof Error ? iconErr.message : String(iconErr);
      return NextResponse.json(
        {
          error: `顶栏 LOGO 已保存，但同步 App / iOS 图标失败：${hint}`,
        },
        { status: 500 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const iconsReady = await brandingAssetsExist();

  return NextResponse.json({
    ok: true,
    logoKind: ext === ".svg" ? "svg" : "raster",
    updatedAt: saved.updatedAt,
    appIconsUpdatedAt: saved.appIconsUpdatedAt,
    appIconOriginalName: saved.appIconOriginalName,
    originalName: saved.originalName,
    presetId: saved.presetId,
    colors: saved.colors,
    urls: {
      logo: "/branding/logo.png",
      ...(iconsReady
        ? {
            icon192: "/branding/icon-192.png",
            icon512: "/branding/icon-512.png",
            appleTouch: "/branding/apple-touch-icon.png",
            favicon32: "/branding/favicon-32.png",
          }
        : {}),
      ...(ext === ".svg" ? { vector: "/branding/logo.svg" as const } : {}),
    },
  });
}
