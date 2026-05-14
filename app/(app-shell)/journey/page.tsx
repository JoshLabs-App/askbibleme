import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("旅程"),
  description: "你若喜欢安静地同行，走着走着会遇见更多；首页的自然与经文也一直在这儿。",
};

export default function JourneyPlaceholderPage() {
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <AppShellPlaceholder
        embedded
        hideBackHomeCta
        titleKey="pages.journey.title"
        leadKey="pages.journey.lead"
        bodyKey="pages.journey.body"
      />
    </ShellTemplateChromeLayout>
  );
}
