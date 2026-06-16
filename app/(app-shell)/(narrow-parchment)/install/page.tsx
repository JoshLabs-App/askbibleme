import { AppInstallGuidePage } from "@/components/install/AppInstallGuidePage";
import { NarrowParchmentChrome } from "@/components/shell/NarrowParchmentChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("安装 App"),
  description:
    "AskBible.me 安装引导：iOS App Store 下载与 Android 试用版邮件申请。",
};

export default function InstallPage() {
  return (
    <NarrowParchmentChrome>
      <AppInstallGuidePage />
    </NarrowParchmentChrome>
  );
}
