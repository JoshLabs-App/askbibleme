import type { NextRequest } from "next/server";
import { serveChapterAudioFile } from "@/lib/bible/serve-chapter-audio-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const segments = (await ctx.params).path ?? [];
  return serveChapterAudioFile(req, segments);
}

export async function HEAD(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const segments = (await ctx.params).path ?? [];
  const res = await serveChapterAudioFile(req, segments);
  return new Response(null, { status: res.status, headers: res.headers });
}
