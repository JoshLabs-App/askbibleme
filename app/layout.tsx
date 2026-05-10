import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Selah.my",
    template: "%s | Selah.my",
  },
  description: "安静回到经文的入口 — 正在成型。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans text-[15px] leading-relaxed">
        {children}
      </body>
    </html>
  );
}
