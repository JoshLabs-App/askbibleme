import { NextResponse } from "next/server";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";
import { mergeMusicCompanionTrackDisplay } from "@/lib/music-companion/merge-track-display";
import { filterPublicMusicCompanionStore } from "@/lib/music-companion/public-store";
import {
  parseAndValidateMusicStore,
  readMusicCompanionStore,
  writeMusicCompanionStore,
} from "@/lib/music-companion/store-file";
import { shippedMusicCompanionStore } from "@/lib/music-companion/shipped-store";
import type { MusicCompanionStore } from "@/lib/music-companion/types";

/** 公开读取音乐陪伴配置（前台首页与后台编辑用） */
export async function GET(req: Request) {
  try {
    const includeHidden = new URL(req.url).searchParams.get("includeHidden") === "1";
    const store = mergeMusicCompanionTrackDisplay(
      await readMusicCompanionStore(process.cwd()),
      shippedMusicCompanionStore,
    );
    const payload: MusicCompanionStore = includeHidden ? store : filterPublicMusicCompanionStore(store);
    return NextResponse.json(payload, {
      headers: {
        /** 曲库 JSON 很小；短私缓存减轻重复请求 */
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 写入 `data/music-companion.json`。
 * 权限与 Studio 写磁盘一致：开发默认可写；生产需 STUDIO_ALLOW_DISK_SAVE + Bearer。
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
  try {
    const store = parseAndValidateMusicStore(body);
    await writeMusicCompanionStore(process.cwd(), store);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
