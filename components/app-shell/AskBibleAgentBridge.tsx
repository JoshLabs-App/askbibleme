"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { readStoredAskbibleWebSession } from "@/lib/askbible-web-auth-client";
import { buildEntryLink, resolveBook } from "@/lib/ai/askbible-ai-catalog.mjs";

type McpProposal = {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  summary: string;
  sourceAgent: string;
  status: string;
  createdAt: string;
};

type ModelContextTool = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (args?: Record<string, unknown>) => Promise<unknown> | unknown;
};

type NavigatorWithModelContext = Navigator & {
  modelContext?: {
    registerTool?: (tool: ModelContextTool) => void;
    unregisterTool?: (name: string) => void;
  };
};

type AskBibleWindowAgent = {
  version: string;
  getState: () => {
    pathname: string;
    playingMusic: boolean;
    signedIn: boolean;
    pendingProposalsCount: number;
  };
  navigateToPassage: (opts: {
    book: string;
    chapter: number;
    verses?: string;
    translation?: string;
    audio?: "quiet" | "off";
  }) => { ok: boolean; url?: string; error?: string };
  setQuietMusic: (enabled: boolean) => { ok: boolean; playing: boolean };
  playScriptureChapter: (opts: { book: string; chapter: number; translation?: string }) => Promise<{ ok: boolean; error?: string }>;
  listPendingProposals: () => Promise<McpProposal[]>;
  approveProposal: (id: string) => Promise<{ ok: boolean; error?: string }>;
  rejectProposal: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

declare global {
  interface Window {
    __ASKBIBLE_AGENT__?: AskBibleWindowAgent;
  }
}

export function AskBibleAgentBridge() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user } = useAskbibleUser();
  const music = useMusicShellPlayback();
  const [proposals, setProposals] = useState<McpProposal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const handledQueryRef = useRef<string>("");

  const fetchPendingProposals = useCallback(async (): Promise<McpProposal[]> => {
    const session = readStoredAskbibleWebSession();
    if (!session?.sessionToken) {
      setProposals([]);
      return [];
    }
    try {
      const res = await fetch("/api/sync/v1/mcp/proposals?status=pending", {
        headers: { Authorization: `Bearer ${session.sessionToken}` },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = (await res.json().catch(() => null)) as { ok?: boolean; proposals?: McpProposal[] } | null;
      const list = Array.isArray(data?.proposals) ? data.proposals : [];
      setProposals(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const resolveProposal = useCallback(async (id: string, decision: "approve" | "reject") => {
    const session = readStoredAskbibleWebSession();
    if (!session?.sessionToken) return { ok: false, error: "not_signed_in" };
    setBusyId(id);
    try {
      const res = await fetch(`/api/sync/v1/mcp/proposals/${encodeURIComponent(id)}/${decision}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.sessionToken}` },
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setProposals((prev) => prev.filter((p) => p.id !== id));
        return { ok: true };
      }
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      setBusyId(null);
    }
  }, []);

  // 1. 登录后静默检查待确认的外部 AI 提案（无提案时不渲染任何 UI）
  useEffect(() => {
    if (!user) {
      setProposals([]);
      return;
    }
    void fetchPendingProposals();
  }, [user, pathname, fetchPendingProposals]);

  // 2. 语义深链状态接管：处理 ?audio=quiet&autoplay=1 / ?audio=off 与 ?v=<verse>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `${pathname}${window.location.search}`;
    if (handledQueryRef.current === key) return;
    handledQueryRef.current = key;

    const params = new URLSearchParams(window.location.search);
    const audioParam = params.get("audio");
    const autoplayParam = params.get("autoplay");
    if (audioParam === "quiet" && autoplayParam === "1" && !music.playing && music.canPlayMusic) {
      music.togglePlayMusic();
    } else if (audioParam === "off" && music.playing) {
      music.pausePlayback();
    }

    const vParam = params.get("v");
    if (vParam) {
      const firstVerse = Number(String(vParam).split(/[-–—~:]/)[0]);
      if (Number.isInteger(firstVerse) && firstVerse >= 1) {
        window.setTimeout(() => {
          const el =
            document.getElementById(`v${firstVerse}`) ||
            document.querySelector(`[data-verse="${firstVerse}"]`);
          if (el && typeof el.scrollIntoView === "function") {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 350);
      }
    }
  }, [pathname, music]);

  // 3. 暴露 window.__ASKBIBLE_AGENT__ 与浏览器原生 WebMCP (navigator.modelContext)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const agent: AskBibleWindowAgent = {
      version: "1.0.0",
      getState: () => ({
        pathname,
        playingMusic: music.playing,
        signedIn: Boolean(user),
        pendingProposalsCount: proposals.length,
      }),
      navigateToPassage: ({ book, chapter, verses, translation, audio }) => {
        const link = buildEntryLink({
          bookId: book,
          chapter,
          verse: verses,
          translation,
          audio,
          origin: window.location.origin,
        });
        if (!link) return { ok: false, error: "invalid_passage" };
        const relative = link.webUrl.replace(window.location.origin, "");
        router.push(relative);
        return { ok: true, url: link.webUrl };
      },
      setQuietMusic: (enabled) => {
        if (enabled && !music.playing && music.canPlayMusic) {
          music.togglePlayMusic();
        } else if (!enabled && music.playing) {
          music.pausePlayback();
        }
        return { ok: true, playing: enabled };
      },
      playScriptureChapter: async ({ book, chapter, translation }) => {
        const resolved = resolveBook(book);
        if (!resolved || !Number.isInteger(chapter) || chapter < 1 || chapter > resolved.chapters) {
          return { ok: false, error: "invalid_passage" };
        }
        await music.playScriptureChapter({
          bookId: resolved.id,
          chapter,
          bookName: resolved.zh,
          translationId: translation,
        });
        return { ok: true };
      },
      listPendingProposals: fetchPendingProposals,
      approveProposal: (id) => resolveProposal(id, "approve"),
      rejectProposal: (id) => resolveProposal(id, "reject"),
    };

    window.__ASKBIBLE_AGENT__ = agent;

    const nav = navigator as NavigatorWithModelContext;
    const registered: string[] = [];
    if (nav.modelContext?.registerTool) {
      const webMcpTools: ModelContextTool[] = [
        {
          name: "askbible_get_state",
          description: "获取当前 AskBible.me 页面路径、安静伴读音乐播放状态与待确认提案数。",
          execute: () => agent.getState(),
        },
        {
          name: "askbible_navigate_passage",
          description: "在当前 AskBible.me 页面导航到指定书卷与章节（可选节号、译本与安静背景音乐）。",
          inputSchema: {
            type: "object",
            properties: {
              book: { type: "string" },
              chapter: { type: "integer" },
              verses: { type: "string" },
              translation: { type: "string" },
              audio: { type: "string", enum: ["quiet", "off"] },
            },
            required: ["book", "chapter"],
          },
          execute: (args) =>
            agent.navigateToPassage({
              book: String(args?.book || ""),
              chapter: Number(args?.chapter || 1),
              verses: args?.verses ? String(args.verses) : undefined,
              translation: args?.translation ? String(args.translation) : undefined,
              audio: args?.audio === "quiet" || args?.audio === "off" ? args.audio : undefined,
            }),
        },
        {
          name: "askbible_set_quiet_music",
          description: "开启或暂停 AskBible.me 的「安静」伴读背景音乐。",
          inputSchema: {
            type: "object",
            properties: { enabled: { type: "boolean" } },
            required: ["enabled"],
          },
          execute: (args) => agent.setQuietMusic(Boolean(args?.enabled)),
        },
      ];
      for (const tool of webMcpTools) {
        try {
          nav.modelContext.registerTool(tool);
          registered.push(tool.name);
        } catch {
          // 忽略不支持的浏览器实验实现
        }
      }
    }

    return () => {
      if (nav.modelContext?.unregisterTool) {
        for (const name of registered) {
          try {
            nav.modelContext.unregisterTool(name);
          } catch {
            // ignore
          }
        }
      }
    };
  }, [pathname, music, user, proposals.length, router, fetchPendingProposals, resolveProposal]);

  if (proposals.length === 0) return null;

  const head = proposals[0];
  const isBusy = busyId === head.id;

  return (
    <aside
      aria-label="外部 AI 读经建议确认"
      className="fixed bottom-20 left-1/2 z-40 flex w-[min(92vw,440px)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--ink)] shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{head.summary}</div>
        <div className="truncate text-xs text-[var(--muted)]">
          来自 {head.sourceAgent}
          {proposals.length > 1 ? ` · 另有 ${proposals.length - 1} 条待确认` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void resolveProposal(head.id, "reject")}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          忽略
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void resolveProposal(head.id, "approve")}
          className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--surface)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          确认
        </button>
      </div>
    </aside>
  );
}
