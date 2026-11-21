const UPSTREAM_ORIGIN = "https://askbible-sync.joshlabs.app";

type SyncFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

async function getSyncBinding(): Promise<SyncFetcher | null> {
  try {
    const mod = await import(/* webpackIgnore: true */ "cloudflare:workers");
    const binding = mod.env?.ASKBIBLE_SYNC;
    return binding && typeof binding.fetch === "function" ? binding : null;
  } catch {
    return null;
  }
}

async function proxySync(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const subPath = Array.isArray(path) ? path.join("/") : "";
  const reqUrl = new URL(req.url);
  const targetUrl = `${UPSTREAM_ORIGIN}/${subPath}${reqUrl.search}`;

  const headers = new Headers();
  for (const key of ["authorization", "content-type", "accept", "x-device-id", "x-platform"]) {
    const val = req.headers.get(key);
    if (val) headers.set(key, val);
  }
  headers.set("user-agent", req.headers.get("user-agent") || "AskBibleWebSyncProxy/2.0");

  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const syncBinding = await getSyncBinding();
  const upstreamRes = syncBinding
    ? await syncBinding.fetch(new Request(targetUrl, { method: req.method, headers, body }))
    : await fetch(targetUrl, { method: req.method, headers, body });

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": upstreamRes.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const GET = proxySync;
export const POST = proxySync;
export const PATCH = proxySync;
export const DELETE = proxySync;

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-Id, X-Platform",
    },
  });
}
