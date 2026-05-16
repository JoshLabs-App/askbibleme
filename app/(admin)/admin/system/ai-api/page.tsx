import { AdminAiApiConfigClient } from "@/components/admin/AdminAiApiConfigClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";

export const metadata = { title: "API 密钥" };

export default function AdminAiApiConfigPage() {
  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">API 密钥</h1>
      <AdminAiApiConfigClient />
    </div>
  );
}
