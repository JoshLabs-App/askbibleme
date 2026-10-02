// AskBible · Supabase 反代（防封换线，见 docs/anti-block-endpoints.md、DECISIONS D-20）
//
// 免费版 Supabase 不能绑自定义域，`*.supabase.co` 被干扰时登录 / 会员同步全挂
// （2026-10-01 国内实测 24 个节点里 5 个移动节点已经连不上）。这个 Worker 是放在前面的自家入口：
// 路径、查询串、方法、请求体、头全部原样转给 Supabase，回来的也原样返回。
//
// 客户端不直接写这个地址，而是把它当作 `api` 角色的一个候选域（data/endpoints.json）。
// 照抄自听到 `03MyClass/workers/supabase-proxy/`，同一个 Supabase 项目，各部署各的。
//
// ⚠️ 只认自定义域 `askbible-sb.joshlabs.app`：`*.workers.dev` 在国内整段不通（实测 0/24）。
//
// 部署：cd workers/supabase-proxy && npx wrangler deploy

const UPSTREAM = "https://tgobadhdylarhssudplc.supabase.co";

// 浏览器端要跨域访问，所以自己答 CORS。会话 token 走 Authorization 头不走 cookie，可以放 `*`。
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, accept, accept-profile, content-profile, prefer, range, x-client-info, x-supabase-api-version",
  "Access-Control-Expose-Headers": "content-range, content-length, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 候选域探测用。探测只看「有没有 HTTP 响应」，给一个明确的 200 更省事。
    if (url.pathname === "/healthz.txt") {
      return new Response("ok\n", { headers: { "content-type": "text/plain", ...CORS } });
    }

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const target = new URL(url.pathname + url.search, UPSTREAM);
    const headers = new Headers(request.headers);
    // Host 交给 fetch 自己按目标域填；cf-* / x-forwarded-* 是边缘加的，不转。
    headers.delete("host");
    for (const k of [...headers.keys()]) {
      if (k.startsWith("cf-") || k.startsWith("x-forwarded-")) headers.delete(k);
    }

    let upstream;
    try {
      upstream = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        // OAuth 的 /auth/v1/authorize 靠 302 把用户送去 Google，不能替客户端跟。
        redirect: "manual",
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: `upstream unreachable: ${e}` }), {
        status: 502,
        headers: { "content-type": "application/json", ...CORS },
      });
    }

    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(CORS)) out.set(k, v);
    // 上游把 Location 指回 supabase.co 的话，客户端就绕过反代了，改写回本入口。
    const loc = out.get("location");
    if (loc && loc.startsWith(UPSTREAM)) out.set("location", url.origin + loc.slice(UPSTREAM.length));

    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
  },
};
