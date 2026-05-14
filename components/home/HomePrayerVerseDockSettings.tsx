"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HOME_BIBLE_TRANSLATIONS_CATALOG_URL, HOME_PRAYER_POOL_PUBLIC_BASE } from "@/lib/home-prayer-pools/constants";
import {
  memoryNamespaceFromScope,
  normalizeGoldenVerseFontFamily,
  normalizeGoldenVerseTextEffect,
  readHomePrayerVersePrefs,
  requestHomePrayerVerseFeedReload,
  writeHomePrayerVersePrefs,
} from "@/lib/home-prayer-pools/prefs";
import type { HomePrayerVersePrefsV1 } from "@/lib/home-prayer-pools/types";

type Meta = { version: 1; categories: { id: string; title: string }[] };

type Catalog = { version: 1; translations: { id: string; labelZh: string; labelEn: string; language: string }[] };

type HomeVerseSettingsSection = "scope" | "translation" | "goldenFont";

/** 自然首页：本页经文 `zoom` 档位（与 `nature-home-text-scale-prefs` 同源） */
export type NatureVerseTextScaleDockProps = {
  atMin: boolean;
  atMax: boolean;
  onSmaller: () => void;
  onLarger: () => void;
};

type Props = {
  /** `dock`：自然页底栏折叠面板；`drawer`：侧滑菜单；`page`：金句专页；`popover`：顶栏深色磨砂浮层（与首页用户菜单同屏气质） */
  placement?: "dock" | "drawer" | "page" | "popover";
  /** `placement="drawer"` 时由父级传入，抽屉打开动画结束后再为 true，用于与 localStorage 同步 */
  drawerOpen?: boolean;
  /** 默认 `['scope','translation']`；金句页可传 `['scope','goldenFont']`，侧栏只传 `['translation']`。 */
  sections?: HomeVerseSettingsSection[];
  /** 自然首页 dock 或首页齿轮 popover：字体/字面区块下方展示本页经文缩放 +/-（`nature-home-text-scale-prefs`） */
  natureVerseTextScale?: NatureVerseTextScaleDockProps;
};

