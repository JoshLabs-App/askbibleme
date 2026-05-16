import { notFound } from "next/navigation";
import { ReadBibleTypographySettingsControl } from "@/components/bible/ReadBibleTypographySettingsControl";
import { ReadPlanDetailClient } from "@/components/bible/ReadPlansPageClient";
import { ShellTemplateChromeLayout } from "@/components/shell/ShellTemplateChromeLayout";
import { readReadingPlanBundleSync, readReadingPlanRegistrySync } from "@/lib/bible/reading-plans/reading-plans-store";
import { PRAYER_SHELL_FILL_LIGHT } from "@/lib/prayer/prayer-shell-fill";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "../../read-chapter-surfaces.css";
import "../../read-bible-typography.css";

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
    <ShellTemplateChromeLayout
      contentClassName="gap-0"
      appShellBackground={PRAYER_SHELL_FILL_LIGHT}
      immersive
      topBarRightAccessory={<ReadBibleTypographySettingsControl />}
    >
      <div className="read-bible-parchment-shell flex-1 text-amber-950 dark:text-stone-50">
        <div className="read-bible-parchment-scroll">
          <div className="read-bible-parchment-column read-bible-typography">
            <ReadPlanDetailClient bundle={bundle} />
          </div>
        </div>
      </div>
    </ShellTemplateChromeLayout>
  );
}
