"use client";

/**
 * AskBible.me Studio — 主工作区（客户端）
 * ---------------------------------------------------------------------------
 * 三栏：文档导航 | Markdown 编辑 | AI 占位面板
 * 持久化：浏览器 localStorage（非技术人员可理解为「存在本机浏览器里」）。
 * 后续若要团队共享或备份，可把「写入 localStorage」换成调用后端数据库 API。
 */

import { studioDocCharCount } from "@/lib/studio-doc-history";
import { StudioAIDiscussionPanel } from "./studio-ai-discussion-panel";
import { StudioContextSidebar } from "./StudioContextSidebar";
import { StudioDocMarkdown } from "./studio-doc-markdown";
import { StudioPersistenceAndHistoryDrawers } from "./StudioModelSettingsPanel";
import { useStudioAiProfiles } from "./use-studio-ai-profiles";
import { useStudioDocEditor } from "./use-studio-doc-editor";
import { RESIZER_WIDTH_PX, useStudioPaneLayout } from "./use-studio-pane-layout";

export type StudioWorkspaceProps = {
  /** 服务端从 /docs/*.md 读入的初始正文 */
  initialDocuments: Record<string, string>;
  /** 嵌入统一后台 `/admin/studio`：高度与返回链接适配侧栏 */
  embedInAdmin?: boolean;
};

