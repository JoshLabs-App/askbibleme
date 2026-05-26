import type { ReactNode } from "react";
import { ReadBibleTypographyProvider } from "@/components/bible/ReadBibleTypographyProvider";

export default function InfoEditionBatchLayout({ children }: { children: ReactNode }) {
  return <ReadBibleTypographyProvider>{children}</ReadBibleTypographyProvider>;
}
