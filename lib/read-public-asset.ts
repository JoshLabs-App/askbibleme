/**
 * Reads a static asset from `public/` across both Node.js (Next.js / dev)
 * and Cloudflare Workers (`vinext` via `env.ASSETS`).
 */
export async function readPublicAssetText(
  urlPath: string,
  cwd = process.cwd(),
): Promise<string | null> {
  const normalized = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  const rel = normalized.slice(1);

  try {
    const [{ default: fs }, { default: path }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    return await fs.readFile(path.join(cwd, "public", rel), "utf8");
  } catch {
    // Fall through to Cloudflare Workers ASSETS binding when fs is unavailable.
  }

  try {
    const cfMod = "cloudflare:workers";
    const mod = (await import(/* webpackIgnore: true */ /* @vite-ignore */ cfMod)) as {
      env?: { ASSETS?: { fetch: (req: Request) => Promise<Response> } };
    };
    const assets = mod?.env?.ASSETS;
    if (assets && typeof assets.fetch === "function") {
      const res = await assets.fetch(new Request(`https://assets.local${normalized}`));
      if (res.ok) return await res.text();
    }
  } catch {
    // Not running inside Cloudflare Workers with ASSETS binding.
  }

  return null;
}

export async function readPublicAssetJson<T = unknown>(
  urlPath: string,
  cwd = process.cwd(),
): Promise<T | null> {
  const raw = await readPublicAssetText(urlPath, cwd);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
