export const TESTNET_STRATEGY = {
  mode: "spot_testnet",
  name: "Codex 新手趋势策略",
  startedAt: "2026-07-23T01:37:10.504Z",
  startingCapitalUsdt: 10_000,
  targetCapitalUsdt: 20_000,
  targetIsGuaranteed: false,
  refreshIntervalSeconds: 60,
  rules: {
    leverage: false,
    allowedSymbols: ["BTCUSDT", "ETHUSDT"],
    maxOrderUsdt: 200,
    maxInitialExposurePct: 10,
    stopLossPct: 6,
    takeProfitPct: 12,
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
  ],
} as const;
