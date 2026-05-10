import { NextResponse } from "next/server";
import {
  getBuiltinPreset,
  getEnvPresetDraft,
  normalizePresetCode,
} from "@/lib/ai/preset-code";

/**
 * 快捷码解析：自动填名称、Base URL、模型、Token 等（Studio 一键应用）。
 * GET /api/ai/preset?code=SKY
 *
 * - 内置：OLLAMA、LM、LMSTUDIO、VLLM、LOCAL、LLAMACPP
 * - 任意大写字母码：若存在环境变量 AI_PRESET_<CODE>_BASE_URL 则生效（如 SKY）
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("code")?.trim() ?? "";
  const code = normalizePresetCode(raw);
  if (!code) {
    return NextResponse.json({ error: "缺少 code 参数" }, { status: 400 });
  }

  const builtin = getBuiltinPreset(code);
  if (builtin) {
    return NextResponse.json({ ...builtin, source: "builtin" as const });
  }

  const fromEnv = getEnvPresetDraft(code);
  if (fromEnv) {
    return NextResponse.json({ ...fromEnv, source: "env" as const });
  }

  return NextResponse.json(
    {
      error: `未知快捷码「${code}」。可用内置：OLLAMA、LM、LMSTUDIO、VLLM、LLAMACPP、LOCAL；自定义请在 .env.local 配置 AI_PRESET_${code}_BASE_URL（及 NAME、MODEL、API_KEY、AUTO_SCAN）。`,
    },
    { status: 404 },
  );
}
