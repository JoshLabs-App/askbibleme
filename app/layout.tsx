import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Selah.my",
    template: "%s | Selah.my",
  },
  description: "安静回到经文的入口 — 正在成型。",
  /** iOS「添加到主屏幕」后以独立应用壳打开，避免出现 Safari 顶栏 */
  appleWebApp: {
    capable: true,
    title: "Selah.my",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4EBD9",
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
