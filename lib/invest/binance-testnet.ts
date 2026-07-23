import "server-only";

import {
  publicRequest,
  readCredentials,
  isTestnetAutoConfigured,
  signedRequest,
  type BinanceAccount,
  type BinanceOrder,
  type BinanceTrade,
  BinanceTestnetError,
} from "@/lib/invest/binance-testnet-client";
import {
  buildInvestModel,
  type BinanceBalance,
  type InvestModel,
} from "@/lib/invest/binance-testnet-model";
import {
  readTestnetAutoState,
  type AutoDecision,
} from "@/lib/invest/testnet-auto-state";
import { TESTNET_STRATEGY } from "@/lib/invest/testnet-strategy";

type ReadySnapshot = InvestModel & {
  status: "ready";
  virtual: true;
  liveTradingEnabled: false;
  testnetAutoTradingEnabled: boolean;
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
    evaluationIntervalMinutes: number;
    rules: typeof TESTNET_STRATEGY.rules;
  };
  automation: {
    configured: boolean;
    paused: boolean;
    pauseReason: string | null;
    lastRunAt: string | null;
    nextRunAt: string;
    lastError: string | null;
  };
  decision: {
    action: AutoDecision["action"];
    state: string;
    rationale: string;
    nextAction: string;
    nextTrigger: string;
    metrics?: AutoDecision["metrics"];
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
      testnetAutoTradingEnabled: false;
      message: string;
      refreshedAt: string;
    };

function fallbackDecision(model: InvestModel, configured: boolean) {
  const position = model.positions[0];
  if (!configured) {
    return {
      action: "PAUSED" as const,
      state: "自动执行尚未接通",
      rationale: "当前只读取测试网数据，服务器交易执行器尚未启用。",
      nextAction: "配置测试网交易密钥和定时执行器后才会自动下单。",
      nextTrigger: "真实账户始终保持关闭。",
    };
  }
  if (!position) {
    return {
      action: "HOLD" as const,
      state: "等待趋势信号",
      rationale: "当前没有策略持仓，自动执行器会按 1 小时趋势规则检查。",
      nextAction: "条件满足时自动买入不超过 200 USDT，并立即建立保护单。",
      nextTrigger: TESTNET_STRATEGY.rules.entrySignal,
    };
  }
  if (!position.protectionActive) {
    return {
      action: "PAUSED" as const,
      state: "需要检查保护单",
      rationale: "当前仓位存在，但止损或止盈保护单未完整处于挂单状态。",
      nextAction: "暂停新增仓位，优先检查测试网保护单。",
      nextTrigger: "保护恢复并人工解除暂停后再继续。",
    };
  }
  return {
    action: "PROTECTED" as const,
    state: "持有并受保护",
    rationale: `BTC 虚拟仓位约占初始资金 ${(
      (position.costUsdt / TESTNET_STRATEGY.startingCapitalUsdt) *
      100
    ).toFixed(2)}%，止损和止盈单均有效。`,
    nextAction: "自动持有，本轮不加仓；保护单成交后再等待下一次趋势信号。",
    nextTrigger: `重点观察 ${position.stopTriggerPrice.toLocaleString(
      "en-CA",
    )} USDT 止损线与 ${position.takeProfitPrice.toLocaleString(
      "en-CA",
    )} USDT 止盈线。`,
  };
}

export async function getInvestTestnetSnapshot(): Promise<InvestTestnetSnapshot> {
  const refreshedAt = new Date();
  const credentials = readCredentials();
  if (!credentials) {
    return {
      status: "unconfigured",
      virtual: true,
      liveTradingEnabled: false,
      testnetAutoTradingEnabled: false,
      message: "测试网读取凭证尚未接入云端",
      refreshedAt: refreshedAt.toISOString(),
    };
  }

  try {
    const autoState = await readTestnetAutoState();
    const configured = isTestnetAutoConfigured();
    const symbols = [
      ...new Set(
        autoState.managedPositions
          .map((position) => position.symbol)
          .concat([...TESTNET_STRATEGY.rules.allowedSymbols]),
      ),
    ];
    const [account, ...perSymbol] = await Promise.all([
      signedRequest<BinanceAccount>(
        credentials,
        "GET",
        "/api/v3/account",
        { omitZeroBalances: "true" },
      ),
      ...symbols.flatMap((symbol) => [
        signedRequest<BinanceTrade[]>(
          credentials,
          "GET",
          "/api/v3/myTrades",
          { symbol, limit: "1000" },
        ),
        signedRequest<BinanceOrder[]>(
          credentials,
          "GET",
          "/api/v3/allOrders",
          { symbol, limit: "1000" },
        ),
        publicRequest<{ symbol: string; price: string }>(
          "/api/v3/ticker/price",
          { symbol },
        ),
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

    const model = buildInvestModel({
      trades,
      orders,
      prices,
      managedPositions: autoState.managedPositions,
    });
    const visibleAssets = new Set([
      "USDT",
      ...symbols.map((symbol) => symbol.replace(/USDT$/, "")),
    ]);
    const balances = (account.balances ?? []).filter((balance) =>
      visibleAssets.has(balance.asset),
    );
    const fallbackNextRun = new Date(
      refreshedAt.getTime() +
        TESTNET_STRATEGY.evaluationIntervalMinutes * 60 * 1_000,
    ).toISOString();
    const nextRunAt = autoState.nextRunAt ?? fallbackNextRun;
    const latestDecision =
      autoState.lastDecision ?? fallbackDecision(model, configured);

    return {
      status: "ready",
      virtual: true,
      liveTradingEnabled: false,
      testnetAutoTradingEnabled: configured && !autoState.paused,
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
        evaluationIntervalMinutes:
          TESTNET_STRATEGY.evaluationIntervalMinutes,
        rules: TESTNET_STRATEGY.rules,
      },
      automation: {
        configured,
        paused: autoState.paused,
        pauseReason: autoState.pauseReason,
        lastRunAt: autoState.lastRunAt,
        nextRunAt,
        lastError: autoState.lastError,
      },
      decision: latestDecision,
      refreshedAt: refreshedAt.toISOString(),
      nextCheckAt: nextRunAt,
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
      testnetAutoTradingEnabled: false,
      message,
      refreshedAt: refreshedAt.toISOString(),
    };
  }
}
