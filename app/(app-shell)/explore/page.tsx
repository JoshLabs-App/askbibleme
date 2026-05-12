import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";

export const metadata = {
  title: "探索 | Selah.my",
  description: "适合慢慢走的人：转角会有轻轻松一口气的地方，音乐和放松也随时欢迎你。",
};

export default function ExplorePlaceholderPage() {
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <AppShellPlaceholder
        embedded
        hideBackHomeCta
        titleKey="pages.explore.title"
        leadKey="pages.explore.lead"
        bodyKey="pages.explore.body"
      />
    </ShellTemplateChromeLayout>
  );
}
