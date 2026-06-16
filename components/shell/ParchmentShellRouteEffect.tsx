"use client";

import { usePathname } from "next/navigation";
import { ScriptureParchmentShellChromeEffect } from "@/components/scripture/ScriptureParchmentShellChromeEffect";
import { isScriptureParchmentPath } from "@/lib/read/scripture-parchment-shell";

/** 全站羊皮卷：同步 `theme-color`、安全区与宽屏卷轴（含 app-shell 外页面）。 */
export function ParchmentShellRouteEffect() {
  const pathname = usePathname() ?? "";
  if (!isScriptureParchmentPath(pathname)) return null;
  return <ScriptureParchmentShellChromeEffect />;
}
