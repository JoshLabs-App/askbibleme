import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** 电视自动上报：浏览器版本、屏幕、全屏结果、播放异常。只写日志（Vercel Runtime Logs 里搜 [tv-report]），不落库。 */
export async function POST(req: Request) {
  try {
    const text = (await req.text()).slice(0, 4000);
    console.log("[tv-report]", text);
  } catch {
    /* ignore */
  }
  return new NextResponse(null, { status: 204 });
}
