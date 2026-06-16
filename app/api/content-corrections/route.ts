import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { contentCorrectionsStorePath } from "@/lib/content-corrections/store";
import {
  CONTENT_CORRECTION_SCOPES,
  type ContentCorrectionRecord,
  type ContentCorrectionScope,
} from "@/lib/content-corrections/types";

export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 800;
const MAX_EMAIL_CHARS = 320;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;

const ipBuckets = new Map<string, { count: number; start: number }>();

type Body = {
  message?: unknown;
  email?: unknown;
  locale?: unknown;
  scope?: unknown;
  articleSlug?: unknown;
  articleTitle?: unknown;
  bookId?: unknown;
  chapter?: unknown;
  roleId?: unknown;
  roleLabel?: unknown;
  publishedAt?: unknown;
  platform?: unknown;
  appVersion?: unknown;
};

function trimString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isEmailLike(v: string): boolean {
  if (!v) return true;
  if (v.length > MAX_EMAIL_CHARS) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.trim() ?? "";
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of ipBuckets) {
    if (now - value.start > RATE_LIMIT_WINDOW_MS * 2) ipBuckets.delete(key);
  }
  const bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.start >= RATE_LIMIT_WINDOW_MS) {
    ipBuckets.set(ip, { count: 1, start: now });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  bucket.count += 1;
  return true;
}

function parseScope(v: unknown): ContentCorrectionScope | null {
  const scope = trimString(v).toLowerCase();
  return (CONTENT_CORRECTION_SCOPES as readonly string[]).includes(scope)
    ? (scope as ContentCorrectionScope)
    : null;
}

function formatContextLine(record: Pick<ContentCorrectionRecord, "scope" | "articleSlug" | "articleTitle" | "bookId" | "chapter" | "roleId" | "roleLabel" | "publishedAt">): string {
  if (record.scope === "explore_article") {
    return `探索文章 · ${record.articleTitle || record.articleSlug || "?"}`;
  }
  const editionLabel = record.scope === "guide_edition" ? "发现版" : "讲解版";
  const loc = record.bookId && record.chapter ? `${record.bookId} ${record.chapter}章` : "?";
  const role = record.roleLabel || record.roleId || "";
  return `${editionLabel} · ${loc}${role ? ` · ${role}` : ""}`;
}

async function sendCorrectionEmail(input: ContentCorrectionRecord): Promise<boolean> {
  const notifyTo = process.env.FEEDBACK_NOTIFY_EMAIL?.trim() || "";
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!notifyTo || !resendApiKey) return false;

  const from = process.env.FEEDBACK_FROM_EMAIL?.trim() || "AskBible Feedback <onboarding@resend.dev>";
  const subject = `[AskBible] 内容纠错 ${input.scope} (${input.id})`;
  const text = [
    `ID: ${input.id}`,
    `Time: ${input.createdAt}`,
    `Context: ${formatContextLine(input)}`,
    `Scope: ${input.scope}`,
    `Locale: ${input.locale || "(unknown)"}`,
    `Platform: ${input.platform || "(unknown)"}`,
    `App: ${input.appVersion || "(unknown)"}`,
    `Email: ${input.email || "(none)"}`,
    `IP: ${input.ip}`,
    "",
    "— Details —",
    `articleSlug: ${input.articleSlug || ""}`,
    `articleTitle: ${input.articleTitle || ""}`,
    `bookId: ${input.bookId || ""}`,
    `chapter: ${input.chapter ?? ""}`,
    `roleId: ${input.roleId || ""}`,
    `roleLabel: ${input.roleLabel || ""}`,
    `publishedAt: ${input.publishedAt || ""}`,
    "",
    input.message,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [notifyTo], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "提交过于频繁，请稍后再试。" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求体需为 JSON。" }, { status: 400 });
  }

  const scope = parseScope(body.scope);
  const message = trimString(body.message);
  const email = trimString(body.email);
  const locale = trimString(body.locale).slice(0, 24);
  const articleSlug = trimString(body.articleSlug).slice(0, 120);
  const articleTitle = trimString(body.articleTitle).slice(0, 200);
  const bookId = trimString(body.bookId).toUpperCase().slice(0, 8);
  const chapter = Number(body.chapter);
  const roleId = trimString(body.roleId).slice(0, 80) || null;
  const roleLabel = trimString(body.roleLabel).slice(0, 120) || null;
  const publishedAt = trimString(body.publishedAt).slice(0, 40) || null;
  const platform = trimString(body.platform).slice(0, 24) || null;
  const appVersion = trimString(body.appVersion).slice(0, 40) || null;

  if (!scope) {
    return NextResponse.json({ error: "内容类型无效。" }, { status: 400 });
  }
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `说明需为 1-${MAX_MESSAGE_CHARS} 个字符。` },
      { status: 400 },
    );
  }
  if (!isEmailLike(email)) {
    return NextResponse.json({ error: "邮箱格式不正确。" }, { status: 400 });
  }

  if (scope === "explore_article") {
    if (!articleSlug) {
      return NextResponse.json({ error: "缺少文章标识。" }, { status: 400 });
    }
  } else if (!bookId || !Number.isInteger(chapter) || chapter < 1) {
    return NextResponse.json({ error: "缺少书卷或章号。" }, { status: 400 });
  }

  const storeFile = contentCorrectionsStorePath();
  if (!storeFile) {
    return NextResponse.json(
      { error: "纠错存储未配置：生产环境请设置 DATA_ROOT 或 FEEDBACK_DATA_DIR。" },
      { status: 503 },
    );
  }

  const createdAt = new Date().toISOString();
  const id = `cc_${createdAt.slice(0, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 9)}`;
  const record: ContentCorrectionRecord = {
    id,
    createdAt,
    message,
    email: email || null,
    locale: locale || null,
    scope,
    articleSlug: scope === "explore_article" ? articleSlug : null,
    articleTitle: scope === "explore_article" ? articleTitle || null : null,
    bookId: scope !== "explore_article" ? bookId : null,
    chapter: scope !== "explore_article" ? chapter : null,
    roleId,
    roleLabel,
    publishedAt,
    platform,
    appVersion,
    ip,
    ua: req.headers.get("user-agent")?.slice(0, 256) ?? null,
  };

  try {
    await fs.mkdir(path.dirname(storeFile), { recursive: true });
    await fs.appendFile(storeFile, `${JSON.stringify(record)}\n`, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入失败：${msg}` }, { status: 500 });
  }

  const notified = await sendCorrectionEmail(record);
  return NextResponse.json({ ok: true, id, notified });
}
