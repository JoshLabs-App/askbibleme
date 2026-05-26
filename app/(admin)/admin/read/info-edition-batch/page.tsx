import { InfoEditionBatchClient } from "@/components/admin/InfoEditionBatchClient";

export default function InfoEditionBatchAdminPage() {
  return (
    <InfoEditionBatchClient
      apiPath="/api/admin/bible/info-edition-batch"
      mode="online"
      title="全本批量生成（线上）"
      subtitle="讲解版 + 发现版 · 直写持久盘"
    />
  );
}