export function StudioWorkspace({
  initialDocuments,
  embedInAdmin = false,
}: StudioWorkspaceProps) {
  const layout = useStudioPaneLayout();
  const editor = useStudioDocEditor(initialDocuments);
  const aiProfiles = useStudioAiProfiles();

  return (
    <div
      className={
        embedInAdmin
          ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-canvas text-ink"
          : "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-canvas text-ink"
      }
    >
      <div
        ref={layout.mainRowRef}
        className={`flex min-h-0 min-w-0 flex-1 flex-row ${
          layout.discussionFocusOnly
            ? "overflow-hidden"
            : "overflow-x-auto overflow-hidden"
        }`}
      >
        {layout.discussionFocusOnly ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
            <StudioAIDiscussionPanel
              activeDocId={editor.activeId}
              activeTitleLine={editor.discussionTitleLine}
              documents={editor.documents}
              setDocuments={editor.setDocuments}
              layoutMode="focusOnly"
              onExitFocusOnly={() => layout.setDiscussionFocusOnly(false)}
            />
          </div>
        ) : (
          <>
            <StudioContextSidebar
              embedInAdmin={embedInAdmin}
              leftColPx={layout.leftColPx}
              saveMessage={editor.saveMessage}
              docOrder={editor.docOrder}
              extraDocMeta={editor.extraDocMeta}
              activeId={editor.activeId}
              documents={editor.documents}
              onSelectDoc={editor.setActiveId}
              onAddDocument={editor.addStudioDocument}
              assistantHint={aiProfiles.assistantHint}
              aiError={aiProfiles.aiError}
            />

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整左栏宽度"
              className="hidden shrink-0 cursor-col-resize border-x border-border/30 bg-transparent hover:bg-border/70 active:bg-border md:block"
              style={{
                width: RESIZER_WIDTH_PX,
                touchAction: "none",
              }}
              onPointerDown={layout.beginResizeLeftDivider}
            />

            {/* 中：编辑区（勿用 min-w-0，否则窄屏下 flex-1 会被压成 0 宽 → 整页空白） */}
            <main className="flex min-h-0 min-w-[280px] shrink-0 flex-1 flex-col border-r border-border bg-canvas">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5">
                <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight text-ink">
                  <span className="select-none font-mono text-[11px] tabular-nums text-muted">
                    {editor.activeDocOrdinal}
                  </span>{" "}
                  <span>{editor.activeResolved?.labelEn}</span>
                  <span className="text-muted"> · </span>
                  <span className="font-normal text-muted">
                    {editor.activeResolved?.labelZh}
                  </span>
                </h1>
                <div className="flex shrink-0 items-center gap-2">
                  {editor.docViewMode === "edit" ? (
                    <span
                      className="font-mono text-[10px] tabular-nums text-muted"
                      aria-live="polite"
                    >
                      {editor.editingCharCount}
                    </span>
                  ) : null}
                  <div className="inline-flex rounded-md border border-border bg-canvas p-px shadow-sm">
                    <button
                      type="button"
                      onClick={() => editor.setDocViewMode("edit")}
                      title="Markdown 源码"
                      className={`rounded-[5px] px-2 py-1 text-[11px] font-medium transition ${
                        editor.docViewMode === "edit"
                          ? "bg-surface text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.setDocViewMode("read")}
                      title="排版阅读"
                      className={`rounded-[5px] px-2 py-1 text-[11px] font-medium transition ${
                        editor.docViewMode === "read"
                          ? "bg-surface text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      阅读
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void editor.persistDocuments()}
                    title={`保存到 docs/${editor.activeId}.md，并同步浏览器。${
                      editor.lastSavedForActive
                        ? ` 上次保存：${editor.lastSavedForActive.at.slice(0, 19).replace("T", " ")}，${studioDocCharCount(editor.lastSavedForActive.body)} 字。`
                        : " 尚未有「已保存」快照。"
                    }`}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-ink shadow-sm transition hover:border-sand"
                  >
                    保存
                  </button>
                </div>
              </div>
              {editor.activeResolved?.isExtra ? (
                <div className="flex flex-wrap items-end gap-2 border-b border-border/70 bg-surface/35 px-4 py-2">
                  <label className="flex min-w-[5.5rem] flex-1 flex-col gap-0.5 text-[9px] text-muted">
                    英文名
                    <input
                      value={editor.extraDocMeta[editor.activeId]?.labelEn ?? ""}
                      onChange={(e) =>
                        editor.patchActiveExtraMeta({ labelEn: e.target.value })
                      }
                      className="rounded border border-border bg-canvas px-1.5 py-1 text-[11px] text-ink outline-none focus:border-sand"
                      autoComplete="off"
                    />
                  </label>
                  <label className="flex min-w-[5.5rem] flex-1 flex-col gap-0.5 text-[9px] text-muted">
                    中文名
                    <input
                      value={editor.extraDocMeta[editor.activeId]?.labelZh ?? ""}
                      onChange={(e) =>
                        editor.patchActiveExtraMeta({ labelZh: e.target.value })
                      }
                      className="rounded border border-border bg-canvas px-1.5 py-1 text-[11px] text-ink outline-none focus:border-sand"
                      autoComplete="off"
                    />
                  </label>
                  <label className="flex min-w-[8rem] flex-[2] flex-col gap-0.5 text-[9px] text-muted">
                    左侧备注
                    <input
                      value={editor.extraDocMeta[editor.activeId]?.remark ?? ""}
                      onChange={(e) =>
                        editor.patchActiveExtraMeta({ remark: e.target.value })
                      }
                      className="rounded border border-border bg-canvas px-1.5 py-1 text-[11px] text-ink outline-none focus:border-sand"
                      placeholder="极简一句"
                      autoComplete="off"
                    />
                  </label>
                </div>
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col">
                {editor.docViewMode === "edit" ? (
                  <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-border">
                    <textarea
                      className="min-h-[32vh] w-full flex-1 resize-none bg-transparent px-4 py-5 font-mono text-[13px] leading-6 text-ink outline-none placeholder:text-muted/60 md:min-h-0 md:w-0 md:px-6"
                      spellCheck={false}
                      value={editor.activeBody}
                      onChange={(e) =>
                        editor.setDocuments((prev) => ({
                          ...prev,
                          [editor.activeId]: e.target.value,
                        }))
                      }
                      onBlur={editor.recordAutosaveSnapshot}
                      aria-label="Markdown editor"
                    />
                    <div className="flex min-h-[28vh] min-w-0 flex-1 flex-col border-t border-border md:min-h-0 md:border-t-0">
                      <p className="shrink-0 border-b border-border/60 bg-surface/45 px-4 py-1.5 text-[9px] font-medium uppercase tracking-wide text-muted md:px-6">
                        Markdown 预览
                      </p>
                      <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-canvas to-surface/30 px-4 py-4 md:px-6 md:py-5">
                        <StudioDocMarkdown content={editor.activeBody} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-canvas to-surface/40 px-4 py-5 md:px-6 md:py-6"
                    aria-label="文档阅读预览"
                  >
                    <StudioDocMarkdown content={editor.activeBody} />
                  </div>
                )}
              </div>

              <StudioPersistenceAndHistoryDrawers
                diskBearerDraft={editor.diskBearerDraft}
                onChangeDiskBearerDraft={editor.setDiskBearerDraft}
                onBlurDiskBearerDraft={editor.persistDiskBearerOnBlur}
                activeHistoryEntries={editor.activeHistoryEntries}
                onRestoreDocHistoryEntry={editor.restoreDocHistoryEntry}
              />
            </main>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整右栏宽度"
              className="hidden shrink-0 cursor-col-resize border-x border-border/30 bg-transparent hover:bg-border/70 active:bg-border md:block"
              style={{
                width: RESIZER_WIDTH_PX,
                touchAction: "none",
              }}
              onPointerDown={layout.beginResizeRightDivider}
            />

            {/* 右：AI Discussion Panel */}
            <div
              className="flex min-h-0 shrink-0 flex-col self-stretch"
              style={{
                width: layout.rightColPx,
                minWidth: Math.min(layout.rightColPx, 260),
              }}
            >
              <StudioAIDiscussionPanel
                activeDocId={editor.activeId}
                activeTitleLine={editor.discussionTitleLine}
                documents={editor.documents}
                setDocuments={editor.setDocuments}
                layoutMode="default"
                onEnterFocusOnly={() => layout.setDiscussionFocusOnly(true)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default StudioWorkspace;
