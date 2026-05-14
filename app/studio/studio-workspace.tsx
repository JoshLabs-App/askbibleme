"use client";

/**
 * Selah.my Studio — 主工作区（客户端）
 * ---------------------------------------------------------------------------
 * 三栏：文档导航 | Markdown 编辑 | AI 占位面板
 * 持久化：浏览器 localStorage（非技术人员可理解为「存在本机浏览器里」）。
 * 后续若要团队共享或备份，可把「写入 localStorage」换成调用后端数据库 API。
 */

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StudioAIDiscussionPanel } from "./studio-ai-discussion-panel";
import { StudioDocMarkdown } from "./studio-doc-markdown";
import {
  AI_PROFILES_STORAGE_KEY,
  AI_SETTINGS_LEGACY_KEY,
  CONNECTION_TEMPLATES,
  KNOWN_PRESET_CODES,
  bundleFromLegacySettingsJson,
  emptyConnection,
  emptyProfilesBundle,
  newProfileId,
  normalizePresetCode,
  type AIConnectionProfile,
  type AIProfilesBundle,
  type AISettings,
  type ConnectionTemplate,
} from "@/lib/ai";
import {
  STUDIO_DISK_BEARER_STORAGE_KEY,
  STUDIO_DISCUSSION_FOCUS_ONLY_KEY,
  STUDIO_DOC_ENTRIES,
  STUDIO_STORAGE_KEY,
  type StudioDocId,
} from "@/lib/studio-config";
import { isStudioDocId } from "@/lib/studio-disk-save";
import {
  STUDIO_DOC_MANIFEST_KEY,
  buildDocOrder,
  defaultExtraMeta,
  formatStudioDocOrdinal,
  isExtraStudioDocId,
  makeExtraStudioDocId,
  mergeOrderWithDocumentKeys,
  parseStudioDocManifest,
  resolveStudioDocRow,
  type StudioExtraDocMeta,
} from "@/lib/studio-doc-manifest";
import {
  appendDocHistoryEntry,
  appendSavedSnapshotForAllDocs,
  docHistorySourceLabel,
  emptyDocHistoryBundle,
  parseDocHistoryBundle,
  studioDocCharCount,
  STUDIO_DOC_HISTORY_STORAGE_KEY,
  type DocHistoryBundle,
  type DocHistoryEntry,
} from "@/lib/studio-doc-history";
import {
  entryFromScanParts,
  formatImportedProfileName,
  formatSavedConnectionName,
  inferLocalModelSuitability,
  type LocalModelScanEntry,
} from "@/lib/ai/model-notes";
import { SITE_METADATA_DEFAULT_TITLE } from "@/lib/site-metadata-defaults";

function entriesFromLocalModelsApi(data: {
  models?: string[];
  entries?: LocalModelScanEntry[];
}): LocalModelScanEntry[] {
  if (data.entries && data.entries.length > 0) return data.entries;
  return (data.models ?? []).map((name) => ({
    name,
    suitability: inferLocalModelSuitability(name),
  }));
}

const STUDIO_LAYOUT_STORAGE_KEY = "askbible-studio-layout-v1";
/** 中间栏「编辑 | 阅读」偏好（仅存本机） */
const STUDIO_DOC_VIEW_STORAGE_KEY = "askbible-studio-doc-view-v1";
const LAYOUT_DEFAULT_LEFT_PX = 268;
const LAYOUT_DEFAULT_RIGHT_PX = 380;
const RESIZER_WIDTH_PX = 6;

type StudioWorkspaceProps = {
  /** 服务端从 /docs/*.md 读入的初始正文 */
  initialDocuments: Record<string, string>;
  /** 嵌入统一后台 `/admin/studio`：高度与返回链接适配侧栏 */
  embedInAdmin?: boolean;
};

