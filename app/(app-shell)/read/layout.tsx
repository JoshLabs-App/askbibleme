import type { ReactNode } from "react";
import { ReadTripleLoopPlanSync } from "@/components/bible/ReadTripleLoopPlanSync";
import { ReadWideQuickPanelsProvider } from "@/components/bible/ReadWideQuickPanels";
import "./read-chapter-surfaces.css";
import "./catalog/bible-catalog.css";

export default function ReadSectionLayout({ children }: { children: ReactNode }) {
  return (
    <ReadWideQuickPanelsProvider>
      <ReadTripleLoopPlanSync />
      {children}
    </ReadWideQuickPanelsProvider>
  );
}
