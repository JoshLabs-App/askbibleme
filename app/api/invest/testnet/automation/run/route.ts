import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runTestnetAutoTrader } from "@/lib/invest/testnet-auto-trader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(request: NextRequest) {
  const configured = process.env.INVEST_AUTOTRADE_CRON_SECRET?.trim();
  const received = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!configured || !received) return false;
  const expectedBuffer = Buffer.from(configured);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  const result = await runTestnetAutoTrader();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
