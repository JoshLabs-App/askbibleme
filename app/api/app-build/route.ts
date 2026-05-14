import { NextResponse } from "next/server";
import { getAppBuildId } from "@/lib/app-build-id";

/**
 * 返回当前构建标识（与 `public/app-build.json`、`body[data-app-build]` 同源逻辑）。
 * 客户端优先请求 `/app-build.json`；此处保留作兼容回源。
 */
export async function GET() {
  return NextResponse.json(
    { id: getAppBuildId() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  );
}
