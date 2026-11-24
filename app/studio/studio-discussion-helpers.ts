import {
  STUDIO_DISK_BEARER_STORAGE_KEY,
  STUDIO_DISCUSSION_ROLE_CONFIGS_KEY,
  type StudioDocId,
} from "@/lib/studio-config";
import type { AssembledAIContext } from "@/lib/studio-ai-context";
import {
  DISCUSSION_ROLE_IDS,
  isDiscussionRole,
  mergeDiscussionRoleConfigsFromStorage,
  type AIReflection,
  type AIStudioResponseMode,
  type DiscussionAssistantMessage,
  type DiscussionEnvelopeMeta,
  type DiscussionMessage,
  type DiscussionRoleConfig,
  type DiscussionUserMessage,
} from "./discussion-types";
import {
  generateAIReflection,
  type ReflectionContext,
} from "./generate-ai-reflection";

export const DOC_PRINCIPLES: StudioDocId = "03-principles";
export const DOC_DANGEROUS: StudioDocId = "09-dangerous-directions";
export const DOC_PARKING: StudioDocId = "10-parking-lot";

const MAX_STORE_CHARS = 480_000;
/** 分层组装失败（如未授权读盘）时的回退预算：更长摘录以贴近本地 AI 容量 */
const FALLBACK_RECENT_MESSAGES = 90;
const FALLBACK_RECENT_MAX_CHARS = 16_000;

export const THREAD_LABELS: Record<string, string> = {
  "journey-system": "Journey",
  "gentle-return": "Gentle Return",
  "bible-reader": "Bible Reader",
  "feature-creep": "Feature Creep",
  "low-cognitive-load": "Low Cognitive Load",
  "user-psychology": "User Psychology",
  "quiet-atmosphere": "Quiet atmosphere",
  /** 旧 slug（线程文件已迁至 `studio/threads/quiet-atmosphere.md`） */
  "sacred-atmosphere": "Quiet atmosphere",
};

export const STUDIO_AI_RESPONSE_MODE_KEY = "askbible-studio-ai-response-mode-v1";

export function parseStoredResponseMode(raw: string | null): AIStudioResponseMode {
  if (raw === "reflective" || raw === "deep") return raw;
  return "minimal";
}

export function loadRoleConfigsFromBrowser(): DiscussionRoleConfig[] {
  if (typeof window === "undefined") {
    return mergeDiscussionRoleConfigsFromStorage(null);
  }
  try {
    return mergeDiscussionRoleConfigsFromStorage(
      localStorage.getItem(STUDIO_DISCUSSION_ROLE_CONFIGS_KEY),
    );
  } catch {
    return mergeDiscussionRoleConfigsFromStorage(null);
  }
}

/** 旧消息无 responseMode：按篇幅推断是否为长篇 Deep */
export function isDeepReflection(r: AIReflection): boolean {
  if (r.responseMode === "deep") return true;
  if (r.responseMode === "minimal" || r.responseMode === "reflective") return false;
  return r.partnerReply.length > 960;
}

export function modeBadgeLabel(r: AIReflection): string {
  if (r.responseMode === "deep") return "Deep Dive";
  if (r.responseMode === "reflective") return "Reflective";
  if (r.responseMode === "minimal") return "Minimal";
  return isDeepReflection(r) ? "Deep（推断）" : "Minimal（推断）";
}

export function roleDisplayLabelForReflection(
  r: AIReflection,
  configs: DiscussionRoleConfig[],
): string | null {
  if (!r.discussionRole) return null;
  const snap = r.discussionRoleLabelSnapshot?.trim();
  if (snap) return snap;
  return configs.find((c) => c.id === r.discussionRole)?.label ?? r.discussionRole;
}

export function modeAndRoleBadgeLine(
  r: AIReflection,
  configs: DiscussionRoleConfig[],
): string {
  const mode = modeBadgeLabel(r);
  const role = roleDisplayLabelForReflection(r, configs);
  return role ? `${mode} · ${role}` : mode;
}

function clipOneLine(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** 读盘 API 不可用时回退：仍给模拟 AI 较长近期讨论（旧行为仅 ~14 轮已废弃） */
export function buildFallbackDiscussionSnippet(
  priorMessages: DiscussionMessage[],
): string | undefined {
  if (priorMessages.length === 0) return undefined;
  const slice = priorMessages.slice(-FALLBACK_RECENT_MESSAGES);
  const lines: string[] = [];
  let total = 0;
  for (const m of slice) {
    let block = "";
    if (m.kind === "user") block = `[你] ${clipOneLine(m.content, 900)}`;
    else if (m.kind === "assistant") block = `[AI] ${clipOneLine(m.reflection.partnerReply, 1400)}`;
    else block = `[附注] ${clipOneLine(m.content, 400)}`;
    if (total + block.length + 1 > FALLBACK_RECENT_MAX_CHARS) break;
    lines.push(block);
    total += block.length + 1;
  }
  const out = lines.join("\n").trim();
  return out.length > 0 ? out : undefined;
}

export function diskAuthHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  try {
    const t = localStorage.getItem(STUDIO_DISK_BEARER_STORAGE_KEY)?.trim();
    if (t) h.Authorization = `Bearer ${t}`;
  } catch {
    /* ignore */
  }
  return h;
}

