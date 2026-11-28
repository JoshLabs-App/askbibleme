import { loadStaticScriptureChapterVerses } from "@/lib/bible/load-static-scripture-chapter";
import { readPublicAssetText } from "@/lib/read-public-asset";
import type { McpDataProvider } from "@/lib/ai/askbible-mcp-core.mjs";

const SYNC_UPSTREAM_ORIGIN = "https://sync.askbible.me";

type SyncFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

async function getSyncBinding(): Promise<SyncFetcher | null> {
  try {
    const mod = await import(/* webpackIgnore: true */ "cloudflare:workers");
    const binding = mod.env?.ASKBIBLE_SYNC;
    return binding && typeof binding.fetch === "function" ? binding : null;
  } catch {
    return null;
  }
}

let cachedFigures: Array<Record<string, unknown>> | null = null;

export function createWebMcpProvider(cwd = process.cwd()): McpDataProvider {
  return {
    async loadChapter(translationId: string, bookId: string, chapter: number) {
      const verses = await loadStaticScriptureChapterVerses(cwd, translationId, bookId, chapter);
      if (!verses || verses.length === 0) return null;
      return verses.map((v) => ({ verse: v.verse, text: v.text }));
    },

    async loadReadingPlan(planId: string) {
      const safeId = String(planId || "").replace(/[^a-z0-9_-]/gi, "");
      if (!safeId) return null;
      const raw = await readPublicAssetText(`/data/bible-reading-plans/${safeId}.json`, cwd);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    async loadFigures() {
      if (cachedFigures) return cachedFigures;
      const raw = await readPublicAssetText("/data/static-bundles/legacy-figure-preview.json", cwd);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as { profiles?: Array<Record<string, unknown>> };
        cachedFigures = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
        return cachedFigures;
      } catch {
        return [];
      }
    },

    async callSyncApi(path: string, init?: { method?: string; token?: string; body?: unknown }) {
      const target = `${SYNC_UPSTREAM_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
      const headers = new Headers({
        "Content-Type": "application/json",
        "User-Agent": "AskBibleRemoteMCP/1.0",
      });
      if (init?.token) {
        headers.set("Authorization", `Bearer ${init.token}`);
      }
      const method = init?.method || "GET";
      const body = init?.body !== undefined && method !== "GET" ? JSON.stringify(init.body) : undefined;
      const binding = await getSyncBinding();
      const res = binding
        ? await binding.fetch(new Request(target, { method, headers, body }))
        : await fetch(target, { method, headers, body });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      return { ok: res.ok, status: res.status, data };
    },
  };
}
