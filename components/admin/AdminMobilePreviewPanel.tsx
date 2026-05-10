"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

const PREVIEW_ROUTES: { path: string; labelKey: string }[] = [
  { path: "/", labelKey: "admin.preview.routeMusicHome" },
  { path: "/relax", labelKey: "nav.relax" },
  { path: "/journey", labelKey: "nav.journey" },
  { path: "/read", labelKey: "nav.read" },
  { path: "/explore", labelKey: "nav.explore" },
];

/** iPhone 12 Pro：Safari / CSS 逻辑视口（pt），与真机一致 */
const IPHONE_12_PRO_W = 390;
const IPHONE_12_PRO_H = 844;
/** 外壳近似尺寸（p-[10px] + 刘海 mb-2 h-6 + 屏幕），首帧占位；实测以 ref 为准 */
const PHONE_OUTER_FALLBACK_W = IPHONE_12_PRO_W + 20;
const PHONE_OUTER_FALLBACK_H = 10 + 24 + 8 + IPHONE_12_PRO_H + 10;

/**
 * 后台常驻「手机预览」：同源 iframe 嵌入真实前台（品牌色、底栏与线上逻辑一致）。
 */
export function AdminMobilePreviewPanel({
  stacked = false,
  className = "",
}: {
  /** 窄屏：固定在视口比例高度内，预览自动缩放适配 */
  stacked?: boolean;
  className?: string;
}) {
  const { t } = useLocale();
  const labelId = useId();
  const [routeIdx, setRouteIdx] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const [previewFit, setPreviewFit] = useState({
    scale: 1,
    pw: PHONE_OUTER_FALLBACK_W,
    ph: PHONE_OUTER_FALLBACK_H,
  });

  useLayoutEffect(() => {
    const root = containerRef.current;
    const phone = phoneRef.current;
    if (!root || !phone) return;

    const update = () => {
      const cw = root.clientWidth;
      const ch = root.clientHeight;
      const pw = phone.offsetWidth;
      const ph = phone.offsetHeight;
      if (cw < 8 || ch < 8 || pw < 8 || ph < 8) return;
      const gutter = 16;
      const sx = (cw - gutter) / pw;
      const sy = (ch - gutter) / ph;
      const raw = Math.min(sx, sy, 1);
      const scale = Number.isFinite(raw) ? Math.max(0.22, Math.min(1, raw)) : 1;
      setPreviewFit({ scale, pw, ph });
    };

    const ro = new ResizeObserver(update);
    ro.observe(root);
    update();
    return () => ro.disconnect();
  }, []);

  const src = useMemo(() => {
    const path = PREVIEW_ROUTES[routeIdx]?.path ?? "/";
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [routeIdx]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <section
      aria-labelledby={labelId}
      className={`flex min-h-0 flex-col bg-adminBg ${stacked ? "h-[min(420px,56vh)] min-h-[300px]" : "h-full min-h-[320px]"} ${className}`}
    >
      <header
        className={`shrink-0 border-b border-adminLine ${stacked ? "px-3 py-2.5" : "px-4 py-3"}`}
      >
        <p id={labelId} className="text-[12px] font-medium text-adminFg md:text-[13px]">
          {t("admin.preview.title")}
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-adminMuted md:text-[11px]">
          {t("admin.preview.hint", {
            w: String(IPHONE_12_PRO_W),
            h: String(IPHONE_12_PRO_H),
          })}
        </p>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-adminLine bg-adminPanel/35 px-3 py-2 md:px-4">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-adminMuted sm:flex-initial">
          <span className="shrink-0">{t("admin.preview.page")}</span>
          <select
            value={routeIdx}
            onChange={(e) => setRouteIdx(Number(e.target.value))}
            className="min-w-0 flex-1 rounded-md border border-adminLine bg-adminBg px-2 py-1.5 text-[12px] text-adminFg sm:flex-initial"
          >
            {PREVIEW_ROUTES.map((r, i) => (
              <option key={r.path} value={i}>
                {t(r.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={refresh}
          className="shrink-0 rounded-md border border-adminLine bg-adminBg px-2.5 py-1.5 text-[11px] font-medium text-adminFg hover:border-sand"
        >
          {t("common.refresh")}
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-3 md:px-3 md:py-4"
      >
        <div
          className="relative shrink-0"
          style={{
            width: previewFit.pw * previewFit.scale,
            height: previewFit.ph * previewFit.scale,
          }}
        >
          <div
            ref={phoneRef}
            className="absolute left-0 top-0 flex shrink-0 flex-col items-center rounded-[2.6rem] bg-[#1a1a1c] p-[10px] shadow-[0_16px_48px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.06]"
            style={{
              width: PHONE_OUTER_FALLBACK_W,
              transform: `scale(${previewFit.scale})`,
              transformOrigin: "top left",
            }}
          >
            <div
              className="mb-2 h-6 w-[88px] shrink-0 rounded-full bg-black/85 ring-1 ring-white/[0.08]"
              aria-hidden
            />
            <div
              className="shrink-0 overflow-hidden rounded-[2rem] bg-black ring-1 ring-white/[0.05]"
              style={{ width: IPHONE_12_PRO_W, height: IPHONE_12_PRO_H }}
            >
              <iframe
                key={`${src}-${reloadKey}`}
                title={t("admin.preview.iframeTitle")}
                src={src}
                className="block h-full w-full border-0 bg-canvas"
                width={IPHONE_12_PRO_W}
                height={IPHONE_12_PRO_H}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
