import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const R2 = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/";
const CUSTOM = "https://askbible-media.joshlabs.app/";

/** 模拟浏览器：localStorage + fetch。`blocked` 里的域一律当作被墙（请求直接失败）。 */
function fakeBrowser(blocked: string[], remoteList?: unknown) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      if (url === "/endpoints.json") {
        if (!remoteList) return { ok: false };
        return { ok: true, json: async () => remoteList };
      }
      if (blocked.some((h) => url.startsWith(h))) throw new TypeError("Failed to fetch");
      return { ok: true };
    }),
  );
  return store;
}

async function load() {
  vi.resetModules();
  return import("./index");
}

describe("防封换线：网页端候选域", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("服务端（没有 window）永远用内置表第一条", async () => {
    const m = await load();
    expect(m.endpointBase("media")).toBe(R2.slice(0, -1));
    expect(m.endpointDefaultBase("site")).toBe("https://askbible.me");
    expect(m.endpointDefaultBase("api")).toBe("https://tgobadhdylarhssudplc.supabase.co");
  });

  it("都通的时候取列表里最靠前的那条，并存进 localStorage", async () => {
    const store = fakeBrowser([]);
    const m = await load();
    await m.refreshEndpoints(true);
    expect(m.endpointBase("media")).toBe(R2.slice(0, -1));
    expect(JSON.parse(store.get("askbible-endpoint-host-v1")!).media).toBe(R2);
  });

  it("第一条被墙就换到第二条，通知订阅者，下次启动直接用缓存", async () => {
    const store = fakeBrowser([R2]);
    const m = await load();
    const onChange = vi.fn();
    m.subscribeEndpoints(onChange);
    await m.refreshEndpoints(true);
    expect(m.endpointBase("media")).toBe(CUSTOM.slice(0, -1));
    expect(onChange).toHaveBeenCalled();
    expect(m.rebaseMediaUrl(`${R2}downloads/android/AskBible-latest.apk`)).toBe(`${CUSTOM}downloads/android/AskBible-latest.apk`);

    // 「下次启动」：重新加载模块，不探测也该直接读到缓存的线路
    const saved = new Map(store);
    fakeBrowser([R2]);
    (window as unknown as { localStorage: { getItem: (k: string) => string | null } }).localStorage.getItem = (k) =>
      saved.get(k) ?? null;
    const again = await load();
    expect(again.endpointBase("media")).toBe(CUSTOM.slice(0, -1));
  });

  it("全挂就保持原样", async () => {
    fakeBrowser([R2, CUSTOM]);
    const m = await load();
    await m.refreshEndpoints(true);
    expect(m.endpointBase("media")).toBe(R2.slice(0, -1));
  });

  it("线上候选表排在内置表前面；线上表写坏了内置表兜底", async () => {
    const NEW = "https://media-new.example.org/";
    fakeBrowser([], { roles: { media: { candidates: [NEW, "not-a-url"] } } });
    const m = await load();
    await m.refreshEndpoints(true);
    expect(m.endpointCandidates("media")).toEqual([NEW, R2, CUSTOM]);
    expect(m.endpointBase("media")).toBe(NEW.slice(0, -1));

    fakeBrowser([NEW], { roles: { media: { candidates: [NEW] } } });
    const m2 = await load();
    await m2.refreshEndpoints(true);
    expect(m2.endpointBase("media")).toBe(R2.slice(0, -1));
  });

  it("不是 media 候选域的地址不动", async () => {
    const m = await load();
    expect(m.rebaseMediaUrl("https://apps.apple.com/app/id6771996188")).toBe("https://apps.apple.com/app/id6771996188");
  });
});
