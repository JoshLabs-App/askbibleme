"use client";

/**
 * AI Discussion Panel — 安静的产品思考侧栏。
 * 不接真实 API 时由 generateAIReflection 模拟；接入后替换生成函数即可。
 */

import type { StudioDocId } from "@/lib/studio-config";
import { StudioDiscussionMessageList } from "./StudioDiscussionMessageList";
import { StudioDiscussionRolePanel } from "./StudioDiscussionRolePanel";
import { useStudioDiscussionController } from "./use-studio-discussion-controller";

type Props = {
  activeDocId: StudioDocId;
  /** 当前文档一行标题，例如「01 · Vision · 产品愿景」 */
  activeTitleLine: string;
  documents: Record<string, string>;
  setDocuments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** default：三栏中的右侧；focusOnly：独占一行全宽 */
  layoutMode?: "default" | "focusOnly";
  onEnterFocusOnly?: () => void;
  onExitFocusOnly?: () => void;
};

export function StudioAIDiscussionPanel({
  activeDocId,
  activeTitleLine,
  documents,
  setDocuments,
  layoutMode = "default",
  onEnterFocusOnly,
  onExitFocusOnly,
}: Props) {
  const ctrl = useStudioDiscussionController({
    activeDocId,
    activeTitleLine,
    documents,
    setDocuments,
  });

  return (
    <div
      role="complementary"
      aria-label="AI Editorial Discussion Panel"
      className={`flex min-h-0 flex-1 flex-col bg-canvas text-ink ${
        layoutMode === "focusOnly" ? "" : "border-l border-border/80"
      }`}
    >
      <StudioDiscussionRolePanel
        activeTitleLine={activeTitleLine}
        layoutMode={layoutMode}
        onEnterFocusOnly={onEnterFocusOnly}
        onExitFocusOnly={onExitFocusOnly}
        responseMode={ctrl.responseMode}
        setResponseMode={ctrl.setResponseMode}
        roleConfigs={ctrl.roleConfigs}
        setRoleConfigs={ctrl.setRoleConfigs}
        pmOpen={ctrl.pmOpen}
        setPmOpen={ctrl.setPmOpen}
        pmDraft={ctrl.pmDraft}
        setPmDraft={ctrl.setPmDraft}
        confirmAppendProductMemory={ctrl.confirmAppendProductMemory}
        lastAssembly={ctrl.lastAssembly}
        discussionMeta={ctrl.discussionMeta}
      />

      <StudioDiscussionMessageList
        scrollRef={ctrl.scrollRef}
        messages={ctrl.messages}
        busy={ctrl.busy}
        note={ctrl.note}
        composer={ctrl.composer}
        setComposer={ctrl.setComposer}
        discussionRole={ctrl.discussionRole}
        setDiscussionRole={ctrl.setDiscussionRole}
        roleConfigs={ctrl.roleConfigs}
        docLabel={ctrl.docLabel}
        onAddCurrent={ctrl.onAddCurrent}
        appendToDoc={ctrl.appendToDoc}
        onRewriteShorter={ctrl.onRewriteShorter}
        onKeepDiscussion={ctrl.onKeepDiscussion}
        send={ctrl.send}
        sendAskAllRoles={ctrl.sendAskAllRoles}
      />
    </div>
  );
}
