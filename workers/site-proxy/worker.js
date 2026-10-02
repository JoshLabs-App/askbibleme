// AskBible · 主站接口反代（防封换线，见 docs/anti-block-endpoints.md、DECISIONS D-20）
//
// App 要调主站的几个接口（在线译本目录 / 章节 / 书名、章节朗读地址解析、注销账号）。
// `askbible.me` 被封时这些全断，而且主站在 Vercel，换 IP 这条路我们控制不了。
// 这个 Worker 是另一条线：走 Cloudflare 的边缘，再由边缘去取 askbible.me。
//
// 客户端把它当作 `site` 角色的一个候选域（data/endpoints.json），askbible.me 通的时候不会走这里。
//
// 只放行 App 用的接口前缀，不做整站镜像：网页带 cookie 登录和整页跳转，
// 换了域名会牵出一串回跳 / cookie 域的问题，那是「网页备用入口」的事，不在这里做。
//
// ⚠️ 只认自定义域 `askbible-site.joshlabs.app`：`*.workers.dev` 在国内整段不通（2026-10-01 实测 0/24）。
//
// 部署：cd workers/site-proxy && npx wrangler deploy

const UPSTREAM = "https://askbible.me";
const ALLOW_PREFIXES = ["/api/mobile/", "/api/read/"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, range",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz.txt") {
      return new Response("ok\n", { headers: { "content-type": "text/plain", ...CORS } });
    }

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (!ALLOW_PREFIXES.some((p) => url.pathname.startsWith(p))) {
      return new Response("not found\n", { status: 404, headers: { "content-type": "text/plain", ...CORS } });
    }

    const target = new URL(url.pathname + url.search, UPSTREAM);
    const headers = new Headers(request.headers);
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
        // 主站把 6 个纯配置接口 307 到 R2（next.config.mjs），原样交还给客户端自己跟，
        // 不替它取——R2 那边客户端有自己的候选域。
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
    // 上游把 Location 指回 askbible.me 的话，客户端就绕过反代了，改写回本入口。
    const loc = out.get("location");
    if (loc && loc.startsWith(UPSTREAM)) out.set("location", url.origin + loc.slice(UPSTREAM.length));

    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
  },
};
