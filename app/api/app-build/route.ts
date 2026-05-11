import { NextResponse } from "next/server";
import { getAppBuildId } from "@/lib/app-build-id";

/**
 * 返回当前服务端构建标识；客户端与 `body[data-app-build]` 对比，判断是否有新部署。
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
