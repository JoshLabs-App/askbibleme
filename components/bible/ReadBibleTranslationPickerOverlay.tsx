"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";

type Option = { id: string; label: string; language?: string };

type Props = {
  open: boolean;
  mode: "primary" | "contrast";
  title: string;
  options: Option[];
  primaryValue: string;
  contrastValues: string[];
  noneLabel: string;
  confirmLabel: string;
  onClose: () => void;
  onSelectPrimary: (id: string) => void;
  onConfirmContrast: (ids: string[]) => void;
};

/** 对齐 App：译本不在设置卡片内展开，进入独立的窄栏羊皮选择页。 */
export function ReadBibleTranslationPickerOverlay({
  open,
  mode,
  title,
  options,
  primaryValue,
  contrastValues,
  noneLabel,
  confirmLabel,
  onClose,
  onSelectPrimary,
  onConfirmContrast,
}: Props) {
  const [draft, setDraft] = useState<string[]>(contrastValues);
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"common" | "all">("common");
  const [activeLanguage, setActiveLanguage] = useState("");

  const languageLabel = (language: string) => {
    const lang = language.toLowerCase();
    if (lang.startsWith("zh-hant")) return "中文（繁體）";
    if (lang.startsWith("zh")) return "中文（简体）";
    if (lang.startsWith("en")) return "英文";
    if (lang.startsWith("es")) return "西班牙语";
    if (lang.startsWith("he")) return "希伯来语";
    return "其他";
  };

  const pinnedOptions = useMemo(
    () => options.filter((option) => !option.id || option.id.startsWith("__")),
    [options],
  );
  const regularOptions = useMemo(
    () => options.filter((option) => option.id && !option.id.startsWith("__")),
    [options],
  );
  const languageGroups = useMemo(() => {
    const groups = new Map<string, Option[]>();
    for (const option of regularOptions) {
      const language = option.language?.trim() || "other";
      groups.set(language, [...(groups.get(language) ?? []), option]);
    }
    return [...groups.entries()].map(([language, items]) => ({ language, items }));
  }, [regularOptions]);
  const query = searchText.trim().toLowerCase();
  const filterOptions = (items: Option[]) =>
    query ? items.filter((option) => `${option.id} ${option.label}`.toLowerCase().includes(query)) : items;
  const visiblePinned = filterOptions(pinnedOptions);
  const filteredGroups = languageGroups
    .map((group) => ({ ...group, items: filterOptions(group.items) }))
    .filter((group) => group.items.length > 0);
  const currentLanguage = filteredGroups.some((group) => group.language === activeLanguage)
    ? activeLanguage
    : filteredGroups[0]?.language ?? "";
  const commonOptions = filterOptions(regularOptions.slice(0, 10));
  const visibleOptions =
    viewMode === "common"
      ? commonOptions
      : filteredGroups.find((group) => group.language === currentLanguage)?.items ?? [];

  useEffect(() => {
    if (open) {
      setDraft(contrastValues);
      setSearchText("");
      setViewMode("common");
      const selected = regularOptions.find((option) => option.id === primaryValue);
      setActiveLanguage(selected?.language?.trim() || languageGroups[0]?.language || "");
    }
  }, [contrastValues, languageGroups, open, primaryValue, regularOptions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const toggleContrast = (id: string) => {
    setDraft((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(28,20,16,0.35)] p-3">
      <button type="button" className="absolute inset-0" aria-label="关闭译本选择" onClick={onClose} />
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
            aria-label="返回阅读设置"
          >
            <ShellMaterialIcon name="arrow_back_ios_new" size={20} color="#5c4030" />
          </button>
          <div className="min-w-0 flex-1 pr-11 text-center">
            <h2 className="text-[18px] font-semibold">{title}</h2>
            <p className="mt-0.5 text-[12px] text-[#6e5240]">先选语言，再选这个语言里的版本。</p>
          </div>
        </header>

        <div className="border-b border-[rgba(120,53,15,0.16)] px-3 py-3">
          <label className="flex h-10 items-center gap-2 rounded-full border border-[rgba(120,53,15,0.25)] bg-[rgba(255,252,245,0.55)] px-3">
            <ShellMaterialIcon name="search" size={18} color="#8b6b55" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索译本"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1c1410] outline-none placeholder:text-[#8b6b55]"
            />
            {searchText ? (
              <button type="button" onClick={() => setSearchText("")} aria-label="清除搜索">
                <ShellMaterialIcon name="close" size={16} color="#8b6b55" />
              </button>
            ) : null}
          </label>
          <div className="mt-3 flex gap-2">
            {(["common", "all"] as const).map((modeKey) => {
              const active = viewMode === modeKey;
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => setViewMode(modeKey)}
                  className={[
                    "min-w-[70px] rounded-full border px-4 py-1.5 text-[14px] font-semibold",
                    active
                      ? "border-[#d97707] bg-[rgba(217,119,7,0.12)] text-[#d97707]"
                      : "border-[rgba(120,53,15,0.24)] bg-[rgba(255,252,245,0.45)] text-[#6e5240]",
                  ].join(" ")}
                >
                  {modeKey === "common" ? "常用" : "全部"}
                </button>
              );
            })}
          </div>
          {viewMode === "all" ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {filteredGroups.map((group) => {
                const active = group.language === currentLanguage;
                return (
                  <button
                    key={group.language}
                    type="button"
                    onClick={() => setActiveLanguage(group.language)}
                    className={[
                      "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium",
                      active
                        ? "border-[#d97707] bg-[rgba(217,119,7,0.12)] text-[#d97707]"
                        : "border-[rgba(120,53,15,0.22)] bg-[rgba(255,252,245,0.45)] text-[#6e5240]",
                    ].join(" ")}
                  >
                    {languageLabel(group.language)} · {group.items.length}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-[13px] font-medium text-[#8b6b55]">常用版本</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {mode === "contrast" ? (
            <button
              type="button"
              onClick={() => setDraft([])}
              className="mb-2 flex min-h-[48px] w-full items-center justify-between rounded-lg border border-[rgba(120,53,15,0.22)] bg-[rgba(255,252,245,0.52)] px-3 text-left"
            >
              <span>{noneLabel}</span>
              {draft.length === 0 ? <ShellMaterialIcon name="check" size={20} color="#d97707" /> : null}
            </button>
          ) : null}

          <div className="space-y-2">
            {[...visiblePinned, ...visibleOptions].map((option) => {
              const selected =
                mode === "primary" ? option.id === primaryValue : draft.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (mode === "primary") {
                      onSelectPrimary(option.id);
                      onClose();
                    } else {
                      toggleContrast(option.id);
                    }
                  }}
                  className={[
                    "flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-[15px]",
                    selected
                      ? "border-[#d97707] bg-[rgba(217,119,7,0.12)]"
                      : "border-[rgba(120,53,15,0.22)] bg-[rgba(255,252,245,0.52)]",
                  ].join(" ")}
                >
                  <span className="min-w-0 flex-1">{option.label}</span>
                  {selected ? <ShellMaterialIcon name="check" size={20} color="#d97707" /> : null}
                </button>
              );
            })}
            {visiblePinned.length === 0 && visibleOptions.length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-semibold text-[#1c1410]">没有找到匹配结果</p>
                <p className="mt-1 text-[13px] text-[#8b6b55]">换个关键词，或者清除搜索。</p>
              </div>
            ) : null}
          </div>
        </div>

        {mode === "contrast" ? (
          <footer className="border-t border-[rgba(120,53,15,0.2)] p-3">
            <button
              type="button"
              onClick={() => {
                onConfirmContrast(draft);
                onClose();
              }}
              className="min-h-[46px] w-full rounded-lg border border-[rgba(120,53,15,0.36)] bg-[rgba(217,119,7,0.14)] text-[15px] font-semibold"
            >
              {confirmLabel}
            </button>
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
