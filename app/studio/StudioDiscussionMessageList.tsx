"use client";

import type { StudioDocId } from "@/lib/studio-config";
import type {
  AIReflection,
  DiscussionMessage,
  DiscussionRole,
  DiscussionRoleConfig,
} from "./discussion-types";
import {
  DOC_DANGEROUS,
  DOC_PARKING,
  DOC_PRINCIPLES,
  isDeepReflection,
  modeAndRoleBadgeLine,
} from "./studio-discussion-helpers";
import { StudioDiscussionMarkdown } from "./studio-discussion-markdown";

export type StudioDiscussionMessageListProps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: DiscussionMessage[];
  busy: boolean;
  note: string | null;
  composer: string;
  setComposer: React.Dispatch<React.SetStateAction<string>>;
  discussionRole: DiscussionRole;
  setDiscussionRole: React.Dispatch<React.SetStateAction<DiscussionRole>>;
  roleConfigs: DiscussionRoleConfig[];
  docLabel: (id: StudioDocId) => string;
  onAddCurrent: (r: AIReflection) => void;
  appendToDoc: (docId: StudioDocId, r: AIReflection, titleSuffix: string) => void;
  onRewriteShorter: (r: AIReflection) => void;
  onKeepDiscussion: () => void;
  send: () => Promise<void>;
  sendAskAllRoles: () => Promise<void>;
};

