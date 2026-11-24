"use client";

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
  STUDIO_DOC_ENTRIES,
  STUDIO_DISCUSSION_ROLE_CONFIGS_KEY,
  STUDIO_DISCUSSION_ROLE_KEY,
  type StudioDocId,
} from "@/lib/studio-config";
import type { AssembledAIContext } from "@/lib/studio-ai-context";
import {
  isDiscussionRole,
  mergeDiscussionRoleConfigsFromStorage,
  type AIReflection,
  type AIStudioResponseMode,
  type DiscussionEnvelopeMeta,
  type DiscussionMessage,
  type DiscussionRole,
  type DiscussionRoleConfig,
  type DiscussionUserMessage,
} from "./discussion-types";
import { mockRewriteShorter, type ReflectionContext } from "./generate-ai-reflection";
import {
  STUDIO_AI_RESPONSE_MODE_KEY,
  diskAuthHeaders,
  executeDiscussionTurn,
  formatMarkdownBlock,
  jsonForDiscussionStorage,
  loadRoleConfigsFromBrowser,
  parseDiscussionEnvelope,
  parseStoredResponseMode,
} from "./studio-discussion-helpers";

export type StudioDiscussionControllerDeps = {
  activeDocId: StudioDocId;
  activeTitleLine: string;
  documents: Record<string, string>;
  setDocuments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

export function useStudioDiscussionController({
  activeDocId,
  activeTitleLine,
  documents,
  setDocuments,
}: StudioDiscussionControllerDeps) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [discussionMeta, setDiscussionMeta] = useState<DiscussionEnvelopeMeta>({});
  const [lastAssembly, setLastAssembly] = useState<AssembledAIContext | null>(null);
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [persistReady, setPersistReady] = useState(false);
  const [pmDraft, setPmDraft] = useState("");
  const [pmOpen, setPmOpen] = useState(false);
  const [responseMode, setResponseMode] = useState<AIStudioResponseMode>("minimal");
  const [discussionRole, setDiscussionRole] = useState<DiscussionRole>("product_partner");
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
      const rawRole = localStorage.getItem(STUDIO_DISCUSSION_ROLE_KEY)?.trim();
      if (rawRole && isDiscussionRole(rawRole)) setDiscussionRole(rawRole);
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
        const res = await fetch("/api/studio/discussion", { headers: diskAuthHeaders() });
        if (res.ok) {
          const data = (await res.json()) as {
            messages?: unknown;
            meta?: DiscussionEnvelopeMeta;
          };
          const parsed = parseDiscussionEnvelope(
            JSON.stringify({
              messages: Array.isArray(data.messages) ? data.messages : [],
              meta: data.meta ?? {},
            }),
          );
          fromDisk = parsed.messages;
          diskMeta = parsed.meta;
        }
      } catch {
        /* 离线或无权读盘：仅用 localStorage */
      }
      const fromLsParsed = parseDiscussionEnvelope(
        localStorage.getItem(STUDIO_AI_DISCUSSION_STORAGE_KEY),
      );
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
        setMessages(fromLsParsed.messages);
        setDiscussionMeta(fromLsParsed.meta);
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
          await fetch("/api/studio/discussion", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
            body: JSON.stringify({ messages, meta: discussionMeta }),
          });
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

  const runTurn = useCallback(
    async (askAllRoles: boolean) => {
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
        const { assembled, userWithMeta, assistants, relatedDocIds } =
          await executeDiscussionTurn({
            text,
            userMsg,
            priorMessages,
            activeDocId,
            reflectionContext,
            responseMode,
            askAllRoles,
          });
        setLastAssembly(assembled);
        setDiscussionMeta((prev) => ({
          ...prev,
          lastActiveDocId: activeDocId,
          lastDetectedTopics: assembled?.detectedTopics ?? prev.lastDetectedTopics,
          lastRelatedThreadSlugs:
            assembled?.relatedThreadSlugs ?? prev.lastRelatedThreadSlugs,
          lastRelatedDocIds: relatedDocIds,
          updatedAt: new Date().toISOString(),
        }));
        setMessages((prev) => [...prev.slice(0, -1), userWithMeta, ...assistants]);
      } finally {
        setBusy(false);
      }
    },
    [composer, busy, messages, activeDocId, reflectionContext, responseMode],
  );

  const send = useCallback(() => runTurn(false), [runTurn]);
  const sendAskAllRoles = useCallback(() => runTurn(true), [runTurn]);

  const appendToDoc = useCallback(
    (docId: StudioDocId, reflection: AIReflection, titleSuffix: string) => {
      const block = formatMarkdownBlock(reflection, titleSuffix, roleConfigs);
      const label = docLabel(docId);
      if (
        !window.confirm(
          `将以下内容追加到「${label}」末尾？\n\n（不会覆盖原有正文；你可随后再编辑。）`,
        )
      ) {
        return;
      }
      setDocuments((prev) => ({
        ...prev,
        [docId]: `${(prev[docId] ?? "").replace(/\s+$/, "")}\n${block}\n`,
      }));
      setNote(`已追加到「${label}」。中间栏「保存」后才会写入仓库 docs/。`);
    },
    [docLabel, setDocuments, roleConfigs],
  );

  const onAddCurrent = useCallback(
    (r: AIReflection) => appendToDoc(activeDocId, r, activeTitleLine),
    [activeDocId, activeTitleLine, appendToDoc],
  );

  const onRewriteShorter = useCallback((r: AIReflection) => {
    setMessages((m) => [
      ...m,
      {
        kind: "assistant_note",
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        content: mockRewriteShorter(r),
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
    ) {
      return;
    }
    try {
      const res = await fetch("/api/studio/product-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...diskAuthHeaders() },
        body: JSON.stringify({ appendMarkdown: body }),
      });
      if (!res.ok) throw new Error("bad status");
      setPmDraft("");
      setPmOpen(false);
      setNote("已追加到 Product Memory（磁盘）。此为 Layer 1 协助记忆，不替代你在 docs 中的正式决策流程。");
    } catch {
      setNote("写入 Product Memory 失败（可能未授权磁盘读写）。");
    }
  }, [pmDraft]);

  return {
    messages,
    discussionMeta,
    lastAssembly,
    composer,
    setComposer,
    busy,
    note,
    pmDraft,
    setPmDraft,
    pmOpen,
    setPmOpen,
    responseMode,
    setResponseMode,
    discussionRole,
    setDiscussionRole,
    roleConfigs,
    setRoleConfigs,
    scrollRef,
    docLabel,
    send,
    sendAskAllRoles,
    appendToDoc,
    onAddCurrent,
    onRewriteShorter,
    onKeepDiscussion,
    confirmAppendProductMemory,
  };
}
