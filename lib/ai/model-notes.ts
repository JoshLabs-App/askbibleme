/**
 * 本地模型「约几 GB / 适合什么」——来自 Ollama size 与名称启发式，非精确 benchmark。
 */

export type LocalModelScanEntry = {
  name: string;
  /** Ollama /api/tags 的 size 换算；OpenAI 兼容 /models 通常无此字段 */
  sizeGb?: number;
  /** 一句话场景提示 */
  suitability: string;
};

const BYTES_PER_GB = 1024 ** 3;

export function bytesToApproxGb(bytes: number): number {
  return Math.round((bytes / BYTES_PER_GB) * 10) / 10;
}

/** 从常见命名里猜参数量级（b = billion），用于无 size 时补充说明 */
export function inferBillionsFromName(modelName: string): number | undefined {
  const s = modelName.toLowerCase();
  const tagged = s.match(/[-_:](\d{1,3})b\b/);
  if (tagged) return parseInt(tagged[1], 10);
  const loose = s.match(/(\d{1,3})b\b/);
  if (loose) return parseInt(loose[1], 10);
  return undefined;
}

export function inferLocalModelSuitability(
  modelName: string,
  sizeGb?: number,
): string {
  const lower = modelName.toLowerCase();

  if (
    /\bembed|embedding\b/.test(lower) ||
    lower.includes("nomic-embed") ||
    lower.includes("mxbai-embed") ||
    lower.includes("bge-")
  ) {
    return "嵌入模型：向量/检索，不用来聊天补全";
  }
  if (
    /\bcoder\b|codeqwen|deepseek-coder|starcoder|codellama/.test(lower)
  ) {
    return "偏重代码与工程问答";
  }
  if (
    /vision|vl-|:vl\b|\bvl\b|llava|moondream|qwen.?vl|pixtral/.test(lower)
  ) {
    return "多模态/视觉：占用常高于同档纯文本";
  }

  const g = sizeGb;
  if (g !== undefined && g > 0) {
    if (g < 1.2) return "约 1GB 级：极快，适合标签、短句、草稿";
    if (g < 2.5) return "约 1–3GB：轻量对话、简单摘要";
    if (g < 6) return "约 3–6GB：日常对话、轻工位推理";
    if (g < 12) return "约 6–12GB：常见本地主力，写作与中等推理";
    if (g < 24) return "约 12–24GB：较深推理与长文（建议 16GB+ 显存或大内存）";
    if (g < 45) return "约 24–40GB：高质量推理（建议高端 GPU）";
    return "40GB+ 级：服务器/大显存，追求上限质量";
  }

  const b = inferBillionsFromName(modelName);
  if (b !== undefined) {
    if (b <= 2) return "小参数量：省资源，适合分类与短答";
    if (b <= 4) return "轻量：日常聊天与简单任务";
    if (b <= 9) return "7–9B：本地常用档位，平衡速度与质量";
    if (b <= 14) return "13–14B：说理与写作明显强于 7B";
    if (b <= 34) return "30B 级：深度推理，需较大内存/显存";
    return "70B 级：对话质量上限高，硬件要求很高";
  }

  return "体量未知：按延迟与显存试用；量化档同名体积可差数倍";
}

export function entryFromScanParts(
  name: string,
  sizeBytes?: number,
): LocalModelScanEntry {
  const trimmed = name.trim();
  const sizeGb =
    typeof sizeBytes === "number" && sizeBytes > 0
      ? bytesToApproxGb(sizeBytes)
      : undefined;
  return {
    name: trimmed,
    sizeGb,
    suitability: inferLocalModelSuitability(trimmed, sizeGb),
  };
}

const DEFAULT_MAX_SUITABILITY_CHARS = 52;

function clipSuitability(text: string, max = DEFAULT_MAX_SUITABILITY_CHARS): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * 批量导入连接时的名称：`本机 · Ollama · qwen3:14b · 约8.2G · 适合…`
 * （G 为磁盘/权重体量近似值；适合为启发式说明。）
 */
export function formatImportedProfileName(
  namePrefix: string,
  backendLabel: string,
  entry: LocalModelScanEntry,
  maxSuitabilityChars = DEFAULT_MAX_SUITABILITY_CHARS,
): string {
  const sizePart =
    entry.sizeGb != null && entry.sizeGb > 0 ? ` · 约${entry.sizeGb}G` : "";
  return `${namePrefix} · ${backendLabel} · ${entry.name}${sizePart} · ${clipSuitability(entry.suitability, maxSuitabilityChars)}`;
}

/**
 * 手动保存且用户未填「连接名称」时：`连接 · 模型 · 约XG · 适合…`
 */
export function formatSavedConnectionName(entry: LocalModelScanEntry): string {
  const sizePart =
    entry.sizeGb != null && entry.sizeGb > 0 ? ` · 约${entry.sizeGb}G` : "";
  return `连接 · ${entry.name}${sizePart} · ${clipSuitability(entry.suitability)}`;
}
