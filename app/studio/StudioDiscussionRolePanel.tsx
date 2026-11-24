"use client";

import type { AssembledAIContext } from "@/lib/studio-ai-context";
import {
  DEFAULT_DISCUSSION_ROLE_CONFIGS,
  type AIStudioResponseMode,
  type DiscussionEnvelopeMeta,
  type DiscussionRoleConfig,
} from "./discussion-types";
import { THREAD_LABELS } from "./studio-discussion-helpers";

export type StudioDiscussionRolePanelProps = {
  activeTitleLine: string;
  layoutMode: "default" | "focusOnly";
  onEnterFocusOnly?: () => void;
  onExitFocusOnly?: () => void;
  responseMode: AIStudioResponseMode;
  setResponseMode: React.Dispatch<React.SetStateAction<AIStudioResponseMode>>;
  roleConfigs: DiscussionRoleConfig[];
  setRoleConfigs: React.Dispatch<React.SetStateAction<DiscussionRoleConfig[]>>;
  pmOpen: boolean;
  setPmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pmDraft: string;
  setPmDraft: React.Dispatch<React.SetStateAction<string>>;
  confirmAppendProductMemory: () => Promise<void>;
  lastAssembly: AssembledAIContext | null;
  discussionMeta: DiscussionEnvelopeMeta;
};

