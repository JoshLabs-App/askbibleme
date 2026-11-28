// AskBible.me D-47 静态内核 · WebMCP 与语义深链代理桥
// 暴露轻量只读状态与安全导航，保持界面安静不侵入。

type KernelAgentOptions = {
  getRoutePath: () => string;
  getTranslationId: () => string;
  navigate: (path: string) => void;
  setTranslationId: (id: string) => void;
};

type NavigatorWithModelContext = Navigator & {
  modelContext?: {
    registerTool?: (tool: {
      name: string;
      description: string;
      inputSchema?: Record<string, unknown>;
      execute: (args?: Record<string, unknown>) => unknown;
    }) => void;
    unregisterTool?: (name: string) => void;
  };
};

export function registerKernelAgentBridge(opts: KernelAgentOptions): () => void {
  if (typeof window === "undefined") return () => {};

  const bridge = {
    version: "1.0.0",
    getState: () => ({
      routePath: opts.getRoutePath(),
      translationId: opts.getTranslationId(),
    }),
    navigateToPassage: (bookId: string, chapter: number, translationId?: string) => {
      const cleanBook = String(bookId || "").trim().toUpperCase();
      const ch = Number(chapter);
      if (!/^[A-Z0-9]{2,6}$/.test(cleanBook) || !Number.isInteger(ch) || ch < 1) {
        return { ok: false, error: "invalid_passage" };
      }
      if (translationId && translationId.trim()) {
        opts.setTranslationId(translationId.trim());
      }
      opts.navigate(`/read/${cleanBook}/${ch}`);
      return { ok: true, routePath: `/read/${cleanBook}/${ch}` };
    },
  };

  (window as unknown as { __ASKBIBLE_AGENT__?: typeof bridge }).__ASKBIBLE_AGENT__ = bridge;

  const nav = navigator as NavigatorWithModelContext;
  const registered: string[] = [];
  if (nav.modelContext?.registerTool) {
    try {
      nav.modelContext.registerTool({
        name: "askbible_kernel_navigate",
        description: "在 AskBible.me 离线内核中导航到指定经文章节。",
        inputSchema: {
          type: "object",
          properties: {
            bookId: { type: "string" },
            chapter: { type: "integer" },
            translationId: { type: "string" },
          },
          required: ["bookId", "chapter"],
        },
        execute: (args) =>
          bridge.navigateToPassage(
            String(args?.bookId || ""),
            Number(args?.chapter || 1),
            args?.translationId ? String(args.translationId) : undefined,
          ),
      });
      registered.push("askbible_kernel_navigate");
    } catch {
      // ignore unsupported implementations
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
}
