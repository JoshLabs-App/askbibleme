import type { Metadata } from "next";
import { ShellTemplatePage } from "@/components/shell/ShellTemplatePage";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: sitePageTitle("壳模板"),
  description: "主导航壳内版心与留白。",
};

export default function TemplateRoutePage() {
  return <ShellTemplatePage />;
}
