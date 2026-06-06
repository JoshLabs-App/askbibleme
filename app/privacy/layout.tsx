import type { Metadata } from "next";
import { ASKBIBLE_PRODUCT_URL } from "@/lib/askbible-product-name";
import { SITE_METADATA_DEFAULT_TITLE, sitePageTitle } from "@/lib/site-metadata-defaults";

export const metadata: Metadata = {
  title: sitePageTitle("Privacy"),
  description: `Privacy policy for ${SITE_METADATA_DEFAULT_TITLE} — how we handle data in the app and on ${ASKBIBLE_PRODUCT_URL}.`,
  alternates: {
    canonical: `${ASKBIBLE_PRODUCT_URL}/privacy`,
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
