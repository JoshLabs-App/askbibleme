import { NextResponse } from "next/server";
import { readHomeGoldenThemeSelectionSync, writeHomeGoldenThemeSelectionSync } from "@/lib/scripture/home-golden-theme-selection";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

const KEY_RE = /^\d+-\d+$/;
const MAX_SELECTED_KEYS = 120;

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  const cwd = process.cwd();
  const sel = readHomeGoldenThemeSelectionSync(cwd);
  return NextResponse.json(
    { ok: true, selectedSubcategoryKeys: sel.selectedSubcategoryKeys },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();

  const cwd = process.cwd();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "须为 JSON。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "无效请求体。" }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>).selectedSubcategoryKeys;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "缺少 selectedSubcategoryKeys 数组。" }, { status: 400 });
  }
  const keys = raw
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x): x is string => KEY_RE.test(x));
  const uniq = [...new Set(keys)];
  if (uniq.length > MAX_SELECTED_KEYS) {
    return NextResponse.json(
      { ok: false, error: `最多选择 ${MAX_SELECTED_KEYS} 个主题标签。` },
      { status: 400 },
    );
  }

  try {
    writeHomeGoldenThemeSelectionSync(cwd, uniq);
    return NextResponse.json(
      { ok: true, selectedCount: uniq.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
