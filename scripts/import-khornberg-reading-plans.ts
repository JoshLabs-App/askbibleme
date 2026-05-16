/**
 * Downloads JSON reading plans from https://github.com/khornberg/readingplans
 * (derived from devkardia/bibleplan) and writes normalized bundles under
 * `data/bible-reading-plans/built/` plus `registry.json`.
 *
 * Run: npm run import:reading-plans
 */
import fs from "node:fs/promises";
import path from "node:path";

import { parseEnglishPassageLabel } from "@/lib/bible/reading-plans/parse-english-passage-label";
import type { ReadingPlanBundle, ReadingPlanDay, ReadingPlanRegistry, ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";

const ROOT = process.cwd();
const RAW_BASE = "https://raw.githubusercontent.com/khornberg/readingplans/master";

type Khorn = {
  id?: string;
  abbv?: string;
  name?: string;
  info?: string;
  data2?: string[][];
};

const SLUGS = [
  "backtothebiblechronological",
  "esvchroniclesandprophets",
  "esveverydayinword",
  "esvgospelsandepistles",
  "esvliterarystudybible",
  "esvpentateuchandhistoryofisrael",
  "esvpsalmsandwisdomliterature",
  "esvthroughthebible",
  "heartlightotandnt",
  "mcheyne",
  "oneyearchronological",
] as const;

/** Same product niche as another listed plan; keep bundle, hide from picker. */
const LIST_HIDDEN_PLAN_IDS = new Set(["heartlightotandnt"]);

const LIST_PRIORITY_BY_PLAN_ID: Record<string, number> = {
  esvthroughthebible: 0,
  backtothebiblechronological: 1,
  esvgospelsandepistles: 2,
};

async function fetchJson(slug: string): Promise<Khorn> {
  const u = `${RAW_BASE}/${slug}.json`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`fetch ${u} → ${res.status}`);
  return res.json() as Promise<Khorn>;
}

function safeFileStem(planId: string): string {
  return planId.replace(/[^a-z0-9_-]/gi, "") || "plan";
}

function transform(slug: string, data: Khorn): ReadingPlanBundle {
  const planId = String(data.id || slug).trim() || slug;
  const data2 = data.data2;
  if (!Array.isArray(data2) || data2.length === 0) {
    throw new Error(`[import-reading-plans] missing data2: ${slug}`);
  }
  const days: ReadingPlanDay[] = data2.map((row, dayIndex) => {
    if (!Array.isArray(row)) {
      throw new Error(`[import-reading-plans] ${slug} day ${dayIndex}: expected string[]`);
    }
    const readings = row.flatMap((cell) => {
      const s = String(cell ?? "").trim();
      if (!s) return [];
      return [parseEnglishPassageLabel(s)];
    });
    return { dayIndex, readings };
  });

  return {
    schemaVersion: 1,
    planId,
    abbreviation: typeof data.abbv === "string" && data.abbv.trim() ? data.abbv.trim() : undefined,
    name: String(data.name || planId).trim() || planId,
    description: typeof data.info === "string" && data.info.trim() ? data.info.trim() : undefined,
    sourceUrl: `${RAW_BASE}/${slug}.json`,
    days,
  };
}

async function main() {
  const outDir = path.join(ROOT, "data", "bible-reading-plans", "built");
  await fs.mkdir(outDir, { recursive: true });

  const entries: ReadingPlanRegistryEntry[] = [];

  for (const slug of SLUGS) {
    const raw = await fetchJson(slug);
    const bundle = transform(slug, raw);
    const stem = safeFileStem(bundle.planId);
    const rel = path.posix.join("data", "bible-reading-plans", "built", `${stem}.json`);
    const abs = path.join(ROOT, ...rel.split("/"));
    await fs.writeFile(abs, `${JSON.stringify(bundle, null, 2)}\n`, "utf-8");

    let maxReadingsPerDay = 0;
    for (const d of bundle.days) {
      maxReadingsPerDay = Math.max(maxReadingsPerDay, d.readings.length);
    }

    entries.push({
      planId: bundle.planId,
      name: bundle.name,
      abbreviation: bundle.abbreviation,
      description: bundle.description,
      sourceUrl: bundle.sourceUrl,
      bundlePath: rel,
      dayCount: bundle.days.length,
      maxReadingsPerDay,
      ...(LIST_HIDDEN_PLAN_IDS.has(bundle.planId) ? { listHidden: true } : {}),
      ...(LIST_PRIORITY_BY_PLAN_ID[bundle.planId] != null
        ? { listPriority: LIST_PRIORITY_BY_PLAN_ID[bundle.planId] }
        : {}),
    });
    console.log(`wrote ${rel} (${bundle.days.length} days, up to ${maxReadingsPerDay} readings/day)`);
  }

  entries.sort((a, b) => {
    const pa = a.listPriority ?? 100;
    const pb = b.listPriority ?? 100;
    if (pa !== pb) return pa - pb;
    return a.planId.localeCompare(b.planId);
  });

  const registry: ReadingPlanRegistry = {
    schemaVersion: 1,
    upstreamNote:
      "Bundles are generated from https://github.com/khornberg/readingplans (README: transformed from devkardia/bibleplan). Names mentioning ESV are historical labels in that repo — confirm Crossway / publisher marks and redistribution rights before public product use. Chinese three-track / other tables are not in this upstream set; add separately.",
    plans: entries,
  };

  const regPath = path.join(ROOT, "data", "bible-reading-plans", "registry.json");
  await fs.writeFile(regPath, `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
  console.log(`wrote data/bible-reading-plans/registry.json (${entries.length} plans)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
