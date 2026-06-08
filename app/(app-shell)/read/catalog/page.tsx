import { redirect } from "next/navigation";

/** 兼容旧链接；真源路由为 `/read/read`（对齐 iOS stack）。 */
export default function ReadCatalogLegacyPage() {
  redirect("/read/read");
}
