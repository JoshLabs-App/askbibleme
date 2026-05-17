"use client";

import { useEffect, useRef, useState } from "react";
import { fetchNatureVideoFully } from "@/lib/nature/fetch-nature-video-fully";

type Args = {
  enabled: boolean;
  videoSrc: string;
  sceneKey: string;
};

/**
 * 进页显静图时：后台 fetch 整段成片，就绪后返回 Blob object URL 供 `<video src>` 使用。
 */
export function useNatureHomeFullVideoFetch({ enabled, videoSrc, sceneKey }: Args) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !videoSrc.trim()) {
      setObjectUrl(null);
      setReady(false);
      setFailed(false);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    setObjectUrl(null);
    setReady(false);
    setFailed(false);

    void (async () => {
      try {
        const buf = await fetchNatureVideoFully(videoSrc, ac.signal, () => {});
        if (cancelled) return;
        const blob = new Blob([buf], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setObjectUrl(url);
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setObjectUrl(null);
      setReady(false);
      setFailed(false);
    };
  }, [enabled, videoSrc, sceneKey]);

  return { objectUrl, ready, failed };
}
