import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("圣经"),
  description: "回到文字里的路，会与首页已经遇见的经文悄悄相连——你愿意的话，就一路走下去。",
};

export default function ReadPlaceholderPage() {
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <AppShellPlaceholder
        embedded
        hideBackHomeCta
        titleKey="pages.read.title"
        leadKey="pages.read.lead"
        bodyKey="pages.read.body"
        secondaryCtaHref="/read/catalog"
        secondaryCtaLabelKey="pages.read.catalogCta"
      />
    </ShellTemplateChromeLayout>
  );
}