export async function fetchAssembledStudioContext(
  userInput: string,
  activeDocId: StudioDocId,
  discussionMessages: DiscussionMessage[],
): Promise<AssembledAIContext | null> {
  try {
    const res = await fetch("/api/studio/assemble-ai-context", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
      body: JSON.stringify({ userInput, activeDocId, discussionMessages }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AssembledAIContext;
  } catch {
    return null;
  }
}

export async function executeDiscussionTurn(params: {
  text: string;
  userMsg: DiscussionUserMessage;
  priorMessages: DiscussionMessage[];
  activeDocId: StudioDocId;
  reflectionContext: ReflectionContext;
  responseMode: AIStudioResponseMode;
  askAllRoles: boolean;
}): Promise<{
  assembled: AssembledAIContext | null;
  userWithMeta: DiscussionUserMessage;
  assistants: DiscussionAssistantMessage[];
  relatedDocIds: StudioDocId[];
}> {
  const { text, userMsg, priorMessages, activeDocId, reflectionContext, responseMode, askAllRoles } =
    params;
  const assembled = await fetchAssembledStudioContext(text, activeDocId, priorMessages);
  const assistants: DiscussionAssistantMessage[] = [];
  let relatedDocIds: StudioDocId[] = [];

  if (askAllRoles) {
    for (const role of DISCUSSION_ROLE_IDS) {
      const reflection = await generateAIReflection(text, {
        ...reflectionContext,
        discussionRole: role,
        responseMode: "minimal",
        assembledPrompt: undefined,
        recentDiscussion: undefined,
        detectedTopics: assembled?.detectedTopics,
        relatedThreadSlugs: assembled?.relatedThreadSlugs,
      });
      if (assistants.length === 0) relatedDocIds = reflection.relatedDocIds;
      assistants.push({
        kind: "assistant",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        reflection,
      });
    }
  } else {
    const fallbackDiscussion = buildFallbackDiscussionSnippet(priorMessages);
    const reflection = await generateAIReflection(text, {
      ...reflectionContext,
      responseMode,
      assembledPrompt: responseMode === "deep" ? assembled?.assembledPrompt : undefined,
      detectedTopics: assembled?.detectedTopics,
      relatedThreadSlugs: assembled?.relatedThreadSlugs,
      recentDiscussion:
        responseMode === "deep" && !assembled?.assembledPrompt ? fallbackDiscussion : undefined,
    });
    relatedDocIds = reflection.relatedDocIds;
    assistants.push({
      kind: "assistant",
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reflection,
    });
  }

  const userWithMeta: DiscussionUserMessage =
    assembled != null
      ? {
          ...userMsg,
          meta: {
            detectedTopics: assembled.detectedTopics,
            relatedThreadSlugs: assembled.relatedThreadSlugs,
            relatedDocIds,
            assembledChars: assembled.assembledPrompt.length,
          },
        }
      : userMsg;

  return { assembled, userWithMeta, assistants, relatedDocIds };
}

export function parseDiscussionEnvelope(raw: string | null): {
  messages: DiscussionMessage[];
  meta: DiscussionEnvelopeMeta;
} {
  if (!raw) return { messages: [], meta: {} };
  try {
    const p = JSON.parse(raw) as unknown;
    let rows: unknown[] = [];
    let envelopeMeta: DiscussionEnvelopeMeta = {};
    if (Array.isArray(p)) {
      rows = p;
    } else if (p && typeof p === "object") {
      const o = p as { messages?: unknown; meta?: unknown };
      if (Array.isArray(o.messages)) rows = o.messages;
      if (o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)) {
        envelopeMeta = o.meta as DiscussionEnvelopeMeta;
      }
    }
    const out: DiscussionMessage[] = [];
    for (const item of rows) {
      if (!item || typeof item !== "object") continue;
      const kind = (item as { kind?: unknown }).kind;
      const id = (item as { id?: unknown }).id;
      const createdAt = (item as { createdAt?: unknown }).createdAt;
      if (kind !== "user" && kind !== "assistant" && kind !== "assistant_note") continue;
      if (typeof id !== "string" || !id || typeof createdAt !== "string") continue;
      if (kind === "user") {
        const content = (item as { content?: unknown }).content;
        if (typeof content !== "string") continue;
        const um: DiscussionUserMessage = { kind: "user", id, createdAt, content };
        const metaRaw = (item as { meta?: unknown }).meta;
        if (metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)) {
          const mr = metaRaw as Record<string, unknown>;
          um.meta = {
            detectedTopics: Array.isArray(mr.detectedTopics)
              ? mr.detectedTopics.filter((t): t is string => typeof t === "string")
              : undefined,
            relatedThreadSlugs: Array.isArray(mr.relatedThreadSlugs)
              ? mr.relatedThreadSlugs.filter((t): t is string => typeof t === "string")
              : undefined,
            relatedDocIds: Array.isArray(mr.relatedDocIds)
              ? mr.relatedDocIds.filter((t): t is string => typeof t === "string")
              : undefined,
            assembledChars:
              typeof mr.assembledChars === "number" ? mr.assembledChars : undefined,
          };
        }
        out.push(um);
        continue;
      }
      if (kind === "assistant_note") {
        const content = (item as { content?: unknown }).content;
        if (typeof content !== "string") continue;
        out.push({ kind: "assistant_note", id, createdAt, content });
        continue;
      }
      const reflection = (item as { reflection?: unknown }).reflection;
      if (!reflection || typeof reflection !== "object") continue;
      const r = reflection as Partial<AIReflection>;
      if (
        typeof r.clarifiedIntent !== "string" ||
        typeof r.coreInsight !== "string" ||
        typeof r.tensionRisk !== "string" ||
        typeof r.suggestedNextStep !== "string" ||
        !Array.isArray(r.relatedDocIds)
      ) {
        continue;
      }
      const relatedDocIds = r.relatedDocIds.filter(
        (x): x is StudioDocId => typeof x === "string",
      );
      const partnerReply =
        typeof r.partnerReply === "string" && r.partnerReply.trim()
          ? r.partnerReply.trim()
          : [r.coreInsight, r.suggestedNextStep].filter(Boolean).join("\n\n");
      const rm = r.responseMode;
      const responseModeParsed =
        rm === "minimal" || rm === "reflective" || rm === "deep" ? rm : undefined;
      const dr = (r as { discussionRole?: unknown }).discussionRole;
      const discussionRoleParsed =
        typeof dr === "string" && isDiscussionRole(dr) ? dr : undefined;
      const lbs = (r as { discussionRoleLabelSnapshot?: unknown }).discussionRoleLabelSnapshot;
      const rbs = (r as { discussionRoleRulesSnapshot?: unknown }).discussionRoleRulesSnapshot;
      const discussionRoleLabelSnapshot =
        typeof lbs === "string" && lbs.trim() ? lbs.trim() : undefined;
      const discussionRoleRulesSnapshot = typeof rbs === "string" ? rbs : undefined;
      out.push({
        kind: "assistant",
        id,
        createdAt,
        reflection: {
          partnerReply,
          clarifiedIntent: r.clarifiedIntent,
          coreInsight: r.coreInsight,
          relatedDocIds,
          tensionRisk: r.tensionRisk,
          suggestedNextStep: r.suggestedNextStep,
          ...(responseModeParsed ? { responseMode: responseModeParsed } : {}),
          ...(discussionRoleParsed ? { discussionRole: discussionRoleParsed } : {}),
          ...(discussionRoleLabelSnapshot ? { discussionRoleLabelSnapshot } : {}),
          ...(discussionRoleRulesSnapshot !== undefined ? { discussionRoleRulesSnapshot } : {}),
        },
      });
    }
    return { messages: out, meta: envelopeMeta };
  } catch {
    return { messages: [], meta: {} };
  }
}

