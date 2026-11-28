import assert from "node:assert/strict";
import { describe, it } from "node:test";
import worker from "../src/index.js";
import { BIBLE_BOOKS } from "../src/route-meta.js";

const SAMPLE_INDEX_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AskBible.me</title>
    <link rel="manifest" href="/manifest.webmanifest" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app-9a8b7c.js"></script>
  </body>
</html>`;

const SAMPLE_MANIFEST = {
  schemaVersion: 1,
  bundleId: "20261127-abc1234",
  builtAt: "2026-11-27T21:30:00Z",
  entry: "index.html",
  files: {
    "index.html": { size: SAMPLE_INDEX_HTML.length, sha256: "deadbeef" },
    "assets/app-9a8b7c.js": { size: 128, sha256: "cafebabe" },
  },
};

function createMockEnv(syncCalls = []) {
  const assetMap = new Map([
    ["/index.html", { body: SAMPLE_INDEX_HTML, type: "text/html; charset=utf-8" }],
    ["/pack-manifest.json", { body: JSON.stringify(SAMPLE_MANIFEST), type: "application/json; charset=utf-8" }],
    ["/sw.js", { body: "self.addEventListener('fetch', () => {});", type: "application/javascript; charset=utf-8" }],
    ["/manifest.webmanifest", { body: JSON.stringify({ name: "AskBible.me" }), type: "application/manifest+json; charset=utf-8" }],
    ["/assets/app-9a8b7c.js", { body: "console.log('askbible');", type: "application/javascript; charset=utf-8" }],
    ["/assets/app-3d4e5f.css", { body: "body{margin:0}", type: "text/css; charset=utf-8" }],
  ]);

  return {
    ASSETS: {
      async fetch(req) {
        const pathname = new URL(req.url).pathname;
        const entry = assetMap.get(pathname);
        if (!entry) return new Response("Not Found", { status: 404 });
        return new Response(entry.body, {
          status: 200,
          headers: { "Content-Type": entry.type },
        });
      },
    },
    ASKBIBLE_SYNC: {
      async fetch(req) {
        const url = new URL(req.url);
        const bodyText = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
        syncCalls.push({
          method: req.method,
          pathname: url.pathname,
          search: url.search,
          auth: req.headers.get("authorization"),
          bodyText,
        });
        return new Response(JSON.stringify({ ok: true, proxiedPath: url.pathname }), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      },
    },
  };
}

describe("askbible-edge worker", () => {
  it("injects consistent home metadata and noscript summary for all user agents", async () => {
    const env = createMockEnv();
    const humanRes = await worker.fetch(
      new Request("https://askbible.me/", { headers: { "User-Agent": "Mozilla/5.0" } }),
      env,
    );
    const botRes = await worker.fetch(
      new Request("https://askbible.me/", { headers: { "User-Agent": "Googlebot/2.1" } }),
      env,
    );

    assert.equal(humanRes.status, 200);
    assert.equal(botRes.status, 200);
    const humanHtml = await humanRes.text();
    const botHtml = await botRes.text();
    assert.equal(humanHtml, botHtml);

    assert.match(humanHtml, /<title>AskBible\.me · 安静地，回到经文<\/title>/);
    assert.match(humanHtml, /<meta name="description" content="一个让人重新进入圣经的安静入口/);
    assert.match(humanHtml, /<meta property="og:title" content="AskBible\.me · 安静地，回到经文">/);
    assert.match(humanHtml, /<meta property="og:url" content="https:\/\/askbible\.me\/">/);
    assert.match(humanHtml, /<noscript data-edge-seo="1"><main><h1>/);
  });

  it("resolves /read/JHN/10 and all 66 bible books accurately", async () => {
    assert.equal(Object.keys(BIBLE_BOOKS).length, 66);

    const env = createMockEnv();
    const res = await worker.fetch(new Request("https://askbible.me/read/JHN/10"), env);
    assert.equal(res.status, 200);
    const html = await res.text();

    assert.match(html, /<title>约翰福音 10 \| AskBible\.me<\/title>/);
    assert.match(html, /<meta property="og:title" content="约翰福音 10 \| AskBible\.me">/);
    assert.match(html, /<meta property="og:url" content="https:\/\/askbible\.me\/read\/JHN\/10">/);
    assert.match(html, /约翰福音第 10 章/);

    // Out-of-range chapter falls back gracefully
    const fallbackRes = await worker.fetch(new Request("https://askbible.me/read/JHN/99"), env);
    const fallbackHtml = await fallbackRes.text();
    assert.match(fallbackHtml, /<title>经文 \| AskBible\.me<\/title>/);
  });

  it("injects metadata for /explore, /panorama, /plans, /figures", async () => {
    const env = createMockEnv();

    const exploreHtml = await (await worker.fetch(new Request("https://askbible.me/explore"), env)).text();
    assert.match(exploreHtml, /<title>探索 \| AskBible\.me<\/title>/);
    assert.match(exploreHtml, /<meta property="og:url" content="https:\/\/askbible\.me\/explore">/);

    const panoramaHtml = await (await worker.fetch(new Request("https://askbible.me/panorama"), env)).text();
    assert.match(panoramaHtml, /<title>救赎全景 \| AskBible\.me<\/title>/);

    const plansHtml = await (await worker.fetch(new Request("https://askbible.me/plans"), env)).text();
    assert.match(plansHtml, /<title>读经计划 \| AskBible\.me<\/title>/);

    const figuresHtml = await (await worker.fetch(new Request("https://askbible.me/figures"), env)).text();
    assert.match(figuresHtml, /<title>圣经人物库 \| AskBible\.me<\/title>/);
  });

  it("returns bundleId and builtAt on /api/app-build and /app-build.json", async () => {
    const env = createMockEnv();
    for (const path of ["/api/app-build", "/app-build.json"]) {
      const res = await worker.fetch(new Request(`https://askbible.me${path}`), env);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Cache-Control"), "no-store, max-age=0, must-revalidate");
      const data = await res.json();
      assert.equal(data.id, "20261127-abc1234");
      assert.equal(data.bundleId, "20261127-abc1234");
      assert.equal(data.builtAt, "2026-11-27T21:30:00Z");
    }
  });

  it("applies exact Cache-Control headers to static assets", async () => {
    const env = createMockEnv();

    const manifestRes = await worker.fetch(new Request("https://askbible.me/pack-manifest.json"), env);
    assert.equal(manifestRes.status, 200);
    assert.equal(manifestRes.headers.get("Cache-Control"), "no-cache");

    const swRes = await worker.fetch(new Request("https://askbible.me/sw.js"), env);
    assert.equal(swRes.status, 200);
    assert.equal(swRes.headers.get("Cache-Control"), "no-cache");

    const jsRes = await worker.fetch(new Request("https://askbible.me/assets/app-9a8b7c.js"), env);
    assert.equal(jsRes.status, 200);
    assert.equal(jsRes.headers.get("Cache-Control"), "public, max-age=31536000, immutable");

    const webmanifestRes = await worker.fetch(new Request("https://askbible.me/manifest.webmanifest"), env);
    assert.equal(webmanifestRes.status, 200);

    const missingAssetRes = await worker.fetch(new Request("https://askbible.me/assets/missing.js"), env);
    assert.equal(missingAssetRes.status, 404);
  });

  it("proxies /api/sync/* and /api/auth/* to ASKBIBLE_SYNC binding", async () => {
    const syncCalls = [];
    const env = createMockEnv(syncCalls);

    const syncRes = await worker.fetch(
      new Request("https://askbible.me/api/sync/v1/sync/reading?cursor=1", {
        method: "POST",
        headers: { Authorization: "Bearer tok_123", "Content-Type": "application/json" },
        body: JSON.stringify({ blobs: {} }),
      }),
      env,
    );
    assert.equal(syncRes.status, 200);
    assert.equal((await syncRes.json()).proxiedPath, "/api/sync/v1/sync/reading");

    const authRes = await worker.fetch(
      new Request("https://askbible.me/api/auth/session", { method: "GET" }),
      env,
    );
    assert.equal(authRes.status, 200);
    assert.equal((await authRes.json()).proxiedPath, "/api/auth/session");

    assert.equal(syncCalls.length, 2);
    assert.equal(syncCalls[0].method, "POST");
    assert.equal(syncCalls[0].search, "?cursor=1");
    assert.equal(syncCalls[0].auth, "Bearer tok_123");
    assert.equal(syncCalls[1].method, "GET");

    const unknownApiRes = await worker.fetch(new Request("https://askbible.me/api/unknown"), env);
    assert.equal(unknownApiRes.status, 404);
  });
});
