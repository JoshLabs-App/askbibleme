import { describe, expect, it } from "vitest";
import { buildInvestModel } from "./binance-testnet-model";

describe("buildInvestModel", () => {
  it("only includes the configured testnet strategy orders", () => {
    const model = buildInvestModel({
      prices: { BTCUSDT: 66_000 },
      trades: [
        {
          id: 1,
          orderId: 19736813,
          symbol: "BTCUSDT",
          price: "65817.01",
          qty: "0.00303",
          quoteQty: "199.4255403",
          commission: "0",
          commissionAsset: "BTC",
          time: Date.parse("2026-07-23T01:37:10.504Z"),
          isBuyer: true,
        },
        {
          id: 2,
          orderId: 999,
          symbol: "BTCUSDT",
          price: "100",
          qty: "1",
          quoteQty: "100",
          time: Date.parse("2026-07-23T01:40:00.000Z"),
          isBuyer: true,
        },
      ],
      orders: [
        {
          orderId: 19736813,
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          status: "FILLED",
          time: Date.parse("2026-07-23T01:37:10.504Z"),
        },
        {
          orderId: 19736920,
          symbol: "BTCUSDT",
          side: "SELL",
          type: "STOP_LOSS_LIMIT",
          status: "NEW",
          time: Date.parse("2026-07-23T01:37:40.000Z"),
        },
        {
          orderId: 19736921,
          symbol: "BTCUSDT",
          side: "SELL",
          type: "LIMIT_MAKER",
          status: "NEW",
          time: Date.parse("2026-07-23T01:37:40.000Z"),
        },
      ],
    });

    expect(model.trades).toHaveLength(1);
    expect(model.orders).toHaveLength(3);
    expect(model.positions[0]).toMatchObject({
      symbol: "BTCUSDT",
      quantity: 0.00303,
      protectionActive: true,
    });
    expect(model.summary.deployedUsdt).toBe(199.43);
    expect(model.summary.cashReserveUsdt).toBe(9800.57);
  });

  it("marks protection inactive when one protective order is missing", () => {
    const model = buildInvestModel({
      prices: { BTCUSDT: 65_000 },
      trades: [
        {
          orderId: 19736813,
          symbol: "BTCUSDT",
          price: "65817.01",
          qty: "0.00303",
          quoteQty: "199.4255403",
          time: Date.parse("2026-07-23T01:37:10.504Z"),
          isBuyer: true,
        },
      ],
      orders: [
        {
          orderId: 19736920,
          symbol: "BTCUSDT",
          status: "NEW",
          time: Date.parse("2026-07-23T01:37:40.000Z"),
        },
      ],
    });

    expect(model.positions[0]?.protectionActive).toBe(false);
  });
});
