"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WEB_APP_HOME_PATH } from "@/lib/web-app-home-path";

/** 手机里那一页按这个尺寸排版，再整体缩到模型里；比例和屏幕框的 600 / 1299 一致。 */
const LIVE_SCREEN_WIDTH = 390;
const LIVE_SCREEN_HEIGHT = 844;
/** 页面加载完再等一会儿才淡入，免得看到风景视频和金句还没出来的空白。 */
const LIVE_SCREEN_REVEAL_DELAY_MS = 1200;

type Props = {
  posterSrc: string;
  alt: string;
};

function prefersSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * 官网手机模型里的画面（Josh 2026-10-01：「就像是 WEB 的实际内容，而不是一个图在那里」，DECISIONS D-15）。
 * 里面是真的网页版首页（`/web`），金句照常轮播；只看不能点，点整个屏幕进网页版。
 * 截图垫在下面：网页版还没加载完、开了省流量、或者加载失败时看到的是它。
 */
export function SitePhoneLiveScreen({ posterSrc, alt }: Props) {
  const screenRef = useRef<HTMLAnchorElement>(null);
  const [scale, setScale] = useState(0);
  const [mountLive, setMountLive] = useState(false);
  const [liveReady, setLiveReady] = useState(false);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const sync = () => setScale(el.clientWidth / LIVE_SCREEN_WIDTH);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** 等官网自己先画完再去加载网页版，不和首屏抢带宽。 */
  useEffect(() => {
    if (prefersSaveData()) return;
    const id = window.setTimeout(() => setMountLive(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  const revealTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (revealTimerRef.current != null) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  return (
    <Link ref={screenRef} href={WEB_APP_HOME_PATH} className="site-home__phone-screen" aria-label={alt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={posterSrc} alt="" width={600} height={1299} decoding="async" />
      {mountLive && scale > 0 ? (
        <iframe
          className="site-home__phone-live"
          data-ready={liveReady ? "1" : "0"}
          src={WEB_APP_HOME_PATH}
          title={alt}
          tabIndex={-1}
          aria-hidden
          width={LIVE_SCREEN_WIDTH}
          height={LIVE_SCREEN_HEIGHT}
          style={{ transform: `scale(${scale})` }}
          onLoad={() => {
            revealTimerRef.current = window.setTimeout(() => setLiveReady(true), LIVE_SCREEN_REVEAL_DELAY_MS);
          }}
        />
      ) : null}
    </Link>
  );
}
