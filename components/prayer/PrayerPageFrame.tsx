import type { ReactNode } from "react";

/** 祷告内容区：外层由 `ScriptureChrome` 提供羊皮卷与滚动；此处仅保留版心宽度。 */
export function PrayerPageFrame({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>;
}
