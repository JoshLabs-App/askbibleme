"use client";

import { useCallback, useEffect, useState } from "react";
import type { GoldenVerseBackgroundItem } from "@/lib/golden-verses/background-uploads";

async function fetchGoldenVersePageBackgrounds(): Promise<GoldenVerseBackgroundItem[]> {
  const res = await fetch("/api/golden-verses/backgrounds", { cache: "no-store" });
  const j = (await res.json()) as { backgrounds?: GoldenVerseBackgroundItem[] };
  if (!res.ok) return [];
  return Array.isArray(j.backgrounds) ? j.backgrounds : [];
}

function sameCatalog(
  a: readonly GoldenVerseBackgroundItem[],
  b: readonly GoldenVerseBackgroundItem[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id || a[i]?.url !== b[i]?.url) return false;
  }
  return true;
}

/** SSR 初值 + 客户端拉取后台实际上传目录，避免页模板与 admin 不同步 */
export function useGoldenVersePageBackgrounds(
  initialFromServer: readonly GoldenVerseBackgroundItem[],
) {
  const [backgrounds, setBackgrounds] = useState<GoldenVerseBackgroundItem[]>(() => [
    ...initialFromServer,
  ]);

  const refresh = useCallback(async () => {
    const next = await fetchGoldenVersePageBackgrounds();
    setBackgrounds((prev) => (sameCatalog(prev, next) ? prev : next));
    return next;
  }, []);

  useEffect(() => {
    setBackgrounds((prev) => (sameCatalog(prev, initialFromServer) ? prev : [...initialFromServer]));
  }, [initialFromServer]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return { backgrounds, refresh };
}
