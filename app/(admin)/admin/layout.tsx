import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { SITE_METADATA_DEFAULT_TITLE, sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: {
    default: sitePageTitle("后台"),
    template: `%s · 后台 | ${SITE_METADATA_DEFAULT_TITLE}`,
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
