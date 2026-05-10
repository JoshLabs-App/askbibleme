import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";

export const metadata = {
  title: "探索 | Selah.my",
  description: "慢一点的发现，不与「回到经文」抢主叙事。",
};

export default function ExplorePlaceholderPage() {
  return (
    <AppShellPlaceholder titleKey="pages.explore.title" descriptionKey="pages.explore.description" />
  );
}
