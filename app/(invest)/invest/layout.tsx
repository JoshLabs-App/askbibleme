import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "私人投资控制台",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function InvestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
