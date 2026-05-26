import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 1200;
const MAX_EMAIL_CHARS = 320;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const feedbackTypes = new Set(["bug", "idea", "content", "other"]);

const ipBuckets = new Map<string, { count: number; start: number }>();

type FeedbackBody = {
  type?: unknown;
  message?: unknown;
  email?: unknown;
  page?: unknown;
  locale?: unknown;
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

function feedbackStorePath(cwd = process.cwd()): string | null {
  const external = process.env.FEEDBACK_DATA_DIR?.trim() || process.env.DATA_ROOT?.trim();
  if (external) return path.join(path.resolve(external), "feedback", "feedback-submissions.jsonl");
  if (process.env.NODE_ENV === "production") return null;
  return path.join(cwd, "data", "feedback", "feedback-submissions.jsonl");
}

async function sendFeedbackEmail(input: {
  id: string;
  type: string;
  message: string;
  email: string;
  page: string;
  locale: string;
  ip: string;
  createdAt: string;
}): Promise<boolean> {
  const notifyTo = process.env.FEEDBACK_NOTIFY_EMAIL?.trim() || "";
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!notifyTo || !resendApiKey) return false;

  const from = process.env.FEEDBACK_FROM_EMAIL?.trim() || "AskBible Feedback <onboarding@resend.dev>";
  const subject = `[AskBible] feedback ${input.type} (${input.id})`;
  const text = [
    `Feedback ID: ${input.id}`,
    `Time: ${input.createdAt}`,
    `Type: ${input.type}`,
    `Email: ${input.email || "(none)"}`,
    `Locale: ${input.locale || "(unknown)"}`,
    `Page: ${input.page || "(unknown)"}`,
    `IP: ${input.ip}`,
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
      body: JSON.stringify({
        from,
        to: [notifyTo],
        subject,
        text,
      }),
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

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "请求体需为 JSON。" }, { status: 400 });
  }

  const type = trimString(body.type).toLowerCase();
  const message = trimString(body.message);
  const email = trimString(body.email);
  const page = trimString(body.page).slice(0, 200);
  const locale = trimString(body.locale).slice(0, 24);

  if (!feedbackTypes.has(type)) {
    return NextResponse.json({ error: "反馈类型无效。" }, { status: 400 });
  }
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `反馈内容需为 1-${MAX_MESSAGE_CHARS} 个字符。` },
      { status: 400 },
    );
  }
  if (!isEmailLike(email)) {
    return NextResponse.json({ error: "邮箱格式不正确。" }, { status: 400 });
  }

  const storeFile = feedbackStorePath();
  if (!storeFile) {
    return NextResponse.json(
      { error: "反馈存储未配置：生产环境请设置 DATA_ROOT 或 FEEDBACK_DATA_DIR。" },
      { status: 503 },
    );
  }

  const createdAt = new Date().toISOString();
  const id = `fb_${createdAt.slice(0, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 9)}`;
  const record = {
    id,
    createdAt,
    type,
    message,
    email: email || null,
    page: page || null,
    locale: locale || null,
    ip,
    ua: req.headers.get("user-agent")?.slice(0, 256) ?? null,
  };

  try {
    await fs.mkdir(path.dirname(storeFile), { recursive: true });
    await fs.appendFile(storeFile, `${JSON.stringify(record)}\n`, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `写入反馈失败：${msg}` }, { status: 500 });
  }

  const notified = await sendFeedbackEmail({
    id,
    type,
    message,
    email,
    page,
    locale,
    ip,
    createdAt,
  });

  return NextResponse.json({ ok: true, id, notified });
}
