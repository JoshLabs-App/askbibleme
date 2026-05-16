import { AdminGenerationRolesClient } from "@/components/admin/AdminGenerationRolesClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";

export const metadata = { title: "生成角色" };

export default function AdminGenerationRolesPage() {
  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">生成角色</h1>
      <AdminGenerationRolesClient />
    </div>
  );
}
