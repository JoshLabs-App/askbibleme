"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { readChapterHref } from "@/lib/read/read-chapter-href";
import { readPlanFlowActive } from "@/lib/read/plan-flow-session";

/** Chapter links that preserve `?planFlow=1` when the user is in plan-flow mode. */
export function useReadChapterHref() {
  const searchParams = useSearchParams();
  const planFlowFromUrl = searchParams.get("planFlow") === "1";
  const planFlow = planFlowFromUrl || readPlanFlowActive();

  return useCallback(
    (bookId: string, chapter: number, forcePlanFlow?: boolean) =>
      readChapterHref(bookId, chapter, { planFlow: forcePlanFlow ?? planFlow }),
    [planFlow],
  );
}
