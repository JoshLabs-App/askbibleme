"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { AppLocale } from "@/lib/i18n/config";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
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
  variant?: "drawer" | "settings";
  showStats?: boolean;
};

type PoolPickerOverlayProps = {
  open: boolean;
  locale: AppLocale;
  rows: ReturnType<typeof buildHomeVersePoolMenuRows>;
  selectedScope: HomeVersePoolMenuScopeId;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  onClose: () => void;
  onSelectScope: (next: HomeVersePoolMenuScopeId) => void;
};

function HomeVersePoolPickerOverlay({
  open,
  locale,
  rows,
  selectedScope,
  title,
  subtitle,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
  onClose,
  onSelectScope,
}: PoolPickerOverlayProps) {
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearchText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const query = searchText.trim().toLowerCase();
  const visibleRows = query
    ? rows.filter((row) => {
        if (row.kind === "header") return false;
        return row.label.toLowerCase().includes(query) || row.scopeId.toLowerCase().includes(query);
      })
    : rows;
  const zh = locale === "zh-CN" || locale === "zh-TW";

  return createPortal(
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-[rgba(28,20,16,0.35)] p-3">
      <button type="button" className="absolute inset-0" aria-label={zh ? "关闭经文池选择" : "Close verse pool picker"} onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="read-parchment-modal-surface relative z-10 flex h-[min(42rem,90dvh)] w-[min(22.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[rgba(120,53,15,0.42)] text-[#1c1410] shadow-[0_8px_30px_rgba(28,20,16,0.2)]"
      >
        <header className="flex min-h-[68px] items-start border-b border-[rgba(120,53,15,0.2)] px-2 py-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            aria-label={zh ? "返回设置" : "Back to settings"}
          >
            <ShellMaterialIcon name="arrow_back_ios_new" size={20} color="#5c4030" />
          </button>
          <div className="min-w-0 flex-1 pr-11 text-center">
            <h2 className="text-[18px] font-semibold">{title}</h2>
            <p className="mt-0.5 text-[12px] text-[#6e5240]">{subtitle}</p>
          </div>
        </header>

        <div className="border-b border-[rgba(120,53,15,0.16)] px-3 py-3">
          <label className="flex h-10 items-center gap-2 rounded-full border border-[rgba(120,53,15,0.25)] bg-[rgba(255,252,245,0.55)] px-3">
            <ShellMaterialIcon name="search" size={18} color="#8b6b55" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1c1410] outline-none placeholder:text-[#8b6b55]"
            />
            {searchText ? (
              <button type="button" onClick={() => setSearchText("")} aria-label={zh ? "清除搜索" : "Clear search"}>
                <ShellMaterialIcon name="close" size={16} color="#8b6b55" />
              </button>
            ) : null}
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-2">
            {visibleRows.map((row, index) =>
              row.kind === "header" ? (
                <div
                  key={`h-${row.label}-${index}`}
                  className="px-2 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6e5240]/55"
                >
                  {row.label}
                </div>
              ) : (
                <button
                  key={row.scopeId}
                  type="button"
                  onClick={() => {
                    onSelectScope(row.scopeId);
                    onClose();
                  }}
                  className={[
                    "flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-[15px]",
                    row.indent === 1 ? "pl-5" : "",
                    selectedScope === row.scopeId
                      ? "border-[#d97707] bg-[rgba(217,119,7,0.12)]"
                      : "border-[rgba(120,53,15,0.22)] bg-[rgba(255,252,245,0.52)]",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  {selectedScope === row.scopeId ? (
                    <ShellMaterialIcon name="check_circle" size={20} color="#d97707" />
                  ) : null}
                </button>
              ),
            )}
            {visibleRows.length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-semibold text-[#1c1410]">{emptyTitle}</p>
                <p className="mt-1 text-[13px] text-[#8b6b55]">{emptyHint}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function HomeVersePoolMenuPicker({
  locale,
  selectedScope,
  onSelectScope,
  poolLabel,
  currentLabel,
  variant = "drawer",
  showStats = true,
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

  const settings = variant === "settings";
  const overlayTitle = zh ? "选择经文池" : "Choose verse pool";
  const overlaySubtitle = zh ? "选择首页金句轮播使用的经文范围。" : "Choose the Scripture range used for the home verse rotation.";

  return (
    <div>
      {poolLabel ? (
        <p className={settings ? "sr-only" : "shell-nav-drawer-section-label"}>
          {poolLabel}
        </p>
      ) : settings ? null : (
        <p className="shell-nav-drawer-section-label">{zh ? "首页经文范围" : "Home Scripture range"}</p>
      )}
      <button
        type="button"
        className={
          settings
            ? "nature-home-settings-select-trigger flex min-h-[38px] w-full items-center justify-between gap-2 rounded-[9px] border px-3 py-1.5 text-left transition"
            : "shell-nav-drawer-select-trigger w-full"
        }
        aria-expanded={open}
        aria-haspopup={settings ? "dialog" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={
            settings
              ? "min-w-0 truncate text-[13px] font-semibold text-[#1c1410]"
              : "shell-nav-drawer-select-label"
          }
        >
          {currentLabel ?? (zh ? "当前范围" : "Range")}
        </span>
        <span
          className={
            settings
              ? "min-w-0 truncate text-right text-[13px] font-semibold text-[#6e5240]"
              : "shell-nav-drawer-select-value"
          }
        >
          {selectedLabel}
        </span>
      </button>
      {settings ? (
        <HomeVersePoolPickerOverlay
          open={open}
          locale={locale}
          rows={rows}
          selectedScope={selectedScope}
          title={overlayTitle}
          subtitle={overlaySubtitle}
          searchPlaceholder={zh ? "搜索经文池" : "Search verse pools"}
          emptyTitle={zh ? "没有找到匹配结果" : "No matching pools"}
          emptyHint={zh ? "换个关键词，或者清除搜索。" : "Try another keyword, or clear search."}
          onClose={() => setOpen(false)}
          onSelectScope={onSelectScope}
        />
      ) : open ? (
        <div
          className={
            settings
              ? "nature-home-settings-select-menu mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-[9px] border py-1"
              : "shell-nav-drawer-select-options max-h-64 overflow-y-auto"
          }
        >
          {rows.map((row, index) =>
            row.kind === "header" ? (
              <div
                key={`h-${row.label}-${index}`}
                className={
                  settings
                    ? "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6e5240]/55"
                    : "shell-nav-drawer-select-group"
                }
              >
                {row.label}
              </div>
            ) : (
              <button
                key={row.scopeId}
                type="button"
                className={
                  settings
                    ? [
                        "nature-home-settings-select-option flex min-h-[34px] w-full items-center justify-between gap-2 px-3 text-left text-[13px] transition",
                        row.indent === 1 ? "pl-5" : "",
                        selectedScope === row.scopeId ? "nature-home-settings-select-option--selected font-semibold" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : [
                        "shell-nav-drawer-select-option w-full text-left",
                        row.indent === 1 ? "shell-nav-drawer-select-option-indent" : "",
                        selectedScope === row.scopeId ? "shell-nav-drawer-select-option-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                }
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
      {showStats ? (
      <div className="mt-2 flex items-start justify-between gap-4 px-1 text-[12px] leading-5 text-[#37352f]/65">
        <span>
          {zh ? "已聆听" : "Listened"} {formatListeningTime(listening.totalListeningSeconds, zh)}
        </span>
        <span className="text-right">
          {zh ? `第${position.stage}程 · 第${position.group}组` : `Journey ${position.stage} · Group ${position.group}`}
          {latestHonor ? <span className="block text-[#a85b17]">{honorLabel(latestHonor, zh)}</span> : null}
        </span>
      </div>
      ) : null}
    </div>
  );
}
