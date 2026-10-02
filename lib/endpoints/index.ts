/**
 * 防封换线（docs/anti-block-endpoints.md、DECISIONS D-20）：网页端的候选域入口。
 *
 * 真源是 `data/endpoints.json`（直接 import，不经生成）。每个角色一组候选域，浏览器里并发探测，
 * 取**列表里最靠前**那条通的并存进 localStorage；候选表本身从本站 `/endpoints.json` 更新。
 * 三端同一套：iOS `Endpoints.swift`、安卓 `Endpoints.kt`。照听到 `endpoints.js` 改的。
 *
 * 服务端渲染永远用内置表第一条（和老行为一致）；浏览器里要在渲染中用的地方走
 * `useEndpointBase()`（先用服务端那个值水合，挂载后再换），不要在渲染里直接调 `endpointBase()`。
 */
import endpointsData from "@/data/endpoints.json";

export type EndpointRole = "media" | "site" | "api";

const withSlash = (s: unknown): string => {
  const t = String(s ?? "").trim();
  return t ? t.replace(/\/*$/, "/") : "";
};
const noSlash = (s: string): string => s.replace(/\/+$/, "");

const BUILTIN: Record<EndpointRole, string[]> = {
  media: endpointsData.roles.media.candidates.map(withSlash),
  site: endpointsData.roles.site.candidates.map(withSlash),
  api: endpointsData.roles.api.candidates.map(withSlash),
};

/**
 * 网页端要探测的角色。`site` 就是本站自己（页面能打开就说明它通），不用探；
 * `api` 是浏览器端 Supabase 的入口（lib/supabase/browser.ts）。
 */
const PROBED_ROLES: EndpointRole[] = ["media", "api"];

const HOST_KEY = "askbible-endpoint-host-v1"; // { media, api }：上次探通的
const LIST_KEY = "askbible-endpoint-list-v1"; // { media: [...] }：线上候选表
const PROBE = "healthz.txt";
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const isBrowser = typeof window !== "undefined";

function load<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式等：存不下就每次重探 */
  }
}

/** 候选顺序：线上列表（缓存下来的）→ 内置，去重。线上表写坏了也不至于把页面锁死。 */
export function endpointCandidates(role: EndpointRole): string[] {
  const remote = (load<Partial<Record<EndpointRole, string[]>>>(LIST_KEY, {})[role] ?? []).map(withSlash);
  return [...new Set([...remote, ...BUILTIN[role]].filter((h) => h.startsWith("https://")))];
}

/** 服务端和水合时用的值：内置表第一条，不带结尾斜杠 */
export function endpointDefaultBase(role: EndpointRole): string {
  return noSlash(BUILTIN[role][0]);
}

let chosen: Partial<Record<EndpointRole, string>> | null = null;
function state(): Partial<Record<EndpointRole, string>> {
  if (!chosen) chosen = isBrowser ? load<Partial<Record<EndpointRole, string>>>(HOST_KEY, {}) : {};
  return chosen;
}

/** 当前生效的域，不带结尾斜杠。事件回调 / effect 里用；渲染里用 `useEndpointBase()`。 */
export function endpointBase(role: EndpointRole): string {
  const h = withSlash(state()[role]);
  return h ? noSlash(h) : endpointDefaultBase(role);
}

/**
 * 把写死了某条 media 线路的绝对地址换到 `base` 上（APK 直链这类常量 / 数据）。
 * 不是 media 候选域的地址原样返回。
 */
export function rebaseMediaUrl(url: string, base: string = endpointBase("media")): string {
  for (const h of endpointCandidates("media")) {
    if (url.startsWith(h)) return `${noSlash(base)}/${url.slice(h.length)}`;
  }
  return url;
}

const listeners = new Set<() => void>();
export function subscribeEndpoints(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * 通不通只看「请求有没有被拒在网络层」：被墙表现为 DNS 失败 / TLS 重置 / 超时，而不是 404。
 * no-cors 拿到的是 opaque 响应，读不到状态码，但只要 resolve 就说明这个域能连上。
 */
async function probeHost(host: string): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    await fetch(host + PROBE, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** 并发探测，取**列表里最靠前**的那个通的（不是最快的：顺序稳定，不会每次刷新换来换去） */
async function pickHost(role: EndpointRole): Promise<string | null> {
  const list = endpointCandidates(role);
  if (!list.length) return null;
  const ok = await Promise.all(list.map(probeHost));
  const i = ok.indexOf(true);
  return i < 0 ? null : list[i];
}

let lastRefreshAt = 0;

/** 浏览器里挂载后、回到前台时调。`force` 为 false 时 10 分钟内不重复探。 */
export async function refreshEndpoints(force = false): Promise<void> {
  if (!isBrowser) return;
  const now = Date.now();
  if (!force && now - lastRefreshAt < REFRESH_INTERVAL_MS) return;
  lastRefreshAt = now;

  const apply = async () => {
    const next = { ...state() };
    let changed = false;
    for (const role of PROBED_ROLES) {
      const host = await pickHost(role);
      if (host && host !== next[role]) {
        next[role] = host;
        changed = true;
      }
    }
    if (changed) {
      chosen = next;
      save(HOST_KEY, next);
      listeners.forEach((fn) => fn());
    }
  };

  await apply();
  try {
    const res = await fetch("/endpoints.json", { cache: "no-cache" });
    if (!res.ok) return;
    const roles = ((await res.json()) as { roles?: Record<string, { candidates?: unknown }> }).roles ?? {};
    const list: Partial<Record<EndpointRole, string[]>> = {};
    for (const role of Object.keys(BUILTIN) as EndpointRole[]) {
      const c = roles[role]?.candidates;
      if (Array.isArray(c) && c.length) list[role] = c.map(withSlash).filter((h) => h.startsWith("https://"));
    }
    if (Object.keys(list).length) {
      save(LIST_KEY, list);
      await apply(); // 新列表可能引入更靠前的候选，再挑一次
    }
  } catch {
    /* 拉不到候选表：继续用手上的 */
  }
}
