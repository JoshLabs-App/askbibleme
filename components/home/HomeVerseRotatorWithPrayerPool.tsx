"use client";

import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import type { ComponentProps } from "react";

/** 与 `HomeVerseRotator` 同义：经文数据与轮播进度由 `HomePrayerVerseFeedProvider` 全站注入。 */
export type HomeVerseRotatorWithPrayerPoolProps = ComponentProps<typeof HomeVerseRotator>;

export function HomeVerseRotatorWithPrayerPool(props: HomeVerseRotatorWithPrayerPoolProps) {
  return <HomeVerseRotator {...props} />;
}
