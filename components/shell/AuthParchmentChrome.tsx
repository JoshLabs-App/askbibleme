import type { ReactNode } from "react";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";

/** 登录 / 注册 / 找回密码：全屏羊皮卷底 + 窄栏版心（不含阅读版式设置角标）。 */
export function AuthParchmentChrome({ children }: { children: ReactNode }) {
  return (
    <ScriptureChrome
      hideTypographyControl
      parchmentScrollClassName="read-bible-parchment-scroll--explore-prose read-bible-parchment-scroll--narrow"
      parchmentColumnClassName="read-bible-parchment-column--narrow prayer-on-parchment flex min-h-[min(100dvh,100vh)] flex-col items-center justify-center"
    >
      {children}
    </ScriptureChrome>
  );
}
