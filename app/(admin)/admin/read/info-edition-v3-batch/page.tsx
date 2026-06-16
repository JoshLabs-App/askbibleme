import { InfoEditionV3BatchClient } from "@/components/admin/InfoEditionV3BatchClient";

export default function InfoEditionV3BatchAdminPage() {
  return (
    <div className="admin-page">
      <h1 className="text-lg font-semibold text-adminFg">V3 批量纠错（临时）</h1>
      <p className="mt-1 text-[12px] text-adminMuted">DeepSeek · 全书断点续跑 · 边改边存</p>
      <InfoEditionV3BatchClient />
    </div>
  );
}
