import { NextResponse } from "next/server";
import { mobileConfigR2RedirectForGet } from "@/lib/mobile-config-r2";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import {
  assertValidNatureSettingsForWrite,
  readNatureSettings,
  writeNatureSettings,
} from "@/lib/nature/nature-settings-store";

export async function GET() {
  /** 生产走 R2（见 lib/mobile-config-r2.ts）；dev 仍读本地，改内容立刻可见。POST 不受影响。 */
  const redirected = mobileConfigR2RedirectForGet("/api/nature/settings");
  if (redirected) return redirected;

  try {
    const data = await readNatureSettings(process.cwd());
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
    const data = assertValidNatureSettingsForWrite(body);
    await writeNatureSettings(process.cwd(), data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
