import type { ReactNode } from "react";
import { ReadBibleTypographyProvider } from "@/components/bible/ReadBibleTypographyProvider";
import "./read-chapter-surfaces.css";

export default function ReadSectionLayout({ children }: { children: ReactNode }) {
  return <ReadBibleTypographyProvider>{children}</ReadBibleTypographyProvider>;
}