export default function StudioWorkspace({
  initialDocuments,
  embedInAdmin = false,
}: StudioWorkspaceProps) {
  const [documents, setDocuments] =
    useState<Record<string, string>>(initialDocuments);
  const [docOrder, setDocOrder] = useState<string[]>(() =>
    STUDIO_DOC_ENTRIES.map((e) => e.id),
  );
  const [extraDocMeta, setExtraDocMeta] = useState<
    Record<string, StudioExtraDocMeta>
  >(() => ({}));
  const [activeId, setActiveId] = useState<StudioDocId>(
    STUDIO_DOC_ENTRIES[0].id,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  /** 连接/扫描等后台操作的提示（右栏讨论区不再重复展示连接文案） */
  const [assistantHint, setAssistantHint] = useState<string>("");
  const [bundle, setBundle] = useState<AIProfilesBundle>(() =>
    emptyProfilesBundle(),
  );
  const [draftName, setDraftName] = useState("");
  const [draftConnection, setDraftConnection] = useState<AISettings>(() =>
    emptyConnection(),
  );
  const [aiError, setAiError] = useState<string | null>(null);
  /** 由本机扫描得到的模型（含约几 GB 与场景备注，用于 datalist 与下方列表） */
  const [scannedEntries, setScannedEntries] = useState<LocalModelScanEntry[]>(
    [],
  );
  const [modelScanBusy, setModelScanBusy] = useState(false);
  const [presetCodeInput, setPresetCodeInput] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);
  const [diskBearerDraft, setDiskBearerDraft] = useState("");
  const [docHistoryBundle, setDocHistoryBundle] = useState<DocHistoryBundle>(
    () => emptyDocHistoryBundle(),
  );
  const [leftColPx, setLeftColPx] = useState(LAYOUT_DEFAULT_LEFT_PX);
  const [rightColPx, setRightColPx] = useState(LAYOUT_DEFAULT_RIGHT_PX);
  /** 中间文档：源码编辑 vs 格式化阅读 */
  const [docViewMode, setDocViewMode] = useState<"edit" | "read">("read");
  const mainRowRef = useRef<HTMLDivElement>(null);
  /** 仅显示右侧 AI 讨论区（全宽）；首屏须与 SSR 一致，在 useLayoutEffect 中再读 localStorage */
  const [discussionFocusOnly, setDiscussionFocusOnly] = useState(false);

  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(STUDIO_DISCUSSION_FOCUS_ONLY_KEY) === "1") {
        setDiscussionFocusOnly(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  /** 首屏已从 localStorage 合并文档与清单后再写入 manifest，避免用初始空清单覆盖 */
  const [studioManifestReady, setStudioManifestReady] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        STUDIO_DISCUSSION_FOCUS_ONLY_KEY,
        discussionFocusOnly ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [discussionFocusOnly]);

  // 首次挂载后合并本机已保存的文档与文档清单（避免覆盖服务器默认）
  useEffect(() => {
    const mergedDocs: Record<string, string> = { ...initialDocuments };
    try {
      const stored = localStorage.getItem(STUDIO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        Object.assign(mergedDocs, parsed);
      }
    } catch {
      // 若数据损坏，忽略即可，仍使用服务器与内存中的内容
    }

    let manifest = parseStudioDocManifest(null);
    try {
      manifest = parseStudioDocManifest(
        localStorage.getItem(STUDIO_DOC_MANIFEST_KEY),
      );
    } catch {
      /* parseStudioDocManifest 已兜底 */
    }
    const baseOrder = buildDocOrder(manifest);
    const order = mergeOrderWithDocumentKeys(
      baseOrder,
      Object.keys(mergedDocs),
    );
    const extras: Record<string, StudioExtraDocMeta> = {
      ...manifest.extras,
    };
    for (const id of order) {
      if (isExtraStudioDocId(id) && !extras[id]) {
        extras[id] = defaultExtraMeta();
      }
    }
    for (const k of Object.keys(mergedDocs)) {
      if (!isStudioDocId(k)) delete mergedDocs[k];
    }
    setDocuments(mergedDocs);
    setDocOrder(order);
    setExtraDocMeta(extras);
    setActiveId((cur) =>
      order.includes(cur) ? cur : (order[0] ?? STUDIO_DOC_ENTRIES[0].id),
    );
    try {
      const b = localStorage.getItem(STUDIO_DISK_BEARER_STORAGE_KEY);
      if (b) setDiskBearerDraft(b);
    } catch {
      /* ignore */
    }
    try {
      const h = localStorage.getItem(STUDIO_DOC_HISTORY_STORAGE_KEY);
      if (h) setDocHistoryBundle(parseDocHistoryBundle(h));
    } catch {
      /* ignore */
    }
    try {
      const lay = localStorage.getItem(STUDIO_LAYOUT_STORAGE_KEY);
      if (lay) {
        const p = JSON.parse(lay) as {
          left?: unknown;
          right?: unknown;
        };
        if (typeof p.left === "number" && p.left >= 0) {
          setLeftColPx(p.left);
        }
        if (typeof p.right === "number" && p.right >= 0) {
          setRightColPx(p.right);
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const v2 = localStorage.getItem(AI_PROFILES_STORAGE_KEY);
      if (v2) {
        const parsed = JSON.parse(v2) as AIProfilesBundle;
        if (parsed?.profiles && Array.isArray(parsed.profiles)) {
          setBundle({
            version: 1,
            activeProfileId: parsed.activeProfileId ?? null,
            profiles: parsed.profiles,
          });
        }
      } else {
        const v1 = localStorage.getItem(AI_SETTINGS_LEGACY_KEY);
        if (v1) {
          const migrated = bundleFromLegacySettingsJson(v1);
          if (migrated) {
            setBundle(migrated);
            localStorage.setItem(
              AI_PROFILES_STORAGE_KEY,
              JSON.stringify(migrated),
            );
          }
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const dv = localStorage.getItem(STUDIO_DOC_VIEW_STORAGE_KEY);
      if (dv === "read" || dv === "edit") setDocViewMode(dv);
    } catch {
      /* ignore */
    }
    setStudioManifestReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时从 localStorage 恢复；initialDocuments 为服务端首包快照
  }, []);

  useEffect(() => {
    if (!studioManifestReady) return;
    try {
      const extraOrder = docOrder.filter(isExtraStudioDocId);
      localStorage.setItem(
        STUDIO_DOC_MANIFEST_KEY,
        JSON.stringify({
          version: 1,
          extraOrder,
          extras: extraDocMeta,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [studioManifestReady, docOrder, extraDocMeta]);

  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_DOC_VIEW_STORAGE_KEY, docViewMode);
    } catch {
      /* ignore */
    }
  }, [docViewMode]);

  // 仅在选择变化时，把该条配置加载到编辑区（避免保存后覆盖未提交的草稿）
  useEffect(() => {
    setScannedEntries([]);
    const id = bundle.activeProfileId;
    if (!id) {
      setDraftName("");
      setDraftConnection(emptyConnection());
      return;
    }
    const p = bundle.profiles.find((x) => x.id === id);
    if (!p) return;
    setDraftName(p.name);
    setDraftConnection({
      provider: p.provider,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: p.apiKey ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 同 id 下仅改 profiles 内容时不重置草稿
  }, [bundle.activeProfileId]);

  const activeBody = documents[activeId] ?? "";

  const persistDocuments = useCallback(async () => {
    const toSave = Object.fromEntries(
      Object.entries(documents).filter(([id]) => isStudioDocId(id)),
    );
    try {
      localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      setSaveMessage("保存失败：浏览器可能禁用了本地存储。");
      window.setTimeout(() => setSaveMessage(null), 3200);
      return;
    }

    setDocHistoryBundle((prev) => {
      const next = appendSavedSnapshotForAllDocs(prev, toSave, docOrder);
      try {
        localStorage.setItem(STUDIO_DOC_HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const bearer = diskBearerDraft.trim();
      if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
      }
      const res = await fetch("/api/studio/save-docs", {
        method: "POST",
        headers,
        body: JSON.stringify({ documents: toSave }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        written?: number;
      };
      if (!res.ok) {
        if (res.status === 403) {
          setSaveMessage(
            "已同步浏览器。未写入仓库：请用 `npm run dev`，或在 .env 配置 STUDIO_ALLOW_DISK_SAVE + STUDIO_WRITE_SECRET 后于下方填写同一密钥。",
          );
        } else {
          setSaveMessage(
            `已同步浏览器；写仓库失败：${data.error ?? res.status}`,
          );
        }
        window.setTimeout(() => setSaveMessage(null), 5200);
        return;
      }
      setSaveMessage(
        typeof data.written === "number"
          ? `已写入仓库 docs/（${data.written} 篇）并同步浏览器。`
          : "已写入仓库 docs/ 并同步浏览器。",
      );
      window.setTimeout(() => setSaveMessage(null), 3200);
    } catch {
      setSaveMessage("已同步浏览器；写仓库时网络异常。");
      window.setTimeout(() => setSaveMessage(null), 4000);
    }
  }, [documents, diskBearerDraft, docOrder]);

  const activeResolved = useMemo(
    () => resolveStudioDocRow(activeId, extraDocMeta),
    [activeId, extraDocMeta],
  );

  const activeDocOrdinal = useMemo(() => {
    const i = docOrder.indexOf(activeId);
    return formatStudioDocOrdinal(i >= 0 ? i + 1 : 0);
  }, [docOrder, activeId]);

  const addStudioDocument = useCallback(() => {
    const id = makeExtraStudioDocId();
    setExtraDocMeta((prev) => ({ ...prev, [id]: defaultExtraMeta() }));
    setDocOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setDocuments((prev) => ({ ...prev, [id]: "# 新文档\n\n" }));
    setActiveId(id);
  }, []);

  const patchActiveExtraMeta = useCallback(
    (patch: Partial<StudioExtraDocMeta>) => {
      if (!isExtraStudioDocId(activeId)) return;
      setExtraDocMeta((prev) => ({
        ...prev,
        [activeId]: {
          ...(prev[activeId] ?? defaultExtraMeta()),
          ...patch,
        },
      }));
    },
    [activeId],
  );

  const activeHistoryEntries = useMemo(
    () => docHistoryBundle.byDoc[activeId] ?? [],
    [docHistoryBundle, activeId],
  );

  const lastSavedForActive = useMemo(() => {
    const list = docHistoryBundle.byDoc[activeId] ?? [];
    return list.find((e) => e.source === "saved");
  }, [docHistoryBundle, activeId]);

  const editingCharCount = useMemo(
    () => studioDocCharCount(activeBody),
    [activeBody],
  );

  /** 编辑停顿约 2 秒后自动记一条「自动记录」快照 */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDocHistoryBundle((prev) => {
        const next = appendDocHistoryEntry(prev, activeId, activeBody, "autosave");
        if (next === prev) return prev;
        try {
          localStorage.setItem(
            STUDIO_DOC_HISTORY_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          /* ignore */
        }
        return next;
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [activeId, activeBody]);

  const restoreDocHistoryEntry = useCallback((entry: DocHistoryEntry) => {
    const n = studioDocCharCount(entry.body);
    if (!window.confirm(`恢复到此版本？（${n} 字符）`)) return;
    setActiveId(entry.docId);
    setDocuments((prev) => ({ ...prev, [entry.docId]: entry.body }));
  }, []);

  const persistLayoutSizes = useCallback((left: number, right: number) => {
    try {
      localStorage.setItem(
        STUDIO_LAYOUT_STORAGE_KEY,
        JSON.stringify({ version: 1, left, right }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const beginResizeLeftDivider = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const row = mainRowRef.current;
      const el = e.currentTarget;
      if (!row) return;
      const startX = e.clientX;
      const startLeft = leftColPx;
      const otherRight = rightColPx;
      let lastLeft = startLeft;
      el.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const w = row.offsetWidth;
        const dx = ev.clientX - startX;
        const maxL = Math.max(0, w - otherRight - 2 * RESIZER_WIDTH_PX);
        lastLeft = Math.min(Math.max(0, startLeft + dx), maxL);
        setLeftColPx(lastLeft);
      };
      const done = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", done);
        el.removeEventListener("pointercancel", done);
        persistLayoutSizes(lastLeft, otherRight);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", done);
      el.addEventListener("pointercancel", done);
    },
    [leftColPx, rightColPx, persistLayoutSizes],
  );

  const beginResizeRightDivider = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const row = mainRowRef.current;
      const el = e.currentTarget;
      if (!row) return;
      const startX = e.clientX;
      const otherLeft = leftColPx;
      const startRight = rightColPx;
      let lastRight = startRight;
      el.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const w = row.offsetWidth;
        const dx = ev.clientX - startX;
        const maxR = Math.max(0, w - otherLeft - 2 * RESIZER_WIDTH_PX);
        lastRight = Math.min(Math.max(0, startRight - dx), maxR);
        setRightColPx(lastRight);
      };
      const done = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", done);
        el.removeEventListener("pointercancel", done);
        persistLayoutSizes(otherLeft, lastRight);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", done);
      el.addEventListener("pointercancel", done);
    },
    [leftColPx, rightColPx, persistLayoutSizes],
  );

  const commitBundle = useCallback(
    (updater: (b: AIProfilesBundle) => AIProfilesBundle) => {
      setBundle((b) => {
        const next = updater(b);
        try {
          localStorage.setItem(
            AI_PROFILES_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          setAiError("无法写入本地存储，请检查浏览器权限。");
        }
        return next;
      });
    },
    [],
  );

  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;

  /** 将当前 base 下扫到的所有模型各存为一条连接（同 base+model 已存在则跳过） */
  const bindAllModelsForBase = useCallback(
    async (
      baseUrl: string,
      apiKey?: string,
      namePrefix = "本机",
    ): Promise<{ added: number }> => {
      const trimmedBase = baseUrl.trim();
      if (!trimmedBase) {
        setAiError("Base URL 为空，无法导入模型列表。");
        return { added: 0 };
      }
      setModelScanBusy(true);
      setAiError(null);
      try {
        const qs = new URLSearchParams({
          provider: "auto",
          baseUrl: trimmedBase,
        });
        const res = await fetch(`/api/ai/local-models?${qs}`);
        const data = (await res.json()) as {
          models?: string[];
          entries?: LocalModelScanEntry[];
          error?: string;
          source?: string;
        };
        const entries = entriesFromLocalModelsApi(data);
        setScannedEntries(entries);
        const models = entries.map((e) => e.name);
        if (!res.ok || models.length === 0) {
          if (!res.ok) setAiError(data.error || "拉取模型列表失败");
          return { added: 0 };
        }
        let added = 0;
        commitBundle((b) => {
          const seen = new Set(
            b.profiles.map((p) => `${p.baseUrl}|${p.model}`),
          );
          const additions: AIConnectionProfile[] = [];
          const src = data.source === "ollama" ? "Ollama" : "兼容API";
          for (const entry of entries) {
            const model = entry.name;
            const key = `${trimmedBase}|${model}`;
            if (seen.has(key)) continue;
            seen.add(key);
            additions.push({
              id: newProfileId(),
              name: formatImportedProfileName(namePrefix, src, entry),
              provider: "openai-compatible",
              baseUrl: trimmedBase,
              model,
              apiKey: apiKey?.trim() || undefined,
            });
          }
          added = additions.length;
          if (additions.length === 0) return b;
          const profiles = [...b.profiles, ...additions];
          return {
            version: 1,
            activeProfileId: additions[0]!.id,
            profiles,
          };
        });
        return { added };
      } catch {
        setAiError("导入请求失败。");
        return { added: 0 };
      } finally {
        setModelScanBusy(false);
      }
    },
    [commitBundle],
  );

  /** 保存当前编辑区为一条「连接配置」，供下拉与其它模块复用 */
  const saveCurrentProfile = () => {
    commitBundle((b) => {
      const id = b.activeProfileId ?? newProfileId();
      const draftModel = draftConnection.model.trim();
      const fromScan = scannedEntries.find((e) => e.name === draftModel);
      const name =
        draftName.trim() ||
        (draftModel
          ? formatSavedConnectionName(
              fromScan ?? entryFromScanParts(draftModel),
            )
          : "连接 · 未命名");
      const nextProfile: AIConnectionProfile = {
        id,
        name,
        provider: draftConnection.provider,
        baseUrl: draftConnection.baseUrl.trim(),
        model: draftConnection.model.trim(),
        apiKey: draftConnection.apiKey?.trim() || undefined,
      };
      const exists = b.profiles.some((p) => p.id === id);
      const profiles = exists
        ? b.profiles.map((p) => (p.id === id ? nextProfile : p))
        : [...b.profiles, nextProfile];
      return {
        version: 1,
        activeProfileId: id,
        profiles,
      };
    });
    setAiError(null);
    setAssistantHint(
      "已保存连接配置。其它页面可读取同一键（见 lib/ai/storage）或改为服务端下发。",
    );
    window.setTimeout(() => {
      setAssistantHint(
        "选择已保存的连接，或套用下方模板后改模型名，再点 AI 动作。",
      );
    }, 2800);
  };

  const createNewProfile = () => {
    commitBundle((b) => {
      const id = newProfileId();
      const blank: AIConnectionProfile = {
        id,
        name: "新连接",
        ...emptyConnection(),
      };
      return {
        version: 1,
        activeProfileId: id,
        profiles: [...b.profiles, blank],
      };
    });
  };

  const deleteCurrentProfile = () => {
    commitBundle((b) => {
      const id = b.activeProfileId;
      if (!id) return b;
      const profiles = b.profiles.filter((p) => p.id !== id);
      return {
        version: 1,
        activeProfileId: profiles[0]?.id ?? null,
        profiles,
      };
    });
    setAssistantHint("已删除该连接。");
  };

  const applyTemplate = (t: ConnectionTemplate) => {
    setDraftConnection((d) => ({
      ...d,
      baseUrl: t.baseUrl,
      model: t.modelPlaceholder,
    }));
    if (t.hint) setAssistantHint(t.hint);
  };

  /**
   * 向本机服务拉取模型列表（经 Next API 代理，避免浏览器跨端口 CORS）。
   * `provider` 默认 auto：先试 Ollama /api/tags，再试 OpenAI /models。
   */
  const scanLocalModels = async (
    provider: "ollama" | "openai_models" | "auto" = "auto",
    baseUrlOverride?: string,
  ) => {
    const base = (baseUrlOverride ?? draftConnection.baseUrl).trim();
    if (!base) {
      setAiError("请先填写 Base URL，或点选上方模板。");
      return;
    }
    setModelScanBusy(true);
    setAiError(null);
    try {
      const qs = new URLSearchParams({
        provider,
        baseUrl: base,
      });
      const res = await fetch(`/api/ai/local-models?${qs}`);
      const data = (await res.json()) as {
        models?: string[];
        entries?: LocalModelScanEntry[];
        error?: string;
      };
      if (!res.ok) {
        setScannedEntries([]);
        setAiError(data.error || "扫描失败");
        setAssistantHint("未拿到模型列表，请检查本机服务是否已启动、Base URL 是否正确。");
        return;
      }
      const entries = entriesFromLocalModelsApi(data);
      setScannedEntries(entries);
      const models = entries.map((e) => e.name);
      setAssistantHint(
        models.length > 0
          ? `已从本机读取 ${models.length} 个模型；Model 下拉含备注，详见下方列表。`
          : "服务已响应但未发现模型条目。",
      );
      setDraftConnection((d) => ({
        ...d,
        model: d.model.trim() ? d.model : (models[0] ?? ""),
      }));
    } catch {
      setScannedEntries([]);
      setAiError("扫描请求失败。");
    } finally {
      setModelScanBusy(false);
    }
  };

  const onTemplateClick = (t: ConnectionTemplate) => {
    if (t.id !== "ollama" && t.id !== "lmstudio") {
      setScannedEntries([]);
    }
    applyTemplate(t);
    if (t.id === "ollama" || t.id === "lmstudio") {
      const label =
        t.label.replace(/（本机）/, "").replace(/（.*?）/, "").trim() ||
        t.id;
      void bindAllModelsForBase(t.baseUrl, undefined, label);
    }
  };

  /** 快捷码：OLLAMA / LM / SKY（SKY 需在 .env 配 AI_PRESET_SKY_*）→ 自动填表并可导入全部模型 */
  const applyPresetCode = async () => {
    const raw = presetCodeInput.trim();
    if (!raw) {
      setAiError("请输入快捷码，例如 OLLAMA 或 SKY。");
      return;
    }
    setPresetBusy(true);
    setAiError(null);
    try {
      const res = await fetch(
        `/api/ai/preset?code=${encodeURIComponent(raw)}`,
      );
      const data = (await res.json()) as {
        name?: string;
        baseUrl?: string;
        model?: string;
        apiKey?: string;
        autoScan?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setAiError(data.error || "快捷码无效");
        return;
      }
      setDraftName(data.name ?? "");
      setDraftConnection({
        provider: "openai-compatible",
        baseUrl: data.baseUrl ?? "",
        model: data.model ?? "",
        apiKey: data.apiKey ?? "",
      });
      const code = normalizePresetCode(raw);
      if (data.autoScan && data.baseUrl) {
        const { added } = await bindAllModelsForBase(
          data.baseUrl,
          data.apiKey,
          data.name ?? code,
        );
        setAssistantHint(
          added > 0
            ? `快捷码「${code}」已应用，并新增 ${added} 条模型连接（已去重）。`
            : `快捷码「${code}」已应用；未新增连接（可能已全部存在或未扫到模型）。`,
        );
      } else {
        setAssistantHint(
          `快捷码「${code}」已自动填写名称与接口。需要批量导入模型时点「一键导入本机全部模型」。`,
        );
      }
    } catch {
      setAiError("快捷码请求失败。");
    } finally {
      setPresetBusy(false);
    }
  };

  /** 首次进入且尚无任何连接时，尝试从默认 Ollama 地址导入（仅尝试一次 / 标签页） */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem("askbible-studio-initial-bind-tried")) return;
      if (bundleRef.current.profiles.length > 0) return;
      sessionStorage.setItem("askbible-studio-initial-bind-tried", "1");
      void bindAllModelsForBase(
        "http://127.0.0.1:11434/v1",
        undefined,
        "本机",
      ).then(({ added }) => {
        if (added > 0) {
          setAssistantHint(
            `首次打开：已从本机默认 Ollama 导入 ${added} 条模型连接，可在已保存的连接中选择。`,
          );
        }
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [bindAllModelsForBase]);

  const onSelectProfile = (value: string) => {
    commitBundle((b) => ({
      ...b,
      activeProfileId: value || null,
    }));
  };

  /** 展示在 AI Discussion 顶部的当前文档一行 */
  const discussionTitleLine = useMemo(() => {
    const row = activeResolved;
    if (!row) return "";
    return `${activeDocOrdinal} · ${row.labelEn} · ${row.labelZh}`;
  }, [activeResolved, activeDocOrdinal]);

  return (
    <div
      className={
        embedInAdmin
          ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-canvas text-ink"
          : "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-canvas text-ink"
      }
    >
      <div
        ref={mainRowRef}
        className={`flex min-h-0 min-w-0 flex-1 flex-row ${
          discussionFocusOnly
            ? "overflow-hidden"
            : "overflow-x-auto overflow-hidden"
        }`}
      >
        {discussionFocusOnly ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
            <StudioAIDiscussionPanel
              activeDocId={activeId}
              activeTitleLine={discussionTitleLine}
              documents={documents}
              setDocuments={setDocuments}
              layoutMode="focusOnly"
              onExitFocusOnly={() => setDiscussionFocusOnly(false)}
            />
          </div>
        ) : (
          <>
            {/* 左：返回 / 标题 + 文档导航 */}
            <aside
              className="flex min-h-0 shrink-0 flex-col border-r border-border bg-surface/60 py-2 pl-2 pr-1"
              style={{ width: leftColPx, minWidth: Math.min(leftColPx, 220) }}
            >
          <div className="shrink-0 px-1 pb-3">
            <Link
              href={embedInAdmin ? "/admin" : "/"}
              className="text-[11px] text-muted transition hover:text-ink"
            >
              {embedInAdmin ? "← 管理概览" : "← 返回"}
            </Link>
            <div className="mt-1.5 text-[12px] font-medium leading-tight tracking-tight text-ink">
              {`${SITE_METADATA_DEFAULT_TITLE} Studio`}
            </div>
            <p className="mt-0.5 text-[9px] leading-snug text-muted/90">
              产品大脑 · 内部
            </p>
            {saveMessage ? (
              <p className="mt-1.5 text-[9px] leading-snug text-muted">
                {saveMessage}
              </p>
            ) : null}
          </div>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
            {docOrder.map((id) => {
              const doc = resolveStudioDocRow(id, extraDocMeta);
              if (!doc) return null;
              const active = id === activeId;
              const len = studioDocCharCount(documents[id] ?? "");
              const ord = formatStudioDocOrdinal(docOrder.indexOf(id) + 1);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveId(id)}
                  title={`${ord} · ${doc.labelEn} · ${doc.labelZh} — ${doc.remark}`}
                  className={`rounded-md px-2 py-1.5 text-left transition ${
                    active
                      ? "bg-canvas text-ink ring-1 ring-border"
                      : "text-muted hover:bg-canvas/70 hover:text-ink"
                  }`}
                >
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 truncate leading-snug">
                      <span className="select-none font-mono text-[10px] tabular-nums text-muted/90">
                        {ord}
                      </span>
                      <span className="text-[11px] font-semibold tracking-tight text-ink">
                        {" "}
                        {doc.labelEn}
                      </span>
                      <span className="text-[10px] font-normal text-muted/75">
                        {" "}
                        · {doc.labelZh}
                      </span>
                    </div>
                    <span
                      className="shrink-0 font-mono text-[9px] tabular-nums text-muted/70"
                      aria-label={`${len} 字符`}
                    >
                      {len}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 border-l border-border/60 pl-1.5 text-[9px] leading-snug text-muted/90">
                    {doc.remark}
                  </p>
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={addStudioDocument}
            className="mt-1.5 shrink-0 rounded-md border border-dashed border-border/80 bg-canvas/50 px-2 py-1.5 text-left text-[10px] font-medium text-muted transition hover:border-sand hover:text-ink"
          >
            + 新建文档
          </button>
          {(assistantHint || aiError) && (
            <div
              className="mt-2 shrink-0 px-1 pt-2 text-[10px] leading-snug"
              role="status"
            >
              {assistantHint ? (
                <p className="text-muted">{assistantHint}</p>
              ) : null}
              {aiError ? (
                <p className="mt-1 text-ink/90">错误：{aiError}</p>
              ) : null}
            </div>
          )}
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="调整左栏宽度"
          className="hidden shrink-0 cursor-col-resize border-x border-border/30 bg-transparent hover:bg-border/70 active:bg-border md:block"
          style={{
            width: RESIZER_WIDTH_PX,
            touchAction: "none",
          }}
          onPointerDown={beginResizeLeftDivider}
        />

        {/* 中：编辑区（勿用 min-w-0，否则窄屏下 flex-1 会被压成 0 宽 → 整页空白） */}
        <main className="flex min-h-0 min-w-[280px] shrink-0 flex-1 flex-col border-r border-border bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5">
            <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight text-ink">
              <span className="select-none font-mono text-[11px] tabular-nums text-muted">
                {activeDocOrdinal}
              </span>{" "}
              <span>{activeResolved?.labelEn}</span>
              <span className="text-muted"> · </span>
              <span className="font-normal text-muted">
                {activeResolved?.labelZh}
              </span>
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {docViewMode === "edit" ? (
                <span
                  className="font-mono text-[10px] tabular-nums text-muted"
                  aria-live="polite"
                >
                  {editingCharCount}
                </span>
              ) : null}
              <div className="inline-flex rounded-md border border-border bg-canvas p-px shadow-sm">
                <button
                  type="button"
                  onClick={() => setDocViewMode("edit")}
                  title="Markdown 源码"
                  className={`rounded-[5px] px-2 py-1 text-[11px] font-medium transition ${
                    docViewMode === "edit"
                      ? "bg-surface text-ink shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => setDocViewMode("read")}
                  title="排版阅读"
                  className={`rounded-[5px] px-2 py-1 text-[11px] font-medium transition ${
                    docViewMode === "read"
                      ? "bg-surface text-ink shadow-sm"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  阅读
                </button>
              </div>
              <button
                type="button"
                onClick={() => void persistDocuments()}
                title={`保存到 docs/${activeId}.md，并同步浏览器。${
                  lastSavedForActive
                    ? ` 上次保存：${lastSavedForActive.at.slice(0, 19).replace("T", " ")}，${studioDocCharCount(lastSavedForActive.body)} 字。`
                    : " 尚未有「已保存」快照。"
                }`}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-ink shadow-sm transition hover:border-sand"
              >
                保存
              </button>
            </div>
          </div>
          {activeResolved?.isExtra ? (
            <div className="flex flex-wrap items-end gap-2 border-b border-border/70 bg-surface/35 px-4 py-2">
              <label className="flex min-w-[5.5rem] flex-1 flex-col gap-0.5 text-[9px] text-muted">
                英文名
                <input
                  value={extraDocMeta[activeId]?.labelEn ?? ""}
                  onChange={(e) =>
                    patchActiveExtraMeta({ labelEn: e.target.value })
                  }
                  className="rounded border border-border bg-canvas px-1.5 py-1 text-[11px] text-ink outline-none focus:border-sand"
                  autoComplete="off"
                />
              </label>
              <label className="flex min-w-[5.5rem] flex-1 flex-col gap-0.5 text-[9px] text-muted">
                中文名
                <input
                  value={extraDocMeta[activeId]?.labelZh ?? ""}
                  onChange={(e) =>
                    patchActiveExtraMeta({ labelZh: e.target.value })
                  }
                  className="rounded border border-border bg-canvas px-1.5 py-1 text-[11px] text-ink outline-none focus:border-sand"
                  autoComplete="off"
                />
              </label>
              <label className="flex min-w-[8rem] flex-[2] flex-col gap-0.5 text-[9px] text-muted">
                左侧备注
                <input
                  value={extraDocMeta[activeId]?.remark ?? ""}
                  onChange={(e) =>
                    patchActiveExtraMeta({ remark: e.target.value })
                  }
                  className="rounded border border-border bg-canvas px-1.5 py-1 text-[11px] text-ink outline-none focus:border-sand"
                  placeholder="极简一句"
                  autoComplete="off"
                />
              </label>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col">
            {docViewMode === "edit" ? (
              <div className="flex min-h-0 flex-1 flex-col md:flex-row md:divide-x md:divide-border">
                <textarea
                  className="min-h-[32vh] w-full flex-1 resize-none bg-transparent px-4 py-5 font-mono text-[13px] leading-6 text-ink outline-none placeholder:text-muted/60 md:min-h-0 md:w-0 md:px-6"
                  spellCheck={false}
                  value={activeBody}
                  onChange={(e) =>
                    setDocuments((prev) => ({
                      ...prev,
                      [activeId]: e.target.value,
                    }))
                  }
                  onBlur={() => {
                    setDocHistoryBundle((prev) => {
                      const next = appendDocHistoryEntry(
                        prev,
                        activeId,
                        activeBody,
                        "autosave",
                      );
                      if (next === prev) return prev;
                      try {
                        localStorage.setItem(
                          STUDIO_DOC_HISTORY_STORAGE_KEY,
                          JSON.stringify(next),
                        );
                      } catch {
                        /* ignore */
                      }
                      return next;
                    });
                  }}
                  aria-label="Markdown editor"
                />
                <div className="flex min-h-[28vh] min-w-0 flex-1 flex-col border-t border-border md:min-h-0 md:border-t-0">
                  <p className="shrink-0 border-b border-border/60 bg-surface/45 px-4 py-1.5 text-[9px] font-medium uppercase tracking-wide text-muted md:px-6">
                    Markdown 预览
                  </p>
                  <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-canvas to-surface/30 px-4 py-4 md:px-6 md:py-5">
                    <StudioDocMarkdown content={activeBody} />
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-canvas to-surface/40 px-4 py-5 md:px-6 md:py-6"
                aria-label="文档阅读预览"
              >
                <StudioDocMarkdown content={activeBody} />
              </div>
            )}
          </div>
          <div className="border-t border-border px-4 py-1.5 text-[10px] leading-snug text-muted">
            <p>
              优先写入 Git 中的 <span className="font-mono">docs/</span>；失败时仍保留浏览器副本。
            </p>
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[10px] text-muted hover:text-ink/80">
                使用 next start 时写磁盘（可选）
              </summary>
              <p className="mt-1 text-[10px] leading-snug">
                在 <span className="font-mono">.env.local</span> 设置{" "}
                <span className="font-mono">STUDIO_ALLOW_DISK_SAVE=1</span> 与{" "}
                <span className="font-mono">STUDIO_WRITE_SECRET</span>
                ，将同一密钥填入下方并失焦保存；普通{" "}
                <span className="font-mono">npm run dev</span> 无需填写。
              </p>
              <input
                type="password"
                className="mt-1 w-full max-w-md rounded border border-border bg-canvas px-2 py-1 font-mono text-[10px] text-ink outline-none focus:border-sand"
                placeholder="STUDIO_WRITE_SECRET（仅存本机浏览器）"
                value={diskBearerDraft}
                onChange={(e) => setDiskBearerDraft(e.target.value)}
                onBlur={() => {
                  try {
                    const t = diskBearerDraft.trim();
                    if (t) {
                      localStorage.setItem(STUDIO_DISK_BEARER_STORAGE_KEY, t);
                    } else {
                      localStorage.removeItem(STUDIO_DISK_BEARER_STORAGE_KEY);
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                autoComplete="off"
              />
            </details>
          </div>

          <details className="group shrink-0 border-t border-border/50 bg-canvas/40 px-4 py-1">
            <summary className="cursor-pointer list-none py-0.5 text-[9px] text-muted/80 marker:content-none [&::-webkit-details-marker]:hidden hover:text-muted">
              <span className="tracking-wide">修订快照</span>
              {activeHistoryEntries.length > 0 ? (
                <span className="ml-1.5 font-mono tabular-nums text-muted/60">
                  {activeHistoryEntries.length}
                </span>
              ) : (
                <span className="ml-1 text-muted/50">（空）</span>
              )}
            </summary>
            <p className="mt-1 border-t border-border/30 pt-1 text-[8px] leading-snug text-muted/70">
              停顿约 2 秒或离开编辑区记「自动记录」；点保存记「已保存」。极少需要时点「恢复」。
            </p>
            <ul className="mt-1 max-h-28 space-y-px overflow-y-auto pb-1 font-mono text-[9px] leading-tight">
              {activeHistoryEntries.length === 0 ? (
                <li className="text-muted/60">暂无</li>
              ) : (
                activeHistoryEntries.map((e) => (
                  <li
                    key={e.entryId}
                    className="flex items-center gap-1.5 py-0.5 text-muted hover:bg-canvas/50"
                  >
                    <span className="shrink-0">
                      {e.at.slice(0, 16).replace("T", " ")}
                    </span>
                    <span
                      className={
                        e.source === "saved"
                          ? "shrink-0 text-ink/75"
                          : "shrink-0 text-muted/80"
                      }
                    >
                      {docHistorySourceLabel(e.source)}
                    </span>
                    <span className="min-w-0 shrink truncate text-muted/70">
                      {studioDocCharCount(e.body)}字
                    </span>
                    <button
                      type="button"
                      className="ml-auto shrink-0 rounded px-1 text-[9px] text-ink/80 underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => restoreDocHistoryEntry(e)}
                    >
                      恢复
                    </button>
                  </li>
                ))
              )}
            </ul>
          </details>
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
          onPointerDown={beginResizeRightDivider}
        />

        {/* 右：AI Discussion Panel */}
        <div
          className="flex min-h-0 shrink-0 flex-col self-stretch"
          style={{ width: rightColPx, minWidth: Math.min(rightColPx, 260) }}
        >
          <StudioAIDiscussionPanel
            activeDocId={activeId}
            activeTitleLine={discussionTitleLine}
            documents={documents}
            setDocuments={setDocuments}
            layoutMode="default"
            onEnterFocusOnly={() => setDiscussionFocusOnly(true)}
          />
        </div>
          </>
        )}
      </div>
    </div>
  );
}
