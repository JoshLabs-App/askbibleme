"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

const LOGO_SVG = "/branding/logo.svg";
const LOGO_PNG = "/branding/logo.png";

/**
 * 应用壳顶栏正中：透明 LOGO + 可配置方块底色（`--brand-logo-background`）。
 */
export function AppShellBarLogo() {
  const [src, setSrc] = useState(LOGO_SVG);
  const [hidden, setHidden] = useState(false);

  const onError = useCallback(() => {
    if (src === LOGO_SVG) {
      setSrc(LOGO_PNG);
      return;
    }
    setHidden(true);
  }, [src]);

  if (hidden) return null;

  return (
    <div
      className="chrome-float-hit pointer-events-none fixed left-1/2 z-[50] -translate-x-1/2 pt-[max(0.35rem,env(safe-area-inset-top,0px))]"
      aria-hidden
    >
      <div
        className="relative h-9 w-9 overflow-hidden rounded-lg border border-ink/10 shadow-sm sm:h-10 sm:w-10"
        style={{ backgroundColor: "rgb(var(--brand-logo-background-rgb))" }}
      >
        <Image
          src={src}
          alt=""
          fill
          className="object-contain p-1"
          unoptimized
          onError={onError}
        />
      </div>
    </div>
  );
}
