import "server-only";

import { createHmac } from "node:crypto";
import {
  buildInvestModel,
  type BinanceBalance,
  type BinanceOrder,
  type BinanceTrade,
  type InvestModel,
} from "@/lib/invest/binance-testnet-model";
import { TESTNET_STRATEGY } from "@/lib/invest/testnet-strategy";

const BINANCE_TESTNET_ORIGIN = "https://testnet.binance.vision";
const REQUEST_TIMEOUT_MS = 8_000;

type BinanceAccount = {
  accountType?: string;
  canTrade?: boolean;
  permissions?: string[];
  balances?: BinanceBalance[];
};

type ReadySnapshot = InvestModel & {
  status: "ready";
  virtual: true;
  liveTradingEnabled: false;
  account: {
    type: string;
    canTrade: boolean;
    permissions: string[];
    balances: BinanceBalance[];
  };
  strategy: {
    name: string;
    startedAt: string;
    targetCapitalUsdt: number;
    targetIsGuaranteed: false;
    refreshIntervalSeconds: number;
    rules: typeof TESTNET_STRATEGY.rules;
  };
  decision: {
    state: string;
    rationale: string;
    nextAction: string;
    nextTrigger: string;
  };
  refreshedAt: string;
  nextCheckAt: string;
};

export type InvestTestnetSnapshot =
  | ReadySnapshot
  | {
      status: "unconfigured" | "error";
      virtual: true;
      liveTradingEnabled: false;
      message: string;
      refreshedAt: string;
    };

class BinanceTestnetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BinanceTestnetError";
  }
}

function credentials() {
  const apiKey = process.env.BINANCE_TESTNET_API_KEY?.trim();
  const secretKey = process.env.BINANCE_TESTNET_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BinanceTestnetError("Binance 测试网返回了无法识别的数据");
  }
  if (!response.ok) {
    const code =
      typeof payload === "object" && payload && "code" in payload
        ? String(payload.code)
        : "";
    if (code === "-1021") {
      throw new BinanceTestnetError("测试网时间校验失败，请稍后刷新");
    }
    if (code === "-2014" || code === "-2015" || code === "-1022") {
      throw new BinanceTestnetError("测试网只读凭证无效或权限不足");
    }
    throw new BinanceTestnetError("Binance Spot Testnet 暂时无法读取");
  }
  return payload as T;
}

async function publicGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(path, BINANCE_TESTNET_ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": "AskBible-Private-Invest/1.0" },
  });
  return parseResponse<T>(response);
}

async function signedGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const auth = credentials();
  if (!auth) throw new BinanceTestnetError("测试网凭证尚未接入云端");

  const serverTime = await publicGet<{ serverTime: number }>("/api/v3/time");
  const query = new URLSearchParams({
    ...params,
    recvWindow: "5000",
    timestamp: String(serverTime.serverTime),
  });
  const signature = createHmac("sha256", auth.secretKey)
    .update(query.toString())
    .digest("hex");
  query.set("signature", signature);

  const url = new URL(path, BINANCE_TESTNET_ORIGIN);
  url.search = query.toString();
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "User-Agent": "AskBible-Private-Invest/1.0",
      "X-MBX-APIKEY": auth.apiKey,
    },
  });
  return parseResponse<T>(response);
}

