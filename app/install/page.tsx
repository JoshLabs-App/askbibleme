import { AppInstallGuidePage } from "@/components/install/AppInstallGuidePage";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("安装 App"),
  description:
    "AskBible.me 测试版安装引导：iOS TestFlight 与 Android Google Play 内部测试邀请。",
};

export default function InstallPage() {
  return <AppInstallGuidePage />;
}
