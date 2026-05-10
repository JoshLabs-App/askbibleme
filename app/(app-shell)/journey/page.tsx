import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";

export const metadata = {
  title: "旅程 | Selah.my",
  description: "安静路径上的陪伴感，正在与整体产品一起成型。",
};

export default function JourneyPlaceholderPage() {
  return (
    <AppShellPlaceholder titleKey="pages.journey.title" descriptionKey="pages.journey.description" />
  );
}
