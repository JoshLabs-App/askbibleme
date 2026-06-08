"use client";

import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import type { ExploreEntry } from "@/lib/explore/exploreEntries";

type Props = {
  entry: ExploreEntry;
  size: number;
  color?: string;
};

/** 与 iOS `ExploreEntryIcon` 对齐（Material Community Icons） */
export function ExploreEntryIcon({ entry, size, color = "currentColor" }: Props) {
  return <ShellMaterialCommunityIcon name={entry.icon} size={size} color={color} />;
}
