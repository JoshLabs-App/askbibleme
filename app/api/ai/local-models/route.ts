import { NextResponse } from "next/server";
import {
  fetchOllamaScanEntries,
  fetchOpenAICompatibleScanEntries,
  listLocalModelsAuto,
} from "@/lib/ai/local-model-list";

function scanJson(
  entries: { name: string; sizeGb?: number; suitability: string }[],
  source: "ollama" | "openai",
) {
  return NextResponse.json({
    models: entries.map((e) => e.name),
    entries,
    source,
  });
}

/**
 * 扫描本机已安装的模型名，供 Studio datalist 使用。
 * `entries` 含 Ollama 返回的约几 GB 与一句话场景提示（启发式）。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? "auto";
  const baseUrl =
    searchParams.get("baseUrl")?.trim() || "http://127.0.0.1:11434/v1";

  const t = 10_000;

  try {
    if (provider === "auto") {
      const result = await listLocalModelsAuto(baseUrl, t);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, models: [] as string[], entries: [] },
          { status: 502 },
        );
      }
      return scanJson(result.entries, result.source);
    }

    if (provider === "ollama") {
      const entries = await fetchOllamaScanEntries(baseUrl, t);
      if (!entries || entries.length === 0) {
        return NextResponse.json(
          {
            error:
              "Ollama 无响应或未返回模型。请确认本机已启动 ollama，且端口与 Base URL 一致。",
            models: [] as string[],
            entries: [],
          },
          { status: 502 },
        );
      }
      return scanJson(entries, "ollama");
    }

    if (provider === "openai_models") {
      const entries = await fetchOpenAICompatibleScanEntries(baseUrl, t);
      if (!entries || entries.length === 0) {
        return NextResponse.json(
          {
            error:
              "该地址未返回 /models 列表。请确认 LM Studio Server 已开启或端点支持 OpenAI 兼容列表。",
            models: [] as string[],
            entries: [],
          },
          { status: 502 },
        );
      }
      return scanJson(entries, "openai");
    }

    return NextResponse.json(
      { error: "未知 provider", models: [], entries: [] },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "无法连接本机服务（超时或拒绝连接）。请确认 Ollama / LM Studio 已启动。",
        models: [] as string[],
        entries: [],
      },
      { status: 502 },
    );
  }
}
