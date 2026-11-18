"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GoldenVerseBackgroundItem } from "@/lib/golden-verses/background-uploads";

async function fetchGoldenVersePageBackgrounds(): Promise<GoldenVerseBackgroundItem[] | null> {
  try {
    const res = await fetch("/api/golden-verses/backgrounds", { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { backgrounds?: GoldenVerseBackgroundItem[] };
    return Array.isArray(j.backgrounds) ? j.backgrounds : null;
  } catch {
    // A failed refresh is not an empty catalog. Keep the last usable backgrounds.
    return null;
  }
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
  const backgroundsRef = useRef(backgrounds);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    const next = await fetchGoldenVersePageBackgrounds();
    if (request === requestRef.current && next !== null) {
      if (!sameCatalog(backgroundsRef.current, next)) {
        backgroundsRef.current = next;
        setBackgrounds(next);
      }
    }
    return backgroundsRef.current;
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    if (!sameCatalog(backgroundsRef.current, initialFromServer)) {
      backgroundsRef.current = [...initialFromServer];
      setBackgrounds(backgroundsRef.current);
    }
  }, [initialFromServer]);

  useEffect(() => {
    void refresh();
    return () => { requestRef.current += 1; };
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
