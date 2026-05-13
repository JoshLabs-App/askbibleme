import { ExploreHomeContent } from "@/components/explore/ExploreHomeContent";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";

export const metadata = {
  title: "探索 | Selah.my",
  description: "更多小惊喜正在路上；也可从这儿打开祷告与经文。",
};

export default function ExplorePage() {
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <ExploreHomeContent />
    </ShellTemplateChromeLayout>
  );
}
