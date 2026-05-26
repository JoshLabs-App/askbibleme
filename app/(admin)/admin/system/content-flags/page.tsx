import { AdminMobileContentFlagsClient } from "@/components/admin/AdminMobileContentFlagsClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";

export const metadata = { title: "内容开关" };

export default function AdminMobileContentFlagsPage() {
  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">内容开关</h1>
      <AdminMobileContentFlagsClient />
    </div>
  );
}
