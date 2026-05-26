import type { Metadata } from "next";

/** 与 `admin/layout` 的 `title.template` 合并为「登录 · 后台 | AskBible.me」 */
export const metadata: Metadata = {
  title: "登录",
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
