
/** 浏览器中每篇文档的修订快照 */
export const STUDIO_DOC_HISTORY_STORAGE_KEY = "askbible-studio-doc-history-v1";

export const STUDIO_DOC_HISTORY_MAX_PER_DOC = 80;

export type DocHistorySource = "autosave" | "saved";

export type DocHistoryEntry = {
  entryId: string;
  docId: string;
  at: string;
  source: DocHistorySource;
  body: string;
};

export type DocHistoryBundle = {
  version: 1;
  /** 各文档 id → 从新到旧 */
  byDoc: Partial<Record<string, DocHistoryEntry[]>>;
};

export function emptyDocHistoryBundle(): DocHistoryBundle {
  return { version: 1, byDoc: {} };
}

/** 与常见编辑器一致：按 UTF-16 码元计（中英文混合足够用） */
export function studioDocCharCount(text: string): number {
  return text.length;
}

export function docHistorySourceLabel(source: DocHistorySource): string {
  return source === "saved" ? "已保存" : "自动记录";
}

export function appendDocHistoryEntry(
  bundle: DocHistoryBundle,
  docId: string,
  body: string,
  source: DocHistorySource,
): DocHistoryBundle {
  const prevList = bundle.byDoc[docId] ?? [];
  const last = prevList[0];
  if (last && last.body === body && last.source === source) {
    return bundle;
  }
  const entry: DocHistoryEntry = {
    entryId: crypto.randomUUID(),
    docId,
    at: new Date().toISOString(),
    source,
    body,
  };
  const nextList = [entry, ...prevList].slice(0, STUDIO_DOC_HISTORY_MAX_PER_DOC);
  return {
    version: 1,
    byDoc: { ...bundle.byDoc, [docId]: nextList },
  };
}

/** 保存到磁盘成功后：为每篇文档记一条「已保存」快照（正文与上次相同则跳过） */
export function appendSavedSnapshotForAllDocs(
  bundle: DocHistoryBundle,
  documents: Record<string, string>,
  orderedDocIds: string[],
): DocHistoryBundle {
  let next = bundle;
  for (const id of orderedDocIds) {
    if (!(id in documents)) continue;
    const body = documents[id] ?? "";
    next = appendDocHistoryEntry(next, id, body, "saved");
  }
  return next;
}

export function parseDocHistoryBundle(raw: string | null): DocHistoryBundle {
  if (!raw) return emptyDocHistoryBundle();
  try {
    const p = JSON.parse(raw) as DocHistoryBundle;
    if (p?.version !== 1 || typeof p.byDoc !== "object" || p.byDoc === null) {
      return emptyDocHistoryBundle();
    }
    return { version: 1, byDoc: { ...p.byDoc } };
  } catch {
    return emptyDocHistoryBundle();
  }
}
