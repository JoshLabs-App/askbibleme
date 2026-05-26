"use client";

import { useEffect, useRef, useState } from "react";
import {
  ensureNatureVideoBlobObjectUrl,
  peekNatureVideoBlobObjectUrl,
} from "@/lib/nature/nature-video-blob-cache";

type Args = {
  enabled: boolean;
  videoSrc: string;
  sceneKey: string;
};

/**
 * 进页显静图时：后台 fetch 整段成片，就绪后返回 Blob object URL 供 `<video src>` 使用。
 */
export function useNatureHomeFullVideoFetch({ enabled, videoSrc, sceneKey }: Args) {
  const [objectUrl, setObjectUrl] = useState<string | null>(() =>
    enabled && videoSrc.trim() ? peekNatureVideoBlobObjectUrl(videoSrc.trim()) : null,
  );
  const [ready, setReady] = useState(() =>
    Boolean(enabled && videoSrc.trim() && peekNatureVideoBlobObjectUrl(videoSrc.trim())),
  );
  const [failed, setFailed] = useState(false);
  /** 0–1；无 Content-Length 时为 null */
  const [progress, setProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(() =>
    Boolean(enabled && videoSrc.trim() && !peekNatureVideoBlobObjectUrl(videoSrc.trim())),
  );

  useEffect(() => {
    const src = videoSrc.trim();
    if (!enabled || !src) {
      setObjectUrl(null);
      setReady(false);
      setFailed(false);
      setProgress(null);
      setLoading(false);
      return;
    }

    const cached = peekNatureVideoBlobObjectUrl(src);
    if (cached) {
      setObjectUrl(cached);
      setReady(true);
      setFailed(false);
      setProgress(1);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    setObjectUrl(null);
    setReady(false);
    setFailed(false);
    setProgress(0);
    setLoading(true);

    void (async () => {
      try {
        const url = await ensureNatureVideoBlobObjectUrl(src, ac.signal, (received, totalBytes) => {
          if (cancelled) return;
          if (totalBytes != null && totalBytes > 0) {
            setProgress(Math.min(1, received / totalBytes));
          } else {
            setProgress(null);
          }
        });
        if (cancelled) return;
        setObjectUrl(url);
        setProgress(1);
        setReady(true);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      setObjectUrl(null);
      setReady(false);
      setFailed(false);
      setProgress(null);
      setLoading(false);
    };
  }, [enabled, videoSrc, sceneKey]);

  return { objectUrl, ready, failed, progress, loading };
}
