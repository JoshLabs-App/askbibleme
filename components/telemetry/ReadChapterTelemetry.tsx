"use client";

import { useEffect } from "react";
import { trackTelemetry } from "@/lib/telemetry/client";

type Props = {
  bookId: string;
  chapter: number;
};

export function ReadChapterTelemetry({ bookId, chapter }: Props) {
  useEffect(() => {
    if (!bookId || !Number.isFinite(chapter)) return;
    trackTelemetry("read_chapter_open", { book_id: bookId.toUpperCase(), chapter });
  }, [bookId, chapter]);

  return null;
}
