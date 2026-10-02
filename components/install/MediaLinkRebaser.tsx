"use client";

import { useEffect } from "react";
import { rebaseMediaUrl } from "@/lib/endpoints";
import { useEndpointBase } from "@/lib/endpoints/use-endpoint-base";

/**
 * 防封换线：把同一页里指向 `media` 候选域的链接（APK 直链）换到当前通的那条线路上。
 * 给服务端渲染的静态页用——链接是服务端按默认线路 / version.json 写的，浏览器这边线路可能已经换了。
 * 不渲染任何东西。
 */
export function MediaLinkRebaser() {
  const mediaBase = useEndpointBase("media");
  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>("a[href^='https://']").forEach((a) => {
      const raw = a.getAttribute("href") ?? "";
      const next = rebaseMediaUrl(raw, mediaBase);
      if (next !== raw) a.setAttribute("href", next);
    });
  }, [mediaBase]);
  return null;
}
