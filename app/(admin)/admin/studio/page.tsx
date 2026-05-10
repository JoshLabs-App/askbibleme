import type { Metadata } from "next";
import StudioWorkspace from "@/app/studio/studio-workspace";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { loadStudioInitialDocuments } from "@/lib/studio/load-initial-documents";

export const metadata: Metadata = {
  title: "Studio",
  description: "产品文档与本地 AI 讨论（统一后台内）",
};

export default async function AdminStudioPage() {
  const initialDocuments = await loadStudioInitialDocuments();
  return (
    <div className={`${ADMIN_MAIN_CLASS} flex min-h-0 min-w-0 flex-1 flex-col`}>
      <StudioWorkspace initialDocuments={initialDocuments} embedInAdmin />
    </div>
  );
}