function IosSettingsSwitch({
  checked,
  onChange,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  "aria-label": string;
  "aria-describedby"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors motion-reduce:transition-none",
        checked ? "bg-[#34C759]" : "bg-ink/20 dark:bg-white/20",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.14)] transition-transform motion-reduce:transition-none",
          checked ? "translate-x-[22px]" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function IconTextScaleSmallerDock(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7.5 15.5 12 6l4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 12h5.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M8 18.25h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTextScaleLargerDock(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7.5 15.5 12 6l4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.4 12h5.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M12 17v4M10 19h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function HomePrayerVerseDockSettings({
  placement = "dock",
  drawerOpen = false,
  sections: sectionsProp,
  natureVerseTextScale,
}: Props) {
  const { t, locale } = useLocale();
  const isDock = placement === "dock";
  const isPage = placement === "page";
  const isPopover = placement === "popover";
  const isPageLike = isPage || isPopover;
  const sections = sectionsProp ?? (["scope", "translation"] as HomeVerseSettingsSection[]);
  const showScope = sections.includes("scope");
  const showTranslation = sections.includes("translation");
  const showGoldenFont = sections.includes("goldenFont");
  const goldenFontIntroText =
    showScope || showTranslation ? t("pages.goldenVerses.fontLegend") : t("nature.homeVerse.goldenFontPrefsHint");
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

  const iosSelectClass =
    "min-h-[44px] min-w-0 max-w-[60%] flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent py-2.5 pr-6 text-right text-[17px] font-normal leading-snug text-[#007AFF] outline-none ring-0 focus:ring-0 dark:text-[#0A84FF]";

  /** 叠在 `bg-ink/88` 浮层内时的选择器字色（对齐 iOS 暗色列表） */
  const iosSelectClassPopover =
    "min-h-[44px] min-w-0 max-w-[60%] flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent py-2.5 pr-6 text-right text-[17px] font-normal leading-snug text-sky-300 outline-none ring-0 focus:ring-0";

  const pageSelectClass = isPopover ? iosSelectClassPopover : iosSelectClass;

  useEffect(() => {
    if (!isDock || !open) return;
    setPrefs(readHomePrayerVersePrefs());
  }, [isDock, open]);

  useEffect(() => {
    if (isDock) return;
    if (placement === "drawer" && !drawerOpen) return;
    setPrefs(readHomePrayerVersePrefs());
  }, [isDock, placement, drawerOpen]);

  const persist = useCallback((next: HomePrayerVersePrefsV1, opts?: { reloadFeed?: boolean }) => {
    writeHomePrayerVersePrefs(next);
    setPrefs(next);
    if (opts?.reloadFeed !== false) requestHomePrayerVerseFeedReload();
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

  if (isPageLike && showScope && !meta?.categories.length) {
    const loadingCardClass = isPopover
      ? "rounded-xl border border-white/12 bg-white/[0.06] px-4 py-5 text-[14px] leading-relaxed text-canvas/65 sm:px-5"
      : showGoldenFont
        ? "mt-4 rounded-xl border border-ink/10 bg-canvas/70 px-4 py-5 text-[14px] leading-relaxed text-muted shadow-sm sm:px-5"
        : "mt-1 rounded-xl border border-ink/10 bg-canvas/70 px-4 py-5 text-[14px] leading-relaxed text-muted shadow-sm sm:px-5";

    const loadingBody = (
      <>
        {showGoldenFont ? (
          <div className={isPopover ? "mt-0 space-y-4" : "mt-0 space-y-5"}>
            <div>
              <p
                className={
                  isPopover
                    ? "px-4 pb-1.5 text-[13px] font-normal leading-snug text-canvas/55"
                    : "px-4 pb-1.5 text-[13px] font-normal leading-snug text-muted"
                }
              >
                {goldenFontIntroText}
              </p>
              <div
                className={
                  isPopover
                    ? "overflow-hidden rounded-[10px] bg-white/[0.07]"
                    : "overflow-hidden rounded-[10px] bg-ink/[0.045] dark:bg-white/[0.06]"
                }
              >
                <label className="flex min-h-[44px] items-center justify-between gap-3 px-4">
                  <span
                    className={
                      isPopover
                        ? "shrink-0 text-[17px] leading-snug text-canvas/95"
                        : "shrink-0 text-[17px] leading-snug text-ink dark:text-white"
                    }
                  >
                    {t("pages.goldenVerses.fontRowLabel")}
                  </span>
                  <select
                    className={pageSelectClass}
                    value={prefs.goldenVerseFontFamily}
                    onChange={(e) => {
                      const p = readHomePrayerVersePrefs();
                      persist(
                        { ...p, goldenVerseFontFamily: normalizeGoldenVerseFontFamily(e.target.value) },
                        { reloadFeed: false },
                      );
                    }}
                  >
                    <option value="sans">{t("pages.goldenVerses.fontSans")}</option>
                    <option value="serif">{t("pages.goldenVerses.fontSerif")}</option>
                  </select>
                </label>
                <label
                  className={
                    isPopover
                      ? "flex min-h-[44px] items-center justify-between gap-3 border-t border-white/10 px-4"
                      : "flex min-h-[44px] items-center justify-between gap-3 border-t border-black/[0.06] px-4 dark:border-white/[0.08]"
                  }
                >
                  <span
                    className={
                      isPopover
                        ? "shrink-0 text-[17px] leading-snug text-canvas/95"
                        : "shrink-0 text-[17px] leading-snug text-ink dark:text-white"
                    }
                  >
                    {t("pages.goldenVerses.effectRowLabel")}
                  </span>
                  <select
                    className={pageSelectClass}
                    value={prefs.goldenVerseTextEffect}
                    onChange={(e) => {
                      const p = readHomePrayerVersePrefs();
                      persist(
                        { ...p, goldenVerseTextEffect: normalizeGoldenVerseTextEffect(e.target.value) },
                        { reloadFeed: false },
                      );
                    }}
                  >
                    <option value="engraved">{t("pages.goldenVerses.effectEngraved")}</option>
                    <option value="insetCarved">{t("pages.goldenVerses.effectInsetCarved")}</option>
                    <option value="flat">{t("pages.goldenVerses.effectFlat")}</option>
                    <option value="letterpress">{t("pages.goldenVerses.effectLetterpress")}</option>
                    <option value="softBloom">{t("pages.goldenVerses.effectSoftBloom")}</option>
                  </select>
                </label>
              </div>
              <p
                className={
                  isPopover
                    ? "px-4 pt-1.5 text-[12px] leading-snug text-canvas/50"
                    : "px-4 pt-1.5 text-[12px] leading-snug text-muted"
                }
              >
                {t("pages.goldenVerses.effectLegend")}
              </p>
            </div>
          </div>
        ) : null}
        <div className={isPopover ? `mt-2 ${loadingCardClass}` : loadingCardClass} role="status">
          {t("pages.goldenVerses.settingsLoading")}
        </div>
      </>
    );

    return isPage ? (
      <section className="w-full" aria-label={t("pages.goldenVerses.title")}>
        {loadingBody}
      </section>
    ) : (
      <div className="w-full">{loadingBody}</div>
    );
  }

  if (showScope && !meta?.categories.length) {
    return null;
  }

  const formInnerDockDrawer = (
    <div
      className={
        isDock
          ? "mt-2 space-y-3 rounded-xl border border-white/12 bg-black/25 px-3 py-3 text-[12px] text-white/88 sm:text-[13px]"
          : "space-y-3 rounded-lg border border-neutral-200/80 bg-white/60 px-2.5 py-2.5 text-[13px] text-[#37352f]/90 backdrop-blur-sm sm:text-[14px]"
      }
    >
      {showScope ? (
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
                    categoryId: meta!.categories[0]?.id ?? "self",
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
              {meta!.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ) : null}
        </fieldset>
      ) : null}

      {showTranslation && zhCatalog.length > 0 && enCatalog.length > 0 ? (
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

      {showTranslation ? (
        <>
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
        </>
      ) : null}

      {showGoldenFont && isDock ? (
        <div className="space-y-2 border-t border-white/[0.12] pt-2 sm:space-y-2.5 sm:pt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            {t("nature.homeVerse.appearanceDockTitle")}
          </p>
          <p className="text-[11px] leading-snug text-white/50">{goldenFontIntroText}</p>
          <div className="overflow-hidden rounded-lg border border-white/12 bg-black/30">
            <label className="flex min-h-[44px] items-center justify-between gap-2 border-b border-white/10 px-2.5 sm:px-3">
              <span className="shrink-0 text-[13px] leading-snug text-white/90 sm:text-[14px]">
                {t("pages.goldenVerses.fontRowLabel")}
              </span>
              <select
                className="min-h-[44px] min-w-0 max-w-[58%] flex-1 cursor-pointer appearance-none truncate rounded-md border border-white/15 bg-black/35 py-2 pl-2 pr-7 text-right text-[13px] font-normal leading-snug text-sky-200 outline-none ring-0 sm:text-[14px]"
                value={prefs.goldenVerseFontFamily}
                onChange={(e) => {
                  const p = readHomePrayerVersePrefs();
                  persist(
                    { ...p, goldenVerseFontFamily: normalizeGoldenVerseFontFamily(e.target.value) },
                    { reloadFeed: false },
                  );
                }}
              >
                <option value="sans">{t("pages.goldenVerses.fontSans")}</option>
                <option value="serif">{t("pages.goldenVerses.fontSerif")}</option>
              </select>
            </label>
            <label className="flex min-h-[44px] items-center justify-between gap-2 px-2.5 sm:px-3">
              <span className="shrink-0 text-[13px] leading-snug text-white/90 sm:text-[14px]">
                {t("pages.goldenVerses.effectRowLabel")}
              </span>
              <select
                className="min-h-[44px] min-w-0 max-w-[58%] flex-1 cursor-pointer appearance-none truncate rounded-md border border-white/15 bg-black/35 py-2 pl-2 pr-7 text-right text-[13px] font-normal leading-snug text-sky-200 outline-none ring-0 sm:text-[14px]"
                value={prefs.goldenVerseTextEffect}
                onChange={(e) => {
                  const p = readHomePrayerVersePrefs();
                  persist(
                    { ...p, goldenVerseTextEffect: normalizeGoldenVerseTextEffect(e.target.value) },
                    { reloadFeed: false },
                  );
                }}
              >
                <option value="engraved">{t("pages.goldenVerses.effectEngraved")}</option>
                <option value="insetCarved">{t("pages.goldenVerses.effectInsetCarved")}</option>
                <option value="flat">{t("pages.goldenVerses.effectFlat")}</option>
                <option value="letterpress">{t("pages.goldenVerses.effectLetterpress")}</option>
                <option value="softBloom">{t("pages.goldenVerses.effectSoftBloom")}</option>
              </select>
            </label>
          </div>
          <p className="text-[11px] leading-snug text-white/45">{t("pages.goldenVerses.effectLegend")}</p>
          {natureVerseTextScale ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                {t("nature.homeVerse.sizeOnHome")}
              </p>
              <div className="flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-black/30 px-2 py-2">
                <button
                  type="button"
                  disabled={natureVerseTextScale.atMin}
                  aria-label={t("nature.textScaleSmallerAria")}
                  className="touch-manipulation inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/18 bg-white/[0.06] text-white/90 transition hover:bg-white/12 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
                  onClick={natureVerseTextScale.onSmaller}
                >
                  <IconTextScaleSmallerDock className="h-[1.25rem] w-[1.25rem] opacity-90" />
                </button>
                <button
                  type="button"
                  disabled={natureVerseTextScale.atMax}
                  aria-label={t("nature.textScaleLargerAria")}
                  className="touch-manipulation inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/18 bg-white/[0.06] text-white/90 transition hover:bg-white/12 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
                  onClick={natureVerseTextScale.onLarger}
                >
                  <IconTextScaleLargerDock className="h-[1.25rem] w-[1.25rem] opacity-90" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const formInnerPage = (
    <div className={isPopover ? "mt-0 space-y-4" : "mt-4 space-y-5"}>
      {showGoldenFont ? (
        <div>
          <p
            className={
              isPopover
                ? "px-4 pb-1.5 text-[13px] font-normal leading-snug text-canvas/55"
                : "px-4 pb-1.5 text-[13px] font-normal leading-snug text-muted"
            }
          >
            {goldenFontIntroText}
          </p>
          <div
            className={
              isPopover
                ? "overflow-hidden rounded-[10px] bg-white/[0.07]"
                : "overflow-hidden rounded-[10px] bg-ink/[0.045] dark:bg-white/[0.06]"
            }
          >
            <label className="flex min-h-[44px] items-center justify-between gap-3 px-4">
              <span
                className={
                  isPopover
                    ? "shrink-0 text-[17px] leading-snug text-canvas/95"
                    : "shrink-0 text-[17px] leading-snug text-ink dark:text-white"
                }
              >
                {t("pages.goldenVerses.fontRowLabel")}
              </span>
              <select
                className={pageSelectClass}
                value={prefs.goldenVerseFontFamily}
                onChange={(e) => {
                  const p = readHomePrayerVersePrefs();
                  persist(
                    { ...p, goldenVerseFontFamily: normalizeGoldenVerseFontFamily(e.target.value) },
                    { reloadFeed: false },
                  );
                }}
              >
                <option value="sans">{t("pages.goldenVerses.fontSans")}</option>
                <option value="serif">{t("pages.goldenVerses.fontSerif")}</option>
              </select>
            </label>
            <label
              className={
                isPopover
                  ? "flex min-h-[44px] items-center justify-between gap-3 border-t border-white/10 px-4"
                  : "flex min-h-[44px] items-center justify-between gap-3 border-t border-black/[0.06] px-4 dark:border-white/[0.08]"
              }
            >
              <span
                className={
                  isPopover
                    ? "shrink-0 text-[17px] leading-snug text-canvas/95"
                    : "shrink-0 text-[17px] leading-snug text-ink dark:text-white"
                }
              >
                {t("pages.goldenVerses.effectRowLabel")}
              </span>
              <select
                className={pageSelectClass}
                value={prefs.goldenVerseTextEffect}
                onChange={(e) => {
                  const p = readHomePrayerVersePrefs();
                  persist(
                    { ...p, goldenVerseTextEffect: normalizeGoldenVerseTextEffect(e.target.value) },
                    { reloadFeed: false },
                  );
                }}
              >
                <option value="engraved">{t("pages.goldenVerses.effectEngraved")}</option>
                <option value="insetCarved">{t("pages.goldenVerses.effectInsetCarved")}</option>
                <option value="flat">{t("pages.goldenVerses.effectFlat")}</option>
                <option value="letterpress">{t("pages.goldenVerses.effectLetterpress")}</option>
                <option value="softBloom">{t("pages.goldenVerses.effectSoftBloom")}</option>
              </select>
            </label>
          </div>
          <p
            className={
              isPopover
                ? "px-4 pt-1.5 text-[12px] leading-snug text-canvas/50"
                : "px-4 pt-1.5 text-[12px] leading-snug text-muted"
            }
          >
            {t("pages.goldenVerses.effectLegend")}
          </p>
          {natureVerseTextScale && isPopover ? (
            <>
              <p className="mt-3 px-4 text-[13px] font-medium leading-snug text-canvas/70">
                {t("nature.homeVerse.sizeOnHome")}
              </p>
              <div className="mx-4 mt-1.5 flex items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-white/[0.07] px-2 py-2">
                <button
                  type="button"
                  disabled={natureVerseTextScale.atMin}
                  aria-label={t("nature.textScaleSmallerAria")}
                  className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-canvas/95 transition hover:bg-white/[0.14] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
                  onClick={natureVerseTextScale.onSmaller}
                >
                  <IconTextScaleSmallerDock className="h-[1.3rem] w-[1.3rem] opacity-90" />
                </button>
                <button
                  type="button"
                  disabled={natureVerseTextScale.atMax}
                  aria-label={t("nature.textScaleLargerAria")}
                  className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-canvas/95 transition hover:bg-white/[0.14] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
                  onClick={natureVerseTextScale.onLarger}
                >
                  <IconTextScaleLargerDock className="h-[1.3rem] w-[1.3rem] opacity-90" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {showScope && meta ? (
        <div>
          <p
            className={
              isPopover
                ? "px-4 pb-1.5 text-[13px] font-normal leading-snug text-canvas/55"
                : "px-4 pb-1.5 text-[13px] font-normal leading-snug text-muted"
            }
          >
            {t("nature.homeVerse.scopeLegend")}
          </p>
          <div
            className={
              isPopover
                ? "overflow-hidden rounded-[10px] bg-white/[0.07] p-1"
                : "overflow-hidden rounded-[10px] bg-ink/[0.045] p-1 dark:bg-white/[0.06]"
            }
          >
            <div className={isPopover ? "flex h-9 rounded-lg bg-black/35 p-0.5" : "flex h-9 rounded-lg bg-black/[0.06] p-0.5 dark:bg-black/30"}>
              <button
                type="button"
                aria-pressed={prefs.verseScope.type === "all"}
                className={[
                  "min-h-0 flex-1 rounded-md text-[13px] font-medium leading-none transition motion-reduce:transition-none",
                  prefs.verseScope.type === "all"
                    ? isPopover
                      ? "bg-white/18 text-white shadow-none"
                      : "bg-canvas text-ink shadow-sm dark:bg-zinc-700 dark:text-white"
                    : isPopover
                      ? "text-white/55"
                      : "text-ink/55 dark:text-white/55",
                ].join(" ")}
                onClick={() => persist({ ...prefs, verseScope: { type: "all" } })}
              >
                {t("nature.homeVerse.scopeAll")}
              </button>
              <button
                type="button"
                aria-pressed={prefs.verseScope.type === "category"}
                className={[
                  "min-h-0 flex-1 rounded-md text-[13px] font-medium leading-none transition motion-reduce:transition-none",
                  prefs.verseScope.type === "category"
                    ? isPopover
                      ? "bg-white/18 text-white shadow-none"
                      : "bg-canvas text-ink shadow-sm dark:bg-zinc-700 dark:text-white"
                    : isPopover
                      ? "text-white/55"
                      : "text-ink/55 dark:text-white/55",
                ].join(" ")}
                onClick={() =>
                  persist({
                    ...prefs,
                    verseScope: {
                      type: "category",
                      categoryId: meta.categories[0]?.id ?? "self",
                    },
                  })
                }
              >
                {t("nature.homeVerse.scopeCategory")}
              </button>
            </div>
          </div>
          {prefs.verseScope.type === "category" ? (
            <div
              className={
                isPopover
                  ? "mt-2 overflow-hidden rounded-[10px] bg-white/[0.07]"
                  : "mt-2 overflow-hidden rounded-[10px] bg-ink/[0.045] dark:bg-white/[0.06]"
              }
            >
              <label
                className={
                  isPopover
                    ? "flex min-h-[44px] items-center justify-between gap-3 border-b border-white/10 px-4"
                    : "flex min-h-[44px] items-center justify-between gap-3 border-b border-black/[0.06] px-4 dark:border-white/[0.08]"
                }
              >
                <span
                  className={
                    isPopover
                      ? "shrink-0 text-[17px] leading-snug text-canvas/95"
                      : "shrink-0 text-[17px] leading-snug text-ink dark:text-white"
                  }
                >
                  {t("nature.homeVerse.categoryRowLabel")}
                </span>
                <select
                  className={pageSelectClass}
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
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {showTranslation && zhCatalog.length > 0 && enCatalog.length > 0 ? (
        <div>
          <p
            className={
              isPopover
                ? "px-4 pb-1.5 text-[13px] font-normal leading-snug text-canvas/55"
                : "px-4 pb-1.5 text-[13px] font-normal leading-snug text-muted"
            }
          >
            {t("nature.homeVerse.translationLegend")}
          </p>
          <div
            className={
              isPopover
                ? "overflow-hidden rounded-[10px] bg-white/[0.07]"
                : "overflow-hidden rounded-[10px] bg-ink/[0.045] dark:bg-white/[0.06]"
            }
          >
            <p
              className={
                isPopover
                  ? "border-b border-white/10 px-4 pb-2 pt-2.5 text-[13px] leading-snug text-canvas/55"
                  : "border-b border-black/[0.06] px-4 pb-2 pt-2.5 text-[13px] leading-snug text-muted dark:border-white/[0.08]"
              }
            >
              {t("nature.homeVerse.contrastCaption")}
            </p>
            <label
              className={
                isPopover
                  ? "flex min-h-[44px] items-center justify-between gap-3 border-b border-white/10 px-4"
                  : "flex min-h-[44px] items-center justify-between gap-3 border-b border-black/[0.06] px-4 dark:border-white/[0.08]"
              }
            >
              <span
                className={
                  isPopover
                    ? "shrink-0 text-[17px] leading-snug text-canvas/95"
                    : "shrink-0 text-[17px] leading-snug text-ink dark:text-white"
                }
              >
                {t("nature.homeVerse.zhTranslation")}
              </span>
              <select
                className={pageSelectClass}
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
            <label className="flex min-h-[44px] items-center justify-between gap-3 px-4">
              <span
                className={
                  isPopover
                    ? "shrink-0 text-[17px] leading-snug text-canvas/95"
                    : "shrink-0 text-[17px] leading-snug text-ink dark:text-white"
                }
              >
                {t("nature.homeVerse.enTranslation")}
              </span>
              <select
                className={pageSelectClass}
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
          </div>
        </div>
      ) : null}

      {showTranslation ? (
        <>
          <div>
            <div
              className={
                isPopover
                  ? "overflow-hidden rounded-[10px] bg-white/[0.07]"
                  : "overflow-hidden rounded-[10px] bg-ink/[0.045] dark:bg-white/[0.06]"
              }
            >
              <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-1">
                <span
                  className={
                    isPopover
                      ? "text-[17px] leading-snug text-canvas/95"
                      : "text-[17px] leading-snug text-ink dark:text-white"
                  }
                >
                  {t("nature.homeVerse.bilingual")}
                </span>
                <IosSettingsSwitch
                  checked={prefs.verseDisplay === "bilingual"}
                  onChange={(on) =>
                    persist({
                      ...prefs,
                      verseDisplay: on ? "bilingual" : "primary",
                    })
                  }
                  aria-label={t("nature.homeVerse.bilingual")}
                />
              </div>
            </div>
          </div>

          <div className="px-2 pt-1">
            <button
              type="button"
              className={
                isPopover
                  ? "w-full rounded-xl py-3 text-center text-[17px] font-normal text-[#FF9A8F] transition active:opacity-70"
                  : "w-full rounded-xl py-3 text-center text-[17px] font-normal text-[#FF3B30] transition active:opacity-70 dark:text-[#FF453A]"
              }
              onClick={resetMemory}
            >
              {t("nature.homeVerse.resetMemory")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );

  const formInner = isPageLike ? formInnerPage : formInnerDockDrawer;

  if (isPage) {
    return (
      <section className="w-full" aria-label={t("pages.goldenVerses.title")}>
        {formInner}
      </section>
    );
  }

  if (isPopover) {
    return <div className="w-full text-canvas">{formInner}</div>;
  }

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
