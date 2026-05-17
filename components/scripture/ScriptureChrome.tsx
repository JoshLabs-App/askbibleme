import type { ReactNode } from "react";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ScriptureParchmentShellChromeEffect } from "@/components/scripture/ScriptureParchmentShellChromeEffect";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";

type Props = {
  children: ReactNode;
  /** `/read`、`/prayer` 首页：整列 flex 排版（渐隐与章页相同，见 `read-chapter-surfaces.css`） */
  scrollHome?: boolean;
};

/**
 * 圣经 /read 与祷告 /prayer 共用：immersive 壳 + 右上阅读版式 + 羊皮卷滚动区。
 */
export function ScriptureChrome({ children, scrollHome = false }: Props) {
  return (
    <>
      <ScriptureParchmentShellChromeEffect />
      <ShellTemplateChromeLayout
        contentClassName="gap-0"
        appShellBackground={PRAYER_SHELL_FILL_LIGHT}
        immersive
        topBarRightAccessory={<ReadBibleTypographySettingsControl />}
      >
      <div className="read-bible-parchment-shell flex-1 text-amber-950 dark:text-stone-50">
        <div
          className={[
            "read-bible-parchment-scroll",
            scrollHome ? "read-bible-parchment-scroll--read-home" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="read-bible-parchment-column read-bible-typography prayer-on-parchment">{children}</div>
        </div>
      </div>
    </ShellTemplateChromeLayout>
    </>
  );
}
