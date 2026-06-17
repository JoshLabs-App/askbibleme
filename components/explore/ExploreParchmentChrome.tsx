import type { ReactNode } from "react";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";

type Props = {
  children: ReactNode;
};

/** 探索区与 /read 共用羊皮卷底、顶栏与滚动区（scroll mask 与读经 Tab 一致）。 */
export function ExploreParchmentChrome({ children }: Props) {
  return (
    <ScriptureChrome scrollHome>
      <div className="explore-parchment-root">{children}</div>
    </ScriptureChrome>
  );
}
