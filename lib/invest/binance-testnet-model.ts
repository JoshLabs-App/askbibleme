import { TESTNET_STRATEGY } from "./testnet-strategy";

export type BinanceBalance = {
  asset: string;
  free: string;
  locked: string;
};

export type BinanceTrade = {
  id?: number;
  orderId?: number;
  symbol?: string;
  price?: string;
  qty?: string;
  quoteQty?: string;
  commission?: string;
  commissionAsset?: string;
  time?: number;
  isBuyer?: boolean;
  isMaker?: boolean;
};

export type BinanceOrder = {
  orderId?: number;
  orderListId?: number;
  symbol?: string;
  side?: string;
  type?: string;
  status?: string;
  price?: string;
  stopPrice?: string;
  origQty?: string;
  executedQty?: string;
  cummulativeQuoteQty?: string;
  time?: number;
  updateTime?: number;
};

export type InvestPosition = {
  symbol: string;
  quantity: number;
  entryPrice: number;
  costUsdt: number;
  currentPrice: number;
  marketValueUsdt: number;
  unrealizedPnlUsdt: number;
  returnPct: number;
  takeProfitPrice: number;
  stopTriggerPrice: number;
  stopLimitPrice: number;
  protectionActive: boolean;
};

export type InvestTrade = {
  tradeId: number | null;
  orderId: number | null;
  time: number;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  quoteQuantity: number;
  commission: number;
  commissionAsset: string;
  maker: boolean;
};

export type InvestOrder = {
  orderId: number | null;
  orderListId: number | null;
  time: number;
  updateTime: number;
  symbol: string;
  side: string;
  type: string;
  status: string;
  price: number;
  stopPrice: number;
  originalQuantity: number;
  executedQuantity: number;
  quoteQuantity: number;
};

export type InvestSummary = {
  startingCapitalUsdt: number;
  cashReserveUsdt: number;
  deployedUsdt: number;
  marketValueUsdt: number;
  strategyEquityUsdt: number;
  realizedPnlUsdt: number;
  unrealizedPnlUsdt: number;
  totalPnlUsdt: number;
  returnPct: number;
  targetProgressPct: number;
  tradeCount: number;
  orderCount: number;
};

export type InvestModel = {
  summary: InvestSummary;
  positions: InvestPosition[];
  trades: InvestTrade[];
  orders: InvestOrder[];
};

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number, digits = 2) => {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};

