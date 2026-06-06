"use client";

import { useEffect } from "react";
import { writeLastReadPosition } from "@/lib/read/read-last-position";

type Props = {
  bookId: string;
  chapter: number;
  bookName: string;
};

/** Persists last-read chapter for catalog highlighting (aligned with iOS). */
export function ReadChapterLastPositionSync({ bookId, chapter, bookName }: Props) {
  useEffect(() => {
    writeLastReadPosition({ bookId, chapter, bookName });
  }, [bookId, chapter, bookName]);

  return null;
}
