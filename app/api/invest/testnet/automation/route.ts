import { NextRequest, NextResponse } from "next/server";
import { resolvePublicAuthOrigin } from "@/lib/auth/public-auth-origin";
import { getInvestAccessState } from "@/lib/invest-access";
import { getInvestTestnetSnapshot } from "@/lib/invest/binance-testnet";
import {
  readTestnetAutoState,
  setTestnetAutoPaused,
} from "@/lib/invest/testnet-auto-state";
import { runTestnetAutoTrader } from "@/lib/invest/testnet-auto-trader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === resolvePublicAuthOrigin(request);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const access = await getInvestAccessState();
  if (access.status !== "authorized" || !sameOrigin(request)) {
    return NextResponse.json(
      { error: "无权修改私人测试网自动策略" },
      { status: access.status === "unauthenticated" ? 401 : 403, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;
  const action = body?.action;
  if (!["pause", "resume", "run"].includes(String(action))) {
    return NextResponse.json(
      { error: "无法识别的自动策略操作" },
      { status: 400, headers: NO_STORE },
    );
  }

  if (action === "pause") {
    await setTestnetAutoPaused(true, "由私人控制台暂停");
  } else if (action === "resume") {
    const current = await readTestnetAutoState();
    if (current.lastError?.includes("紧急退出均失败")) {
      return NextResponse.json(
        { error: "当前存在未解除的安全锁，不能直接恢复" },
        { status: 409, headers: NO_STORE },
      );
    }
    await setTestnetAutoPaused(false, null);
  } else {
    await runTestnetAutoTrader({ force: true });
  }

  const snapshot = await getInvestTestnetSnapshot();
  return NextResponse.json(snapshot, { headers: NO_STORE });
}
