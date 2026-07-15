"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { AppLocale } from "@/lib/i18n/config";
import {
  buildHomeVersePoolMenuRows,
  resolveHomeVersePoolMenuLabel,
  type HomeVersePoolMenuScopeId,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";
import { homeListeningPosition } from "@/lib/home-listening/fixed-verse-flow";
import {
  getHomeListeningProgressServerSnapshot,
  getHomeListeningProgressSnapshot,
  subscribeHomeListeningProgress,
} from "@/lib/home-listening/progress";

function formatListeningTime(totalSeconds: number, zh: boolean): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60);
  if (totalMinutes < 60) return zh ? `${totalMinutes}分钟` : `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return zh ? `${hours}小时${minutes ? `${minutes}分` : ""}` : `${hours}h${minutes ? ` ${minutes}m` : ""}`;
}

function honorLabel(id: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    "listen-1h": ["静听一小时", "One quiet hour"],
    "listen-7h": ["七小时同行", "Seven hours together"],
    "listen-21h": ["二十一小时相伴", "Twenty-one hours together"],
    "listen-49h": ["四十九小时聆听", "Forty-nine listening hours"],
    "listen-100h": ["百小时同行", "One hundred hours together"],
    "journey-group-1": ["七节同行", "Seven verses together"],
    "journey-stage-1": ["一程经文", "One Scripture journey"],
    "journey-stage-3": ["三程同行", "Three journeys together"],
    "journey-stage-7": ["七程回响", "Seven journeys of Scripture"],
  };
  return labels[id]?.[zh ? 0 : 1] ?? id;
}

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
  const listening = useSyncExternalStore(
    subscribeHomeListeningProgress,
    getHomeListeningProgressSnapshot,
    getHomeListeningProgressServerSnapshot,
  );
  const scopeProgress = listening.progressByScope[selectedScope];
  const position = homeListeningPosition(scopeProgress?.cursor ?? 0);
  const latestHonor = listening.earnedHonors.at(-1);

  return (
    <div>
      <p className="shell-nav-drawer-section-label">{poolLabel ?? (zh ? "首页经文范围" : "Home Scripture range")}</p>
      <button
        type="button"
        className="shell-nav-drawer-select-trigger w-full"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shell-nav-drawer-select-label">{currentLabel ?? (zh ? "当前范围" : "Range")}</span>
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
                  row.indent === 1 ? "shell-nav-drawer-select-option-indent" : "",
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
      <div className="mt-2 flex items-start justify-between gap-4 px-1 text-[12px] leading-5 text-[#37352f]/65">
        <span>
          {zh ? "已聆听" : "Listened"} {formatListeningTime(listening.totalListeningSeconds, zh)}
        </span>
        <span className="text-right">
          {zh ? `第${position.stage}程 · 第${position.group}组` : `Journey ${position.stage} · Group ${position.group}`}
          {latestHonor ? <span className="block text-[#a85b17]">{honorLabel(latestHonor, zh)}</span> : null}
        </span>
      </div>
    </div>
  );
}
