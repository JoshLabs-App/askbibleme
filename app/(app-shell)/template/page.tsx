import type { Metadata } from "next";
import { ShellTemplatePage } from "@/components/shell/ShellTemplatePage";

export const metadata: Metadata = {
  title: "壳模板",
  description: "主导航壳内版心与留白。",
};

export default function TemplateRoutePage() {
  return <ShellTemplatePage />;
}
