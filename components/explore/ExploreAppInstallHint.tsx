"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { APP_INSTALL_ANDROID_URL, APP_INSTALL_IOS_URL } from "@/lib/app-install-urls";
import { isDisplayStandalone } from "@/lib/pwa/display-mode";

/**
 * 探索页内嵌安装提示：非全局弹窗，但有明确标题、说明与操作。
 */
export function ExploreAppInstallHint() {
  const { t } = useLocale();

  if (isDisplayStandalone()) return null;
  if (!APP_INSTALL_IOS_URL && !APP_INSTALL_ANDROID_URL) return null;

  return (
    <section className="explore-app-install-card" aria-labelledby="explore-app-install-title">
        <h2 id="explore-app-install-title" className="explore-app-install-title">
          {t("chrome.pwaInstallTitle")}
        </h2>
        <p className="explore-app-install-body">{t("chrome.pwaInstallBody")}</p>
        <div className="explore-app-install-actions">
          {APP_INSTALL_IOS_URL ? (
            <a
              href={APP_INSTALL_IOS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="explore-app-install-btn"
            >
              {t("chrome.pwaInstallActionIos")}
            </a>
          ) : null}
          {APP_INSTALL_ANDROID_URL ? (
            <a
              href={APP_INSTALL_ANDROID_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="explore-app-install-btn"
            >
              {t("chrome.pwaInstallActionAndroid")}
            </a>
          ) : null}
          <Link href="/install" className="explore-app-install-guide">
            {t("install.guideLink")}
          </Link>
        </div>
    </section>
  );
}
