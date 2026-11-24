"use client";

import { useEffect, useState } from "react";
import { isMobileModelActive, subscribeMobileModelChange } from "@/lib/shell/app-shell-portal-root";

/** 音乐页宽屏：平板 / 桌面（与壳层横屏沉浸上沿 957px 一致）；1:1 手机模型内走单栏移动端 */
export function useMusicHomeWideScreen(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(!isMobileModelActive() && mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const offModel = subscribeMobileModelChange(sync);
    return () => {
      offModel();
      mq.removeEventListener("change", sync);
    };
  }, []);
  return wide;
}
