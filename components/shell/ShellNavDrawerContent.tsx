"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HomeTtsExperimentDrawerSection } from "@/components/home/HomeTtsExperimentDrawerSection";
import { ShellTemplateThemeStrip } from "@/components/shell/ShellTemplateThemeStrip";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import {
  HOME_VERSE_POOL_SCOPE_OPTIONS,
  type HomeVersePoolScopeId,
} from "@/lib/explore/explore-home-verse-pool-scopes";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { AppLocale } from "@/lib/i18n/config";
import {
  getHomeVersePoolScope,
  hydrateHomeVersePoolScope,
  setHomeVersePoolScope,
  subscribeHomeVersePoolScope,
} from "@/lib/home/home-verse-pool-scope-prefs";
import { requestHomePrayerVerseFeedReload } from "@/lib/home-prayer-pools/prefs";
import { isMemberRegisterEnabledClient } from "@/lib/member-register-enabled";
import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";

const SUPPORT_EMAIL = "askbibleme@gmail.com";

type Props = {
  onClose: () => void;
};

function ShellNavDrawerMenuRow({
  label,
  detail,
  onClick,
  href,
}: {
  label: string;
  detail?: string;
  onClick?: () => void;
  href?: string;
}) {
  const className = "shell-nav-drawer-row w-full";
  const inner = (
    <>
      <span className="shell-nav-drawer-row-text">{label}</span>
      {detail ? <span className="shell-nav-drawer-row-detail">{detail}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={[className, "shell-nav-drawer-row-stack no-underline"].join(" ")} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={[className, detail ? "shell-nav-drawer-row-stack" : ""].join(" ")} onClick={onClick}>
      {inner}
    </button>
  );
}

function ShellNavDrawerLocaleRow() {
  const { locale, setLocale } = useLocale();
  const zh = locale === "zh-CN" || locale === "zh-TW";

  const pick = (next: AppLocale) => {
    if (next !== locale) setLocale(next);
  };

  return (
    <div className="shell-nav-drawer-inline-row">
      <span className="shell-nav-drawer-row-text">{zh ? "语言" : "Language"}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="shell-nav-drawer-locale-chip"
          aria-pressed={locale === "en"}
          aria-label={zh ? "英文（美国旗）" : "English (US flag)"}
          onClick={() => pick("en")}
        >
          🇺🇸
        </button>
        <button
          type="button"
          className="shell-nav-drawer-locale-chip"
          aria-pressed={locale === "zh-TW"}
          aria-label="繁体"
          onClick={() => pick("zh-TW")}
        >
          🇹🇼
        </button>
        <button
          type="button"
          className="shell-nav-drawer-locale-chip"
          aria-pressed={locale === "zh-CN"}
          aria-label="中简"
          onClick={() => pick("zh-CN")}
        >
          🇨🇳
        </button>
      </div>
    </div>
  );
}

function ShellNavDrawerVersePoolSection() {
  const { locale } = useLocale();
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const homeVersePoolScope = useSyncExternalStore(
    subscribeHomeVersePoolScope,
    getHomeVersePoolScope,
    getHomeVersePoolScope,
  );

  useEffect(() => {
    void hydrateHomeVersePoolScope();
  }, []);

  const sectionLabel =
    locale === "en" ? "Home verse pool" : locale === "zh-TW" ? toZhTwText("主页经文池") : "主页经文池";
  const currentLabel =
    locale === "en"
      ? "Current"
      : locale === "zh-TW"
        ? toZhTwText("当前选择")
        : "当前选择";
  const current =
    HOME_VERSE_POOL_SCOPE_OPTIONS.find((scope) => scope.id === homeVersePoolScope) ??
    HOME_VERSE_POOL_SCOPE_OPTIONS[0]!;
  const currentValue =
    locale === "en" ? current.labelEn : locale === "zh-TW" ? toZhTwText(current.labelZh) : current.labelZh;

  return (
    <div>
      <p className="shell-nav-drawer-section-label">{sectionLabel}</p>
      <button
        type="button"
        className="shell-nav-drawer-select-trigger w-full"
        onClick={() => setPoolPickerOpen((v) => !v)}
      >
        <span className="shell-nav-drawer-select-label">{currentLabel}</span>
        <span className="shell-nav-drawer-select-value">
          {currentValue}
          <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-70" aria-hidden>
            <path
              d={poolPickerOpen ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {poolPickerOpen ? (
        <div className="shell-nav-drawer-select-options">
          {HOME_VERSE_POOL_SCOPE_OPTIONS.map((scope) => {
            const selected = homeVersePoolScope === scope.id;
            const label =
              locale === "en" ? scope.labelEn : locale === "zh-TW" ? toZhTwText(scope.labelZh) : scope.labelZh;
            return (
              <button
                key={scope.id}
                type="button"
                className={[
                  "shell-nav-drawer-select-option w-full",
                  selected ? "shell-nav-drawer-select-option-active" : "",
                ].join(" ")}
                onClick={() => {
                  setPoolPickerOpen(false);
                  setHomeVersePoolScope(scope.id as HomeVersePoolScopeId);
                  requestHomePrayerVerseFeedReload();
                }}
              >
                <span>{label}</span>
                {selected ? <span className="text-[#A56A2D]" aria-hidden>✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ShellNavDrawerResourceUpdate() {
  const { locale } = useLocale();
  const zh = locale === "zh-CN" || locale === "zh-TW";
  const detail = zh ? "已是最新" : "Up to date";

  return (
    <ShellNavDrawerMenuRow
      label={zh ? "资源更新" : "Resource updates"}
      detail={detail}
      onClick={() => {
        window.alert(
          zh ? "当前本地资源已是最新。" : "Your local resources are already up to date.",
        );
      }}
    />
  );
}

export function ShellNavDrawerContent({ onClose }: Props) {
  const { locale, t } = useLocale();
  const { bootstrapped, user, isAdmin, logout } = useAskbibleUser();
  const registerOpen = isMemberRegisterEnabledClient();
  const { shellTemplateBrand, setShellTemplateBrand } = useAppSkin();
  const zh = locale === "zh-CN" || locale === "zh-TW";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 py-1 pr-0.5">
      <ShellNavDrawerLocaleRow />
      <div className="h-1" aria-hidden />
      <ShellNavDrawerVersePoolSection />
      <div className="h-1" aria-hidden />
      <HomeTtsExperimentDrawerSection variant="parchment" />
      <div className="h-1" aria-hidden />
      <ShellNavDrawerResourceUpdate />
      <div className="h-1" aria-hidden />
      <ShellNavDrawerMenuRow
        label={zh ? "欢迎页" : "Welcome page"}
        onClick={() => {
          onClose();
          void (async () => {
            const { resetOnboardingDevotionIntro } = await import("@/lib/onboarding/onboarding-devotion-prefs");
            const { requestOpenOnboardingDevotionIntro } = await import("@/lib/onboarding/onboarding-devotion-gate");
            await resetOnboardingDevotionIntro();
            requestOpenOnboardingDevotionIntro();
          })();
        }}
      />
      {registerOpen ? (
        <>
          <div className="h-1" aria-hidden />
          <ShellNavDrawerMenuRow
            label={t("auth.drawerRegister")}
            href="/register"
            onClick={onClose}
          />
        </>
      ) : null}
      <div className="h-1" aria-hidden />
      <ShellNavDrawerMenuRow
        label={t("feedback.menuAction")}
        detail={SUPPORT_EMAIL}
        onClick={() => {
          onClose();
          const mailto = `mailto:${SUPPORT_EMAIL}`;
          window.location.href = mailto;
        }}
      />
      {bootstrapped && isAdmin ? (
        <div className="mt-3 border-t border-amber-900/15 pt-3">
          <span className="sr-only">{t("nav.themeColorsHeading")}</span>
          <ShellTemplateThemeStrip
            variant="drawer"
            selectedId={shellTemplateBrand}
            onPick={(id) => {
              setShellTemplateBrand(id);
              onClose();
            }}
          />
          <button
            type="button"
            className="shell-nav-drawer-row mt-2 w-full text-[13px] text-[#37352f]/80"
            aria-pressed={shellTemplateBrand == null}
            onClick={() => {
              setShellTemplateBrand(null);
              onClose();
            }}
          >
            {t("nav.themeColorsFollowSite")}
          </button>
        </div>
      ) : null}
      {bootstrapped && user ? (
        <div className="mt-3 border-t border-amber-900/15 pt-3">
          <p className="shell-nav-drawer-section-label">{t("auth.drawerSignedIn")}</p>
          <p className="truncate px-3 pb-2 text-[13px] text-[#37352f]/80" title={user.email}>
            {user.name !== user.email ? user.name : user.email}
          </p>
          <ShellNavDrawerMenuRow
            label={t("auth.drawerLogout")}
            onClick={() => {
              onClose();
              void logout();
            }}
          />
          {isSelahSuperAdminEmail(user.email) ? (
            <ShellNavDrawerMenuRow label={t("auth.drawerAdmin")} href="/admin" onClick={onClose} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
