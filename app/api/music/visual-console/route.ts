import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  defaultVisualConsoleBundle,
  parseVisualConsoleBundle,
  readMusicVisualConsoleBundle,
  writeMusicVisualConsoleBundle,
} from "@/lib/music-visual/visual-console-file";

/** 读取 `data/music-visual-console.json`（无文件时返回默认 bundle，便于前台 bootstrap） */
export async function GET() {
  try {
    const cwd = process.cwd();
    const bundle = (await readMusicVisualConsoleBundle(cwd)) ?? defaultVisualConsoleBundle();
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 写入 `data/music-visual-console.json`；权限与 companion 写盘一致 */
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
  try {
    const bundle = parseVisualConsoleBundle(body);
    await writeMusicVisualConsoleBundle(process.cwd(), bundle);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
