"use client";

import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { useHomePrayerVerseFeed } from "@/components/home/useHomePrayerVerseFeed";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import type { ComponentProps } from "react";

type RotatorProps = ComponentProps<typeof HomeVerseRotator>;

type Props = Omit<RotatorProps, "entriesByLocale" | "bilingual" | "verseKeys" | "onVerseCommitted" | "onNearEnd"> & {
  fallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
};

export function HomeVerseRotatorWithPrayerPool({ fallbackByLocale, ...rest }: Props) {
  const feed = useHomePrayerVerseFeed({ fallbackByLocale });
  return (
    <HomeVerseRotator
      {...rest}
      entriesByLocale={feed.entriesByLocale}
      bilingual={feed.bilingual}
      verseKeys={feed.verseKeys}
      onVerseCommitted={feed.onVerseCommitted}
      onNearEnd={feed.onNearEnd}
    />
  );
}
