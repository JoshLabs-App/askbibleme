"use client";

import { useEffect, useRef, useState } from "react";
import { READ_PARCHMENT_FAINT, READ_PARCHMENT_MUTED } from "@/lib/read/read-parchment-accents";
import type { ReadHomeVerseItem } from "@/lib/read/read-home-verse-rotation";

type Props = {
  verses: ReadHomeVerseItem[];
};

/** Bottom rotating verse card on `/read` home (iOS ReadCatalogScreen). */
export function ReadBibleHomeVerseRotator({ verses }: Props) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const animatingRef = useRef(false);

  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [verses]);

  useEffect(() => {
    if (verses.length < 2) return;
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      if (animatingRef.current) return;
      animatingRef.current = true;
      setVisible(false);
      window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % verses.length);
        setVisible(true);
        animatingRef.current = false;
      }, 2000);
    }, 15000);

    return () => {
      window.clearInterval(timer);
      animatingRef.current = false;
    };
  }, [verses.length]);

  const active = verses[index] ?? verses[0];
  if (!active?.text) return null;

  return (
    <div className="read-bible-read-home-verse mx-auto mt-[6.25rem] mb-2 w-full max-w-[380px] px-[22px] text-center">
      <div
        className="min-h-[70px] max-h-[70px] transition-opacity duration-[2000ms] ease-in-out"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="line-clamp-3 text-[14px] leading-[21px]" style={{ color: READ_PARCHMENT_MUTED }}>
          {active.text}
        </p>
        <p
          className="mt-0.5 text-[12px] leading-[18px] tracking-[0.02em]"
          style={{ color: READ_PARCHMENT_FAINT }}
        >
          ——{active.reference}
        </p>
      </div>
    </div>
  );
}
