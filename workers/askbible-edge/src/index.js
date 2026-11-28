import { PRODUCT_NAME, resolveRouteMeta } from "./route-meta.js";

const NO_STORE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0, must-revalidate",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: NO_STORE_HEADERS });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function injectPageMeta(html, meta) {
  const title = escapeHtml(meta.title);
  const desc = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const summary = escapeHtml(meta.summary);

  const headTags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${PRODUCT_NAME}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${url}">`,
  ].join("\n    ");

  const noscriptBlock = `<noscript data-edge-seo="1"><main><h1>${title}</h1><p>${summary}</p></main></noscript>`;

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+[^>]*name=["']description["'][^>]*>/gi, "")
    .replace(/<meta\s+[^>]*property=["']og:(?:title|description|url|type|site_name)["'][^>]*>/gi, "")
    .replace(/<noscript\s+data-edge-seo=["']1["']>[\s\S]*?<\/noscript>/gi, "");

  out = /<\/head>/i.test(out)
    ? out.replace(/<\/head>/i, `    ${headTags}\n  </head>`)
    : `${headTags}\n${out}`;

  out = /<\/body>/i.test(out)
    ? out.replace(/<\/body>/i, `  ${noscriptBlock}\n  </body>`)
    : `${out}\n${noscriptBlock}`;

  return out;
}

function withCacheControl(res, cacheControl) {
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", cacheControl);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function handleAppBuild(env, origin) {
  if (env.ASSETS) {
    const manifestRes = await env.ASSETS.fetch(new Request(`${origin}/pack-manifest.json`));
    if (manifestRes.ok) {
      const manifest = await manifestRes.json().catch(() => null);
      if (manifest && typeof manifest === "object") {
        const bundleId = String(manifest.bundleId || manifest.id || "unknown");
        return jsonResponse({
          id: bundleId,
          bundleId,
          builtAt: String(manifest.builtAt || ""),
        });
      }
    }
    const buildRes = await env.ASSETS.fetch(new Request(`${origin}/app-build.json`));
    if (buildRes.ok) {
      const meta = await buildRes.json().catch(() => null);
      if (meta && typeof meta === "object") {
        const bundleId = String(meta.bundleId || meta.id || "unknown");
        return jsonResponse({
          id: bundleId,
          bundleId,
          builtAt: String(meta.builtAt || ""),
        });
      }
    }
  }
  return jsonResponse({ id: "unknown", bundleId: "unknown", builtAt: "" });
}

function isStaticAssetFile(pathname) {
  if (
    pathname === "/pack-manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/assets/")
  ) {
    return true;
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return /\.[a-z0-9]{1,12}$/i.test(lastSegment) && !/\.html?$/i.test(lastSegment);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. 构建与发布探活元信息
    if ((request.method === "GET" || request.method === "HEAD") && (pathname === "/api/app-build" || pathname === "/app-build.json")) {
      return handleAppBuild(env, url.origin);
    }

    // 2. 透传会员认证与多端同步至 askbible-sync Service Binding
    if (
      pathname === "/api/sync" ||
      pathname.startsWith("/api/sync/") ||
      pathname === "/api/auth" ||
      pathname.startsWith("/api/auth/")
    ) {
      if (!env.ASKBIBLE_SYNC || typeof env.ASKBIBLE_SYNC.fetch !== "function") {
        return jsonResponse({ ok: false, error: "ASKBIBLE_SYNC binding unavailable" }, 503);
      }
      return env.ASKBIBLE_SYNC.fetch(request);
    }

    // 未知 API 路由返回 404 JSON，避免回落到 HTML
    if (pathname.startsWith("/api/")) {
      return jsonResponse({ ok: false, error: "Not Found" }, 404);
    }

    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("ASSETS binding unavailable", { status: 503 });
    }

    // 3. 静态资源直出与分级缓存
    if (isStaticAssetFile(pathname)) {
      const assetRes = await env.ASSETS.fetch(request);
      if (!assetRes.ok) return assetRes;

      if (pathname === "/pack-manifest.json" || pathname === "/sw.js") {
        return withCacheControl(assetRes, "no-cache");
      }
      if (pathname.startsWith("/assets/")) {
        return withCacheControl(assetRes, "public, max-age=31536000, immutable");
      }
      if (pathname === "/manifest.webmanifest") {
        return withCacheControl(assetRes, "public, max-age=3600");
      }
      return assetRes;
    }

    // 4. 所有页面路由统一注入人机一致的 SEO 元数据（严禁区分 User-Agent）
    const indexRes = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, { method: "GET" }));
    if (!indexRes.ok) {
      return new Response("Not Found", { status: 404 });
    }

    const rawHtml = await indexRes.text();
    const html = injectPageMeta(rawHtml, resolveRouteMeta(pathname));
    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  },
};
