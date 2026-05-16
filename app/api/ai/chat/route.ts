import { NextResponse } from "next/server";
import {
  buildMessagesForAction,
  buildStudioChatMessages,
} from "@/lib/ai/build-messages";
import { createChatCompletion } from "@/lib/ai/openai-compatible";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import type { AIChatContext, AIChatRequestBody } from "@/lib/ai/types";
import { isAssistantActionId } from "@/lib/ai/types";

function parseDialogMessages(
  raw: unknown,
): AIChatContext["dialogMessages"] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<AIChatContext["dialogMessages"]> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    out.push({ role, content });
  }
  return out.length ? out : undefined;
}

/**
 * 统一 AI 入口：Studio 与未来 App 都可 POST 到此路由。
 * 鉴权、配额、计费应在后续单独加；当前为内部工作台最小实现。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体需为 JSON。" }, { status: 400 });
  }

  const b = body as Partial<AIChatRequestBody>;
  if (!b.action || !isAssistantActionId(b.action)) {
    return NextResponse.json({ error: "缺少或无效的 action。" }, { status: 400 });
  }
  if (!b.context || typeof b.context.docTitle !== "string") {
    return NextResponse.json({ error: "缺少 context.docTitle。" }, { status: 400 });
  }
  if (typeof b.context.docBody !== "string") {
    return NextResponse.json({ error: "缺少 context.docBody。" }, { status: 400 });
  }

  const ctxFull: AIChatContext = {
    docTitle: b.context.docTitle,
    docBody: b.context.docBody,
    captureSnippet:
      typeof b.context.captureSnippet === "string"
        ? b.context.captureSnippet
        : undefined,
    panelDraft:
      typeof b.context.panelDraft === "string"
        ? b.context.panelDraft
        : undefined,
    dialogMessages: parseDialogMessages(
      (b.context as { dialogMessages?: unknown }).dialogMessages,
    ),
  };

  const profileId = typeof b.profileId === "string" ? b.profileId.trim() : undefined;
  const resolved = resolveAISettings(b.settings, { profileId: profileId || undefined });
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  let messages;
  try {
    if (b.action === "studio_chat") {
      if (!ctxFull.dialogMessages?.length) {
        return NextResponse.json(
          { error: "studio_chat 需要 context.dialogMessages。" },
          { status: 400 },
        );
      }
      const last = ctxFull.dialogMessages[ctxFull.dialogMessages.length - 1];
      if (last.role !== "user") {
        return NextResponse.json(
          { error: "对话最后一条须为用户消息。" },
          { status: 400 },
        );
      }
      messages = buildStudioChatMessages(ctxFull);
    } else {
      messages = buildMessagesForAction(b.action, ctxFull);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const result = await createChatCompletion(resolved, messages);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 },
    );
  }

  return NextResponse.json({ text: result.text });
}
