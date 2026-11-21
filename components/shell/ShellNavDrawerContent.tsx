"use client";

import { useCallback, useEffect, useState } from "react";
import { AppTextSizePicker } from "@/components/app-shell/AppTextSizeProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useHomeVerseAdvanceGapSec, writeHomeVerseAdvanceGapSec } from "@/components/home/useHomeVerseAdvanceGap";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  ShellNavDrawerHomeTranslationSection,
} from "@/components/shell/ShellNavDrawerHomeTranslationSection";
import { ShellNavDrawerReadingSyncSection } from "@/components/shell/ShellNavDrawerReadingSyncSection";
import { readTranslationsHref } from "@/lib/read/read-translations-route";
import type { AppLocale } from "@/lib/i18n/config";
import { getLocalePickerLabel } from "@/lib/i18n/locale-display-labels";
import { isMemberRegisterEnabledClient } from "@/lib/member-register-enabled";
import {
  ASKBIBLE_MANUAL_CHECK_EVENT,
  checkWebBuildUpdate,
  formatShortBuildId,
  getLoadedBuildId,
  triggerWebBuildReload,
} from "@/lib/pwa/check-app-update";

const SUPPORT_EMAIL = "hello@askbible.me";

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

function ShellNavDrawerCheckUpdate({ onClose }: { onClose: () => void }) {
  const { locale } = useLocale();
  const [phase, setPhase] = useState<"idle" | "checking" | "up-to-date" | "updating" | "failed">("idle");
  const [buildLabel, setBuildLabel] = useState<string>(() => formatShortBuildId(getLoadedBuildId()));

  const runCheck = useCallback(async () => {
    setPhase((prev) => (prev === "checking" || prev === "updating" ? prev : "checking"));
    const outcome = await checkWebBuildUpdate();
    if (outcome.status === "update-available") {
      setBuildLabel(formatShortBuildId(outcome.remoteId));
      setPhase("updating");
      onClose();
      triggerWebBuildReload(900);
      return;
    }
    if (outcome.status === "up-to-date") {
      setBuildLabel(formatShortBuildId(outcome.buildId));
      setPhase("up-to-date");
      return;
    }
    setPhase("failed");
  }, [onClose]);

  useEffect(() => {
    setBuildLabel(formatShortBuildId(getLoadedBuildId()));
    const onFooterCheck = () => {
      void runCheck();
    };
    window.addEventListener(ASKBIBLE_MANUAL_CHECK_EVENT, onFooterCheck);
    return () => window.removeEventListener(ASKBIBLE_MANUAL_CHECK_EVENT, onFooterCheck);
  }, [runCheck]);

  const label =
    locale === "zh-CN"
      ? "检查更新"
      : locale === "zh-TW"
        ? "檢查更新"
        : "Check for updates";

  const detail = (() => {
    if (phase === "checking") {
      return locale === "zh-CN" ? "正在检查…" : locale === "zh-TW" ? "正在檢查…" : "Checking…";
    }
    if (phase === "updating") {
      return locale === "zh-CN"
        ? "发现新版本，正在更新…"
        : locale === "zh-TW"
          ? "發現新版本，正在更新…"
          : "Updating to latest…";
    }
    if (phase === "up-to-date") {
      return locale === "zh-CN"
        ? `已是最新版本（${buildLabel}）`
        : locale === "zh-TW"
          ? `已是最新版本（${buildLabel}）`
          : `Up to date (${buildLabel})`;
    }
    if (phase === "failed") {
      return locale === "zh-CN"
        ? "无法连接更新服务器"
        : locale === "zh-TW"
          ? "無法連線更新伺服器"
          : "Unable to check for updates";
    }
    return buildLabel;
  })();

  return (
    <ShellNavDrawerMenuRow
      label={label}
      detail={detail}
      onClick={() => {
        if (phase === "checking" || phase === "updating") return;
        void runCheck();
      }}
    />
  );
}

function ShellNavDrawerVerseAdvanceGapRow() {
  const { locale } = useLocale();
  const zh = locale === "zh-CN" || locale === "zh-TW";
  const gapSec = useHomeVerseAdvanceGapSec();

  const options = [
    { id: "3", label: "3s" },
    { id: "5", label: "5s" },
    { id: "7", label: "7s" },
    { id: "10", label: "10s" },
    { id: "15", label: "15s" },
  ];

  const apply = (next: number) => {
    writeHomeVerseAdvanceGapSec(next);
  };

  return (
    <div className="shell-nav-drawer-locale-row">
      <div className="flex items-center justify-between gap-3">
        <span className="shell-nav-drawer-row-text">{zh ? "金句停顿" : "Verse pause"}</span>
      </div>
      <div className="shell-nav-drawer-locale-chips pt-1" role="radiogroup" aria-label={zh ? "金句停顿" : "Verse pause"}>
        {options.map((option) => {
          const next = Number(option.id);
          const active = gapSec === next;
          return (
            <button
              key={option.id}
              type="button"
              className="shell-nav-drawer-locale-chip shell-nav-drawer-gap-chip"
              aria-checked={active}
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => apply(next)}
            >
              <span className="shell-nav-drawer-gap-chip-label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShellNavDrawerContent({ onClose }: Props) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const { bootstrapped, user, logout, deleteAccount } = useAskbibleUser();
  const registerOpen = isMemberRegisterEnabledClient();
  const zh = locale === "zh-CN" || locale === "zh-TW";

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col gap-1 py-1 pr-0.5">
      <ShellNavDrawerMenuRow label={zh ? "音乐" : "Music"} href="/music" onClick={onClose} />
      <ShellNavDrawerLocaleRow />
      <AppTextSizePicker />
      <div className="h-1" aria-hidden />
      <ShellNavDrawerHomeTranslationSection
        onOpenBibleVersionPicker={() => {
          onClose();
          router.push(readTranslationsHref());
        }}
      />
      <div className="h-1" aria-hidden />
      <ShellNavDrawerCheckUpdate onClose={onClose} />
      <div className="h-1" aria-hidden />
      <ShellNavDrawerVerseAdvanceGapRow />
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
      {/* 回官网主页（askbible.me/）：网页版首页是 /web，这里故意写 "/"，不是 WEB_APP_HOME_PATH */}
      <ShellNavDrawerMenuRow
        label={zh ? "回主页" : "Back to homepage"}
        detail="askbible.me"
        href="/"
        onClick={onClose}
      />
      <ShellNavDrawerMenuRow
        label={t("install.menuAction")}
        href="/install"
        onClick={onClose}
      />
      <ShellNavDrawerMenuRow
        label={t("feedback.menuAction")}
        detail={SUPPORT_EMAIL}
        href="/feedback"
        onClick={onClose}
      />
      {bootstrapped && user ? <ShellNavDrawerReadingSyncSection /> : null}
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
        </div>
      ) : null}
    </div>
    </>
  );
}
