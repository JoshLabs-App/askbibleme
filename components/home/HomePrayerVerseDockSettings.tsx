"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HOME_BIBLE_TRANSLATIONS_CATALOG_URL, HOME_PRAYER_POOL_PUBLIC_BASE } from "@/lib/home-prayer-pools/constants";
import {
  memoryNamespaceFromScope,
  readHomePrayerVersePrefs,
  requestHomePrayerVerseFeedReload,
  writeHomePrayerVersePrefs,
} from "@/lib/home-prayer-pools/prefs";
import type { HomePrayerVersePrefsV1 } from "@/lib/home-prayer-pools/types";

type Meta = { version: 1; categories: { id: string; title: string }[] };

type Catalog = { version: 1; translations: { id: string; labelZh: string; labelEn: string; language: string }[] };

type Props = {
  /** `dock`：自然页底栏折叠面板；`drawer`：侧滑菜单内常显区块 */
  placement?: "dock" | "drawer";
  /** `placement="drawer"` 时由父级传入，抽屉打开动画结束后再为 true，用于与 localStorage 同步 */
  drawerOpen?: boolean;
};

export function HomePrayerVerseDockSettings({ placement = "dock", drawerOpen = false }: Props) {
  const { t, locale } = useLocale();
  const isDock = placement === "dock";
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [prefs, setPrefs] = useState<HomePrayerVersePrefsV1>(() => readHomePrayerVersePrefs());

  useEffect(() => {
    let cancelled = false;
    void fetch(`${HOME_PRAYER_POOL_PUBLIC_BASE}/_meta.json`, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.version === 1 && Array.isArray(data.categories)) {
          setMeta(data as Meta);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(HOME_BIBLE_TRANSLATIONS_CATALOG_URL, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.version === 1 && Array.isArray(data.translations)) {
          setCatalog(data as Catalog);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const zhCatalog = useMemo(
    () =>
      (catalog?.translations ?? []).filter((x) => {
        const l = (x.language || "").toLowerCase();
        return l === "zh-hans" || l === "zh-hant" || l.startsWith("zh");
      }),
    [catalog],
  );

  const enCatalog = useMemo(
    () => (catalog?.translations ?? []).filter((x) => (x.language || "").toLowerCase().startsWith("en")),
    [catalog],
  );

  useEffect(() => {
    if (!isDock || !open) return;
    setPrefs(readHomePrayerVersePrefs());
  }, [isDock, open]);

  useEffect(() => {
    if (isDock || !drawerOpen) return;
    setPrefs(readHomePrayerVersePrefs());
  }, [isDock, drawerOpen]);

  const persist = useCallback((next: HomePrayerVersePrefsV1) => {
    writeHomePrayerVersePrefs(next);
    setPrefs(next);
    requestHomePrayerVerseFeedReload();
  }, []);

  const resetMemory = useCallback(() => {
    const p = readHomePrayerVersePrefs();
    const ns = memoryNamespaceFromScope(p.verseScope);
    persist({
      ...p,
      memoryByNamespace: { ...p.memoryByNamespace, [ns]: {} },
    });
  }, [persist]);

  useEffect(() => {
    if (zhCatalog.length === 0 || enCatalog.length === 0) return;
    const p = readHomePrayerVersePrefs();
    const zhOk = zhCatalog.some((x) => x.id === p.verseTextZhTranslationId);
    const enOk = enCatalog.some((x) => x.id === p.verseTextEnTranslationId);
    if (zhOk && enOk) return;
    persist({
      ...p,
      verseTextZhTranslationId: zhOk ? p.verseTextZhTranslationId : zhCatalog[0]!.id,
      verseTextEnTranslationId: enOk ? p.verseTextEnTranslationId : enCatalog[0]!.id,
    });
  }, [zhCatalog, enCatalog, persist]);

  if (!meta?.categories.length) return null;

  const formInner = (
    <div
      className={
        isDock
          ? "mt-2 space-y-3 rounded-xl border border-white/12 bg-black/25 px-3 py-3 text-[12px] text-white/88 sm:text-[13px]"
          : "space-y-3 rounded-lg border border-neutral-200/80 bg-white/60 px-2.5 py-2.5 text-[13px] text-[#37352f]/90 backdrop-blur-sm sm:text-[14px]"
      }
    >
      <fieldset className="space-y-2 border-0 p-0">
        <legend
          className={
            isDock
              ? "text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55"
              : "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#37352f]/50"
          }
        >
          {t("nature.homeVerse.scopeLegend")}
        </legend>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name={isDock ? "hv-scope-dock" : "hv-scope-drawer"}
            className="mt-0.5"
            checked={prefs.verseScope.type === "all"}
            onChange={() => persist({ ...prefs, verseScope: { type: "all" } })}
          />
          <span>{t("nature.homeVerse.scopeAll")}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name={isDock ? "hv-scope-dock" : "hv-scope-drawer"}
            className="mt-0.5"
            checked={prefs.verseScope.type === "category"}
            onChange={() =>
              persist({
                ...prefs,
                verseScope: {
                  type: "category",
                  categoryId: meta.categories[0]?.id ?? "self",
                },
              })
            }
          />
          <span>{t("nature.homeVerse.scopeCategory")}</span>
        </label>
        {prefs.verseScope.type === "category" ? (
          <select
            className={
              isDock
                ? "ml-6 mt-1 w-[min(100%,18rem)] rounded-lg border border-white/20 bg-black/30 px-2 py-1.5 text-[12px] text-white/90"
                : "ml-6 mt-1 w-[min(100%,18rem)] rounded-md border border-neutral-200/90 bg-white px-2 py-1.5 text-[13px] text-[#37352f]"
            }
            value={prefs.verseScope.categoryId}
            onChange={(e) =>
              persist({
                ...prefs,
                verseScope: { type: "category", categoryId: e.target.value },
              })
            }
          >
            {meta.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        ) : null}
      </fieldset>

      {zhCatalog.length > 0 && enCatalog.length > 0 ? (
        <fieldset className="space-y-2 border-0 p-0">
          <legend
            className={
              isDock
                ? "text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55"
                : "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#37352f]/50"
            }
          >
            {t("nature.homeVerse.translationLegend")}
          </legend>
          <label className="flex flex-col gap-1">
            <span>{t("nature.homeVerse.zhTranslation")}</span>
            <select
              className={
                isDock
                  ? "w-[min(100%,18rem)] rounded-lg border border-white/20 bg-black/30 px-2 py-1.5 text-[12px] text-white/90"
                  : "w-[min(100%,18rem)] rounded-md border border-neutral-200/90 bg-white px-2 py-1.5 text-[13px] text-[#37352f]"
              }
              value={
                zhCatalog.some((x) => x.id === prefs.verseTextZhTranslationId)
                  ? prefs.verseTextZhTranslationId
                  : zhCatalog[0]!.id
              }
              onChange={(e) =>
                persist({
                  ...prefs,
                  verseTextZhTranslationId: e.target.value,
                })
              }
            >
              {zhCatalog.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {locale === "zh-CN" ? tr.labelZh : tr.labelEn}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>{t("nature.homeVerse.enTranslation")}</span>
            <select
              className={
                isDock
                  ? "w-[min(100%,18rem)] rounded-lg border border-white/20 bg-black/30 px-2 py-1.5 text-[12px] text-white/90"
                  : "w-[min(100%,18rem)] rounded-md border border-neutral-200/90 bg-white px-2 py-1.5 text-[13px] text-[#37352f]"
              }
              value={
                enCatalog.some((x) => x.id === prefs.verseTextEnTranslationId)
                  ? prefs.verseTextEnTranslationId
                  : enCatalog[0]!.id
              }
              onChange={(e) =>
                persist({
                  ...prefs,
                  verseTextEnTranslationId: e.target.value,
                })
              }
            >
              {enCatalog.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {locale === "zh-CN" ? tr.labelZh : tr.labelEn}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      ) : null}

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.verseDisplay === "bilingual"}
          onChange={() =>
            persist({
              ...prefs,
              verseDisplay: prefs.verseDisplay === "bilingual" ? "primary" : "bilingual",
            })
          }
        />
        <span>{t("nature.homeVerse.bilingual")}</span>
      </label>

      <button
        type="button"
        className={
          isDock
            ? "w-full rounded-lg border border-white/18 bg-white/[0.05] py-2 text-[12px] text-white/75 transition hover:bg-white/[0.1]"
            : "w-full rounded-md border border-neutral-200/90 bg-black/[0.03] py-2 text-[13px] text-[#37352f]/80 transition hover:bg-black/[0.06]"
        }
        onClick={resetMemory}
      >
        {t("nature.homeVerse.resetMemory")}
      </button>
    </div>
  );

  if (!isDock) {
    return (
      <div className="px-0.5">
        <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-[#37352f]/45">{t("nav.homeVerseSection")}</p>
        {formInner}
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-white/[0.12] pt-2 sm:mt-2.5 sm:pt-2.5">
      <button
        type="button"
        className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-left text-[12px] font-medium text-white/85 transition hover:border-white/25 hover:bg-white/[0.1] sm:text-[13px]"
        aria-expanded={open}
        onClick={() =>
          setOpen((o) => {
            const next = !o;
            if (next) setPrefs(readHomePrayerVersePrefs());
            return next;
          })
        }
      >
        {t("nature.homeVerse.settingsToggle")}
      </button>
      {open ? formInner : null}
    </div>
  );
}
