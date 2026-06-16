#!/usr/bin/env npx tsx
/**
 * Translate legacy figure profiles + articles to English via OpenAI-compatible API.
 *
 * Run (local Ollama example):
 *   AI_BASE_URL=http://127.0.0.1:11434/v1 AI_MODEL=qwen2.5:14b npx tsx scripts/build-legacy-figure-articles-en.ts
 *
 * Options:
 *   --force     Re-translate even if entry exists
 *   --id=amos   Translate one profile id only
 *   --limit=5   Stop after N new translations
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createChatCompletion } from "../lib/ai/openai-compatible";
import type { ResolvedAISettings } from "../lib/ai/types";
import {
  computeLegacyFigureArticlesEnContentVersion,
  type LegacyFigureEnProfileBlock,
} from "../lib/legacy-figure-articles-en-bundle";
import { buildLegacyFiguresForBookTable } from "../lib/legacy-figure-preview";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = path.join(repoRoot, "data", "legacy-figure-articles", "bundle.json");

type BundleEntry = { id: string; slug: string; en: LegacyFigureEnProfileBlock };
type BundleFile = {
  schemaVersion: number;
  contentVersion: string;
  generatedAt: string | null;
  profiles: BundleEntry[];
};

function parseArgs(argv: string[]) {
  let force = false;
  let limit = Infinity;
  let onlyId: string | null = null;
  for (const arg of argv) {
    if (arg === "--force") force = true;
    else if (arg.startsWith("--limit=")) limit = Number(arg.slice("--limit=".length));
    else if (arg.startsWith("--id=")) onlyId = arg.slice("--id=".length).trim();
  }
  return { force, limit, onlyId };
}

function readBundle(): BundleFile {
  try {
    return JSON.parse(fs.readFileSync(bundlePath, "utf8")) as BundleFile;
  } catch {
    return { schemaVersion: 1, contentVersion: "0000000000000000", generatedAt: null, profiles: [] };
  }
}

function writeBundle(bundle: BundleFile) {
  bundle.contentVersion = computeLegacyFigureArticlesEnContentVersion(bundle.profiles);
  fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
}

function characterRoleEn(roleZh: string): string {
  if (roleZh === "主人物") return "Primary character";
  if (roleZh === "相关人物") return "Related figure";
  return roleZh;
}

function normalizeCharacterRole(value: string | undefined, fallbackZh: string): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return characterRoleEn(fallbackZh);
  if (/^main character$/i.test(trimmed) || /^primary$/i.test(trimmed)) {
    return "Primary character";
  }
  if (/^related figure$/i.test(trimmed) || /^secondary$/i.test(trimmed)) {
    return "Related figure";
  }
  return trimmed;
}

function systemPrompt(): string {
  return [
    "You translate AskBible.me legacy Bible figure articles from Simplified Chinese to English.",
    "Tone: calm, editorial, low cognitive load — not preachy, not devotional hype, not AI-slop.",
    "Preserve all Markdown structure (headings, lists, blockquotes).",
    "Scripture references: use standard English book names (Genesis, Matthew, Philemon, etc.) with chapter:verse.",
    "Do not add content. Do not omit sections.",
    'Return ONLY valid JSON with keys: displayName, scripturePersonality, periodLabel, lifespan, characterRole, articleTitle, articleSummary, articleBody.',
    "Use empty string for missing optional fields.",
  ].join("\n");
}

function userPrompt(profile: ReturnType<typeof buildLegacyFiguresForBookTable>[number]): string {
  const article = profile.article;
  return JSON.stringify(
    {
      englishName: profile.englishName,
      displayNameZh: profile.displayNameZh,
      scripturePersonalityZh: profile.scripturePersonalityZh,
      periodLabelZh: profile.periodLabelZh,
      lifespanZh: profile.lifespanZh,
      characterRoleZh: profile.characterRoleZh,
      article: article
        ? { title: article.title, summary: article.summary, body: article.body }
        : null,
    },
    null,
    2,
  );
}

function parseModelJson(text: string): LegacyFigureEnProfileBlock | null {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1]!.trim() : trimmed;
  try {
    const raw = JSON.parse(jsonText) as Record<string, string>;
    const articleTitle = (raw.articleTitle ?? "").trim();
    const articleSummary = (raw.articleSummary ?? "").trim();
    const articleBody = (raw.articleBody ?? "").trim();
    return {
      displayName: (raw.displayName ?? "").trim(),
      scripturePersonality: (raw.scripturePersonality ?? "").trim() || undefined,
      periodLabel: (raw.periodLabel ?? "").trim() || undefined,
      lifespan: (raw.lifespan ?? "").trim() || undefined,
      characterRole: (raw.characterRole ?? "").trim() || undefined,
      article:
        articleTitle || articleSummary || articleBody
          ? { title: articleTitle, summary: articleSummary, body: articleBody }
          : undefined,
    };
  } catch {
    return null;
  }
}

function readAiSettings(): ResolvedAISettings | { error: string } {
  const baseUrlRaw = String(process.env.AI_BASE_URL ?? "").trim();
  const model = String(process.env.AI_MODEL ?? "").trim();
  if (!baseUrlRaw) {
    return { error: "Set AI_BASE_URL (e.g. http://127.0.0.1:11434/v1) and AI_MODEL." };
  }
  if (!model) {
    return { error: "Set AI_MODEL (e.g. qwen2.5:14b)." };
  }
  const apiKey =
    process.env.AI_API_KEY?.trim()
    || process.env.AI_BEARER_TOKEN?.trim()
    || process.env.OPENAI_API_KEY?.trim()
    || undefined;
  return {
    provider: "openai-compatible",
    baseUrl: baseUrlRaw.replace(/\/$/, ""),
    model,
    apiKey,
  };
}

async function translateProfile(
  profile: ReturnType<typeof buildLegacyFiguresForBookTable>[number],
  settings: ResolvedAISettings,
): Promise<LegacyFigureEnProfileBlock | null> {
  const res = await createChatCompletion(
    settings,
    [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(profile) },
    ],
    { maxTokens: 4096, timeoutMs: 180_000 },
  );

  if ("error" in res) {
    console.error(`  ✗ ${profile.id}: ${res.error}`);
    return null;
  }

  const parsed = parseModelJson(res.text);
  if (!parsed?.displayName) {
    console.error(`  ✗ ${profile.id}: invalid JSON from model`);
    return null;
  }

  if (!parsed.characterRole && profile.characterRoleZh) {
    parsed.characterRole = characterRoleEn(profile.characterRoleZh);
  } else if (parsed.characterRole) {
    parsed.characterRole = normalizeCharacterRole(parsed.characterRole, profile.characterRoleZh);
  }
  if (!parsed.displayName && profile.englishName) {
    parsed.displayName = profile.englishName;
  }

  return parsed;
}

async function main() {
  const { force, limit, onlyId } = parseArgs(process.argv.slice(2));
  const settings = readAiSettings();
  if ("error" in settings) {
    console.error(settings.error);
    process.exit(1);
  }

  const profiles = buildLegacyFiguresForBookTable(repoRoot).filter((p) => {
    if (onlyId && p.id !== onlyId) return false;
    return Boolean(p.article?.body?.trim());
  });

  const bundle = readBundle();
  const byId = new Map(bundle.profiles.map((entry) => [entry.id, entry]));
  let translated = 0;

  console.log(`Translating up to ${Math.min(limit, profiles.length)} of ${profiles.length} profiles…`);

  for (const profile of profiles) {
    if (translated >= limit) break;
    if (!force && byId.get(profile.id)?.en?.article?.body) {
      console.log(`  · ${profile.id} (skip)`);
      continue;
    }

    console.log(`  → ${profile.id} (${profile.displayNameZh})`);
    const en = await translateProfile(profile, settings);
    if (!en) continue;

    byId.set(profile.id, { id: profile.id, slug: profile.slug, en });
    bundle.profiles = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    bundle.generatedAt = new Date().toISOString();
    writeBundle(bundle);
    translated += 1;
    console.log(`  ✓ ${profile.id}`);
  }

  console.log(`Done. ${bundle.profiles.length} entries in bundle (${translated} new this run).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
