import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { DiscussionMessage } from "@/app/studio/discussion-types";
import { buildAIContext, detectDiscussionTopics } from "@/lib/studio-ai-context";
import {
  STUDIO_DOC_ENTRIES,
  STUDIO_PRODUCT_MEMORY_FILE,
  STUDIO_THREADS_DIR,
  type StudioDocId,
} from "@/lib/studio-config";
import { isStudioDiskSaveAllowed, isStudioDocId } from "@/lib/studio-disk-save";

const MAX_MSG = 400;

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

/** 自 API 入参恢复为客户端同类结构（仅校验必要字段） */
function parseDiscussionMessagesInput(raw: unknown): DiscussionMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscussionMessage[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const kind = item.kind;
    const id = item.id;
    const createdAt = item.createdAt;
    if (kind !== "user" && kind !== "assistant" && kind !== "assistant_note")
      continue;
    if (typeof id !== "string" || !id) continue;
    if (typeof createdAt !== "string") continue;
    if (kind === "user") {
      const content = item.content;
      if (typeof content !== "string") continue;
      const meta = item.meta;
      const um: DiscussionMessage = {
        kind: "user",
        id,
        createdAt,
        content,
      };
      if (isRecord(meta)) {
        (um as { meta?: unknown }).meta = {
          detectedTopics: Array.isArray(meta.detectedTopics)
            ? meta.detectedTopics.filter((t): t is string => typeof t === "string")
            : undefined,
          relatedThreadSlugs: Array.isArray(meta.relatedThreadSlugs)
            ? meta.relatedThreadSlugs.filter((t): t is string => typeof t === "string")
            : undefined,
          relatedDocIds: Array.isArray(meta.relatedDocIds)
            ? meta.relatedDocIds.filter((t): t is string => typeof t === "string")
            : undefined,
          assembledChars:
            typeof meta.assembledChars === "number" ? meta.assembledChars : undefined,
        };
      }
      out.push(um);
      continue;
    }
    if (kind === "assistant_note") {
      const content = item.content;
      if (typeof content !== "string") continue;
      out.push({ kind: "assistant_note", id, createdAt, content });
      continue;
    }
    const reflection = item.reflection;
    if (!isRecord(reflection)) continue;
    const r = reflection;
    if (
      typeof r.clarifiedIntent !== "string" ||
      typeof r.coreInsight !== "string" ||
      typeof r.tensionRisk !== "string" ||
      typeof r.suggestedNextStep !== "string"
    )
      continue;
    if (!Array.isArray(r.relatedDocIds)) continue;
    const relatedDocIds = r.relatedDocIds.filter(
      (x): x is string => typeof x === "string",
    );
    const partnerReply =
      typeof r.partnerReply === "string" && r.partnerReply.trim()
        ? r.partnerReply.trim()
        : [r.coreInsight, r.suggestedNextStep].filter(Boolean).join("\n\n");
    out.push({
      kind: "assistant",
      id,
      createdAt,
      reflection: {
        partnerReply,
        clarifiedIntent: r.clarifiedIntent,
        coreInsight: r.coreInsight,
        relatedDocIds,
        tensionRisk: r.tensionRisk,
        suggestedNextStep: r.suggestedNextStep,
      },
    });
  }
  return out.slice(-MAX_MSG);
}

/**
 * POST：读取 `studio/product-memory.md`、`docs/*.md`、`studio/threads/{slug}.md`，
 * 运行 `buildAIContext`，返回分层组装结果（供模拟 AI 或日后真实 API）。
 */
export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) {
    return NextResponse.json(
      {
        error:
          "未允许读磁盘：开发请用 `npm run dev`，或配置 STUDIO_ALLOW_DISK_SAVE 与 Bearer。",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体需为 JSON。" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "非法请求体。" }, { status: 400 });
  }

  const userInput =
    typeof body.userInput === "string" ? body.userInput : "";
  const activeDocId = body.activeDocId;
  if (typeof activeDocId !== "string" || !isStudioDocId(activeDocId)) {
    return NextResponse.json({ error: "非法 activeDocId。" }, { status: 400 });
  }

  const discussionMessages = parseDiscussionMessagesInput(body.discussionMessages);

  const cwd = process.cwd();
  const docsRoot = path.resolve(cwd, "docs");
  const studioRoot = path.resolve(cwd, path.dirname(STUDIO_PRODUCT_MEMORY_FILE));
  const productPath = path.resolve(cwd, STUDIO_PRODUCT_MEMORY_FILE);
  const threadsDir = path.resolve(cwd, STUDIO_THREADS_DIR);

  if (!productPath.startsWith(studioRoot + path.sep) && productPath !== studioRoot) {
    return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
  }
  if (!threadsDir.startsWith(studioRoot + path.sep) && threadsDir !== studioRoot) {
    return NextResponse.json({ error: "路径校验失败。" }, { status: 500 });
  }

  let productMemoryMarkdown = "";
  try {
    productMemoryMarkdown = await fs.readFile(productPath, "utf-8");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: `读取 product-memory 失败：${msg}` }, { status: 500 });
    }
    productMemoryMarkdown =
      "（尚未创建 studio/product-memory.md，请在仓库中补充 Layer 1 长期记忆。）";
  }

  const officialDocBodies: Record<string, string> = {};
  for (const e of STUDIO_DOC_ENTRIES) {
    const fp = path.resolve(docsRoot, `${e.id}.md`);
    if (!fp.startsWith(docsRoot + path.sep)) continue;
    try {
      officialDocBodies[e.id] = await fs.readFile(fp, "utf-8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `读取文档失败：${msg}` }, { status: 500 });
      }
    }
  }

  const { threadSlugs } = detectDiscussionTopics(userInput);
  const topicThreadBodies: Record<string, string> = {};
  for (const slug of threadSlugs) {
    const tf = path.resolve(threadsDir, `${slug}.md`);
    if (!tf.startsWith(threadsDir + path.sep)) continue;
    try {
      topicThreadBodies[slug] = await fs.readFile(tf, "utf-8");
    } catch {
      /* 缺失的 thread 文件跳过 */
    }
  }

  const assembled = buildAIContext({
    userInput,
    activeDocId: activeDocId as StudioDocId,
    officialDocBodies,
    discussionMessages,
    productMemoryMarkdown,
    topicThreadBodies,
  });

  return NextResponse.json(assembled);
}
