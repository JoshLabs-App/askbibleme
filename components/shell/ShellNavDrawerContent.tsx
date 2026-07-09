"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { HomeVerseHoldTimeMenuPicker } from "@/components/home/HomeVerseHoldTimeMenuPicker";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { HomeVersePoolMenuPicker } from "@/components/home/HomeVersePoolMenuPicker";
import { HomeTtsExperimentDrawerSection } from "@/components/home/HomeTtsExperimentDrawerSection";
import { ShellTemplateThemeStrip } from "@/components/shell/ShellTemplateThemeStrip";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { AppLocale } from "@/lib/i18n/config";
import { getLocalePickerLabel } from "@/lib/i18n/locale-display-labels";
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
    <div className="shell-nav-drawer-locale-row">
      <span className="shell-nav-drawer-row-text">{zh ? "语言" : "Language"}</span>
      <div className="shell-nav-drawer-locale-chips">
        {(["en", "zh-TW", "zh-CN"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className="shell-nav-drawer-locale-chip"
            aria-pressed={locale === item}
            aria-label={getLocalePickerLabel(item)}
            onClick={() => pick(item)}
          >
            {getLocalePickerLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShellNavDrawerVersePoolSection() {
  const { locale } = useLocale();
  const selectedScope = useSyncExternalStore(
    subscribeHomeVersePoolScope,
    getHomeVersePoolScope,
    getHomeVersePoolScope,
  );

  useEffect(() => {
    hydrateHomeVersePoolScope();
  }, []);

  const sectionLabel =
    locale === "en" ? "Home verse pool" : locale === "zh-TW" ? toZhTwText("主页经文池") : "主页经文池";
  const poolLabel =
    locale === "en" ? "Pool" : locale === "zh-TW" ? toZhTwText("当前池") : "当前池";

  return (
    <div className="space-y-2">
      <HomeVersePoolMenuPicker
        locale={locale}
        selectedScope={selectedScope}
        poolLabel={sectionLabel}
        currentLabel={poolLabel}
        onSelectScope={(next) => {
          setHomeVersePoolScope(next);
          requestHomePrayerVerseFeedReload();
        }}
      />
      <HomeVerseHoldTimeMenuPicker />
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
  const { bootstrapped, user, isAdmin, logout, deleteAccount } = useAskbibleUser();
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
      {bootstrapped && !user ? (
        <>
          <div className="h-1" aria-hidden />
          <ShellNavDrawerMenuRow label={t("auth.drawerLogin")} href="/login" onClick={onClose} />
          {registerOpen ? (
            <ShellNavDrawerMenuRow label={t("auth.drawerRegister")} href="/register" onClick={onClose} />
          ) : null}
        </>
      ) : null}
      <div className="h-1" aria-hidden />
      <ShellNavDrawerMenuRow
        label={t("install.menuAction")}
        href="/install"
        onClick={onClose}
      />
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
          <ShellNavDrawerMenuRow
            label={t("auth.deleteAccount")}
            onClick={() => {
              onClose();
              if (!window.confirm(`${t("auth.deleteAccountTitle")}\n\n${t("auth.deleteAccountMessage")}`)) {
                return;
              }
              void (async () => {
                const result = await deleteAccount();
                if (result.ok) return;
                const message =
                  result.code === "admin_account"
                    ? t("auth.deleteAccountAdminBlocked")
                    : result.code === "network"
                      ? t("auth.errorNetwork")
                      : t("auth.deleteAccountFailedMessage");
                window.alert(`${t("auth.deleteAccountFailedTitle")}\n\n${message}`);
              })();
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