export function StudioDiscussionRolePanel({
  activeTitleLine,
  layoutMode,
  onEnterFocusOnly,
  onExitFocusOnly,
  responseMode,
  setResponseMode,
  roleConfigs,
  setRoleConfigs,
  pmOpen,
  setPmOpen,
  pmDraft,
  setPmDraft,
  confirmAppendProductMemory,
  lastAssembly,
  discussionMeta,
}: StudioDiscussionRolePanelProps) {
  return (
    <>
      <header className="shrink-0 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[15px] font-medium tracking-tight text-ink/95">
              AI Editorial Discussion
              <span className="ml-1.5 font-sans text-[12px] font-normal text-muted">
                （AI 编辑讨论区）
              </span>
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              默认
              <span className="font-medium text-ink/75">Minimal</span>
              ：先直接回应你的问题；当前 mock 可对中文做较长产品向分析，不套固定「洞察 / 风险 / 下一步」。需要更结构化时用
              Reflective，需要叠上下文时用 Deep Dive。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] text-muted">回应模式</span>
              {(
                [
                  ["minimal", "Minimal"],
                  ["reflective", "Reflective"],
                  ["deep", "Deep Dive"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setResponseMode(id)}
                  title={
                    id === "minimal"
                      ? "先答你问的事；mock 下篇幅可较长，接入 API 后再定上限"
                      : id === "reflective"
                        ? "判断 / 原因 / 建议三段；mock 下可长文，接入 API 后可再收紧"
                        : "长篇追问与分层上下文（慎用）"
                  }
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                    responseMode === id
                      ? "border-ink/90 bg-ink text-canvas"
                      : "border-border/70 bg-white/80 text-ink/75 hover:border-sand"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 truncate text-[10px] text-muted/90" title={activeTitleLine}>
              上下文：<span className="text-ink/80">{activeTitleLine}</span>
            </p>
            <details className="mt-2 rounded-lg border border-border/65 bg-[var(--ab-bg-deep)] px-2 py-2 text-[11px] leading-snug">
              <summary className="cursor-pointer select-none text-[10px] font-medium text-ink/85">
                角色与规则（可重命名、可编辑，存本机）
              </summary>
              <p className="mt-1.5 text-[9px] leading-relaxed text-muted/90">
                内部 id 固定（product_partner / gatekeeper /
                user_lens），供消息与日后 API；显示名与下方规则可改。每条
                AI 回复会快照当时的名称与规则，便于导出对稿。
              </p>
              <div className="mt-2 max-h-[min(48vh,26rem)] space-y-3 overflow-y-auto overscroll-y-contain pr-0.5">
                {roleConfigs.map((cfg) => (
                  <div
                    key={cfg.id}
                    className="rounded-md border border-border/55 bg-white/85 p-2 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-mono text-[9px] text-muted/80">{cfg.id}</span>
                      <button
                        type="button"
                        className="rounded border border-border/60 bg-canvas px-1.5 py-0.5 text-[9px] text-ink/80 transition hover:border-sand"
                        onClick={() => {
                          const def = DEFAULT_DISCUSSION_ROLE_CONFIGS.find(
                            (d) => d.id === cfg.id,
                          );
                          if (!def) return;
                          setRoleConfigs((prev) =>
                            prev.map((c) => (c.id === cfg.id ? { ...def } : c)),
                          );
                        }}
                      >
                        恢复默认
                      </button>
                    </div>
                    <label className="mt-1.5 block text-[9px] font-medium text-muted">
                      显示名
                    </label>
                    <input
                      type="text"
                      className="mt-0.5 w-full rounded border border-border/70 bg-white px-2 py-1 text-[11px] text-ink outline-none focus:border-sand"
                      value={cfg.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRoleConfigs((prev) =>
                          prev.map((c) => (c.id === cfg.id ? { ...c, label: v } : c)),
                        );
                      }}
                      spellCheck={false}
                      aria-label={`${cfg.id} 显示名`}
                    />
                    <label className="mt-2 block text-[9px] font-medium text-muted">
                      规则（将并入真实 API 的 system prompt）
                    </label>
                    <textarea
                      className="mt-0.5 min-h-[6.5rem] w-full resize-y rounded border border-border/70 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-ink outline-none focus:border-sand"
                      value={cfg.rules}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRoleConfigs((prev) =>
                          prev.map((c) => (c.id === cfg.id ? { ...c, rules: v } : c)),
                        );
                      }}
                      spellCheck={false}
                      aria-label={`${cfg.id} 规则`}
                    />
                  </div>
                ))}
              </div>
            </details>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
            {layoutMode === "focusOnly" && onExitFocusOnly ? (
              <button
                type="button"
                onClick={onExitFocusOnly}
                className="rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-[11px] font-medium text-ink shadow-sm transition hover:border-sand"
              >
                恢复三栏工作台
              </button>
            ) : null}
            {layoutMode === "default" && onEnterFocusOnly ? (
              <button
                type="button"
                onClick={onEnterFocusOnly}
                title="隐藏文档区与导航，专注对话"
                className="rounded-md border border-transparent px-2 py-1 text-[10px] text-muted transition hover:border-border/60 hover:bg-canvas/80 hover:text-ink"
              >
                仅显示本栏
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPmOpen((o) => !o)}
              className="rounded-md border border-border/70 bg-canvas px-2 py-1 text-[10px] text-ink shadow-sm transition hover:border-sand"
            >
              更新 Product Memory…
            </button>
          </div>
        </div>
      </header>

      <section
        className="shrink-0 space-y-2 border-b border-border/55 bg-surface/90 px-4 py-2.5"
        aria-label="编辑线索与长期记忆"
      >
        {pmOpen ? (
          <div className="rounded-lg border border-border/70 bg-white/90 p-2 shadow-sm">
            <p className="text-[10px] text-muted">
              仅追加到 <code className="text-[10px]">studio/product-memory.md</code>
              末尾；需你确认，AI 不会自动写入。
            </p>
            <textarea
              className="mt-2 min-h-[88px] w-full resize-y rounded-md border border-border/70 bg-white px-2 py-1.5 text-[12px] text-ink outline-none focus:border-sand"
              placeholder="粘贴本轮值得进入长期记忆的结论、风险或决策……"
              spellCheck={false}
              value={pmDraft}
              onChange={(e) => setPmDraft(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void confirmAppendProductMemory()}
                className="rounded-md border border-border/80 bg-ink px-3 py-1 text-[10px] font-medium text-canvas"
              >
                确认追加
              </button>
              <button
                type="button"
                onClick={() => {
                  setPmOpen(false);
                  setPmDraft("");
                }}
                className="rounded-md border border-border/60 bg-transparent px-3 py-1 text-[10px] text-muted"
              >
                取消
              </button>
            </div>
          </div>
        ) : null}

        <details className="group rounded-lg border border-border/40 bg-surface/45">
          <summary className="cursor-pointer list-none px-3 py-2 text-[10px] text-muted marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition-transform duration-200 group-open:rotate-180">
              ▼
            </span>{" "}
            上下文线索（主题 / 线程）— 默认折叠，避免信息疲劳
          </summary>
          <div className="space-y-2 border-t border-border/35 px-3 pb-3 pt-2">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[9px] font-medium uppercase tracking-wide text-muted/90">
                  Topics（本轮 / 最近）
                </p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(
                    new Set([
                      ...(lastAssembly?.detectedTopics ?? []),
                      ...(discussionMeta.lastDetectedTopics ?? []),
                    ]),
                  ).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/55 bg-white/85 px-2 py-0.5 text-[10px] text-ink/85"
                    >
                      {t}
                    </span>
                  ))}
                  {!(
                    (lastAssembly?.detectedTopics?.length ?? 0) > 0 ||
                    (discussionMeta.lastDetectedTopics?.length ?? 0) > 0
                  ) ? (
                    <span className="text-[10px] text-muted/80">
                      （发送一条消息后显示主题线索）
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[9px] font-medium uppercase tracking-wide text-muted/90">
                  Related threads
                </p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(
                    new Set([
                      ...(lastAssembly?.relatedThreadSlugs ?? []),
                      ...(discussionMeta.lastRelatedThreadSlugs ?? []),
                    ]),
                  ).map((slug) => (
                    <span
                      key={slug}
                      className="rounded-full border border-border bg-canvas px-2 py-0.5 text-[10px] text-ink/80"
                      title={slug}
                    >
                      {THREAD_LABELS[slug] ?? slug}
                    </span>
                  ))}
                  {!(
                    (lastAssembly?.relatedThreadSlugs?.length ?? 0) > 0 ||
                    (discussionMeta.lastRelatedThreadSlugs?.length ?? 0) > 0
                  ) ? (
                    <span className="text-[10px] text-muted/80">
                      （按关键词匹配 studio/threads）
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </details>
      </section>

      <p className="shrink-0 border-b border-border/50 bg-surface/90 px-4 py-1 text-[9px] text-muted/85">
        对话记录：向上滑动看更早；最新消息始终在底部（输入框上方）。
      </p>
    </>
  );
}
