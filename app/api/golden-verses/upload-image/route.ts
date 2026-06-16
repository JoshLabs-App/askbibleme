import { NextResponse } from "next/server";
import { saveGoldenVerseBackgroundFile } from "@/lib/golden-verses/background-uploads";
import { addGoldenVerseBackground } from "@/lib/golden-verses/settings-file";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { readMultipartForm, type MultipartForm } from "@/lib/http/multipart-form";

/**
 * 金句页背景图 → `public/golden-verses/bg-uploads/`，追加到 `data/golden-verses-settings.json` 目录。
 * 推荐在后台「金句页背景」集中管理；本路由保留供脚本或旧入口调用。
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

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段。" }, { status: 400 });
  }

  const cwd = process.cwd();
  try {
    const saved = await saveGoldenVerseBackgroundFile(cwd, file);
    const item = { ...saved, addedAt: new Date().toISOString() };
    await addGoldenVerseBackground(cwd, item);
    return NextResponse.json({
      ok: true,
      url: saved.url,
      filename: saved.filename,
      id: saved.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("过大") || msg.includes("扩展名") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
