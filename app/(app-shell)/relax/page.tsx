import type { Metadata } from "next";
import { RelaxCalmExperience } from "@/components/relax/RelaxCalmExperience";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readRelaxSettings } from "@/lib/relax/read-relax-settings";

export const metadata: Metadata = {
  title: "放松",
  description: "静音画面与独立音乐层，慢下来的一小段时间。",
};

/** 在 `(app-shell)` 内：底栏固定；`immersive` 仅去掉顶栏与左右留白，主区在底栏之上铺满。 */
export default async function RelaxPage() {
  const settings = await readRelaxSettings(process.cwd());
  return (
    <ShellTemplateChromeLayout contentClassName="gap-0" immersive>
      <RelaxCalmExperience initial={settings} layout="templateChrome" />
    </ShellTemplateChromeLayout>
  );
}
