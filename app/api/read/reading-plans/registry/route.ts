import { NextResponse } from "next/server";
import { readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";

export async function GET() {
  const registry = readReadingPlanRegistrySync(process.cwd());
  if (!registry) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(registry, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
