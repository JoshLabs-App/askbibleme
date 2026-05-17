import fs from "node:fs";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import {
  isSafeChapterAudioRelativePath,
  resolveCuvChapterAudioFilePath,
} from "@/lib/bible/cuv-chapter-audio-storage";

const CACHE = "public, max-age=31536000, immutable";
const TEOCHEW_REL_RE = /^teochew-nt\/[A-Z0-9]{2,8}-\d+\.mp3$/i;

function teochewGithubRawUrl(relativePath: string): string {
  const repo = process.env.SELAH_GITHUB_REPO?.trim() || "askbibleme/askbibleme";
  const branch = process.env.TEOCHEW_AUDIO_GIT_REF?.trim() || "teochew-nt-audio";
  return `https://raw.githubusercontent.com/${repo}/${branch}/public/audio/${relativePath}`;
}

/** 磁盘无文件时，从 teochew-nt-audio 分支代理（生产免先 rsync 692MB） */
async function serveTeochewFromGithubRaw(
  req: NextRequest,
  relativePath: string,
): Promise<Response> {
  const url = teochewGithubRawUrl(relativePath);
  const headers: Record<string, string> = {};
  const range = req.headers.get("range");
  if (range) headers.Range = range;
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (!upstream.ok) {
    return new Response("Not found", { status: upstream.status === 404 ? 404 : 502 });
  }

  const out = new Headers({
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": CACHE,
  });
  for (const key of ["content-length", "content-range"] as const) {
    const v = upstream.headers.get(key);
    if (v) out.set(key, v);
  }

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

function parseByteRange(
  rangeHeader: string,
  size: number,
): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) return null;
  let start = m[1] ? Number.parseInt(m[1], 10) : 0;
  let end = m[2] ? Number.parseInt(m[2], 10) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null;
  }
  if (start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

function audioHeaders(
  filePath: string,
  extra: Record<string, string> = {},
): { headers: Record<string, string>; size: number } {
  const size = fs.statSync(filePath).size;
  return {
    size,
    headers: {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": CACHE,
      ...extra,
    },
  };
}

export async function serveChapterAudioFile(
  req: NextRequest,
  pathSegments: string[],
): Promise<Response> {
  const relativePath = pathSegments.map((s) => decodeURIComponent(s)).join("/");
  if (!isSafeChapterAudioRelativePath(relativePath)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = resolveCuvChapterAudioFilePath(relativePath);
  if (!filePath) {
    if (TEOCHEW_REL_RE.test(relativePath)) {
      return serveTeochewFromGithubRaw(req, relativePath);
    }
    return new Response("Not found", { status: 404 });
  }

  const rangeHeader = req.headers.get("range");
  const { size, headers: baseHeaders } = audioHeaders(filePath);

  if (!rangeHeader) {
    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(size) },
    });
  }

  const range = parseByteRange(rangeHeader, size);
  if (!range) {
    return new Response("Invalid range", { status: 416 });
  }

  const { start, end } = range;
  const chunkSize = end - start + 1;
  const stream = fs.createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}
