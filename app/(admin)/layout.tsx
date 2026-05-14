import { AdminProviders } from "./admin-providers";

/**
 * 管理后台：整屏 `fixed` 壳；`AdminProviders` 根节点带 `data-admin-shell="light"`，
 * 在 `globals.css` 中套用与前台独立的浅灰纸色 + Notion 系正文色（`--brand-admin-*` 与主区语义色）。
 */
export default function AdminSegmentLayout({ children }: { children: React.ReactNode }) {
  return <AdminProviders>{children}</AdminProviders>;
}
