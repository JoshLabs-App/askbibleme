/**
 * `/studio` 不在 `(app-shell)` 内：整屏 fixed 壳与前台同源（顶对齐视口、无负 top）。
 */
import type { Metadata } from "next";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: sitePageTitle("Studio"),
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1] flex min-h-0 w-full flex-col overflow-hidden bg-canvas">
      {children}
    </div>
  );
}