function decisionFor(model: InvestModel) {
  const position = model.positions[0];
  if (!position) {
    return {
      state: "等待信号",
      rationale: "当前没有由本策略管理的持仓，保持现金，不追涨。",
      nextAction: "继续观察 BTC 与 ETH；没有新的人工确认，不新增虚拟订单。",
      nextTrigger: "仅在风险规则满足并获得确认后才会测试新订单。",
    };
  }

  if (!position.protectionActive) {
    return {
      state: "需要检查保护单",
      rationale: "当前仓位存在，但止损或止盈保护单未完整处于挂单状态。",
      nextAction: "暂停新增仓位，优先人工检查测试网保护单。",
      nextTrigger: "保护单恢复有效后，再继续观察。",
    };
  }

  return {
    state: "持有并受保护",
    rationale: `BTC 虚拟仓位约占初始资金 ${(
      (position.costUsdt / TESTNET_STRATEGY.startingCapitalUsdt) *
      100
    ).toFixed(2)}%，止损和止盈单均有效；当前不加仓。`,
    nextAction: "保持保护单，不自动交易；页面每 60 秒重新读取价格和订单状态。",
    nextTrigger: `重点观察 ${position.stopTriggerPrice.toLocaleString(
      "en-CA",
    )} USDT 止损线与 ${position.takeProfitPrice.toLocaleString(
      "en-CA",
    )} USDT 止盈线。`,
  };
}

export async function getInvestTestnetSnapshot(): Promise<InvestTestnetSnapshot> {
  const refreshedAt = new Date();
  if (!credentials()) {
    return {
      status: "unconfigured",
      virtual: true,
      liveTradingEnabled: false,
      message: "测试网凭证尚未接入云端",
      refreshedAt: refreshedAt.toISOString(),
    };
  }

  try {
    const symbols = TESTNET_STRATEGY.managedPositions.map(
      (position) => position.symbol,
    );
    const [account, ...perSymbol] = await Promise.all([
      signedGet<BinanceAccount>("/api/v3/account", {
        omitZeroBalances: "true",
      }),
      ...symbols.flatMap((symbol) => [
        signedGet<BinanceTrade[]>("/api/v3/myTrades", {
          symbol,
          limit: "1000",
        }),
        signedGet<BinanceOrder[]>("/api/v3/allOrders", {
          symbol,
          limit: "1000",
        }),
        publicGet<{ symbol: string; price: string }>("/api/v3/ticker/price", {
          symbol,
        }),
      ]),
    ]);

    const trades: BinanceTrade[] = [];
    const orders: BinanceOrder[] = [];
    const prices: Record<string, number> = {};
    symbols.forEach((symbol, index) => {
      const offset = index * 3;
      trades.push(...((perSymbol[offset] as BinanceTrade[]) ?? []));
      orders.push(...((perSymbol[offset + 1] as BinanceOrder[]) ?? []));
      const ticker = perSymbol[offset + 2] as {
        symbol?: string;
        price?: string;
      };
      prices[symbol] = Number(ticker?.price ?? 0);
    });

    const model = buildInvestModel({ trades, orders, prices });
    const visibleAssets = new Set([
      "USDT",
      ...symbols.map((symbol) => symbol.replace(/USDT$/, "")),
    ]);
    const balances = (account.balances ?? []).filter((balance) =>
      visibleAssets.has(balance.asset),
    );
    const nextCheckAt = new Date(
      refreshedAt.getTime() +
        TESTNET_STRATEGY.refreshIntervalSeconds * 1_000,
    );

    return {
      status: "ready",
      virtual: true,
      liveTradingEnabled: false,
      ...model,
      account: {
        type: account.accountType ?? "SPOT",
        canTrade: Boolean(account.canTrade),
        permissions: account.permissions ?? [],
        balances,
      },
      strategy: {
        name: TESTNET_STRATEGY.name,
        startedAt: TESTNET_STRATEGY.startedAt,
        targetCapitalUsdt: TESTNET_STRATEGY.targetCapitalUsdt,
        targetIsGuaranteed: false,
        refreshIntervalSeconds: TESTNET_STRATEGY.refreshIntervalSeconds,
        rules: TESTNET_STRATEGY.rules,
      },
      decision: decisionFor(model),
      refreshedAt: refreshedAt.toISOString(),
      nextCheckAt: nextCheckAt.toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof BinanceTestnetError
        ? error.message
        : "暂时无法读取 Binance Spot Testnet";
    return {
      status: "error",
      virtual: true,
      liveTradingEnabled: false,
      message,
      refreshedAt: refreshedAt.toISOString(),
    };
  }
}