export function StudioDiscussionMessageList({
  scrollRef,
  messages,
  busy,
  note,
  composer,
  setComposer,
  discussionRole,
  setDiscussionRole,
  roleConfigs,
  docLabel,
  onAddCurrent,
  appendToDoc,
  onRewriteShorter,
  onKeepDiscussion,
  send,
  sendAskAllRoles,
}: StudioDiscussionMessageListProps) {
  return (
    <>
      <div
        ref={scrollRef}
        className="studio-ai-discussion-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-anchor:none]"
      >
        {messages.length === 0 && !busy ? (
          <div className="flex min-h-full flex-col justify-center px-4 py-6">
            <p className="rounded-lg border border-dashed border-border/70 bg-canvas/60 px-3 py-3 text-[12px] leading-relaxed text-muted">
              写一句判断或担忧即可。默认
              <span className="font-medium text-ink/75">Minimal</span>
              会先直接答你的问题（mock 下可较长分析），不套固定「洞察 / 风险 / 下一步」；需要结构化展开用
              Reflective，需要长文再用 Deep。追加文档前需确认；写入仓库仍需中间栏「保存」。
            </p>
          </div>
        ) : (
          <div className="flex min-h-full flex-col justify-end gap-4 px-4 py-3">
            {messages.map((msg) => {
              if (msg.kind === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[min(100%,18rem)] rounded-2xl border border-border/60 bg-white/90 px-3 py-2 text-[12px] leading-relaxed text-ink shadow-sm select-text">
                      <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                    </div>
                  </div>
                );
              }
              if (msg.kind === "assistant_note") {
                return (
                  <div
                    key={msg.id}
                    className="select-text rounded-lg border border-border/60 bg-white/80 px-3 py-2 text-[12px] leading-relaxed text-ink/90 shadow-sm"
                  >
                    <p className="text-[9px] font-medium uppercase tracking-wide text-muted">
                      更短表述
                    </p>
                    <p className="mt-1">{msg.content}</p>
                  </div>
                );
              }
              const { reflection: r } = msg;
              const deep = isDeepReflection(r);
              return (
                <article
                  key={msg.id}
                  className="select-text space-y-3 rounded-xl border border-border/70 bg-white/90 px-3 py-3 shadow-sm"
                >
                  <p className="text-[9px] font-medium text-muted">
                    {modeAndRoleBadgeLine(r, roleConfigs)}
                  </p>
                  <section aria-label="AI 回应">
                    <StudioDiscussionMarkdown content={r.partnerReply} />
                  </section>

                  <section className="border-t border-border/40 pt-3" aria-label="写入文档">
                    <p className="text-[9px] font-medium tracking-wide text-muted">
                      写入文档（需确认）
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="rounded-md border border-border/70 bg-canvas px-2 py-1 text-[10px] text-ink transition hover:border-sand"
                        onClick={() => onAddCurrent(r)}
                      >
                        追加到当前文档
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border/70 bg-canvas px-2 py-1 text-[10px] text-ink transition hover:border-sand"
                        onClick={() => appendToDoc(DOC_PRINCIPLES, r, "Principles")}
                      >
                        追加到「产品原则」
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border/70 bg-canvas px-2 py-1 text-[10px] text-ink transition hover:border-sand"
                        onClick={() => appendToDoc(DOC_DANGEROUS, r, "Dangerous Directions")}
                      >
                        追加到「危险方向」
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border/70 bg-canvas px-2 py-1 text-[10px] text-ink transition hover:border-sand"
                        onClick={() => appendToDoc(DOC_PARKING, r, "Parking Lot")}
                      >
                        写入想法停车场
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border/70 bg-canvas px-2 py-1 text-[10px] text-ink transition hover:border-sand"
                        onClick={() => onRewriteShorter(r)}
                      >
                        改写更短
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border/70 bg-transparent px-2 py-1 text-[10px] text-muted transition hover:border-sand hover:text-ink"
                        onClick={onKeepDiscussion}
                      >
                        仅保留在讨论区
                      </button>
                    </div>
                  </section>

                  <details className="group mt-2 border-t border-border/25 pt-2 text-[12px]">
                    <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-[10px] text-muted/75 marker:content-none transition hover:text-muted [&::-webkit-details-marker]:hidden">
                      <span
                        className="inline-block origin-center text-[9px] text-muted/60 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden
                      >
                        ▼
                      </span>
                      <span>
                        展开更多（理清意图 · 关联文档 · 角色规则快照
                        {deep ? " · 长文结构" : ""}）
                      </span>
                    </summary>
                    <div className="mt-2 space-y-3 pb-1 pt-1">
                      <section>
                        <h3 className="text-[10px] font-medium text-muted">理清意图</h3>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink/85">
                          {r.clarifiedIntent}
                        </p>
                      </section>
                      <section>
                        <h3 className="text-[10px] font-medium text-muted">相关文档</h3>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {r.relatedDocIds.map((id) => (
                            <li
                              key={`${msg.id}-${id}`}
                              className="rounded-full border border-border/60 bg-canvas/80 px-2 py-0.5 text-[10px] text-ink/85"
                            >
                              {docLabel(id)}
                            </li>
                          ))}
                        </ul>
                      </section>
                      {r.discussionRoleRulesSnapshot?.trim() ? (
                        <section>
                          <h3 className="text-[10px] font-medium text-muted">
                            角色规则（生成当刻快照）
                          </h3>
                          <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-border/50 bg-canvas/60 px-2 py-1.5 text-[11px] leading-relaxed text-ink/90">
                            {r.discussionRoleRulesSnapshot.trim()}
                          </pre>
                        </section>
                      ) : null}
                    </div>
                  </details>
                </article>
              );
            })}
            {busy ? (
              <p className="rounded-lg border border-border/50 bg-canvas/70 px-3 py-2 text-[11px] text-muted">
                正在整理回应（模拟）…
              </p>
            ) : null}
          </div>
        )}
      </div>

      <footer className="relative z-10 shrink-0 border-t-2 border-border/60 bg-canvas px-4 py-3 shadow-sm">
        {note ? (
          <p className="mb-2 text-[10px] leading-snug text-muted" role="status">
            {note}
          </p>
        ) : null}
        <div className="mb-2 flex flex-wrap items-center gap-1.5 gap-y-2">
          <span className="text-[9px] text-muted">Role</span>
          {roleConfigs.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.rules.split("\n").slice(0, 3).join(" ").slice(0, 200)}
              disabled={busy}
              onClick={() => setDiscussionRole(opt.id)}
              className={`rounded-full border px-2 py-0.5 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                discussionRole === opt.id
                  ? "border-ink/90 bg-ink text-canvas"
                  : "border-border/70 bg-white/80 text-ink/75 hover:border-sand"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy || !composer.trim()}
            title="用 Minimal 依次征求 Product Partner、Gatekeeper、User Lens 各一条（mock 下为长分析）"
            onClick={() => void sendAskAllRoles()}
            className="ml-auto rounded-full border border-border/80 bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-ink/90 shadow-sm transition hover:border-sand disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask All Roles
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            className="min-h-[72px] flex-1 resize-none rounded-lg border border-border/80 bg-white px-3 py-2 text-[13px] leading-relaxed text-ink shadow-inner outline-none placeholder:text-muted/55 focus:border-sand"
            placeholder="输入一个想法、担忧、用户反馈，或粘贴一段聊天内容……"
            spellCheck={false}
            value={composer}
            disabled={busy}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              void send();
            }}
            aria-label="AI Discussion 输入"
          />
          <button
            type="button"
            disabled={busy || !composer.trim()}
            onClick={() => void send()}
            className="h-fit shrink-0 self-end rounded-lg border border-border/80 bg-ink px-4 py-2 text-[12px] font-medium text-canvas shadow-sm transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            发送
          </button>
        </div>
        <p className="mt-2 text-[9px] leading-snug text-muted/85">
          默认 Minimal：先直接答当前问题（mock 可长文）。Reflective / Deep
          再分层展开。Role 会写入本机偏好；Ask All Roles
          固定三条 Minimal 回应。追加文档前需确认；写入仓库仍需中间栏「保存」。
        </p>
      </footer>
    </>
  );
}
