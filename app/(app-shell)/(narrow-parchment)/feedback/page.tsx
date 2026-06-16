import { FeedbackPageClient } from "@/components/feedback/FeedbackPageClient";
import { NarrowParchmentChrome } from "@/components/shell/NarrowParchmentChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("反馈"),
  description: "把问题、想法或建议发给 AskBible.me。",
};

export default function FeedbackPage() {
  return (
    <NarrowParchmentChrome>
      <FeedbackPageClient />
    </NarrowParchmentChrome>
  );
}
