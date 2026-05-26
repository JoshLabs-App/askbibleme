import { NextResponse } from "next/server";
import { DEFAULT_THEME_REPEAT_MIN_COUNT, themeRepeatPoolScopeId } from "@/lib/scripture/theme-repeat-pool-scope-id";
import {
  readThemeRepeatAllowlistRows,
  writeThemeRepeatAllowlist,
} from "@/lib/home-prayer-pools/theme-repeat-allowlist";

export const dynamic = "force-dynamic";

type SavePayload = {
  minCount?: number;
  keepVerseKeys?: unknown;
};

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "仅开发环境可用。" }, { status: 404 });
  }
  return null;
}

function parseMinCount(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_THEME_REPEAT_MIN_COUNT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_THEME_REPEAT_MIN_COUNT;
  return Math.floor(n);
}

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const minCount = parseMinCount(new URL(req.url).searchParams.get("minCount"));
  const scopeId = themeRepeatPoolScopeId(minCount);
  const rows = readThemeRepeatAllowlistRows(process.cwd(), scopeId);
  if (!rows) {
    return NextResponse.json(
      {
        ok: false,
        error: `未找到 ${scopeId}-allowlist.tsv。先运行: npm run theme-repeat:allowlist -- --min=${minCount}`,
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, scopeId, minCount, total: rows.length, rows });
}

export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  let payload: SavePayload;
  try {
    payload = (await req.json()) as SavePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const minCount = Number.isFinite(payload.minCount)
    ? Math.max(1, Math.floor(payload.minCount as number))
    : DEFAULT_THEME_REPEAT_MIN_COUNT;
  const scopeId = themeRepeatPoolScopeId(minCount);
  const rows = readThemeRepeatAllowlistRows(process.cwd(), scopeId);
  if (!rows) {
    return NextResponse.json(
      {
        ok: false,
        error: `未找到 ${scopeId}-allowlist.tsv。先运行: npm run theme-repeat:allowlist -- --min=${minCount}`,
      },
      { status: 404 },
    );
  }

  const keepRaw = Array.isArray(payload.keepVerseKeys) ? payload.keepVerseKeys : null;
  if (!keepRaw) {
    return NextResponse.json({ ok: false, error: "keepVerseKeys 必须是数组" }, { status: 400 });
  }

  const keep = new Set(
    keepRaw
      .map((v) => String(v ?? "").trim().toUpperCase())
      .filter(Boolean),
  );
  const nextRows = rows.filter((row) => keep.has(row.verseKey));
  const filePath = writeThemeRepeatAllowlist(process.cwd(), scopeId, nextRows);
  return NextResponse.json({
    ok: true,
    scopeId,
    minCount,
    total: rows.length,
    kept: nextRows.length,
    removed: rows.length - nextRows.length,
    filePath,
  });
}
