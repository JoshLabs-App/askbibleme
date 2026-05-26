import { NextResponse } from "next/server";
import {
  infoEditionBatchGetResponse,
  infoEditionBatchPostResponse,
} from "@/lib/bible/info-edition-v1-batch-handlers";

export const dynamic = "force-dynamic";

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "仅开发环境可用。" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;
  return infoEditionBatchGetResponse(process.cwd());
}

export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  return infoEditionBatchPostResponse(process.cwd(), req);
}
