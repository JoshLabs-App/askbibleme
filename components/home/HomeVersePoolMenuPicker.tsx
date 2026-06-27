"use client";

import { useMemo, useState } from "react";
import type { AppLocale } from "@/lib/i18n/config";
import {
  buildHomeVersePoolMenuRows,
  resolveHomeVersePoolMenuLabel,
  type HomeVersePoolMenuScopeId,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";

type Props = {
  locale: AppLocale;
  selectedScope: HomeVersePoolMenuScopeId;
  onSelectScope: (next: HomeVersePoolMenuScopeId) => void;
  poolLabel?: string;
  currentLabel?: string;
};

export function HomeVersePoolMenuPicker({
  locale,
  selectedScope,
  onSelectScope,
  poolLabel,
  currentLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => buildHomeVersePoolMenuRows(locale), [locale]);
  const selectedLabel = resolveHomeVersePoolMenuLabel(selectedScope, locale);
  const zh = locale === "zh-CN" || locale === "zh-TW";

  return (
    <div>
      <p className="shell-nav-drawer-section-label">{poolLabel ?? (zh ? "主页经文池" : "Home verse pool")}</p>
      <button
        type="button"
        className="shell-nav-drawer-select-trigger w-full"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shell-nav-drawer-select-label">{currentLabel ?? (zh ? "当前池" : "Pool")}</span>
        <span className="shell-nav-drawer-select-value">{selectedLabel}</span>
      </button>
      {open ? (
        <div className="shell-nav-drawer-select-options max-h-64 overflow-y-auto">
          {rows.map((row, index) =>
            row.kind === "header" ? (
              <div key={`h-${row.label}-${index}`} className="shell-nav-drawer-select-group">
                {row.label}
              </div>
            ) : (
              <button
                key={row.scopeId}
                type="button"
                className={[
                  "shell-nav-drawer-select-option w-full text-left",
                  row.indent ? "shell-nav-drawer-select-option-indent" : "",
                  selectedScope === row.scopeId ? "shell-nav-drawer-select-option-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  onSelectScope(row.scopeId);
                  setOpen(false);
                }}
              >
                {row.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
