import type { Metadata } from "next";
import { SITE_METADATA_DEFAULT_TITLE, sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: sitePageTitle("注册"),
  description: SITE_METADATA_DEFAULT_TITLE,
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