export function jsonForDiscussionStorage(
  messages: DiscussionMessage[],
  meta?: DiscussionEnvelopeMeta,
): string {
  const payload = {
    version: 2 as const,
    updatedAt: new Date().toISOString(),
    meta: meta ?? {},
    messages,
  };
  let body: DiscussionMessage[] = messages;
  for (let i = 0; i < 10; i++) {
    const json = JSON.stringify({ ...payload, messages: body });
    if (json.length <= MAX_STORE_CHARS) return json;
    body = body.slice(Math.max(1, Math.floor(body.length * 0.75)));
  }
  return JSON.stringify({ ...payload, messages: body.slice(-120) });
}

export function formatMarkdownBlock(
  reflection: AIReflection,
  titleSuffix: string,
  roleConfigs: DiscussionRoleConfig[],
): string {
  const t = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines = ["", "---", "", `### AI Discussion · ${titleSuffix} · ${t}`, ""];
  const roleLine = roleDisplayLabelForReflection(reflection, roleConfigs);
  if (roleLine) lines.push(`Role · ${roleLine}`, "");
  const rulesSnap = reflection.discussionRoleRulesSnapshot?.trim();
  if (rulesSnap) lines.push("#### 角色规则（生成当刻快照）", "", rulesSnap, "");
  lines.push(reflection.partnerReply.trim());
  const fold = reflection.clarifiedIntent.trim();
  if (fold) {
    lines.push("", "> **理清意图（备忘）**", ">", ...fold.split("\n").map((l) => `> ${l}`));
  }
  return lines.join("\n");
}
