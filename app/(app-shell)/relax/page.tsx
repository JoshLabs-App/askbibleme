import type { Metadata } from "next";
import { RelaxCalmExperience } from "@/components/relax/RelaxCalmExperience";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readRelaxSettings } from "@/lib/relax/read-relax-settings";

export const metadata: Metadata = {
  title: "放松",
  description: "静音画面与独立音乐层，慢下来的一小段时间。",
};

/** 在 `(app-shell)` 内：底栏固定；`immersive` 主区横向贴边、仅 safe-area 顶内边距；角标式菜单为 fixed 不占文档流。 */
export default async function RelaxPage() {
  const cwd = process.cwd();
  const settings = await readRelaxSettings(cwd);
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0" immersive>
      <RelaxCalmExperience initial={settings} layout="templateChrome" />
    </ShellTemplateChromeLayout>
  );
}
