import { createBrowserClient } from "@supabase/ssr";
import { endpointBase, endpointDefaultBase } from "@/lib/endpoints";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

type BrowserClient = ReturnType<typeof createBrowserClient>;

/** 每个入口一个客户端：`createBrowserClient` 只认建实例时的地址，线路换了要重建 */
const clients = new Map<string, BrowserClient>();

/**
 * 会话 cookie 名：按**官方入口**的域名推（`sb-<项目 ref>-auth-token`），和服务端 `createServerClient` 推出来的一致。
 * 必须钉死——supabase-js 默认按当前入口的域名推这个名字，换到反代入口就会换名，
 * 用户看起来被登出，服务端也读不到会话。
 */
function sessionCookieName(officialUrl: string): string {
  return `sb-${new URL(officialUrl).hostname.split(".")[0]}-auth-token`;
}

/**
 * 浏览器端 Supabase 客户端。入口走 `api` 角色的当前线路（防封换线，lib/endpoints）：
 * 正常直连 supabase.co，连不上时换到自家反代。环境变量配的不是候选表里那个项目时（本地调别的库）不换线。
 *
 * 已知边界：Google / Apple 网页登录的回跳地址是 supabase.co 自己的，反代管不着；
 * supabase.co 连不上时网页只有邮箱密码登录能用。
 */
export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  const official = url.replace(/\/+$/, "");
  const base = official === endpointDefaultBase("api") ? endpointBase("api") : official;

  let client = clients.get(base);
  if (!client) {
    client = createBrowserClient(base, anonKey, {
      isSingleton: false,
      cookieOptions: { name: sessionCookieName(official) },
    });
    clients.set(base, client);
  }
  return client;
}
