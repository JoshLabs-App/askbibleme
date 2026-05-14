"use client";

/**
 * AI Discussion Panel — 安静的产品思考侧栏。
 * 不接真实 API 时由 generateAIReflection 模拟；接入后替换生成函数即可。
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  STUDIO_AI_DISCUSSION_STORAGE_KEY,
  STUDIO_DISK_BEARER_STORAGE_KEY,
  STUDIO_DOC_ENTRIES,
  STUDIO_DISCUSSION_ROLE_CONFIGS_KEY,
  STUDIO_DISCUSSION_ROLE_KEY,
  type StudioDocId,
} from "@/lib/studio-config";
import type {
  AIReflection,
  AIStudioResponseMode,
  DiscussionAssistantMessage,
  DiscussionEnvelopeMeta,
  DiscussionMessage,
  DiscussionRole,
  DiscussionRoleConfig,
  DiscussionUserMessage,
} from "./discussion-types";
import {
  DEFAULT_DISCUSSION_ROLE_CONFIGS,
  DISCUSSION_ROLE_IDS,
  mergeDiscussionRoleConfigsFromStorage,
  isDiscussionRole,
} from "./discussion-types";
import {
  generateAIReflection,
  mockRewriteShorter,
  type ReflectionContext,
} from "./generate-ai-reflection";
import { StudioDiscussionMarkdown } from "./studio-discussion-markdown";
import type { AssembledAIContext } from "@/lib/studio-ai-context";

const DOC_PRINCIPLES: StudioDocId = "03-principles";
const DOC_DANGEROUS: StudioDocId = "09-dangerous-directions";
const DOC_PARKING: StudioDocId = "10-parking-lot";

const MAX_STORE_CHARS = 480_000;
/** 分层组装失败（如未授权读盘）时的回退预算：更长摘录以贴近本地 AI 容量 */
const FALLBACK_RECENT_MESSAGES = 90;
const FALLBACK_RECENT_MAX_CHARS = 16_000;

const THREAD_LABELS: Record<string, string> = {
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

const STUDIO_AI_RESPONSE_MODE_KEY = "askbible-studio-ai-response-mode-v1";

function parseStoredResponseMode(raw: string | null): AIStudioResponseMode {
  if (raw === "reflective" || raw === "deep") return raw;
  return "minimal";
}

function loadRoleConfigsFromBrowser(): DiscussionRoleConfig[] {
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
function isDeepReflection(r: AIReflection): boolean {
  if (r.responseMode === "deep") return true;
  if (r.responseMode === "minimal" || r.responseMode === "reflective") return false;
  return r.partnerReply.length > 960;
}

function modeBadgeLabel(r: AIReflection): string {
  if (r.responseMode === "deep") return "Deep Dive";
  if (r.responseMode === "reflective") return "Reflective";
  if (r.responseMode === "minimal") return "Minimal";
  return isDeepReflection(r) ? "Deep（推断）" : "Minimal（推断）";
}

function roleDisplayLabelForReflection(
  r: AIReflection,
  configs: DiscussionRoleConfig[],
): string | null {
  if (!r.discussionRole) return null;
  const snap = r.discussionRoleLabelSnapshot?.trim();
  if (snap) return snap;
  return configs.find((c) => c.id === r.discussionRole)?.label ?? r.discussionRole;
}

function modeAndRoleBadgeLine(
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
function buildFallbackDiscussionSnippet(
  priorMessages: DiscussionMessage[],
): string | undefined {
  if (priorMessages.length === 0) return undefined;
  const slice = priorMessages.slice(-FALLBACK_RECENT_MESSAGES);
  const lines: string[] = [];
  let total = 0;
  for (const m of slice) {
    let block = "";
    if (m.kind === "user") {
      block = `[你] ${clipOneLine(m.content, 900)}`;
    } else if (m.kind === "assistant") {
      block = `[AI] ${clipOneLine(m.reflection.partnerReply, 1400)}`;
    } else {
      block = `[附注] ${clipOneLine(m.content, 400)}`;
    }
    if (total + block.length + 1 > FALLBACK_RECENT_MAX_CHARS) break;
    lines.push(block);
    total += block.length + 1;
  }
  const out = lines.join("\n").trim();
  return out.length > 0 ? out : undefined;
}

function diskAuthHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  try {
    const t = localStorage.getItem(STUDIO_DISK_BEARER_STORAGE_KEY)?.trim();
    if (t) h.Authorization = `Bearer ${t}`;
  } catch {
    /* ignore */
  }
  return h;
}

function parseDiscussionEnvelope(raw: string | null): {
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
      if (
        o.meta &&
        typeof o.meta === "object" &&
        !Array.isArray(o.meta)
      ) {
        envelopeMeta = o.meta as DiscussionEnvelopeMeta;
      }
    }
    const out: DiscussionMessage[] = [];
    for (const item of rows) {
      if (!item || typeof item !== "object") continue;
      const kind = (item as { kind?: unknown }).kind;
      const id = (item as { id?: unknown }).id;
      const createdAt = (item as { createdAt?: unknown }).createdAt;
      if (kind !== "user" && kind !== "assistant" && kind !== "assistant_note")
        continue;
      if (typeof id !== "string" || !id) continue;
      if (typeof createdAt !== "string") continue;
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
        typeof r.suggestedNextStep !== "string"
      )
        continue;
      if (!Array.isArray(r.relatedDocIds)) continue;
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
      const lbs = (r as { discussionRoleLabelSnapshot?: unknown })
        .discussionRoleLabelSnapshot;
      const rbs = (r as { discussionRoleRulesSnapshot?: unknown })
        .discussionRoleRulesSnapshot;
      const discussionRoleLabelSnapshot =
        typeof lbs === "string" && lbs.trim() ? lbs.trim() : undefined;
      const discussionRoleRulesSnapshot =
        typeof rbs === "string" ? rbs : undefined;
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
          ...(discussionRoleParsed
            ? { discussionRole: discussionRoleParsed }
            : {}),
          ...(discussionRoleLabelSnapshot
            ? { discussionRoleLabelSnapshot }
            : {}),
          ...(discussionRoleRulesSnapshot !== undefined
            ? { discussionRoleRulesSnapshot }
            : {}),
        },
      });
    }
    return { messages: out, meta: envelopeMeta };
  } catch {
    return { messages: [], meta: {} };
  }
}

