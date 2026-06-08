import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type ManifestAsset = {
  scope: string;
  path: string;
  size: number;
  md5: string;
};

const SCOPES = ["cuv-v20", "web-en", "blm-es", "teochew-nt"] as const;

function normalizeRelUrl(scope: string, fileName: string): string | null {
  const s = String(scope || "").trim();
  const f = String(fileName || "").trim();
  if (!s || !f || f.includes("..") || f.includes("/")) return null;
  if (!(SCOPES as readonly string[]).includes(s)) return null;
  return `/audio/${s}/${f}`;
}

async function md5ForFile(absPath: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const hash = createHash("md5");
    const stream = fs.createReadStream(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function collectAssets(cwd: string): Promise<ManifestAsset[]> {
  const publicRoot = path.resolve(cwd, "public");
  const assets: ManifestAsset[] = [];
  for (const scope of SCOPES) {
    const dir = path.join(publicRoot, "audio", scope);
    let names: string[] = [];
    try {
      names = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".mp3")) continue;
      const urlPath = normalizeRelUrl(scope, name);
      if (!urlPath) continue;
      const absPath = path.resolve(publicRoot, urlPath.slice(1));
      const rel = path.relative(publicRoot, absPath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
      try {
        const stat = await fsp.stat(absPath);
        if (!stat.isFile() || stat.size <= 0) continue;
        const md5 = await md5ForFile(absPath);
        assets.push({ scope, path: urlPath, size: stat.size, md5 });
      } catch {
        /* missing file should not break manifest */
      }
    }
  }
  return assets.sort((a, b) => a.path.localeCompare(b.path));
}

export async function GET() {
  try {
    const cwd = process.cwd();
    const assets = await collectAssets(cwd);
    const hash = createHash("md5");
    for (const asset of assets) {
      hash.update(asset.path);
      hash.update("|");
      hash.update(String(asset.size));
      hash.update("|");
      hash.update(asset.md5);
      hash.update("\n");
    }
    const packVersion = `chapter-audio-v1-${hash.digest("hex").slice(0, 16)}`;

    return NextResponse.json(
      {
        packType: "chapter-audio",
        packVersion,
        assets,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, must-revalidate" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
