import { notFound } from "next/navigation";
import { ExploreStagedEntryPage } from "@/components/explore/ExploreStagedEntryPage";
import {
  EXPLORE_SCRIPTURE_POOL_ENTRY_IDS,
  isExploreStagedEntryId,
  type ExploreStagedEntryId,
} from "@/lib/explore/explore-staged-entries";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

const DYNAMIC_STAGED_IDS: ExploreStagedEntryId[] = [
  "bible-maps",
  "history-timeline",
  ...EXPLORE_SCRIPTURE_POOL_ENTRY_IDS,
];

export function generateStaticParams() {
  return DYNAMIC_STAGED_IDS.map((stagedEntry) => ({ stagedEntry }));
}

export async function generateMetadata({ params }: { params: Promise<{ stagedEntry: string }> }) {
  const { stagedEntry } = await params;
  if (!isExploreStagedEntryId(stagedEntry) || !DYNAMIC_STAGED_IDS.includes(stagedEntry)) {
    return { title: sitePageTitle("探索") };
  }
  return { title: sitePageTitle(stagedEntry) };
}

export default async function ExploreDynamicStagedEntryRoute({
  params,
}: {
  params: Promise<{ stagedEntry: string }>;
}) {
  const { stagedEntry } = await params;
  if (!isExploreStagedEntryId(stagedEntry) || !DYNAMIC_STAGED_IDS.includes(stagedEntry)) {
    notFound();
  }
  return <ExploreStagedEntryPage entryId={stagedEntry} />;
}
