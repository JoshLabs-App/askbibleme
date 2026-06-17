import type { ReactNode } from "react";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";

/** 静态信息页：全屏羊皮卷底 + 窄栏版心（与 /about 默认版面一致）。 */
export function NarrowParchmentChrome({ children }: { children: ReactNode }) {
  return (
    <ScriptureChrome
      scrollHome
      parchmentScrollClassName="read-bible-parchment-scroll--narrow"
      parchmentColumnClassName="read-bible-parchment-column--narrow prayer-on-parchment"
    >
      {children}
    </ScriptureChrome>
  );
}
