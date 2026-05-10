import { ollamaTagsUrlFromChatBaseUrl } from "./ollama-url";
import {
  entryFromScanParts,
  type LocalModelScanEntry,
} from "./model-notes";

export type { LocalModelScanEntry } from "./model-notes";

type OllamaTagsResponse = {
  models?: { name?: string; size?: number }[];
};
type OpenAIModelsResponse = { data?: { id?: string }[] };

export async function fetchOllamaScanEntries(
  chatBaseUrl: string,
  ms: number,
): Promise<LocalModelScanEntry[] | null> {
  const tagsUrl = ollamaTagsUrlFromChatBaseUrl(chatBaseUrl);
  const res = await fetch(tagsUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as OllamaTagsResponse;
  const out: LocalModelScanEntry[] = [];
  for (const m of data.models ?? []) {
    const name = m.name?.trim();
    if (!name) continue;
    out.push(entryFromScanParts(name, m.size));
  }
  return out.length > 0 ? out : null;
}

/** @deprecated 优先用 fetchOllamaScanEntries（含体积与备注） */
export async function fetchOllamaTagNames(
  chatBaseUrl: string,
  ms: number,
): Promise<string[] | null> {
  const entries = await fetchOllamaScanEntries(chatBaseUrl, ms);
  return entries?.map((e) => e.name) ?? null;
}

export async function fetchOpenAICompatibleModelIds(
  chatBaseUrl: string,
  ms: number,
): Promise<string[] | null> {
  const root = chatBaseUrl.trim().replace(/\/$/, "");
  if (!root) return null;
  const res = await fetch(`${root}/models`, {
    cache: "no-store",
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as OpenAIModelsResponse;
  return (data.data ?? [])
    .map((d) => d.id?.trim())
    .filter((n): n is string => Boolean(n));
}

export async function fetchOpenAICompatibleScanEntries(
  chatBaseUrl: string,
  ms: number,
): Promise<LocalModelScanEntry[] | null> {
  const ids = await fetchOpenAICompatibleModelIds(chatBaseUrl, ms);
  if (!ids || ids.length === 0) return null;
  return ids.map((name) => entryFromScanParts(name));
}

/** 先试 Ollama tags（含 size），再试 OpenAI /models */
export async function listLocalModelsAuto(
  baseUrl: string,
  ms = 10_000,
): Promise<
  | { ok: true; entries: LocalModelScanEntry[]; source: "ollama" | "openai" }
  | { ok: false; error: string }
> {
  const fromOllama = await fetchOllamaScanEntries(baseUrl, ms);
  if (fromOllama && fromOllama.length > 0) {
    return { ok: true, entries: fromOllama, source: "ollama" };
  }
  const fromOpenAI = await fetchOpenAICompatibleScanEntries(baseUrl, ms);
  if (fromOpenAI && fromOpenAI.length > 0) {
    return { ok: true, entries: fromOpenAI, source: "openai" };
  }
  return {
    ok: false,
    error:
      "未从该地址读到模型：既不是可访问的 Ollama（/api/tags），也不支持 OpenAI 兼容的 /models。",
  };
}
