import { PRODUCT_NAME, resolveRouteMeta } from "./route-meta.js";
import {
  DEFAULT_TRANSLATION_ID,
  PRODUCT_ORIGIN,
  parseVerseRange,
  resolveBook,
  resolveTranslation,
} from "../../../lib/ai/askbible-ai-catalog.mjs";
import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildMcpDiscoveryJson,
  buildRobotsTxt,
  buildRouteJsonLd,
  buildSitemapXml,
  formatChapterMarkdown,
} from "../../../lib/ai/askbible-ai-docs.mjs";
import { handleMcpJsonRpc } from "../../../lib/ai/askbible-mcp-core.mjs";

const NO_STORE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0, must-revalidate",
};

const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Accept",
};

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function injectPageMeta(html, meta, pathname, origin) {
  const title = escapeHtml(meta.title);
  const desc = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const summary = escapeHtml(meta.summary);
  const jsonLd = JSON.stringify(buildRouteJsonLd(pathname, origin)).replace(/<\//g, "<\\/");

  const headTags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${PRODUCT_NAME}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:url" content="${url}">`,
    `<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs Context">`,
    `<link rel="mcp-server" href="/mcp" title="${PRODUCT_NAME} Remote MCP">`,
    `<script type="application/ld+json" data-edge-jsonld="1">${jsonLd}</script>`,
  ].join("\n    ");

  const noscriptBlock = `<noscript data-edge-seo="1"><main><h1>${title}</h1><p>${summary}</p></main></noscript>`;

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+[^>]*name=["']description["'][^>]*>/gi, "")
    .replace(/<meta\s+[^>]*property=["']og:(?:title|description|url|type|site_name)["'][^>]*>/gi, "")
    .replace(/<script\s+type=["']application\/ld\+json["']\s+data-edge-jsonld=["']1["']>[\s\S]*?<\/script>/gi, "")
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

function extractBearerToken(request) {
  const raw = request.headers.get("authorization") || "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m && m[1].trim() ? m[1].trim() : null;
}

function createEdgeMcpProvider(env, origin) {
  return {
    async loadChapter(translationId, bookId, chapter) {
      if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") return null;
      const res = await env.ASSETS.fetch(new Request(`${origin}/scripture/${translationId}/${bookId}.json`));
      if (!res.ok) return null;
      const doc = await res.json().catch(() => null);
      const raw = doc?.c?.[String(chapter)];
      if (!Array.isArray(raw)) return null;
      return raw
        .map((entry, idx) => {
          if (Array.isArray(entry)) return { verse: Number(entry[0]) || idx + 1, text: String(entry[1] || "") };
          if (entry && typeof entry === "object") return { verse: Number(entry.v || entry.verse) || idx + 1, text: String(entry.t || entry.text || "") };
          return { verse: idx + 1, text: String(entry || "") };
        })
        .filter((r) => r.text);
    },
    async loadReadingPlan(planId) {
      if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") return null;
      const safe = String(planId || "").replace(/[^a-z0-9_-]/gi, "");
      const res = await env.ASSETS.fetch(new Request(`${origin}/data/bible-reading-plans/${safe}.json`));
      if (!res.ok) return null;
      return res.json().catch(() => null);
    },
    async loadFigures() {
      if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") return [];
      for (const p of ["/data/figures.json", "/data/static-bundles/legacy-figure-preview.json"]) {
        const res = await env.ASSETS.fetch(new Request(`${origin}${p}`));
        if (res.ok) {
          const parsed = await res.json().catch(() => null);
          if (Array.isArray(parsed)) return parsed;
          if (Array.isArray(parsed?.profiles)) return parsed.profiles;
          if (Array.isArray(parsed?.figures)) return parsed.figures;
        }
      }
      return [];
    },
    async callSyncApi(path, init = {}) {
      if (!env.ASKBIBLE_SYNC || typeof env.ASKBIBLE_SYNC.fetch !== "function") {
        return { ok: false, status: 503, data: { error: "ASKBIBLE_SYNC binding unavailable" } };
      }
      const headers = new Headers({ "Content-Type": "application/json" });
      if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
      const method = init.method || "GET";
      const body = init.body !== undefined && method !== "GET" ? JSON.stringify(init.body) : undefined;
      const res = await env.ASKBIBLE_SYNC.fetch(
        new Request(`https://sync.askbible.me${path.startsWith("/") ? path : `/${path}`}`, { method, headers, body }),
      );
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    },
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const publicOrigin = url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : PRODUCT_ORIGIN;

    // 0. AI 发现、收录与 Remote MCP 协议端点
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/robots.txt") {
      return new Response(request.method === "HEAD" ? null : buildRobotsTxt(publicOrigin), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/llms.txt") {
      return new Response(request.method === "HEAD" ? null : buildLlmsTxt(publicOrigin), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/llms-full.txt") {
      return new Response(request.method === "HEAD" ? null : buildLlmsFullTxt(publicOrigin), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/sitemap.xml") {
      return new Response(request.method === "HEAD" ? null : buildSitemapXml(publicOrigin), {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
    if ((request.method === "GET" || request.method === "HEAD") && pathname === "/.well-known/mcp.json") {
      return jsonResponse(buildMcpDiscoveryJson(publicOrigin), 200, MCP_CORS_HEADERS);
    }
    if (pathname === "/mcp" || pathname === "/api/mcp") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
      }
      if (request.method === "GET") {
        return jsonResponse(buildMcpDiscoveryJson(publicOrigin), 200, MCP_CORS_HEADERS);
      }
      if (request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body) {
          return jsonResponse(
            { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
            400,
            MCP_CORS_HEADERS,
          );
        }
        const provider = createEdgeMcpProvider(env, url.origin);
        const authToken = extractBearerToken(request);
        if (Array.isArray(body)) {
          const results = (
            await Promise.all(body.map((item) => handleMcpJsonRpc(item, { provider, origin: publicOrigin, authToken })))
          ).filter((r) => r !== null);
          if (results.length === 0) return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
          return jsonResponse(results, 200, MCP_CORS_HEADERS);
        }
        const result = await handleMcpJsonRpc(body, { provider, origin: publicOrigin, authToken });
        if (result === null) return new Response(null, { status: 202, headers: MCP_CORS_HEADERS });
        return jsonResponse(result, 200, MCP_CORS_HEADERS);
      }
    }

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

    // 2.5 纯 Markdown 经文协商（/read/PSA/23.md 或 Accept: text/markdown）
    const mdSuffixMatch = pathname.match(/^\/read\/([A-Za-z0-9]+)\/(\d+)\.md$/);
    const acceptHeader = (request.headers.get("accept") || "").toLowerCase();
    const wantsMarkdown = acceptHeader.includes("text/markdown") && !acceptHeader.includes("text/html");
    const mdChapterMatch = !mdSuffixMatch && wantsMarkdown ? pathname.match(/^\/read\/([A-Za-z0-9]+)\/(\d+)$/) : null;
    const matchedMd = mdSuffixMatch || mdChapterMatch;
    if (matchedMd && (request.method === "GET" || request.method === "HEAD")) {
      const book = resolveBook(matchedMd[1]);
      const ch = Number(matchedMd[2]);
      const tr = resolveTranslation(url.searchParams.get("t") || DEFAULT_TRANSLATION_ID);
      if (!book || !Number.isInteger(ch) || ch < 1 || ch > book.chapters || !tr) {
        return new Response("# Not Found\n", { status: 404, headers: { "Content-Type": "text/markdown; charset=utf-8" } });
      }
      const provider = createEdgeMcpProvider(env, url.origin);
      const rawVerses = await provider.loadChapter(tr.id, book.id, ch);
      if (!rawVerses || rawVerses.length === 0) {
        return new Response("# Not Found\n", { status: 404, headers: { "Content-Type": "text/markdown; charset=utf-8" } });
      }
      const rawRange = url.searchParams.get("v");
      const range = rawRange ? parseVerseRange(rawRange) : null;
      const verses = range ? rawVerses.filter((v) => v.verse >= range.start && v.verse <= range.end) : rawVerses;
      const md = formatChapterMarkdown({ book, chapter: ch, translation: tr, verses, verseRange: range, origin: publicOrigin });
      return new Response(request.method === "HEAD" ? null : md, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          Vary: "Accept",
        },
      });
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

    // 4. 所有页面路由统一注入人机一致的 SEO 元数据与 JSON-LD（严禁区分 User-Agent）
    const indexRes = await env.ASSETS.fetch(new Request(`${url.origin}/index.html`, { method: "GET" }));
    if (!indexRes.ok) {
      return new Response("Not Found", { status: 404 });
    }

    const rawHtml = await indexRes.text();
    const html = injectPageMeta(rawHtml, resolveRouteMeta(pathname), pathname, publicOrigin);
    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  },
};
