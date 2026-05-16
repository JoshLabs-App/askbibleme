import { NextResponse } from "next/server";
import { resolveAdminKeySource } from "@/lib/admin/ai-api-config-resolve";
import { applyAdminApiKey } from "@/lib/ai/apply-admin-api-key";
import { createChatCompletion } from "@/lib/ai/openai-compatible";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

const DEFAULT_PROBE = "请只回复一个字：好";

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

type TestTarget = {
  id: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

function parseTarget(raw: unknown): TestTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const baseUrl = typeof o.baseUrl === "string" ? o.baseUrl.trim() : "";
  const model = typeof o.model === "string" ? o.model.trim() : "";
  if (!id || !baseUrl || !model) return null;
  const apiKey = typeof o.apiKey === "string" ? o.apiKey : undefined;
  return { id, baseUrl, model, apiKey };
}

async function runOne(
  target: TestTarget,
  message: string,
): Promise<{
  id: string;
  ok: boolean;
  keySource: string;
  text?: string;
  error?: string;
  latencyMs: number;
}> {
  const started = Date.now();
  const partial = {
    provider: "openai-compatible" as const,
    baseUrl: target.baseUrl,
    model: target.model,
    apiKey: target.apiKey,
  };
  const keyMeta = resolveAdminKeySource(partial, { profileId: target.id });
  const merged = applyAdminApiKey(partial, { profileId: target.id });
  const resolved = resolveAISettings(merged, { profileId: target.id });

  if ("error" in resolved) {
    return {
      id: target.id,
      ok: false,
      keySource: keyMeta.source,
      error: resolved.error,
      latencyMs: Date.now() - started,
    };
  }

  const needKey = !resolved.baseUrl.includes("127.0.0.1") && !resolved.baseUrl.includes("localhost");
  if (needKey && !resolved.apiKey && keyMeta.source === "none") {
    return {
      id: target.id,
      ok: false,
      keySource: "none",
      error: "未配置密钥（本页、URL 匹配或环境变量）。",
      latencyMs: Date.now() - started,
    };
  }

  const result = await createChatCompletion(resolved, [
    { role: "user", content: message.trim() || DEFAULT_PROBE },
  ], { maxTokens: 64 });

  if ("error" in result) {
    return {
      id: target.id,
      ok: false,
      keySource: keyMeta.source,
      error: result.error,
      latencyMs: Date.now() - started,
    };
  }

  return {
    id: target.id,
    ok: true,
    keySource: keyMeta.source,
    text: result.text.slice(0, 200),
    latencyMs: Date.now() - started,
  };
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "须为 JSON。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "无效请求体。" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const message = typeof o.message === "string" ? o.message : DEFAULT_PROBE;

  const single = parseTarget(o.target);
  if (single) {
    const result = await runOne(single, message);
    return NextResponse.json({ ok: true, result });
  }

  const rawList = Array.isArray(o.targets) ? o.targets : [];
  const targets = rawList.map(parseTarget).filter((x): x is TestTarget => x !== null);
  if (!targets.length) {
    return NextResponse.json({ ok: false, error: "缺少 target 或 targets。" }, { status: 400 });
  }
  if (targets.length > 8) {
    return NextResponse.json({ ok: false, error: "一次最多测试 8 个连接。" }, { status: 400 });
  }

  const results = await Promise.all(targets.map((t) => runOne(t, message)));
  return NextResponse.json({ ok: true, results });
}
