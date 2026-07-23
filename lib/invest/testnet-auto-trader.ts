import "server-only";

import {
  BinanceTestnetError,
  findOrderByClientId,
  findOrderListByClientId,
  isTestnetAutoConfigured,
  publicRequest,
  signedRequest,
  tradeCredentials,
  type BinanceAccount,
  type BinanceKline,
  type BinanceOrderListResponse,
  type BinanceOrderResponse,
  type BinanceTrade,
} from "@/lib/invest/binance-testnet-client";
import { getInvestTestnetSnapshot } from "@/lib/invest/binance-testnet";
import {
  readTestnetAutoState,
  withTestnetAutoStateLock,
  writeTestnetAutoState,
  type AutoDecision,
  type PendingAutoEntry,
  type TestnetAutoState,
} from "@/lib/invest/testnet-auto-state";
import {
  evaluateTrendSignal,
  type SignalMetrics,
} from "@/lib/invest/testnet-signal";
import { TESTNET_STRATEGY } from "@/lib/invest/testnet-strategy";

type SymbolFilter = {
  filterType?: string;
  minPrice?: string;
  tickSize?: string;
  minQty?: string;
  stepSize?: string;
  minNotional?: string;
};

type ExchangeInfo = {
  symbols?: Array<{
    symbol?: string;
    status?: string;
    quoteOrderQtyMarketAllowed?: boolean;
    filters?: SymbolFilter[];
  }>;
};

let activeRun: Promise<AutoRunResult> | null = null;

