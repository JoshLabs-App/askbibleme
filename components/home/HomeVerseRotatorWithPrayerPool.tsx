"use client";

import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import type { ComponentProps } from "react";

/** 与 `HomeVerseRotator` 同义；可选 `standaloneVersesByLocale` 见 `HomeVerseRotator`。 */
export type HomeVerseRotatorWithPrayerPoolProps = ComponentProps<typeof HomeVerseRotator>;

export function HomeVerseRotatorWithPrayerPool(props: HomeVerseRotatorWithPrayerPoolProps) {
  return <HomeVerseRotator {...props} />;
}
