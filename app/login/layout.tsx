import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "登录",
  description: "Selah.my",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