function jsonForDiscussionStorage(
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
    const json = JSON.stringify({
      ...payload,
      messages: body,
    });
    if (json.length <= MAX_STORE_CHARS) return json;
    body = body.slice(Math.max(1, Math.floor(body.length * 0.75)));
  }
  return JSON.stringify({
    ...payload,
    messages: body.slice(-120),
  });
}

function formatMarkdownBlock(
  reflection: AIReflection,
  titleSuffix: string,
  roleConfigs: DiscussionRoleConfig[],
): string {
  const t = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines = [
    "",
    "---",
    "",
    `### AI Discussion · ${titleSuffix} · ${t}`,
    "",
  ];
  const roleLine = roleDisplayLabelForReflection(reflection, roleConfigs);
  if (roleLine) {
    lines.push(`Role · ${roleLine}`, "");
  }
  const rulesSnap = reflection.discussionRoleRulesSnapshot?.trim();
  if (rulesSnap) {
    lines.push("#### 角色规则（生成当刻快照）", "", rulesSnap, "");
  }
  lines.push(reflection.partnerReply.trim());
  const fold = reflection.clarifiedIntent.trim();
  if (fold) {
    lines.push(
      "",
      "> **理清意图（备忘）**",
      ">",
      ...fold.split("\n").map((line) => `> ${line}`),
    );
  }
  return lines.join("\n");
}

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
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [discussionMeta, setDiscussionMeta] = useState<DiscussionEnvelopeMeta>({});
  const [lastAssembly, setLastAssembly] = useState<AssembledAIContext | null>(null);
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [persistReady, setPersistReady] = useState(false);
  const [pmDraft, setPmDraft] = useState("");
  const [pmOpen, setPmOpen] = useState(false);
  const [responseMode, setResponseMode] =
    useState<AIStudioResponseMode>("minimal");
  const [discussionRole, setDiscussionRole] =
    useState<DiscussionRole>("product_partner");
  const [roleConfigs, setRoleConfigs] = useState<DiscussionRoleConfig[]>(() =>
    mergeDiscussionRoleConfigsFromStorage(null),
  );
  const skipNextRoleConfigPersist = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const docLabel = useCallback((id: StudioDocId) => {
    const row = STUDIO_DOC_ENTRIES.find((e) => e.id === id);
    return row ? `${row.labelEn} · ${row.labelZh}` : id;
  }, []);

  useLayoutEffect(() => {
    setRoleConfigs(loadRoleConfigsFromBrowser());
  }, []);

  useEffect(() => {
    try {
      setResponseMode(
        parseStoredResponseMode(localStorage.getItem(STUDIO_AI_RESPONSE_MODE_KEY)),
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_AI_RESPONSE_MODE_KEY, responseMode);
    } catch {
      /* ignore */
    }
  }, [responseMode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STUDIO_DISCUSSION_ROLE_KEY)?.trim();
      if (raw && isDiscussionRole(raw)) setDiscussionRole(raw);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_DISCUSSION_ROLE_KEY, discussionRole);
    } catch {
      /* ignore */
    }
  }, [discussionRole]);

  useEffect(() => {
    if (skipNextRoleConfigPersist.current) {
      skipNextRoleConfigPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(
        STUDIO_DISCUSSION_ROLE_CONFIGS_KEY,
        JSON.stringify(roleConfigs),
      );
    } catch {
      /* ignore */
    }
  }, [roleConfigs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fromDisk: DiscussionMessage[] = [];
      let diskMeta: DiscussionEnvelopeMeta = {};
      try {
        const res = await fetch("/api/studio/discussion", {
          headers: diskAuthHeaders(),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            messages?: unknown;
            meta?: DiscussionEnvelopeMeta;
          };
          const diskJson = JSON.stringify({
            messages: Array.isArray(data.messages) ? data.messages : [],
            meta: data.meta ?? {},
          });
          const parsed = parseDiscussionEnvelope(diskJson);
          fromDisk = parsed.messages;
          diskMeta = parsed.meta;
        }
      } catch {
        /* 离线或无权读盘：仅用 localStorage */
      }
      const lsRaw = localStorage.getItem(STUDIO_AI_DISCUSSION_STORAGE_KEY);
      const fromLsParsed = parseDiscussionEnvelope(lsRaw);
      const fromLs = fromLsParsed.messages;
      const lsMeta = fromLsParsed.meta;
      if (cancelled) return;
      if (fromDisk.length > 0) {
        setMessages(fromDisk);
        setDiscussionMeta(diskMeta);
        try {
          localStorage.setItem(
            STUDIO_AI_DISCUSSION_STORAGE_KEY,
            jsonForDiscussionStorage(fromDisk, diskMeta),
          );
        } catch {
          /* ignore */
        }
      } else {
        setMessages(fromLs);
        setDiscussionMeta(lsMeta);
      }
      setPersistReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    try {
      localStorage.setItem(
        STUDIO_AI_DISCUSSION_STORAGE_KEY,
        jsonForDiscussionStorage(messages, discussionMeta),
      );
    } catch {
      try {
        localStorage.setItem(
          STUDIO_AI_DISCUSSION_STORAGE_KEY,
          JSON.stringify(messages.slice(-120)),
        );
      } catch {
        /* quota */
      }
    }
  }, [messages, discussionMeta, persistReady]);

  /** 变更落盘后写入仓库内 JSON（与中间栏「保存到磁盘」同一权限模型） */
  useEffect(() => {
    if (!persistReady) return;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/studio/discussion", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...diskAuthHeaders(),
            },
            body: JSON.stringify({ messages, meta: discussionMeta }),
          });
          if (!res.ok && res.status !== 403) {
            /* 403：未开磁盘写入；静默 */
          }
        } catch {
          /* 静默 */
        }
      })();
    }, 1200);
    return () => window.clearTimeout(id);
  }, [messages, discussionMeta, persistReady]);
  /** 新消息出现后滚到底部，保证「最新一轮」贴着输入框上方可见 */
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    });
  }, [messages, busy]);

  const reflectionContext = useMemo((): ReflectionContext => {
    return {
      currentDocId: activeDocId,
      currentDocBody: documents[activeDocId] ?? "",
      allDocBodies: documents,
      discussionRole,
      discussionRoleConfigs: roleConfigs,
    };
  }, [activeDocId, documents, discussionRole, roleConfigs]);

  const send = useCallback(async () => {
    const text = composer.trim();
    if (!text || busy) return;
    const priorMessages = messages;
    const userMsg: DiscussionUserMessage = {
      kind: "user",
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setComposer("");
    setNote(null);
    setBusy(true);
    try {
      let assembled: AssembledAIContext | null = null;
      try {
        const res = await fetch("/api/studio/assemble-ai-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...diskAuthHeaders(),
          },
          body: JSON.stringify({
            userInput: text,
            activeDocId,
            discussionMessages: priorMessages,
          }),
        });
        if (res.ok) {
          assembled = (await res.json()) as AssembledAIContext;
          setLastAssembly(assembled);
        } else {
          setLastAssembly(null);
        }
      } catch {
        setLastAssembly(null);
      }

      const fallbackDiscussion = buildFallbackDiscussionSnippet(priorMessages);

      const reflection = await generateAIReflection(text, {
        ...reflectionContext,
        responseMode,
        assembledPrompt:
          responseMode === "deep" ? assembled?.assembledPrompt : undefined,
        detectedTopics: assembled?.detectedTopics,
        relatedThreadSlugs: assembled?.relatedThreadSlugs,
        recentDiscussion:
          responseMode === "deep" && !assembled?.assembledPrompt
            ? fallbackDiscussion
            : undefined,
      });

      const userWithMeta: DiscussionUserMessage =
        assembled != null
          ? {
              ...userMsg,
              meta: {
                detectedTopics: assembled.detectedTopics,
                relatedThreadSlugs: assembled.relatedThreadSlugs,
                relatedDocIds: reflection.relatedDocIds,
                assembledChars: assembled.assembledPrompt.length,
              },
            }
          : userMsg;

      const asst: DiscussionAssistantMessage = {
        kind: "assistant",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        reflection,
      };

      setDiscussionMeta((prev) => ({
        ...prev,
        lastActiveDocId: activeDocId,
        lastDetectedTopics: assembled?.detectedTopics ?? prev.lastDetectedTopics,
        lastRelatedThreadSlugs:
          assembled?.relatedThreadSlugs ?? prev.lastRelatedThreadSlugs,
        lastRelatedDocIds: reflection.relatedDocIds,
        updatedAt: new Date().toISOString(),
      }));

      setMessages((prev) => [
        ...prev.slice(0, -1),
        userWithMeta,
        asst,
      ]);
    } finally {
      setBusy(false);
    }
  }, [
    composer,
    busy,
    reflectionContext,
    messages,
    activeDocId,
    responseMode,
    discussionRole,
    roleConfigs,
  ]);

  const sendAskAllRoles = useCallback(async () => {
    const text = composer.trim();
    if (!text || busy) return;
    const priorMessages = messages;
    const userMsg: DiscussionUserMessage = {
      kind: "user",
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setComposer("");
    setNote(null);
    setBusy(true);
    try {
      let assembled: AssembledAIContext | null = null;
      try {
        const res = await fetch("/api/studio/assemble-ai-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...diskAuthHeaders(),
          },
          body: JSON.stringify({
            userInput: text,
            activeDocId,
            discussionMessages: priorMessages,
          }),
        });
        if (res.ok) {
          assembled = (await res.json()) as AssembledAIContext;
          setLastAssembly(assembled);
        } else {
          setLastAssembly(null);
        }
      } catch {
        setLastAssembly(null);
      }

      const assistants: DiscussionAssistantMessage[] = [];
      let firstRelatedDocIds: StudioDocId[] = [];

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
        if (assistants.length === 0) {
          firstRelatedDocIds = reflection.relatedDocIds;
        }
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
                relatedDocIds: firstRelatedDocIds,
                assembledChars: assembled.assembledPrompt.length,
              },
            }
          : userMsg;

      setDiscussionMeta((prev) => ({
        ...prev,
        lastActiveDocId: activeDocId,
        lastDetectedTopics: assembled?.detectedTopics ?? prev.lastDetectedTopics,
        lastRelatedThreadSlugs:
          assembled?.relatedThreadSlugs ?? prev.lastRelatedThreadSlugs,
        lastRelatedDocIds: firstRelatedDocIds,
        updatedAt: new Date().toISOString(),
      }));

      setMessages((prev) => [
        ...prev.slice(0, -1),
        userWithMeta,
        ...assistants,
      ]);
    } finally {
      setBusy(false);
    }
  }, [
    composer,
    busy,
    reflectionContext,
    messages,
    activeDocId,
    discussionRole,
    roleConfigs,
  ]);

  const appendToDoc = useCallback(
    (docId: StudioDocId, reflection: AIReflection, titleSuffix: string) => {
      const block = formatMarkdownBlock(reflection, titleSuffix, roleConfigs);
      const label = docLabel(docId);
      if (
        !window.confirm(
          `将以下内容追加到「${label}」末尾？\n\n（不会覆盖原有正文；你可随后再编辑。）`,
        )
      )
        return;
      setDocuments((prev) => ({
        ...prev,
        [docId]: `${(prev[docId] ?? "").replace(/\s+$/, "")}\n${block}\n`,
      }));
      setNote(`已追加到「${label}」。中间栏「保存」后才会写入仓库 docs/。`);
    },
    [docLabel, setDocuments, roleConfigs],
  );

  const onAddCurrent = useCallback(
    (r: AIReflection) => {
      appendToDoc(activeDocId, r, activeTitleLine);
    },
    [activeDocId, activeTitleLine, appendToDoc],
  );

  const onRewriteShorter = useCallback((r: AIReflection) => {
    const shortText = mockRewriteShorter(r);
    setMessages((m) => [
      ...m,
      {
        kind: "assistant_note",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content: shortText,
      },
    ]);
    setNote("已生成更短表述（仍仅在讨论区，未写入文档）。");
  }, []);

  const onKeepDiscussion = useCallback(() => {
    setNote("已保留在讨论区；未修改任何文档。");
  }, []);

  const confirmAppendProductMemory = useCallback(async () => {
    const body = pmDraft.trim();
    if (!body) {
      setNote("请先填写要追加的正文。");
      return;
    }
    if (
      !window.confirm(
        "确认将以下内容追加到仓库内 studio/product-memory.md？\n（在末尾追加一段，不会覆盖全文；非正式 docs。）",
      )
    )
      return;
    try {
      const res = await fetch("/api/studio/product-memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...diskAuthHeaders(),
        },
        body: JSON.stringify({ appendMarkdown: body }),
      });
      if (!res.ok) throw new Error("bad status");
      setPmDraft("");
      setPmOpen(false);
      setNote(
        "已追加到 Product Memory（磁盘）。此为 Layer 1 协助记忆，不替代你在 docs 中的正式决策流程。",
      );
    } catch {
      setNote("写入 Product Memory 失败（可能未授权磁盘读写）。");
    }
  }, [pmDraft]);

  return (
    <div
      role="complementary"
      aria-label="AI Editorial Discussion Panel"
      className={`flex min-h-0 flex-1 flex-col bg-canvas text-ink ${
        layoutMode === "focusOnly" ? "" : "border-l border-border/80"
      }`}
    >
      {/* 上区固定：标题（不随对话滚动） */}
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
            <p
              className="mt-2 truncate text-[10px] text-muted/90"
              title={activeTitleLine}
            >
              上下文：<span className="text-ink/80">{activeTitleLine}</span>
            </p>
            <details className="mt-2 rounded-lg border border-border/65 bg-[#f7f5f2] px-2 py-2 text-[11px] leading-snug">
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
                      <span className="font-mono text-[9px] text-muted/80">
                        {cfg.id}
                      </span>
                      <button
                        type="button"
                        className="rounded border border-border/60 bg-canvas px-1.5 py-0.5 text-[9px] text-ink/80 transition hover:border-sand"
                        onClick={() => {
                          const def = DEFAULT_DISCUSSION_ROLE_CONFIGS.find(
                            (d) => d.id === cfg.id,
                          );
                          if (!def) return;
                          setRoleConfigs((prev) =>
                            prev.map((c) =>
                              c.id === cfg.id ? { ...def } : c,
                            ),
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
                          prev.map((c) =>
                            c.id === cfg.id ? { ...c, label: v } : c,
                          ),
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
                          prev.map((c) =>
                            c.id === cfg.id ? { ...c, rules: v } : c,
                          ),
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

      {/* 上栏：仅此区域纵向滚动；旧消息在滚动容器顶部方向，新消息靠近底部 */}
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
                  <div key={msg.id} className="select-text rounded-lg border border-border/60 bg-white/80 px-3 py-2 text-[12px] leading-relaxed text-ink/90 shadow-sm">
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
                  className="select-text space-y-3 rounded-xl border border-border/70 bg-white/90 px-3 py-3 shadow-[0_1px_0_rgba(44,40,36,0.03)]"
                >
                  <p className="text-[9px] font-medium text-muted">
                    {modeAndRoleBadgeLine(r, roleConfigs)}
                  </p>
                  <section aria-label="AI 回应">
                    <StudioDiscussionMarkdown content={r.partnerReply} />
                  </section>

                  <section
                    className="border-t border-border/40 pt-3"
                    aria-label="写入文档"
                  >
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
                        onClick={() =>
                          appendToDoc(DOC_DANGEROUS, r, "Dangerous Directions")
                        }
                      >
                        追加到「危险方向」
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border/70 bg-canvas px-2 py-1 text-[10px] text-ink transition hover:border-sand"
                        onClick={() =>
                          appendToDoc(DOC_PARKING, r, "Parking Lot")
                        }
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
                        <h3 className="text-[10px] font-medium text-muted">
                          理清意图
                        </h3>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink/85">
                          {r.clarifiedIntent}
                        </p>
                      </section>
                      <section>
                        <h3 className="text-[10px] font-medium text-muted">
                          相关文档
                        </h3>
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

      {/* 下栏：输入区始终钉在右栏底部，不参与滚动 */}
      <footer className="relative z-10 shrink-0 border-t-2 border-border/60 bg-canvas px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(44,40,36,0.08)] backdrop-blur-sm">
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
    </div>
  );
}
