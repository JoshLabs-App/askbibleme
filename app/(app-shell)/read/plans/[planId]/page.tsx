import { notFound } from "next/navigation";
import { ReadPlanDetailClient } from "@/components/bible/ReadPlansPageClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readReadingPlanBundleSync, readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type Props = { params: Promise<{ planId: string }> };

export async function generateStaticParams() {
  const reg = readReadingPlanRegistrySync(process.cwd());
  if (!reg?.plans?.length) return [];
  return reg.plans.map((p) => ({ planId: p.planId }));
}

export async function generateMetadata({ params }: Props) {
  const { planId } = await params;
  const bundle = readReadingPlanBundleSync(process.cwd(), decodeURIComponent(planId));
  if (!bundle) return { title: sitePageTitle("读经计划") };
  return { title: sitePageTitle(bundle.name) };
}

export default async function ReadPlanDetailPage({ params }: Props) {
  const { planId: raw } = await params;
  const planId = decodeURIComponent(raw);
  if (!/^[a-zA-Z0-9_-]+$/.test(planId)) notFound();

  const bundle = readReadingPlanBundleSync(process.cwd(), planId);
  if (!bundle) notFound();

  return (
    <ScriptureChrome>
      <ReadPlanDetailClient bundle={bundle} />
    </ScriptureChrome>
  );
}
