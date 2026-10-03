"use client";

import { useEffect, useState } from "react";

/** 每张截图停多久再换下一张（首屏自动轮到这个软件时大约能看到三张） */
const SLIDE_HOLD_MS = 2200;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 官网手机模型里放别的软件时的画面（DECISIONS D-22）：几张截图轮着淡入淡出，点整个屏幕去那个软件。
 * AskBible 自己不用这个，它放的是真的网页版（`SitePhoneLiveScreen`）。
 */
export function SitePhoneSlides({
  slides,
  href,
  alt,
  active,
}: {
  slides: string[];
  href: string;
  alt: string;
  /** 手机里现在是不是轮到它：没轮到时不换图，轮到时从第一张开始 */
  active: boolean;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    setIndex(0);
    if (slides.length < 2 || prefersReducedMotion()) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_HOLD_MS);
    return () => window.clearInterval(id);
  }, [active, slides.length]);

  return (
    <a className="site-home__phone-screen" href={href} target="_blank" rel="noopener noreferrer" aria-label={alt}>
      {slides.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          className="site-home__phone-slide"
          data-on={i === index ? "1" : "0"}
          src={src}
          alt=""
          width={600}
          height={1299}
          decoding="async"
        />
      ))}
    </a>
  );
}

/** 小小圣经是 YouTube 频道，没有手机画面可截：放第 1 集的封面，下面是频道头像、名字和那句话 */
export function SitePhoneLittleBible({
  href,
  alt,
  name,
  slogan,
}: {
  href: string;
  alt: string;
  name: string;
  slogan: string;
}) {
  return (
    <a
      className="site-home__phone-screen site-home__phone-screen--lb"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="site-home__lb-cover" src="/site/littlebible-cover.webp" alt="" width={800} height={450} decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="site-home__lb-avatar" src="/site/sibling-littlebible.jpg" alt="" width={56} height={56} decoding="async" />
      <span className="site-home__lb-name font-serif">{name}</span>
      <span className="site-home__lb-slogan">{slogan}</span>
    </a>
  );
}
