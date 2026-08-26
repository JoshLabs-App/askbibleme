import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { ExploreFigureDetailClient } from "@/components/explore/ExploreFigureDetailClient";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { legacyFigureDisplayName } from "@/lib/legacy-figure-locale";
import { readLegacyFigureProfileBySlug } from "@/lib/legacy-figure-preview";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const profile = readLegacyFigureProfileBySlug(slug);
  if (!profile) return { title: sitePageTitle("圣经人物库") };
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  return { title: sitePageTitle(legacyFigureDisplayName(profile, locale)) };
}

export default async function ExploreFigureDetailPage({ params }: Props) {
  const { slug } = await params;
  const profile = readLegacyFigureProfileBySlug(slug);
  if (!profile) notFound();

  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));

  return (
    <ExploreParchmentChrome>
      <ExploreFigureDetailClient slug={slug} initialProfile={profile} locale={locale} />
    </ExploreParchmentChrome>
  );
}
