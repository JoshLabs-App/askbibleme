"use client";

import { useCallback, useId, useMemo, useState } from "react";

const PREVIEW_ROUTES: { path: string; label: string }[] = [
  { path: "/", label: "音乐首页" },
  { path: "/journey", label: "旅程" },
  { path: "/read", label: "圣经" },
  { path: "/explore", label: "探索" },
];

const FRAME_W = 390;
const FRAME_H_DESKTOP = 780;
const FRAME_H_STACKED = 560;

/**
 * 后台常驻「手机预览」：同源 iframe 嵌入真实前台（品牌色、底栏与线上逻辑一致）。
 */
export function AdminMobilePreviewPanel({
  stacked = false,
  className = "",
}: {
  /** 窄屏：排在主内容下方时略缩短高度 */
  stacked?: boolean;
  className?: string;
}) {
  const labelId = useId();
  const [routeIdx, setRouteIdx] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const frameH = stacked ? FRAME_H_STACKED : FRAME_H_DESKTOP;

  const src = useMemo(() => {
    const path = PREVIEW_ROUTES[routeIdx]?.path ?? "/";
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [routeIdx]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <section
      aria-labelledby={labelId}
      className={`flex min-h-0 flex-col bg-adminBg ${stacked ? "" : "h-full min-h-[320px]"} ${className}`}
    >
      <header
        className={`shrink-0 border-b border-adminLine ${stacked ? "px-3 py-2.5" : "px-4 py-3"}`}
      >
        <p id={labelId} className="text-[12px] font-medium text-adminFg md:text-[13px]">
          手机端预览
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-adminMuted md:text-[11px]">
          同源实时渲染 · 可切换路由与刷新；音频需在框内手动播放。
        </p>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-adminLine bg-adminPanel/35 px-3 py-2 md:px-4">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-adminMuted sm:flex-initial">
          <span className="shrink-0">页面</span>
          <select
            value={routeIdx}
            onChange={(e) => setRouteIdx(Number(e.target.value))}
            className="min-w-0 flex-1 rounded-md border border-adminLine bg-adminBg px-2 py-1.5 text-[12px] text-adminFg sm:flex-initial"
          >
            {PREVIEW_ROUTES.map((r, i) => (
              <option key={r.path} value={i}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={refresh}
          className="shrink-0 rounded-md border border-adminLine bg-adminBg px-2.5 py-1.5 text-[11px] font-medium text-adminFg hover:border-sand"
        >
          刷新
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden px-2 py-4 md:px-3 md:py-5">
        <div
          className="flex shrink-0 flex-col items-center rounded-[2.6rem] bg-[#1a1a1c] p-[10px] shadow-[0_16px_48px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.06]"
          style={{ width: `min(${FRAME_W + 20}px, 100%)` }}
        >
          <div
            className="mb-2 h-6 w-[88px] shrink-0 rounded-full bg-black/85 ring-1 ring-white/[0.08]"
            aria-hidden
          />
          <div
            className="w-full max-w-[390px] overflow-hidden rounded-[2rem] bg-black ring-1 ring-white/[0.05]"
            style={{ height: frameH, maxHeight: stacked ? "56vh" : undefined }}
          >
            <iframe
              key={`${src}-${reloadKey}`}
              title="移动端预览"
              src={src}
              className="block h-full w-full border-0 bg-canvas"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
