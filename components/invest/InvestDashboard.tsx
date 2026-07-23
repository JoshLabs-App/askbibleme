"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InvestTestnetSnapshot } from "@/lib/invest/binance-testnet";

type ReadySnapshot = Extract<InvestTestnetSnapshot, { status: "ready" }>;

const money = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const price = new Intl.NumberFormat("en-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quantity = new Intl.NumberFormat("en-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});

function signedMoney(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${money.format(value)} USDT`;
}

function signedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${money.format(value)}%`;
}

function dateTime(value: string | number) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Toronto",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function pnlTone(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-white";
}

function orderTypeLabel(value: string) {
  const labels: Record<string, string> = {
    MARKET: "市价单",
    LIMIT_MAKER: "止盈限价",
    STOP_LOSS_LIMIT: "止损限价",
  };
  return labels[value] ?? value;
}

function orderStatusLabel(value: string) {
  const labels: Record<string, string> = {
    FILLED: "已成交",
    NEW: "挂单中",
    PARTIALLY_FILLED: "部分成交",
    CANCELED: "已取消",
    EXPIRED: "已过期",
    REJECTED: "已拒绝",
  };
  return labels[value] ?? value;
}

function directionLabel(value: string) {
  return value === "BUY" ? "买入" : value === "SELL" ? "卖出" : value;
}

