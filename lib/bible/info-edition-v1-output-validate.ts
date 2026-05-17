import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

export type InfoEditionOutputCheck = {
  id: string;
  level: "error" | "warn";
  message: string;
};

export type InfoEditionOutputValidation = {
  ok: boolean;
  charCount: number;
  checks: InfoEditionOutputCheck[];
  errorCount: number;
  warnCount: number;
};

const INFO_MIN_CHARS = 400;
const INFO_SOFT_MIN_CHARS = 900;
const GUIDE_MIN_CHARS = 300;
const GUIDE_SOFT_MIN_CHARS = 600;

const INFO_REQUIRED_HEADINGS = [
  "本章概览",
  "历史背景",
  "神学解释",
  "关键主题",
  "今日默想",
  "经文回应",
] as const;

const GUIDE_REQUIRED_HEADINGS = ["观察", "解释", "应用", "经文祷告", "一句话总结"] as const;

function hasHeading(md: string, fragment: string): boolean {
  const re = new RegExp(`^#{1,3}\\s*[^\\n]*${fragment}`, "im");
  return re.test(md);
}

function push(
  checks: InfoEditionOutputCheck[],
  level: InfoEditionOutputCheck["level"],
  id: string,
  message: string,
): void {
  checks.push({ id, level, message });
}

/** 校验模型正文（发布前自检：结构、长度、常见异常） */
export function validateInfoEditionOutput(
  raw: string,
  variant: InfoEditionReaderVariant,
): InfoEditionOutputValidation {
  const checks: InfoEditionOutputCheck[] = [];
  const markdown = normalizeInfoEditionCompareMarkdown(raw);
  const charCount = markdown.length;

  if (!markdown) {
    push(checks, "error", "empty", "正文为空。");
    return summarize(checks, charCount);
  }

  if (/^```/m.test(raw.trim()) && markdown.length < raw.trim().length - 20) {
    push(checks, "warn", "fence", "原文含代码块包裹，已规范化；请确认渲染正常。");
  }

  if (!/^#\s+/m.test(markdown)) {
    push(checks, "error", "no-h1", "缺少 Markdown 一级标题（#）。");
  }

  if (variant === "info") {
    if (charCount < INFO_MIN_CHARS) {
      push(checks, "error", "too-short", `导读过短（${charCount} 字，建议 ≥ ${INFO_MIN_CHARS}）。`);
    } else if (charCount < INFO_SOFT_MIN_CHARS) {
      push(
        checks,
        "warn",
        "short",
        `导读偏短（${charCount} 字；角色规范约 1200–1800 字）。`,
      );
    }
    for (const h of INFO_REQUIRED_HEADINGS) {
      if (!hasHeading(markdown, h)) {
        push(checks, "error", `missing-${h}`, `缺少模块标题「${h}」。`);
      }
    }
    if (/信息版|V1\s*信息|请以.*角色/i.test(markdown.slice(0, 400))) {
      push(checks, "warn", "meta-leak", "开头疑似含元说明（角色/任务描述），请人工看一眼。");
    }
  } else {
    if (charCount < GUIDE_MIN_CHARS) {
      push(checks, "error", "too-short", `引导过短（${charCount} 字，建议 ≥ ${GUIDE_MIN_CHARS}）。`);
    } else if (charCount < GUIDE_SOFT_MIN_CHARS) {
      push(checks, "warn", "short", `引导偏短（${charCount} 字）。`);
    }
    for (const h of GUIDE_REQUIRED_HEADINGS) {
      if (!hasHeading(markdown, h)) {
        push(checks, "error", `missing-${h}`, `缺少模块「${h}」。`);
      }
    }
    if (!/查经引导|回到经文/i.test(markdown.slice(0, 500))) {
      push(checks, "warn", "intro", "开头未见「查经引导」类引导语。");
    }
    if (/描述规则（作者填写）|导读正文/i.test(markdown)) {
      push(checks, "warn", "wrong-task", "正文含导读版用语，可能拼稿或模型跑偏。");
    }
  }

  if (/^[-*]\s*$/m.test(markdown)) {
    push(checks, "warn", "empty-list", "存在空列表项。");
  }

  return summarize(checks, charCount);
}

function summarize(checks: InfoEditionOutputCheck[], charCount: number): InfoEditionOutputValidation {
  const errorCount = checks.filter((c) => c.level === "error").length;
  const warnCount = checks.filter((c) => c.level === "warn").length;
  return {
    ok: errorCount === 0,
    charCount,
    checks,
    errorCount,
    warnCount,
  };
}
