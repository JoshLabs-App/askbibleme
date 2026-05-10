import { STUDIO_DOC_ENTRIES } from "./studio-config";

/** 附加文档元数据（仅存浏览器 manifest；正文在 STUDIO_STORAGE_KEY） */
export type StudioExtraDocMeta = {
  labelEn: string;
  labelZh: string;
  remark: string;
};

export type StudioDocManifest = {
  version: 1;
  /** 附加文档 id 顺序（内置十条始终在前，由 buildDocOrder 合成） */
  extraOrder: string[];
  extras: Record<string, StudioExtraDocMeta>;
};

export const STUDIO_DOC_MANIFEST_KEY = "askbible-studio-doc-manifest-v1";

export const STUDIO_EXTRA_ID_RE =
  /^ext-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUILTIN_IDS = STUDIO_DOC_ENTRIES.map((e) => e.id);

export function isExtraStudioDocId(id: string): boolean {
  return STUDIO_EXTRA_ID_RE.test(id);
}

export function makeExtraStudioDocId(): string {
  return `ext-${crypto.randomUUID()}`;
}

export function defaultExtraMeta(): StudioExtraDocMeta {
  return { labelEn: "Note", labelZh: "新文档", remark: "" };
}

export type StudioDocRow = {
  id: string;
  labelEn: string;
  labelZh: string;
  remark: string;
  isExtra: boolean;
};

export function resolveStudioDocRow(
  id: string,
  extras: Record<string, StudioExtraDocMeta>,
): StudioDocRow | null {
  const bi = STUDIO_DOC_ENTRIES.find((d) => d.id === id);
  if (bi) return { ...bi, isExtra: false };
  if (isExtraStudioDocId(id)) {
    const m = extras[id] ?? defaultExtraMeta();
    return {
      id,
      labelEn: m.labelEn,
      labelZh: m.labelZh,
      remark: m.remark,
      isExtra: true,
    };
  }
  return null;
}

export function buildDocOrder(manifest: StudioDocManifest): string[] {
  const out: string[] = [...BUILTIN_IDS];
  const seen = new Set(out);
  for (const id of manifest.extraOrder) {
    if (!isExtraStudioDocId(id) || seen.has(id)) continue;
    out.push(id);
    seen.add(id);
  }
  return out;
}

export function mergeOrderWithDocumentKeys(
  order: string[],
  documentKeys: string[],
): string[] {
  const seen = new Set(order);
  const next = [...order];
  for (const id of documentKeys) {
    if (!isExtraStudioDocId(id) || seen.has(id)) continue;
    next.push(id);
    seen.add(id);
  }
  return next;
}

export function parseStudioDocManifest(raw: string | null): StudioDocManifest {
  const empty: StudioDocManifest = {
    version: 1,
    extraOrder: [],
    extras: {},
  };
  if (!raw) return empty;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return empty;
    const extraOrder = Array.isArray((p as { extraOrder?: unknown }).extraOrder)
      ? (p as { extraOrder: unknown[] }).extraOrder.filter(
          (x): x is string => typeof x === "string" && isExtraStudioDocId(x),
        )
      : [];
    const rawExtras = (p as { extras?: unknown }).extras;
    const extras: Record<string, StudioExtraDocMeta> = {};
    if (
      rawExtras &&
      typeof rawExtras === "object" &&
      !Array.isArray(rawExtras)
    ) {
      for (const [k, v] of Object.entries(rawExtras)) {
        if (!isExtraStudioDocId(k)) continue;
        const o = v as Record<string, unknown>;
        extras[k] = {
          labelEn:
            typeof o.labelEn === "string" && o.labelEn.trim()
              ? o.labelEn.trim()
              : "Note",
          labelZh:
            typeof o.labelZh === "string" && o.labelZh.trim()
              ? o.labelZh.trim()
              : "新文档",
          remark: typeof o.remark === "string" ? o.remark : "",
        };
      }
    }
    return { version: 1, extraOrder, extras };
  } catch {
    return empty;
  }
}

export function formatStudioDocOrdinal(indexOneBased: number): string {
  if (indexOneBased < 1) return "00";
  if (indexOneBased < 100) return String(indexOneBased).padStart(2, "0");
  return String(indexOneBased);
}
