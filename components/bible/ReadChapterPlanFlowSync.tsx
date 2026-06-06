"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { setPlanFlowActive } from "@/lib/read/plan-flow-session";

/** Keeps plan-flow session in sync with `?planFlow=1` on chapter routes. */
export function ReadChapterPlanFlowSync() {
  const searchParams = useSearchParams();
  const planFlow = searchParams.get("planFlow") === "1";

  useEffect(() => {
    setPlanFlowActive(planFlow);
  }, [planFlow]);

  return null;
}
