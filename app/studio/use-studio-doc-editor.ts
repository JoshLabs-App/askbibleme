"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STUDIO_DISK_BEARER_STORAGE_KEY,
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
  emptyDocHistoryBundle,
  parseDocHistoryBundle,
  studioDocCharCount,
  STUDIO_DOC_HISTORY_STORAGE_KEY,
  type DocHistoryBundle,
  type DocHistoryEntry,
} from "@/lib/studio-doc-history";

/** 中间栏「编辑 | 阅读」偏好（仅存本机） */
const STUDIO_DOC_VIEW_STORAGE_KEY = "askbible-studio-doc-view-v1";

export function useStudioDocEditor(initialDocuments: Record<string, string>) {
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
  const [diskBearerDraft, setDiskBearerDraft] = useState("");
  const [docHistoryBundle, setDocHistoryBundle] = useState<DocHistoryBundle>(
    () => emptyDocHistoryBundle(),
  );
  /** 中间文档：源码编辑 vs 格式化阅读 */
  const [docViewMode, setDocViewMode] = useState<"edit" | "read">("read");
  /** 首屏已从 localStorage 合并文档与清单后再写入 manifest，避免用初始空清单覆盖 */
  const [studioManifestReady, setStudioManifestReady] = useState(false);

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
        localStorage.setItem(
          STUDIO_DOC_HISTORY_STORAGE_KEY,
          JSON.stringify(next),
        );
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

  /** 展示在 AI Discussion 顶部的当前文档一行 */
  const discussionTitleLine = useMemo(() => {
    const row = activeResolved;
    if (!row) return "";
    return `${activeDocOrdinal} · ${row.labelEn} · ${row.labelZh}`;
  }, [activeResolved, activeDocOrdinal]);

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

  const recordAutosaveSnapshot = useCallback(() => {
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
  }, [activeId, activeBody]);

  /** 编辑停顿约 2 秒后自动记一条「自动记录」快照 */
  useEffect(() => {
    const timer = window.setTimeout(recordAutosaveSnapshot, 2000);
    return () => window.clearTimeout(timer);
  }, [recordAutosaveSnapshot]);

  const restoreDocHistoryEntry = useCallback((entry: DocHistoryEntry) => {
    const n = studioDocCharCount(entry.body);
    if (!window.confirm(`恢复到此版本？（${n} 字符）`)) return;
    setActiveId(entry.docId);
    setDocuments((prev) => ({ ...prev, [entry.docId]: entry.body }));
  }, []);

  const persistDiskBearerOnBlur = useCallback(() => {
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
  }, [diskBearerDraft]);

  return {
    documents,
    setDocuments,
    docOrder,
    extraDocMeta,
    activeId,
    setActiveId,
    saveMessage,
    diskBearerDraft,
    setDiskBearerDraft,
    persistDiskBearerOnBlur,
    docViewMode,
    setDocViewMode,
    activeBody,
    activeResolved,
    activeDocOrdinal,
    discussionTitleLine,
    editingCharCount,
    activeHistoryEntries,
    lastSavedForActive,
    persistDocuments,
    addStudioDocument,
    patchActiveExtraMeta,
    recordAutosaveSnapshot,
    restoreDocHistoryEntry,
  };
}
