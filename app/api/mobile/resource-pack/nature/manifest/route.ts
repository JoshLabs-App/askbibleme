import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { readNatureSettings } from "@/lib/nature/nature-settings-store";
import type { NatureSettingsV2 } from "@/lib/nature/types";

type ManifestAsset = {
  path: string;
  size: number;
  md5: string;
};

function normalizeNatureAssetPath(raw: string | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/nature/")) return null;
  if (s.includes("..")) return null;
  return s;
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

async function collectAssets(cwd: string, settings: NatureSettingsV2): Promise<ManifestAsset[]> {
  const seen = new Set<string>();
  const picked: string[] = [];

  for (const row of settings.videos) {
    const candidates = [
      normalizeNatureAssetPath(row.src),
      normalizeNatureAssetPath(row.src1080),
      normalizeNatureAssetPath(row.previewFrameSrc),
      normalizeNatureAssetPath(row.thumbSrc),
    ];
    for (const p of candidates) {
      if (!p || seen.has(p)) continue;
      seen.add(p);
      picked.push(p);
    }
  }

  const assets: ManifestAsset[] = [];
  for (const relPath of picked) {
    const absPath = path.resolve(cwd, "public", relPath.slice(1));
    const rel = path.relative(path.resolve(cwd, "public"), absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    try {
      const stat = await fsp.stat(absPath);
      if (!stat.isFile()) continue;
      const md5 = await md5ForFile(absPath);
      assets.push({ path: relPath, size: stat.size, md5 });
    } catch {
      // Missing file should not break sync manifest.
    }
  }
  return assets.sort((a, b) => a.path.localeCompare(b.path));
}

export async function GET() {
  try {
    const cwd = process.cwd();
    const settings = await readNatureSettings(cwd);
    const assets = await collectAssets(cwd, settings);
    const hash = createHash("md5");
    hash.update(JSON.stringify(settings));
    hash.update("\n---assets---\n");
    for (const asset of assets) {
      hash.update(asset.path);
      hash.update("|");
      hash.update(String(asset.size));
      hash.update("|");
      hash.update(asset.md5);
      hash.update("\n");
    }
    const packVersion = `nature-v1-${hash.digest("hex").slice(0, 16)}`;

    return NextResponse.json(
      {
        packType: "nature",
        packVersion,
        settings,
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

