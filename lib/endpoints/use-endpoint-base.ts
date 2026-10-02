"use client";

import { useSyncExternalStore } from "react";
import { endpointBase, endpointDefaultBase, subscribeEndpoints, type EndpointRole } from "@/lib/endpoints";

/**
 * 渲染里取当前线路（不带结尾斜杠）。水合时先用服务端那个值（内置表第一条），
 * 挂载后如果本机缓存的线路不同再换——避免水合不一致把旧域留在 DOM 上。
 */
export function useEndpointBase(role: EndpointRole): string {
  return useSyncExternalStore(
    subscribeEndpoints,
    () => endpointBase(role),
    () => endpointDefaultBase(role),
  );
}