export type AutoRunResult = {
  ok: boolean;
  executed: boolean;
  decision: AutoDecision;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function floorToStep(value: number, step: number) {
  if (!step) return value;
  const precision = Math.max(0, (step.toString().split(".")[1] ?? "").length);
  return Number((Math.floor(value / step) * step).toFixed(precision));
}

function floorToTick(value: number, tick: number) {
  return floorToStep(value, tick);
}

function compactBucket(date = new Date()) {
  const bucketMs =
    TESTNET_STRATEGY.evaluationIntervalMinutes * 60 * 1_000;
  return Math.floor(date.getTime() / bucketMs).toString(36);
}

function nextRunIso(date = new Date()) {
  return new Date(
    date.getTime() +
      TESTNET_STRATEGY.evaluationIntervalMinutes * 60 * 1_000,
  ).toISOString();
}

function decision(
  action: AutoDecision["action"],
  state: string,
  rationale: string,
  nextAction: string,
  nextTrigger: string,
  metrics?: SignalMetrics,
): AutoDecision {
  return {
    action,
    state,
    rationale,
    nextAction,
    nextTrigger,
    evaluatedAt: new Date().toISOString(),
    metrics: metrics
      ? {
          price: metrics.price,
          sma20: metrics.sma20,
          sma50: metrics.sma50,
          rsi14: metrics.rsi14,
        }
      : undefined,
  };
}

async function finish(
  state: TestnetAutoState,
  result: AutoDecision,
  executed = false,
): Promise<AutoRunResult> {
  state.lastRunAt = result.evaluatedAt;
  state.nextRunAt = nextRunIso(new Date(result.evaluatedAt));
  state.lastDecision = result;
  state.lastError = result.action === "ERROR" ? result.rationale : null;
  await writeTestnetAutoState(state);
  return { ok: result.action !== "ERROR", executed, decision: result };
}

async function getSignal() {
  const klines = await publicRequest<BinanceKline[]>("/api/v3/klines", {
    symbol: "BTCUSDT",
    interval: "1h",
    limit: "61",
  });
  const closedKlines = klines.slice(0, -1);
  return evaluateTrendSignal(
    closedKlines.map((item) => Number(item[4])).filter(Number.isFinite),
  );
}

function utcDayStart() {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
}

function latestSellAt(trades: Array<{ side: string; time: number }>) {
  return Math.max(
    0,
    ...trades
      .filter((trade) => trade.side === "SELL")
      .map((trade) => trade.time),
  );
}

function entriesToday(orders: Array<{ side: string; type: string; time: number }>) {
  const dayStart = utcDayStart();
  return orders.filter(
    (order) =>
      order.side === "BUY" &&
      order.type === "MARKET" &&
      order.time >= dayStart,
  ).length;
}

async function symbolRules(symbol: string) {
  const info = await publicRequest<ExchangeInfo>("/api/v3/exchangeInfo", {
    symbol,
  });
  const item = info.symbols?.find((candidate) => candidate.symbol === symbol);
  if (!item || item.status !== "TRADING") {
    throw new Error(`${symbol} 当前不可交易`);
  }
  const filters = item.filters ?? [];
  const lot = filters.find((filter) => filter.filterType === "LOT_SIZE");
  const price = filters.find((filter) => filter.filterType === "PRICE_FILTER");
  const notional =
    filters.find((filter) => filter.filterType === "NOTIONAL") ??
    filters.find((filter) => filter.filterType === "MIN_NOTIONAL");
  return {
    stepSize: Number(lot?.stepSize ?? 0),
    minQty: Number(lot?.minQty ?? 0),
    tickSize: Number(price?.tickSize ?? 0),
    minNotional: Number(notional?.minNotional ?? 0),
    quoteOrderQtyMarketAllowed: item.quoteOrderQtyMarketAllowed !== false,
  };
}

async function netBoughtQuantity(
  credentials: NonNullable<ReturnType<typeof tradeCredentials>>,
  symbol: string,
  order: BinanceOrderResponse,
) {
  const baseAsset = symbol.replace(/USDT$/, "");
  const fills = order.fills ?? [];
  if (fills.length) {
    return fills.reduce((total, fill) => {
      const quantity = Number(fill.qty ?? 0);
      const commission =
        fill.commissionAsset === baseAsset ? Number(fill.commission ?? 0) : 0;
      return total + quantity - commission;
    }, 0);
  }
  const trades = await signedRequest<BinanceTrade[]>(
    credentials,
    "GET",
    "/api/v3/myTrades",
    { symbol, orderId: String(order.orderId ?? "") },
  );
  return trades.reduce((total, trade) => {
    const quantity = Number(trade.qty ?? 0);
    const commission =
      trade.commissionAsset === baseAsset
        ? Number(trade.commission ?? 0)
        : 0;
    return total + quantity - commission;
  }, 0);
}

async function getOrCreateBuy(
  credentials: NonNullable<ReturnType<typeof tradeCredentials>>,
  pending: PendingAutoEntry,
) {
  const existing = await findOrderByClientId(
    credentials,
    pending.symbol,
    pending.orderClientId,
  );
  if (existing) return existing;
  return signedRequest<BinanceOrderResponse>(
    credentials,
    "POST",
    "/api/v3/order",
    {
      symbol: pending.symbol,
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: pending.quoteOrderUsdt.toFixed(2),
      newClientOrderId: pending.orderClientId,
      newOrderRespType: "FULL",
    },
  );
}

async function emergencyExit(
  credentials: NonNullable<ReturnType<typeof tradeCredentials>>,
  symbol: string,
  quantity: number,
  clientId: string,
) {
  const existing = await findOrderByClientId(credentials, symbol, clientId);
  if (existing) return existing;
  return signedRequest<BinanceOrderResponse>(
    credentials,
    "POST",
    "/api/v3/order",
    {
      symbol,
      side: "SELL",
      type: "MARKET",
      quantity: String(quantity),
      newClientOrderId: clientId,
      newOrderRespType: "FULL",
    },
  );
}

async function getOrCreateProtection(
  credentials: NonNullable<ReturnType<typeof tradeCredentials>>,
  pending: PendingAutoEntry,
  quantity: number,
  entryPrice: number,
  tickSize: number,
) {
  const existing = await findOrderListByClientId(
    credentials,
    pending.listClientId,
  );
  if (existing) return existing;
  const takeProfit = floorToTick(
    entryPrice * (1 + TESTNET_STRATEGY.rules.takeProfitPct / 100),
    tickSize,
  );
  const stopTrigger = floorToTick(
    entryPrice * (1 - TESTNET_STRATEGY.rules.stopLossPct / 100),
    tickSize,
  );
  const stopLimit = floorToTick(entryPrice * 0.935, tickSize);
  return signedRequest<BinanceOrderListResponse>(
    credentials,
    "POST",
    "/api/v3/orderList/oco",
    {
      symbol: pending.symbol,
      side: "SELL",
      quantity: String(quantity),
      listClientOrderId: pending.listClientId,
      aboveType: "LIMIT_MAKER",
      aboveClientOrderId: pending.aboveClientId,
      abovePrice: String(takeProfit),
      belowType: "STOP_LOSS_LIMIT",
      belowClientOrderId: pending.belowClientId,
      belowStopPrice: String(stopTrigger),
      belowPrice: String(stopLimit),
      belowTimeInForce: "GTC",
      newOrderRespType: "FULL",
    },
  );
}

async function executeEntry(
  state: TestnetAutoState,
  metrics: SignalMetrics,
) {
  const credentials = tradeCredentials();
  if (!credentials) throw new Error("测试网交易密钥尚未配置");
  const symbol = "BTCUSDT";
  const rules = await symbolRules(symbol);
  if (
    TESTNET_STRATEGY.rules.maxOrderUsdt < rules.minNotional ||
    !rules.quoteOrderQtyMarketAllowed
  ) {
    throw new Error("当前交易规则不接受策略设置的市价金额");
  }

  const bucket = compactBucket();
  const pending =
    state.pendingEntry ??
    ({
      symbol,
      quoteOrderUsdt: TESTNET_STRATEGY.rules.maxOrderUsdt,
      orderClientId: `abauto-${bucket}`,
      listClientId: `aboco-${bucket}`,
      aboveClientId: `abtp-${bucket}`,
      belowClientId: `absl-${bucket}`,
      createdAt: new Date().toISOString(),
    } satisfies PendingAutoEntry);
  state.pendingEntry = pending;
  await writeTestnetAutoState(state);

  const buy = await getOrCreateBuy(credentials, pending);
  if (!buy.orderId || buy.status !== "FILLED") {
    throw new Error("自动买入未确认成交，已停止后续动作");
  }
  const executedQty = Number(buy.executedQty ?? 0);
  const quoteQty = Number(buy.cummulativeQuoteQty ?? 0);
  const netQty = await netBoughtQuantity(credentials, symbol, buy);
  const protectedQty = floorToStep(netQty, rules.stepSize);
  if (protectedQty < rules.minQty || !executedQty || !quoteQty) {
    throw new Error("成交数量无法满足保护单规则");
  }
  const entryPrice = quoteQty / executedQty;

  try {
    const orderList = await getOrCreateProtection(
      credentials,
      pending,
      protectedQty,
      entryPrice,
      rules.tickSize,
    );
    const protectiveOrderIds = (orderList.orders ?? [])
      .map((order) => Number(order.orderId ?? 0))
      .filter((orderId) => orderId > 0);
    if (protectiveOrderIds.length !== 2) {
      throw new Error("止损止盈保护单未完整创建");
    }
    state.managedPositions.push({
      symbol,
      buyOrderId: buy.orderId,
      protectiveOrderIds,
      takeProfitPrice: floorToTick(
        entryPrice * (1 + TESTNET_STRATEGY.rules.takeProfitPct / 100),
        rules.tickSize,
      ),
      stopTriggerPrice: floorToTick(
        entryPrice * (1 - TESTNET_STRATEGY.rules.stopLossPct / 100),
        rules.tickSize,
      ),
      stopLimitPrice: floorToTick(entryPrice * 0.935, rules.tickSize),
    });
    state.pendingEntry = null;
    return finish(
      state,
      decision(
        "BUY",
        "自动买入并已保护",
        `趋势条件满足，已自动买入约 ${round(quoteQty)} USDT 的 BTC，并同时建立止损与止盈保护单。`,
        "持有仓位；保护单成交前不再新增仓位。",
        `止损约 ${round(entryPrice * 0.94)}，止盈约 ${round(entryPrice * 1.12)} USDT。`,
        metrics,
      ),
      true,
    );
  } catch (protectionError) {
    const exitClientId = `abexit-${bucket}`;
    try {
      const exit = await emergencyExit(
        credentials,
        symbol,
        protectedQty,
        exitClientId,
      );
      state.managedPositions.push({
        symbol,
        buyOrderId: buy.orderId,
        protectiveOrderIds: [],
        emergencyExitOrderIds: exit.orderId ? [exit.orderId] : [],
        takeProfitPrice: 0,
        stopTriggerPrice: 0,
        stopLimitPrice: 0,
      });
      state.pendingEntry = null;
      state.paused = true;
      state.pauseReason = "保护单失败，已自动平仓并暂停";
      return finish(
        state,
        decision(
          "EMERGENCY_EXIT",
          "保护失败，已紧急退出",
          "买入后未能完整建立保护单，系统已立即卖出该笔 BTC 并暂停新增订单。",
          "检查 Binance 测试网订单规则后再手动恢复。",
          "恢复前不会再买入。",
          metrics,
        ),
        true,
      );
    } catch {
      state.paused = true;
      state.pauseReason = "保护单与紧急退出均失败";
      state.lastError =
        protectionError instanceof Error
          ? protectionError.message
          : "保护单创建失败";
      await writeTestnetAutoState(state);
      throw new Error("保护单与紧急退出均失败，自动交易已锁定");
    }
  }
}

async function runOnce(options: { force?: boolean } = {}): Promise<AutoRunResult> {
  const state = await readTestnetAutoState();
  if (!isTestnetAutoConfigured()) {
    return finish(
      state,
      decision(
        "PAUSED",
        "自动执行尚未接通",
        "服务器尚未同时配置测试网交易密钥、自动执行开关和内部调度密钥。",
        "配置完成后自动执行器才会运行。",
        "真实账户始终保持关闭。",
      ),
    );
  }
  if (state.paused) {
    return finish(
      state,
      decision(
        "PAUSED",
        "已暂停新订单",
        state.pauseReason || "已从私人控制台暂停自动策略。",
        "现有止损止盈保护单继续有效；恢复前不会新增仓位。",
        "可在私人控制台手动恢复。",
      ),
    );
  }

  const lastRun = state.lastRunAt ? Date.parse(state.lastRunAt) : 0;
  const minimumGap =
    (TESTNET_STRATEGY.evaluationIntervalMinutes - 1) * 60 * 1_000;
  if (!options.force && lastRun && Date.now() - lastRun < minimumGap) {
    return {
      ok: true,
      executed: false,
      decision:
        state.lastDecision ??
        decision(
          "HOLD",
          "等待下一轮",
          "本轮已经检查过，幂等保护阻止重复执行。",
          "等待下一次定时检查。",
          "每 5 分钟最多执行一次。",
        ),
    };
  }

  const credentials = tradeCredentials();
  if (!credentials) throw new Error("测试网交易密钥尚未配置");
  const account = await signedRequest<BinanceAccount>(
    credentials,
    "GET",
    "/api/v3/account",
    { omitZeroBalances: "true" },
  );
  if (!account.canTrade) {
    throw new Error("测试网交易密钥没有 TRADE 权限");
  }
  if (state.pendingEntry) {
    const pendingAge =
      Date.now() - Date.parse(state.pendingEntry.createdAt || "invalid");
    if (!Number.isFinite(pendingAge) || pendingAge > 60 * 60 * 1_000) {
      state.paused = true;
      state.pauseReason = "发现超过 1 小时未完成的自动订单";
      return finish(
        state,
        decision(
          "PAUSED",
          "未完成订单需要检查",
          "持久化队列中存在超过 1 小时仍未完成的自动订单，为防止重复买入已暂停。",
          "检查测试网订单后再恢复。",
          "恢复前不会新增订单。",
        ),
      );
    }
    return executeEntry(state, await getSignal());
  }

  const snapshot = await getInvestTestnetSnapshot();
  if (snapshot.status !== "ready") {
    throw new Error(snapshot.message);
  }
  if (
    snapshot.summary.strategyEquityUsdt <=
    TESTNET_STRATEGY.startingCapitalUsdt *
      (1 - TESTNET_STRATEGY.rules.maxStrategyDrawdownPct / 100)
  ) {
    state.paused = true;
    state.pauseReason = `策略净值回撤达到 ${TESTNET_STRATEGY.rules.maxStrategyDrawdownPct}%`;
    return finish(
      state,
      decision(
        "PAUSED",
        "达到最大回撤，自动暂停",
        `策略净值已触及 ${TESTNET_STRATEGY.rules.maxStrategyDrawdownPct}% 回撤闸门。`,
        "保留已有保护单，不再新增仓位。",
        "人工检查后才能恢复。",
      ),
    );
  }

  const position = snapshot.positions[0];
  if (position) {
    if (!position.protectionActive) {
      state.paused = true;
      state.pauseReason = "检测到未完整保护的持仓";
      return finish(
        state,
        decision(
          "PAUSED",
          "持仓保护异常，自动暂停",
          "检测到策略持仓，但止损或止盈保护单不完整。",
          "不再新增订单；先检查现有持仓保护。",
          "保护恢复并人工解除暂停后才会继续。",
        ),
      );
    }
    return finish(
      state,
      decision(
        "PROTECTED",
        "持有并受保护",
        `当前 BTC 仓位约占初始资金 ${round(
          (position.costUsdt / TESTNET_STRATEGY.startingCapitalUsdt) * 100,
        )}%，止损与止盈保护单有效。`,
        "自动持有；本轮不加仓。",
        `观察 ${position.stopTriggerPrice} 止损线与 ${position.takeProfitPrice} USDT 止盈线。`,
      ),
    );
  }

  if (
    entriesToday(snapshot.orders) >= TESTNET_STRATEGY.rules.maxEntriesPerDay
  ) {
    return finish(
      state,
      decision(
        "HOLD",
        "今日入场次数已满",
        `每天最多允许 ${TESTNET_STRATEGY.rules.maxEntriesPerDay} 次自动入场，防止频繁交易。`,
        "今日不再买入。",
        "UTC 次日重新允许一次入场检查。",
      ),
    );
  }

  const lastSell = latestSellAt(snapshot.trades);
  const cooldownMs = TESTNET_STRATEGY.rules.cooldownHours * 60 * 60 * 1_000;
  if (lastSell && Date.now() - lastSell < cooldownMs) {
    const hoursLeft = Math.ceil((cooldownMs - (Date.now() - lastSell)) / 3_600_000);
    return finish(
      state,
      decision(
        "HOLD",
        "退出后冷静期",
        `最近一次卖出后需等待 ${TESTNET_STRATEGY.rules.cooldownHours} 小时，避免立即反向追价。`,
        "保持现金，不下单。",
        `约 ${hoursLeft} 小时后重新检查。`,
      ),
    );
  }

  const metrics = await getSignal();
  if (!metrics.shouldEnter) {
    return finish(
      state,
      decision(
        "HOLD",
        "趋势条件未满足",
        `BTC ${metrics.price}；SMA20 ${metrics.sma20}；SMA50 ${metrics.sma50}；RSI14 ${metrics.rsi14}。`,
        "保持现金，本轮不下单。",
        TESTNET_STRATEGY.rules.entrySignal,
        metrics,
      ),
    );
  }
  return executeEntry(state, metrics);
}

export async function runTestnetAutoTrader(
  options: { force?: boolean } = {},
) {
  if (activeRun) return activeRun;
  activeRun = withTestnetAutoStateLock(() => runOnce(options))
    .catch(async (error) => {
      const state = await readTestnetAutoState();
      const message =
        error instanceof BinanceTestnetError || error instanceof Error
          ? error.message
          : "自动策略执行失败";
      return finish(
        state,
        decision(
          "ERROR",
          "本轮执行失败",
          message,
          "本轮不会重试下单，等待下一次检查。",
          "若连续失败，请暂停并检查测试网连接。",
        ),
      );
    })
    .finally(() => {
      activeRun = null;
    });
  return activeRun;
}
