import { NextResponse } from "next/server";
import { buildManifestBody } from "@/lib/site-branding";

export const dynamic = "force-dynamic";

/**
 * 运行时 manifest：上传 LOGO 后图标路径切换到 `/branding/*`，无需整站重新构建。
 */
export async function GET() {
  const manifest = await buildManifestBody();
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