function LoadingShell({
  snapshot,
}: {
  snapshot: Exclude<InvestTestnetSnapshot, { status: "ready" }>;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-[#f3ba2f]/16 bg-[#f3ba2f]/[0.045] p-6">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#f3ba2f]/75">
        BINANCE SPOT TESTNET
      </p>
      <h2 className="mt-3 text-xl font-semibold">测试网数据尚未显示</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/48">
        {snapshot.message}
      </p>
      <p className="mt-4 text-xs text-white/30">
        真实账户与主网交易仍保持关闭。
      </p>
    </section>
  );
}

export function InvestDashboard({
  initialSnapshot,
}: {
  initialSnapshot: InvestTestnetSnapshot;
}) {
  const [snapshot, setSnapshot] =
    useState<InvestTestnetSnapshot>(initialSnapshot);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [automationBusy, setAutomationBusy] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/invest/testnet", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("读取失败");
      const payload = (await response.json()) as InvestTestnetSnapshot;
      if (payload.status === "ready") {
        setSnapshot(payload);
        setRefreshError(null);
      } else {
        setRefreshError(payload.message);
        if (snapshot.status !== "ready") setSnapshot(payload);
      }
    } catch {
      setRefreshError("本次刷新失败，仍显示上次成功读取的数据");
    } finally {
      setRefreshing(false);
    }
  }, [snapshot.status]);

  const automationAction = useCallback(
    async (action: "pause" | "resume" | "run") => {
      setAutomationBusy(action);
      try {
        const response = await fetch("/api/invest/testnet/automation", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = (await response.json()) as
          | InvestTestnetSnapshot
          | { error?: string };
        if (!response.ok || !("status" in payload)) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "自动策略操作失败",
          );
        }
        setSnapshot(payload);
        setRefreshError(null);
      } catch (error) {
        setRefreshError(
          error instanceof Error ? error.message : "自动策略操作失败",
        );
      } finally {
        setAutomationBusy(null);
      }
    },
    [],
  );

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClock(Date.now()), 1_000);
    const refreshTimer = window.setInterval(refresh, 60_000);
    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    };
  }, [refresh]);

  const countdown = useMemo(() => {
    if (snapshot.status !== "ready") return "等待连接";
    const remaining = Math.max(
      0,
      Math.ceil((Date.parse(snapshot.nextCheckAt) - clock) / 1_000),
    );
    return remaining > 0 ? `${remaining} 秒后` : refreshing ? "刷新中" : "即将刷新";
  }, [clock, refreshing, snapshot]);

  if (snapshot.status !== "ready") {
    return <LoadingShell snapshot={snapshot} />;
  }

  const latestTrade = snapshot.trades[0];
  const primaryPosition = snapshot.positions[0];
  const progress = Math.max(
    0,
    Math.min(100, snapshot.summary.targetProgressPct),
  );

  const overview = [
    {
      label: "当前收益",
      value: signedMoney(snapshot.summary.totalPnlUsdt),
      detail: `策略净值 ${money.format(snapshot.summary.strategyEquityUsdt)} USDT · ${signedPercent(snapshot.summary.returnPct)}`,
      tone: pnlTone(snapshot.summary.totalPnlUsdt),
    },
    {
      label: "最新交易",
      value: latestTrade
        ? `${directionLabel(latestTrade.side)} ${latestTrade.symbol.replace("USDT", "")}`
        : "暂无",
      detail: latestTrade
        ? `${money.format(latestTrade.quoteQuantity)} USDT · ${dateTime(latestTrade.time)}`
        : "当前没有策略交易",
      tone: "text-white",
    },
    {
      label: "当前策略",
      value: snapshot.decision.state,
      detail: primaryPosition
        ? `${primaryPosition.symbol} · 保护单${primaryPosition.protectionActive ? "有效" : "需检查"}`
        : snapshot.automation.paused
          ? "自动下单已暂停"
          : "现货测试 · 等待信号",
      tone: primaryPosition?.protectionActive
        ? "text-[#f3ba2f]"
        : "text-rose-300",
    },
    {
      label: "下次检查",
      value: countdown,
      detail: `上次更新 ${dateTime(snapshot.refreshedAt)}`,
      tone: "text-white",
    },
  ];

  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overview.map((item) => (
          <article
            key={item.label}
            className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.9)]"
          >
            <p className="text-[11px] font-medium tracking-[0.08em] text-white/42">
              {item.label}
            </p>
            <p
              className={`mt-5 text-[25px] font-semibold tracking-[-0.035em] ${item.tone}`}
            >
              {item.value}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-white/40">
              {item.detail}
            </p>
          </article>
        ))}
      </section>

      {refreshError ? (
        <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-xs text-amber-100/70">
          {refreshError}
        </div>
      ) : null}

      <section
        className={`mt-5 rounded-3xl border p-5 sm:p-6 ${
          snapshot.testnetAutoTradingEnabled
            ? "border-emerald-400/20 bg-emerald-400/[0.045]"
            : "border-amber-300/16 bg-amber-300/[0.035]"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p
              className={`text-[11px] font-semibold tracking-[0.16em] ${
                snapshot.testnetAutoTradingEnabled
                  ? "text-emerald-300/80"
                  : "text-amber-200/70"
              }`}
            >
              {snapshot.testnetAutoTradingEnabled
                ? "TESTNET AUTO TRADING ON"
                : snapshot.automation.paused
                  ? "TESTNET AUTO TRADING PAUSED"
                  : "TESTNET CONNECTED"}
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              {snapshot.testnetAutoTradingEnabled
                ? "测试网自动执行器正在运行"
                : snapshot.automation.paused
                  ? "自动新增订单已暂停"
                  : "Binance 虚拟账户已连接"}
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-white/48">
              服务器每 {snapshot.strategy.evaluationIntervalMinutes} 分钟检查
              BTC 趋势；满足条件时可自动提交不超过{" "}
              {snapshot.strategy.rules.maxOrderUsdt} USDT 的 Spot Testnet
              订单，并立即建立止损与止盈保护。浏览器不会收到 API 密钥，真实账户、杠杆、提币和主网交易全部关闭。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => automationAction("run")}
              disabled={
                Boolean(automationBusy) ||
                !snapshot.automation.configured ||
                snapshot.automation.paused
              }
              className="rounded-full border border-[#f3ba2f]/25 bg-[#f3ba2f]/10 px-4 py-2 text-[11px] font-medium text-[#f3ba2f] transition hover:bg-[#f3ba2f]/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {automationBusy === "run" ? "检查中…" : "立即运行策略"}
            </button>
            <button
              type="button"
              onClick={() =>
                automationAction(
                  snapshot.automation.paused ? "resume" : "pause",
                )
              }
              disabled={
                Boolean(automationBusy) || !snapshot.automation.configured
              }
              className="rounded-full border border-white/12 bg-white/[0.035] px-4 py-2 text-[11px] font-medium text-white/68 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {automationBusy
                ? "处理中…"
                : snapshot.automation.paused
                  ? "恢复自动策略"
                  : "暂停新订单"}
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || Boolean(automationBusy)}
              className="rounded-full border border-white/12 bg-white/[0.035] px-4 py-2 text-[11px] font-medium text-white/68 transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              {refreshing ? "正在刷新…" : "立即刷新"}
            </button>
            <span className="rounded-full border border-white/12 bg-black/20 px-4 py-2 text-[11px] font-medium text-white/55">
              MAINNET OFF
            </span>
          </div>
        </div>
        {snapshot.automation.pauseReason || snapshot.automation.lastError ? (
          <p className="mt-4 rounded-2xl border border-amber-200/12 bg-black/15 px-4 py-3 text-xs text-amber-100/65">
            {snapshot.automation.lastError || snapshot.automation.pauseReason}
          </p>
        ) : null}
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#f3ba2f]/70">
            AI 决策摘要
          </p>
          <h2 className="mt-3 text-lg font-semibold">{snapshot.decision.state}</h2>
          <p className="mt-3 text-[13px] leading-6 text-white/48">
            {snapshot.decision.rationale}
          </p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/40">
            下一步
          </p>
          <h2 className="mt-3 text-lg font-semibold">
            {snapshot.testnetAutoTradingEnabled
              ? "按规则自动执行"
              : "等待恢复或接通"}
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-white/48">
            {snapshot.decision.nextAction}
          </p>
          <p className="mt-2 text-[12px] leading-5 text-white/35">
            {snapshot.decision.nextTrigger}
          </p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/40">
            风险规则
          </p>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
            <div>
              <p className="text-white/32">杠杆</p>
              <p className="mt-1 text-white/75">关闭</p>
            </div>
            <div>
              <p className="text-white/32">单笔上限</p>
              <p className="mt-1 text-white/75">
                {snapshot.strategy.rules.maxOrderUsdt} USDT
              </p>
            </div>
            <div>
              <p className="text-white/32">总投入上限</p>
              <p className="mt-1 text-white/75">
                {snapshot.strategy.rules.maxTotalExposurePct}%
              </p>
            </div>
            <div>
              <p className="text-white/32">每日入场</p>
              <p className="mt-1 text-white/75">
                最多 {snapshot.strategy.rules.maxEntriesPerDay} 次
              </p>
            </div>
            <div>
              <p className="text-white/32">止损</p>
              <p className="mt-1 text-white/75">
                {snapshot.strategy.rules.stopLossPct}%
              </p>
            </div>
            <div>
              <p className="text-white/32">止盈</p>
              <p className="mt-1 text-white/75">
                {snapshot.strategy.rules.takeProfitPct}%
              </p>
            </div>
          </div>
          <p className="mt-4 border-t border-white/[0.07] pt-3 text-[11px] leading-5 text-white/35">
            最大策略回撤 {snapshot.strategy.rules.maxStrategyDrawdownPct}% 后自动暂停；退出后冷静{" "}
            {snapshot.strategy.rules.cooldownHours} 小时。
          </p>
        </article>
      </section>

      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/40">
              策略资金
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              {money.format(snapshot.summary.strategyEquityUsdt)} USDT
            </h2>
            <p className="mt-1 text-xs text-white/38">
              现金 {money.format(snapshot.summary.cashReserveUsdt)} · 已投入{" "}
              {money.format(snapshot.summary.deployedUsdt)} USDT
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-white/38">
              模拟目标 {money.format(snapshot.strategy.targetCapitalUsdt)} USDT
            </p>
            <p className="mt-1 text-[11px] text-amber-200/55">
              目标不代表保证收益
            </p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.055]">
          <div
            className="h-full rounded-full bg-[#f3ba2f] transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-white/28">
          <span>10,000</span>
          <span>进度 {money.format(snapshot.summary.targetProgressPct)}%</span>
          <span>20,000</span>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025]">
        <div className="border-b border-white/8 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold">当前持仓</h2>
          <p className="mt-1 text-xs text-white/35">
            只计算本策略管理的虚拟资金，不把测试网水龙头赠送资产计入收益。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="text-white/32">
              <tr>
                {[
                  "交易对",
                  "数量",
                  "成本",
                  "现价",
                  "市值",
                  "未实现盈亏",
                  "止损 / 止盈",
                  "保护",
                ].map((label) => (
                  <th key={label} className="px-5 py-3 font-medium first:pl-6">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot.positions.map((position) => (
                <tr key={position.symbol} className="border-t border-white/[0.055]">
                  <td className="px-5 py-4 pl-6 font-medium text-white">
                    {position.symbol}
                  </td>
                  <td className="px-5 py-4 text-white/62">
                    {quantity.format(position.quantity)}
                  </td>
                  <td className="px-5 py-4 text-white/62">
                    {price.format(position.entryPrice)}
                  </td>
                  <td className="px-5 py-4 text-white/62">
                    {price.format(position.currentPrice)}
                  </td>
                  <td className="px-5 py-4 text-white/62">
                    {money.format(position.marketValueUsdt)}
                  </td>
                  <td
                    className={`px-5 py-4 ${pnlTone(position.unrealizedPnlUsdt)}`}
                  >
                    {signedMoney(position.unrealizedPnlUsdt)}
                    <span className="ml-2 text-[10px] opacity-70">
                      {signedPercent(position.returnPct)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/55">
                    {price.format(position.stopTriggerPrice)} /{" "}
                    {price.format(position.takeProfitPrice)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        position.protectionActive
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      {position.protectionActive ? "有效" : "需检查"}
                    </span>
                  </td>
                </tr>
              ))}
              {snapshot.positions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-white/35">
                    当前没有策略持仓
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/8 px-5 py-4 sm:px-6">
            <h2 className="text-base font-semibold">成交记录</h2>
            <p className="mt-1 text-xs text-white/35">
              共 {snapshot.summary.tradeCount} 笔策略成交
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="text-white/32">
                <tr>
                  {["时间", "方向", "交易对", "成交价", "数量", "金额"].map(
                    (label) => (
                      <th key={label} className="px-4 py-3 font-medium first:pl-6">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {snapshot.trades.map((trade) => (
                  <tr
                    key={`${trade.tradeId}-${trade.time}`}
                    className="border-t border-white/[0.055] text-white/58"
                  >
                    <td className="px-4 py-4 pl-6">{dateTime(trade.time)}</td>
                    <td
                      className={`px-4 py-4 ${trade.side === "BUY" ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {directionLabel(trade.side)}
                    </td>
                    <td className="px-4 py-4 text-white/78">{trade.symbol}</td>
                    <td className="px-4 py-4">{price.format(trade.price)}</td>
                    <td className="px-4 py-4">
                      {quantity.format(trade.quantity)}
                    </td>
                    <td className="px-4 py-4">
                      {money.format(trade.quoteQuantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/8 px-5 py-4 sm:px-6">
            <h2 className="text-base font-semibold">订单记录</h2>
            <p className="mt-1 text-xs text-white/35">
              包含买入单与止损 / 止盈保护单
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="text-white/32">
                <tr>
                  {["时间", "方向", "类型", "状态", "价格", "触发价", "数量"].map(
                    (label) => (
                      <th key={label} className="px-4 py-3 font-medium first:pl-6">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {snapshot.orders.map((order) => (
                  <tr
                    key={`${order.orderId}-${order.time}`}
                    className="border-t border-white/[0.055] text-white/58"
                  >
                    <td className="px-4 py-4 pl-6">{dateTime(order.time)}</td>
                    <td className="px-4 py-4">{directionLabel(order.side)}</td>
                    <td className="px-4 py-4 text-white/72">
                      {orderTypeLabel(order.type)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={
                          order.status === "NEW"
                            ? "text-emerald-300"
                            : "text-white/62"
                        }
                      >
                        {orderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {order.price ? price.format(order.price) : "市价"}
                    </td>
                    <td className="px-4 py-4">
                      {order.stopPrice ? price.format(order.stopPrice) : "—"}
                    </td>
                    <td className="px-4 py-4">
                      {quantity.format(order.originalQuantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">测试网账户余额</h2>
            <p className="mt-1 text-xs leading-5 text-white/35">
              这是 Binance Testnet 原始虚拟余额，仅供核对；收益只按上面的
              10,000 USDT 策略账本计算。
            </p>
          </div>
          <span className="text-[11px] text-white/30">
            {snapshot.account.type} · {snapshot.account.permissions.join(", ")}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.account.balances.map((balance) => (
            <div
              key={balance.asset}
              className="rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3"
            >
              <p className="text-xs font-medium text-white/75">{balance.asset}</p>
              <div className="mt-2 flex justify-between text-[11px] text-white/35">
                <span>可用 {quantity.format(Number(balance.free))}</span>
                <span>锁定 {quantity.format(Number(balance.locked))}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
