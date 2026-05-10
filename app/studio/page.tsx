import StudioWorkspace from "./studio-workspace";
import { loadStudioInitialDocuments } from "@/lib/studio/load-initial-documents";

/** Studio 页面：服务端读取 /docs 下 Markdown，交给客户端编辑与持久化 */
export default async function StudioPage() {
  const initialDocuments = await loadStudioInitialDocuments();
  return <StudioWorkspace initialDocuments={initialDocuments} />;
}
