"use client";

import { useEffect, useState } from "react";

function formatBuildLabel(raw: string): string {
  const id = raw.trim();
  if (!id || id === "development") return "Web · dev";
  if (id.length <= 10) return `Web · ${id}`;
  return `Web · ${id.slice(0, 8)}`;
}

/** 抽屉底部构建标识 — 对齐 App `getMobileAppVersionLabel()` 页脚。 */
export function ShellNavDrawerVersionFooter() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/app-build.json", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const id = data && typeof data.id === "string" ? data.id : "";
        setLabel(formatBuildLabel(id));
      })
      .catch(() => {
        if (!cancelled) setLabel("Web");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!label) return null;

  return (
    <p className="shell-nav-drawer-version-footer" aria-label={label}>
      {label}
    </p>
  );
}
