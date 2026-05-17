import { NextResponse } from "next/server";
import { readGoldenVersesSettings } from "@/lib/golden-verses/settings-file";

/** 前台金句页：只读拉取后台背景目录（与 admin 写入同源 JSON） */
export async function GET() {
  try {
    const settings = await readGoldenVersesSettings(process.cwd(), { syncDisk: true });
    return NextResponse.json(
      { backgrounds: settings.backgrounds },
      { headers: { "Cache-Control": "no-store, must-revalidate" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
