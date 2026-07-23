import "server-only";

import { createHmac } from "node:crypto";
import type {
  BinanceBalance,
  BinanceOrder,
  BinanceTrade,
} from "@/lib/invest/binance-testnet-model";

export const BINANCE_TESTNET_ORIGIN = "https://testnet.binance.vision";
const REQUEST_TIMEOUT_MS = 10_000;

export type BinanceCredentials = {
  apiKey: string;
  secretKey: string;
};

export type BinanceAccount = {
  accountType?: string;
  canTrade?: boolean;
  permissions?: string[];
  balances?: BinanceBalance[];
};

export type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export type BinanceOrderResponse = BinanceOrder & {
  clientOrderId?: string;
  fills?: Array<{
    price?: string;
    qty?: string;
    commission?: string;
    commissionAsset?: string;
  }>;
};

export type BinanceOrderListResponse = {
  orderListId?: number;
  listClientOrderId?: string;
  listOrderStatus?: string;
  orders?: Array<{
    symbol?: string;
    orderId?: number;
    clientOrderId?: string;
  }>;
  orderReports?: BinanceOrderResponse[];
};

export class BinanceTestnetError extends Error {
  code: string;

  constructor(message: string, code = "") {
    super(message);
    this.name = "BinanceTestnetError";
    this.code = code;
  }
}

export function readCredentials(): BinanceCredentials | null {
  const apiKey = process.env.BINANCE_TESTNET_API_KEY?.trim();
  const secretKey = process.env.BINANCE_TESTNET_SECRET_KEY?.trim();
  return apiKey && secretKey ? { apiKey, secretKey } : null;
}

export function tradeCredentials(): BinanceCredentials | null {
  const apiKey = process.env.BINANCE_TESTNET_TRADE_API_KEY?.trim();
  const secretKey = process.env.BINANCE_TESTNET_TRADE_SECRET_KEY?.trim();
  return apiKey && secretKey ? { apiKey, secretKey } : null;
}

export function isTestnetAutoConfigured() {
  return (
    process.env.BINANCE_TESTNET_AUTOTRADE_ENABLED?.trim() === "1" &&
    Boolean(tradeCredentials()) &&
    Boolean(process.env.INVEST_AUTOTRADE_CRON_SECRET?.trim())
  );
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
      throw new BinanceTestnetError("测试网时间校验失败，请稍后重试", code);
    }
    if (code === "-2014" || code === "-2015" || code === "-1022") {
      throw new BinanceTestnetError("测试网凭证无效或权限不足", code);
    }
    if (code === "-2013") {
      throw new BinanceTestnetError("订单不存在", code);
    }
    throw new BinanceTestnetError(
      `Binance Spot Testnet 请求失败${code ? ` (${code})` : ""}`,
      code,
    );
  }
  return payload as T;
}

export async function publicRequest<T>(
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
    headers: { "User-Agent": "AskBible-Private-Invest/2.0" },
  });
  return parseResponse<T>(response);
}

export async function signedRequest<T>(
  credentials: BinanceCredentials,
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const serverTime = await publicRequest<{ serverTime: number }>("/api/v3/time");
  const query = new URLSearchParams({
    ...params,
    recvWindow: "5000",
    timestamp: String(serverTime.serverTime),
  });
  const signature = createHmac("sha256", credentials.secretKey)
    .update(query.toString())
    .digest("hex");
  query.set("signature", signature);

  const url = new URL(path, BINANCE_TESTNET_ORIGIN);
  url.search = query.toString();
  const response = await fetch(url, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "User-Agent": "AskBible-Private-Invest/2.0",
      "X-MBX-APIKEY": credentials.apiKey,
    },
  });
  return parseResponse<T>(response);
}

export async function findOrderByClientId(
  credentials: BinanceCredentials,
  symbol: string,
  clientOrderId: string,
) {
  try {
    return await signedRequest<BinanceOrderResponse>(
      credentials,
      "GET",
      "/api/v3/order",
      { symbol, origClientOrderId: clientOrderId },
    );
  } catch (error) {
    if (error instanceof BinanceTestnetError && error.code === "-2013") {
      return null;
    }
    throw error;
  }
}

export async function findOrderListByClientId(
  credentials: BinanceCredentials,
  listClientOrderId: string,
) {
  try {
    return await signedRequest<BinanceOrderListResponse>(
      credentials,
      "GET",
      "/api/v3/orderList",
      { origClientOrderId: listClientOrderId },
    );
  } catch (error) {
    if (error instanceof BinanceTestnetError && error.code === "-2013") {
      return null;
    }
    throw error;
  }
}

export type {
  BinanceBalance,
  BinanceOrder,
  BinanceTrade,
};
