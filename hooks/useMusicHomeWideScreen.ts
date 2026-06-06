"use client";

import { useEffect, useState } from "react";

/** 音乐页宽屏：平板 / 桌面（与壳层横屏沉浸上沿 957px 一致） */
export function useMusicHomeWideScreen(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}
