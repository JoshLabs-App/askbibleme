import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";

export const metadata = {
  title: "探索 | Selah.my",
  description: "更多小惊喜正在路上；首页、音乐与放松里，也有随行的小惊喜。",
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