export function buildInvestModel(input: {
  trades: BinanceTrade[];
  orders: BinanceOrder[];
  prices: Record<string, number>;
}): InvestModel {
  const startedAt = Date.parse(TESTNET_STRATEGY.startedAt);
  const managedOrderIds = new Set<number>(
    TESTNET_STRATEGY.managedPositions.flatMap((position) => [
      position.buyOrderId,
      ...position.protectiveOrderIds,
    ]),
  );
  const managedSymbols = new Set<string>(
    TESTNET_STRATEGY.managedPositions.map((position) => position.symbol),
  );

  const rawTrades = input.trades
    .filter(
      (trade) =>
        managedSymbols.has(String(trade.symbol ?? "")) &&
        numberValue(trade.time) >= startedAt &&
        managedOrderIds.has(numberValue(trade.orderId)),
    )
    .sort((a, b) => numberValue(a.time) - numberValue(b.time));

  const rawOrders = input.orders
    .filter(
      (order) =>
        managedSymbols.has(String(order.symbol ?? "")) &&
        numberValue(order.time) >= startedAt &&
        managedOrderIds.has(numberValue(order.orderId)),
    )
    .sort((a, b) => numberValue(a.time) - numberValue(b.time));

  const holdings = new Map<string, { quantity: number; cost: number }>();
  for (const symbol of managedSymbols) {
    holdings.set(symbol, { quantity: 0, cost: 0 });
  }

  let cashReserve = TESTNET_STRATEGY.startingCapitalUsdt;
  let realizedPnl = 0;
  const trades: InvestTrade[] = [];

  for (const trade of rawTrades) {
    const symbol = String(trade.symbol ?? "");
    const holding = holdings.get(symbol);
    if (!holding) continue;

    const quantity = numberValue(trade.qty);
    const price = numberValue(trade.price);
    const quoteQuantity = numberValue(trade.quoteQty) || quantity * price;
    const commission = numberValue(trade.commission);
    const commissionAsset = String(trade.commissionAsset ?? "");
    const baseAsset = symbol.endsWith("USDT") ? symbol.slice(0, -4) : "";
    const isBuy = Boolean(trade.isBuyer);

    if (isBuy) {
      const receivedQuantity =
        quantity - (commissionAsset === baseAsset ? commission : 0);
      const cashCost =
        quoteQuantity + (commissionAsset === "USDT" ? commission : 0);
      holding.quantity += receivedQuantity;
      holding.cost += cashCost;
      cashReserve -= cashCost;
    } else {
      const averageCost =
        holding.quantity > 0 ? holding.cost / holding.quantity : 0;
      const removedQuantity = Math.min(quantity, holding.quantity);
      const removedCost = removedQuantity * averageCost;
      const cashProceeds =
        quoteQuantity - (commissionAsset === "USDT" ? commission : 0);
      holding.quantity = Math.max(0, holding.quantity - quantity);
      holding.cost = Math.max(0, holding.cost - removedCost);
      cashReserve += cashProceeds;
      realizedPnl += cashProceeds - removedCost;
    }

    trades.push({
      tradeId: trade.id ?? null,
      orderId: trade.orderId ?? null,
      time: numberValue(trade.time),
      symbol,
      side: isBuy ? "BUY" : "SELL",
      price,
      quantity,
      quoteQuantity,
      commission,
      commissionAsset,
      maker: Boolean(trade.isMaker),
    });
  }

  const openOrderIds = new Set(
    rawOrders
      .filter((order) => ["NEW", "PARTIALLY_FILLED"].includes(order.status ?? ""))
      .map((order) => numberValue(order.orderId)),
  );
  const positionConfig = new Map<string, (typeof TESTNET_STRATEGY.managedPositions)[number]>(
    TESTNET_STRATEGY.managedPositions.map((position) => [
      position.symbol,
      position,
    ]),
  );

  let deployedUsdt = 0;
  let marketValueUsdt = 0;
  const positions: InvestPosition[] = [];

  for (const [symbol, holding] of holdings.entries()) {
    if (holding.quantity <= 0) continue;
    const config = positionConfig.get(symbol);
    if (!config) continue;
    const currentPrice = input.prices[symbol] ?? 0;
    const marketValue = holding.quantity * currentPrice;
    const unrealizedPnl = marketValue - holding.cost;
    deployedUsdt += holding.cost;
    marketValueUsdt += marketValue;

    positions.push({
      symbol,
      quantity: holding.quantity,
      entryPrice: holding.cost / holding.quantity,
      costUsdt: holding.cost,
      currentPrice,
      marketValueUsdt: marketValue,
      unrealizedPnlUsdt: unrealizedPnl,
      returnPct: holding.cost > 0 ? (unrealizedPnl / holding.cost) * 100 : 0,
      takeProfitPrice: config.takeProfitPrice,
      stopTriggerPrice: config.stopTriggerPrice,
      stopLimitPrice: config.stopLimitPrice,
      protectionActive: config.protectiveOrderIds.every((id) =>
        openOrderIds.has(id),
      ),
    });
  }

  const orders: InvestOrder[] = rawOrders
    .map((order) => ({
      orderId: order.orderId ?? null,
      orderListId: order.orderListId ?? null,
      time: numberValue(order.time),
      updateTime: numberValue(order.updateTime),
      symbol: String(order.symbol ?? ""),
      side: String(order.side ?? ""),
      type: String(order.type ?? ""),
      status: String(order.status ?? ""),
      price: numberValue(order.price),
      stopPrice: numberValue(order.stopPrice),
      originalQuantity: numberValue(order.origQty),
      executedQuantity: numberValue(order.executedQty),
      quoteQuantity: numberValue(order.cummulativeQuoteQty),
    }))
    .reverse();

  const unrealizedPnl = marketValueUsdt - deployedUsdt;
  const strategyEquity = cashReserve + marketValueUsdt;
  const totalPnl = strategyEquity - TESTNET_STRATEGY.startingCapitalUsdt;
  const targetDistance =
    TESTNET_STRATEGY.targetCapitalUsdt -
    TESTNET_STRATEGY.startingCapitalUsdt;

  return {
    summary: {
      startingCapitalUsdt: TESTNET_STRATEGY.startingCapitalUsdt,
      cashReserveUsdt: round(cashReserve),
      deployedUsdt: round(deployedUsdt),
      marketValueUsdt: round(marketValueUsdt),
      strategyEquityUsdt: round(strategyEquity),
      realizedPnlUsdt: round(realizedPnl),
      unrealizedPnlUsdt: round(unrealizedPnl),
      totalPnlUsdt: round(totalPnl),
      returnPct: round(
        (totalPnl / TESTNET_STRATEGY.startingCapitalUsdt) * 100,
      ),
      targetProgressPct: round(
        targetDistance > 0 ? (totalPnl / targetDistance) * 100 : 0,
      ),
      tradeCount: trades.length,
      orderCount: orders.length,
    },
    positions: positions.map((position) => ({
      ...position,
      quantity: round(position.quantity, 8),
      entryPrice: round(position.entryPrice),
      costUsdt: round(position.costUsdt),
      currentPrice: round(position.currentPrice),
      marketValueUsdt: round(position.marketValueUsdt),
      unrealizedPnlUsdt: round(position.unrealizedPnlUsdt),
      returnPct: round(position.returnPct),
    })),
    trades: trades.reverse(),
    orders,
  };
}
