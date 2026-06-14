import type { Metadata } from "next";
import { ASKBIBLE_PRODUCT_URL } from "@/lib/askbible-product-name";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

const PAGE_URL = `${ASKBIBLE_PRODUCT_URL}/joshmoney/privacy`;

export const metadata: Metadata = {
  title: sitePageTitle("JoshMoney Privacy"),
  description:
    "Privacy policy for JoshMoney — offline bookkeeping for Canadian sole proprietors (iOS and Android).",
  alternates: {
    canonical: PAGE_URL,
  },
};

export default function JoshMoneyPrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
