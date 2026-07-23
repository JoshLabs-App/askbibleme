import { NextResponse } from "next/server";
import { getInvestAccessState } from "@/lib/invest-access";
import { getInvestTestnetSnapshot } from "@/lib/invest/binance-testnet";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

export async function GET() {
  const access = await getInvestAccessState();
  if (access.status !== "authorized") {
    const status =
      access.status === "unauthenticated"
        ? 401
        : access.status === "forbidden"
          ? 403
          : 503;
    return NextResponse.json(
      { error: "无权读取私人测试网数据" },
      { status, headers: NO_STORE },
    );
  }

  const snapshot = await getInvestTestnetSnapshot();
  return NextResponse.json(snapshot, { headers: NO_STORE });
}
