"use client";

import { useCallback, useEffect, useState } from "react";
import { diskAuthHeaders } from "@/lib/disk-auth-headers";
import type { TelemetrySummary } from "@/lib/telemetry/summary-types";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function AdminTelemetryUsageClient() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<TelemetrySummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/telemetry/summary?days=${days}`, {
        headers: { ...diskAuthHeaders() },
      });
      const j = await parseJson(res);
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData(j as unknown as TelemetrySummary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDau = Math.max(1, ...(data?.dau.map((d) => d.count) ?? [1]));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12px] text-adminMuted">
          窗口
          <select
            className="ml-2 rounded border border-adminLine bg-adminBg px-2 py-1 text-[12px] text-adminFg"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 天</option>
            <option value={30}>30 天</option>
            <option value={90}>90 天</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-adminLine px-3 py-1 text-[12px] text-adminFg hover:bg-adminLine/30"
        >
          刷新
        </button>
      </div>

      {loading ? <p className="text-[12px] text-adminMuted">加载中…</p> : null}
      {err ? <p className="text-[12px] text-red-600">{err}</p> : null}

      {data && !data.configured ? (
        <div className="max-w-prose space-y-3 text-[12px] leading-relaxed text-adminMuted">
          <p>
            统计尚未就绪。本机开发默认写入{" "}
            <code className="text-adminFg">data/bible/telemetry-v1-store.json</code>（与信息版相同磁盘策略）。
          </p>
          <p>
            线上 Render 保持已用的{" "}
            <code className="text-adminFg">INFO_EDITION_DISK_SAVE=1</code> 与{" "}
            <code className="text-adminFg">DATA_ROOT</code> 即可，文件为{" "}
            <code className="text-adminFg">telemetry-v1-store.json</code>。
          </p>
          <p className="text-[11px]">
            详见 <code className="text-adminFg">docs/telemetry-privacy.md</code>。
          </p>
        </div>
      ) : null}

      {data?.configured && data.storageHint ? (
        <p className="text-[11px] text-adminMuted">数据来源：{data.storageHint}</p>
      ) : null}

      {data?.configured ? (
        <>
          <section>
            <h2 className="border-b border-adminLine pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-adminMuted">
              日活跃设备（DAU）
            </h2>
            <div className="mt-4 flex items-end gap-1" style={{ minHeight: 120 }}>
              {data.dau.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[28px] rounded-t bg-adminFg/20"
                    style={{ height: `${Math.max(4, (d.count / maxDau) * 100)}px` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <span className="text-[9px] text-adminMuted">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-adminMuted">
              匿名设备 ID，按 UTC 日去重；非注册用户数。
            </p>
          </section>

          <section>
            <h2 className="border-b border-adminLine pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-adminMuted">
              最常打开页面
            </h2>
            <table className="mt-3 w-full max-w-xl text-left text-[12px]">
              <thead>
                <tr className="text-adminMuted">
                  <th className="pb-2 font-medium">screen</th>
                  <th className="pb-2 font-medium text-right">views</th>
                </tr>
              </thead>
              <tbody>
                {data.topScreens.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-adminMuted">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  data.topScreens.map((row) => (
                    <tr key={row.screen} className="border-t border-adminLine/60">
                      <td className="py-2 font-mono text-[11px]">{row.screen}</td>
                      <td className="py-2 text-right tabular-nums">{row.views}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="border-b border-adminLine pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-adminMuted">
              最常点击（白名单）
            </h2>
            <table className="mt-3 w-full max-w-xl text-left text-[12px]">
              <thead>
                <tr className="text-adminMuted">
                  <th className="pb-2 font-medium">target</th>
                  <th className="pb-2 font-medium text-right">count</th>
                </tr>
              </thead>
              <tbody>
                {data.topTaps.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-adminMuted">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  data.topTaps.map((row) => (
                    <tr key={row.target} className="border-t border-adminLine/60">
                      <td className="py-2 font-mono text-[11px]">{row.target}</td>
                      <td className="py-2 text-right tabular-nums">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="border-b border-adminLine pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-adminMuted">
              自然场景
            </h2>
            <table className="mt-3 w-full max-w-2xl text-left text-[12px]">
              <thead>
                <tr className="text-adminMuted">
                  <th className="pb-2 font-medium">scene_id</th>
                  <th className="pb-2 font-medium text-right">views</th>
                  <th className="pb-2 font-medium text-right">sessions</th>
                  <th className="pb-2 font-medium text-right">总时长</th>
                </tr>
              </thead>
              <tbody>
                {data.topScenes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-adminMuted">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  data.topScenes.map((row) => (
                    <tr key={row.scene_id} className="border-t border-adminLine/60">
                      <td className="py-2 font-mono text-[11px]">{row.scene_id}</td>
                      <td className="py-2 text-right tabular-nums">{row.views}</td>
                      <td className="py-2 text-right tabular-nums">{row.sessions}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatDuration(row.total_duration_ms)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
