import { AdminTelemetryUsageClient } from "@/components/admin/AdminTelemetryUsageClient";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";

export default function AdminTelemetryUsagePage() {
  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-[15px] font-medium tracking-tight text-adminFg">使用概览</h1>
      <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-adminMuted">
        匿名设备级统计：日活跃、页面浏览、白名单点击与自然场景时长。不含经文正文与搜索词。
      </p>
      <div className="mt-10">
        <AdminTelemetryUsageClient />
      </div>
    </div>
  );
}
