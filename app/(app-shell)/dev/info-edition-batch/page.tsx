import { InfoEditionBatchClient } from "@/components/admin/InfoEditionBatchClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "./info-edition-batch.css";

export const metadata = {
  title: sitePageTitle("批量生成"),
  description: "本机讲解版与发现版全书批量生成与断点续跑。",
};

export default function InfoEditionBatchMonitorPage() {
  return (
    <ScriptureChrome scrollHome>
      <InfoEditionBatchClient
        apiPath="/api/dev/info-edition-batch"
        mode="local"
        title="讲解 / 发现版 · 本机批量"
        subtitle="全书断点续跑：逐章生成并写入 published.json，直至启示录；停止后可再续。"
      />
    </ScriptureChrome>
  );
}
