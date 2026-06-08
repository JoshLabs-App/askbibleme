import type { ReactNode } from "react";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";

type Props = {
  children: ReactNode;
  /** 长文阅读页：减轻顶底 mask 渐隐，避免正文被「吃掉」 */
  proseScroll?: boolean;
};

/** 探索区与 /read 共用羊皮卷底、顶栏与滚动区。 */
export function ExploreParchmentChrome({ children, proseScroll = false }: Props) {
  return (
    <ScriptureChrome
      scrollHome
      parchmentScrollClassName={proseScroll ? "read-bible-parchment-scroll--explore-prose" : undefined}
    >
      <div className="explore-parchment-root">{children}</div>
    </ScriptureChrome>
  );
}
