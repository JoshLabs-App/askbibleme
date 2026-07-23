export type ManagedTestnetPosition = {
  symbol: string;
  buyOrderId: number;
  protectiveOrderIds: number[];
  emergencyExitOrderIds?: number[];
  takeProfitPrice: number;
  stopTriggerPrice: number;
  stopLimitPrice: number;
};

export const TESTNET_STRATEGY = {
  mode: "spot_testnet",
  name: "Codex 新手趋势策略",
  startedAt: "2026-07-23T01:37:10.504Z",
  startingCapitalUsdt: 10_000,
  targetCapitalUsdt: 20_000,
  targetIsGuaranteed: false,
  refreshIntervalSeconds: 60,
  evaluationIntervalMinutes: 5,
  rules: {
    leverage: false,
    allowedSymbols: ["BTCUSDT"],
    maxOrderUsdt: 200,
    maxTotalExposurePct: 2,
    maxEntriesPerDay: 1,
    cooldownHours: 24,
    maxStrategyDrawdownPct: 2,
    stopLossPct: 6,
    takeProfitPct: 12,
    entrySignal:
      "BTC 1小时收盘价高于20小时均线、20小时均线高于50小时均线，且 RSI(14) 在 50–68 之间",
  },
  managedPositions: [
    {
      symbol: "BTCUSDT",
      buyOrderId: 19736813,
      protectiveOrderIds: [19736920, 19736921],
      takeProfitPrice: 73715.04,
      stopTriggerPrice: 61868,
      stopLimitPrice: 61558.66,
    },
  ] satisfies ManagedTestnetPosition[],
} as const;
