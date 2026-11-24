"use client";

import { useCallback, useEffect, useState } from "react";
import { AskBibleCodeProbeButton } from "@/components/app-shell/AskBibleCodeProbe";
import { useMobileModel } from "@/components/app-shell/MobileModelStage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  checkWebBuildUpdate,
  formatBuildVersionWithTime,
  formatCompactBottomVersion,
  getLoadedBuildId,
  getLoadedBuiltAt,
  getStagedBuildMeta,
  subscribeStagedBuildMeta,
  triggerWebBuildReload,
} from "@/lib/pwa/check-app-update";
import { isEmbeddedPreviewFrame } from "@/lib/shell/app-shell-portal-root";
import "./askbible-bottom-utility-bar.css";

type Variant = "parchment" | "scenery" | "inline";

/**
 * 全站统一底栏轻量状态条：
 * 1. 常驻轻量版本号显示 + 静默无感更新状态（点击可手动静默校验，绝不弹打断式大弹窗）；
 * 2. 显式「定位」探针按钮（Alt+Shift+C，管理员高亮复制 file:line，普通访客低饱和弱化常驻展示绝不隐藏）；
 * 3. 桌面端（>768px）一键切入「1:1 手机模型（390 × 844）」入口。
 */
export function AskBibleBottomUtilityBar({ variant = "parchment" }: { variant?: Variant }) {
  const { locale } = useLocale();
  const isEn = locale === "en";
  const { desktopEligible, mobileModelOpen, setMobileModelOpen } = useMobileModel();

  const [embedded, setEmbedded] = useState(false);
  const [versionText, setVersionText] = useState("v2.0");
  const [fullVersionTitle, setFullVersionTitle] = useState("");
  const [stagedReady, setStagedReady] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);

  useEffect(() => {
    setEmbedded(isEmbeddedPreviewFrame());
    const id = getLoadedBuildId();
    const builtAt = getLoadedBuiltAt();
    setVersionText(formatCompactBottomVersion(id));
    setFullVersionTitle(formatBuildVersionWithTime(id, builtAt));
    setStagedReady(Boolean(getStagedBuildMeta()));
    return subscribeStagedBuildMeta(() => {
      setStagedReady(Boolean(getStagedBuildMeta()));
    });
  }, []);

  useEffect(() => {
    if (!statusHint) return;
    const t = window.setTimeout(() => setStatusHint(null), 2200);
    return () => window.clearTimeout(t);
  }, [statusHint]);

  const onVersionClick = useCallback(async () => {
    if (getStagedBuildMeta()) {
      setStatusHint(isEn ? "Updating…" : "正在切换新版…");
      triggerWebBuildReload(300);
      return;
    }
    setStatusHint(isEn ? "Checking…" : "检查中…");
    const outcome = await checkWebBuildUpdate();
    if (outcome.status === "update-available") {
      setStatusHint(isEn ? "Updating…" : "正在切换新版…");
      triggerWebBuildReload(450);
      return;
    }
    if (outcome.status === "up-to-date") {
      setVersionText(formatCompactBottomVersion(outcome.buildId));
      setStatusHint(isEn ? "✓ Up to date" : "✓ 已是最新");
      return;
    }
    setStatusHint(isEn ? "Offline" : "离线缓存态");
  }, [isEn]);

  // 官网首屏手机框内嵌的只读静态预览 iframe 不重复叠底栏工具条
  if (embedded) return null;

  const barClass = [
    "ab-bottom-utility-bar",
    variant === "scenery"
      ? "ab-bottom-utility-bar--scenery"
      : variant === "inline"
        ? "ab-bottom-utility-bar--inline"
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={barClass} role="group" aria-label={isEn ? "Version and tools" : "版本与定位工具栏"}>
      <button
        type="button"
        className="ab-utility-version-btn"
        data-ab-nav-id="version-status"
        onClick={() => void onVersionClick()}
        title={
          stagedReady
            ? isEn
              ? `${fullVersionTitle} · New version ready in background (click to switch now)`
              : `${fullVersionTitle} · 后台已就绪新版（空闲自动切换，点击立即生效）`
            : isEn
              ? `${fullVersionTitle} · Click to check for updates silently`
              : `${fullVersionTitle} · 点击静默检查更新`
        }
      >
        {stagedReady ? <span className="ab-utility-version-dot" aria-hidden="true" /> : null}
        <span>{statusHint ?? versionText}</span>
      </button>

      <span className="ab-utility-sep" aria-hidden="true">
        ·
      </span>

      <AskBibleCodeProbeButton />

      {desktopEligible && !mobileModelOpen ? (
        <>
          <span className="ab-utility-sep ab-utility-phone-toggle" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            className="ab-utility-phone-toggle"
            data-ab-nav-id="utility-phone-model"
            aria-pressed={mobileModelOpen}
            title={
              isEn
                ? "Switch between Desktop and 1:1 Phone Model (390×844)"
                : "切换 1:1 手机模型（390×844），保留阅读与音频进度"
            }
            onClick={() => setMobileModelOpen(true)}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4.2" y="1.5" width="7.6" height="13" rx="1.6" />
              <path d="M7.2 12.2h1.6" />
            </svg>
            <span>{isEn ? "1:1 Phone" : "1:1 手机模型"}</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
