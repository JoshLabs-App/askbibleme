"use client";

import { useEffect, useState } from "react";
import {
  ASKBIBLE_MANUAL_CHECK_EVENT,
  fetchRemoteBuildMeta,
  formatBuildVersionWithTime,
  getLoadedBuildId,
  getLoadedBuiltAt,
} from "@/lib/pwa/check-app-update";

/** 抽屉底部构建标识与时间 — 对齐原生 App 页脚，点击亦可触发「检查更新」。 */
export function ShellNavDrawerVersionFooter() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getLoadedBuildId();
    const loadedAt = getLoadedBuiltAt();
    if (loaded) setLabel(formatBuildVersionWithTime(loaded, loadedAt));

    let cancelled = false;
    void fetchRemoteBuildMeta()
      .then((meta) => {
        if (cancelled || !meta?.id) return;
        setLabel(formatBuildVersionWithTime(meta.id, meta.builtAt || loadedAt));
      })
      .catch(() => {
        if (!cancelled && !loaded) setLabel("Web");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!label) return null;

  return (
    <button
      type="button"
      className="shell-nav-drawer-version-footer w-full cursor-pointer border-0 bg-transparent text-center"
      aria-label={label}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(ASKBIBLE_MANUAL_CHECK_EVENT));
      }}
    >
      {label}
    </button>
  );
}
