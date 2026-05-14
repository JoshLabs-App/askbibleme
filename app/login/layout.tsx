import type { Metadata } from "next";
import { SITE_METADATA_DEFAULT_TITLE, sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: sitePageTitle("登录"),
  description: SITE_METADATA_DEFAULT_TITLE,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
