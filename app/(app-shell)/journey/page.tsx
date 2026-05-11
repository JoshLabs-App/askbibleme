import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";

export const metadata = {
  title: "旅程 | Selah.my",
  description: "你若喜欢安静地同行，走着走着会遇见更多；首页的自然与经文也一直在这儿。",
};

export default function JourneyPlaceholderPage() {
  return (
    <AppShellPlaceholder
      titleKey="pages.journey.title"
      leadKey="pages.journey.lead"
      bodyKey="pages.journey.body"
    />
  );
}
