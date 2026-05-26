import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { FeedbackPageClient } from "@/components/feedback/FeedbackPageClient";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("反馈"),
  description: "把问题、想法或建议发给 AskBible.me。",
};

export default function FeedbackPage() {
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0">
      <FeedbackPageClient />
    </ShellTemplateChromeLayout>
  );
}
