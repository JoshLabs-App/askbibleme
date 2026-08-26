import Link from "next/link";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { APP_INSTALL_IOS_URL, resolveAppInstallAndroidEmail } from "@/lib/app-install-urls";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("读经提醒"),
  description: "在 App 中设置每日读经提醒。",
};

/** 对齐 App `/explore/reading-alarm`：原生通知能力，Web 说明 + 安装引导。 */
export default function ExploreReadingAlarmPage() {
  const androidEmail = resolveAppInstallAndroidEmail();

  return (
    <ExploreParchmentChrome>
      <div className="explore-home explore-reading-alarm-page">
        <header className="explore-home-header">
          <Link href="/explore" className="explore-subpage-back">
            ←
          </Link>
          <h1 className="explore-home-title">读经提醒</h1>
        </header>
        <p className="explore-home-lead">
          每日提醒需在 iPhone 或 Android App 中开启本地通知；网页版暂不支持定时推送。
        </p>
        <div className="explore-app-install-actions">
          {APP_INSTALL_IOS_URL ? (
            <a href={APP_INSTALL_IOS_URL} target="_blank" rel="noopener noreferrer" className="explore-app-install-btn">
              App Store
            </a>
          ) : null}
          {androidEmail ? (
            <Link href="/install" className="explore-app-install-btn">
              Android 安装
            </Link>
          ) : null}
        </div>
      </div>
    </ExploreParchmentChrome>
  );
}
