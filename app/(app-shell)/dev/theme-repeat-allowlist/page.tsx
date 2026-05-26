import { ThemeRepeatAllowlistEditor } from "@/components/admin/ThemeRepeatAllowlistEditor";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata = {
  title: sitePageTitle("首页金句池审阅"),
  description: "网页方式审阅首页金句池，逐条删除并写回 allowlist。",
};

export default function ThemeRepeatAllowlistPage() {
  return (
    <ScriptureChrome scrollHome>
      <ThemeRepeatAllowlistEditor minCount={5} />
    </ScriptureChrome>
  );
}
