import timelineJson from "@/data/legacy-figures-timeline.json";
import type { LegacyFigureTimelineBookRow } from "@/lib/legacy-figures-timeline-types";

type TimelineBundle = {
  schemaVersion: number;
  contentVersion: string;
  bookRows: LegacyFigureTimelineBookRow[];
};

const bundle = timelineJson as TimelineBundle;

export function readLegacyFiguresTimelineBookRows(): LegacyFigureTimelineBookRow[] {
  return bundle.bookRows;
}

export function readLegacyFiguresTimelineContentVersion(): string {
  return bundle.contentVersion;
}
