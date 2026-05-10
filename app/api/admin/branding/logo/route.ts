import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  assertSafeSvgText,
  regenerateBrandingIcons,
} from "@/lib/branding-generate-icons";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { normalizeBrandColors } from "@/lib/site-branding-colors";
import type { SiteBrandingState } from "@/lib/site-branding-colors";
import {
  BRANDING_PUBLIC_DIR,
  BRANDING_STATE_PATH,
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
 * 上传站点 LOGO（栅格或 SVG）→ 写入 `public/branding/` 并生成 PWA / Apple / favicon。
 * SVG 会保留 `logo.svg` 并以矢量为准栅格化；栅格上传会删除旧的 `logo.svg`。
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

  let form: FormData;
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
    await regenerateBrandingIcons(colors.canvas);

    const next: SiteBrandingState = {
      updatedAt: new Date().toISOString(),
      originalName: origName,
      logoKind: ext === ".svg" ? "svg" : "raster",
      presetId: prev?.presetId ?? "parchment",
      colors,
    };
    await fs.mkdir(path.dirname(BRANDING_STATE_PATH), { recursive: true });
    await writeBrandingState(next);
    saved = next;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    logoKind: ext === ".svg" ? "svg" : "raster",
    updatedAt: saved.updatedAt,
    originalName: saved.originalName,
    presetId: saved.presetId,
    colors: saved.colors,
    urls: {
      logo: "/branding/logo.png",
      icon192: "/branding/icon-192.png",
      icon512: "/branding/icon-512.png",
      appleTouch: "/branding/apple-touch-icon.png",
      favicon32: "/branding/favicon-32.png",
      ...(ext === ".svg" ? { vector: "/branding/logo.svg" as const } : {}),
    },
  });
}
