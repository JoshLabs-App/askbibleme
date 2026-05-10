import { AppShellPlaceholder } from "@/components/shell/AppShellPlaceholder";

export const metadata = {
  title: "圣经 | Selah.my",
  description: "回到经文的路径正在与整体安静体验一起成型。",
};

export default function ReadPlaceholderPage() {
  return (
    <AppShellPlaceholder titleKey="pages.read.title" descriptionKey="pages.read.description" />
  );
}
