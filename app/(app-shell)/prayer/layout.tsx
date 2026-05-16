import type { ReactNode } from "react";
import { ReadBibleTypographyProvider } from "@/components/bible/ReadBibleTypographyProvider";
import "../read/read-chapter-surfaces.css";

export default function PrayerSectionLayout({ children }: { children: ReactNode }) {
  return <ReadBibleTypographyProvider>{children}</ReadBibleTypographyProvider>;
}
