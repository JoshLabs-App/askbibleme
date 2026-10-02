"use client";

import { useEffect } from "react";
import { refreshEndpoints } from "@/lib/endpoints";

/** 防封换线：挂载后、回到前台时探测候选域（lib/endpoints 自己限 10 分钟一次）。不渲染任何东西。 */
export function EndpointsBoot() {
  useEffect(() => {
    void refreshEndpoints();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshEndpoints();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
