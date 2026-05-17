import { notFound } from "next/navigation";
import { ReadPlanDetailClient } from "@/components/bible/ReadPlansPageClient";
import { ReadTripleLoopPlanDetailClient } from "@/components/bible/ReadTripleLoopPlanDetailClient";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { readReadingPlanBundleSync, readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type Props = { params: Promise<{ planId: string }> };

export async function generateStaticParams() {
  const reg = readReadingPlanRegistrySync(process.cwd());
  if (!reg?.plans?.length) return [{ planId: "triple-loop" }];
  return reg.plans.map((p) => ({ planId: p.planId }));
}

export async function generateMetadata({ params }: Props) {
  const { planId } = await params;
  const decoded = decodeURIComponent(planId);
  if (isTripleLoopPlanId(decoded)) return { title: sitePageTitle("三段式读经") };
  const bundle = readReadingPlanBundleSync(process.cwd(), decoded);
  if (!bundle) return { title: sitePageTitle("读经计划") };
  return { title: sitePageTitle(bundle.name) };
}

export default async function ReadPlanDetailPage({ params }: Props) {
  const { planId: raw } = await params;
  const planId = decodeURIComponent(raw);
  if (!/^[a-zA-Z0-9_-]+$/.test(planId)) notFound();

  if (isTripleLoopPlanId(planId)) {
    return (
      <ScriptureChrome>
        <ReadTripleLoopPlanDetailClient />
      </ScriptureChrome>
    );
  }

  const bundle = readReadingPlanBundleSync(process.cwd(), planId);
  if (!bundle) notFound();

  return (
    <ScriptureChrome>
      <ReadPlanDetailClient bundle={bundle} />
    </ScriptureChrome>
  );
}
