import { NextResponse } from "next/server";

/**
 * 供线上负载均衡 / PaaS HTTP 探活（勿依赖首页 RSC：冷启动或大页面易 >5s）。
 * 在部署面板将 health check path 设为 `/api/health`（或同时放宽 startup grace / timeout）。
 */
export const dynamic = "force-dynamic";

const okHeaders = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store, max-age=0, must-revalidate",
} as const;

export function GET() {
  return new NextResponse("ok", { status: 200, headers: okHeaders });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: okHeaders });
}
