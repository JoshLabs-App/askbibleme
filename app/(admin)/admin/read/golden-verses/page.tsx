import { cookies } from "next/headers";
import Link from "next/link";
import { ADMIN_MAIN_CLASS } from "@/components/admin/admin-layout";
import { LOCALE_COOKIE_NAME, parseLocale, type AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";
import type { VerseRef } from "@/lib/bible/verse-ref";
import { readCategorizedVersesSync } from "@/lib/scripture/read-categorized-verses";
import { readExternalHomeVerseRotationSync } from "@/lib/scripture/read-external-home-verse-rotation";

export const metadata = { title: "金句" };

function readHref(ref: VerseRef): string {
  return `/read/${encodeURIComponent(ref.bookId)}/${encodeURIComponent(String(ref.chapter))}`;
}

function previewLine(cwd: string, ref: VerseRef, locale: AppLocale): string {
  const row = resolveVerseRefToHomeEntry(cwd, ref, locale);
  const first = row?.lines?.[0]?.trim();
  if (!first) return "—";
  return first.length > 96 ? `${first.slice(0, 96)}…` : first;
}

export default async function AdminGoldenVersesPage({
  searchParams,
}: {
  searchParams?: Promise<{ locale?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const fromQuery = typeof sp.locale === "string" ? sp.locale : null;
  const cookieStore = await cookies();
  const locale: AppLocale =
    fromQuery === "en" || fromQuery === "zh-CN" ? fromQuery : parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const m = getMessages(locale);
  const g = m.admin.goldenVerses;
  const cwd = process.cwd();
  const home = readExternalHomeVerseRotationSync(cwd);
  const cat = readCategorizedVersesSync(cwd);

  return (
    <div className={ADMIN_MAIN_CLASS}>
      <h1 className="text-lg font-medium tracking-tight text-adminFg">{g.title}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-adminMuted">{g.intro}</p>

      <section className="mt-8 rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
        <h2 className="text-[13px] font-medium text-adminFg">{g.homeSection}</h2>
        <p className="mt-1 font-mono text-[11px] text-adminMuted">{g.fileRotation}</p>
        {!home ? (
          <p className="mt-3 text-[12px] text-amber-700/90 dark:text-amber-300/90">{g.missingRotation}</p>
        ) : (
          <>
            {home.sourceMeta ? (
              <div className="mt-4 rounded-md border border-adminLine/60 bg-adminBg/50 p-3 text-[12px] leading-relaxed text-adminMuted">
                <p className="font-medium text-adminFg/90">{g.sourceMetaHeading}</p>
                {home.sourceMeta.sourceName ? (
                  <p className="mt-1">
                    <span className="text-adminMuted">{g.sourceNameLabel}</span> {home.sourceMeta.sourceName}
                  </p>
                ) : null}
                {home.sourceMeta.sourceUrl ? (
                  <p className="mt-1 break-all">
                    <span className="text-adminMuted">{g.sourceUrlLabel}</span>{" "}
                    <a href={home.sourceMeta.sourceUrl} className="text-adminFg/80 underline underline-offset-2">
                      {home.sourceMeta.sourceUrl}
                    </a>
                  </p>
                ) : null}
                {home.sourceMeta.snapshotVersion ? (
                  <p className="mt-1">
                    <span className="text-adminMuted">{g.snapshotLabel}</span> {home.sourceMeta.snapshotVersion}
                  </p>
                ) : null}
                {home.sourceMeta.licenseOrTermsNote ? (
                  <p className="mt-2 text-[11px] leading-snug text-adminMuted">{home.sourceMeta.licenseOrTermsNote}</p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-adminLine text-[11px] uppercase tracking-wide text-adminMuted">
                    <th className="py-2 pr-3 font-medium">{g.colIndex}</th>
                    <th className="py-2 pr-3 font-medium">{g.colRef}</th>
                    <th className="py-2 pr-3 font-medium">{g.colPreview}</th>
                    <th className="py-2 font-medium">{g.colRead}</th>
                  </tr>
                </thead>
                <tbody>
                  {home.verseRefs.map((ref, i) => (
                    <tr key={`${ref.bookId}-${ref.chapter}-${ref.verseStart}-${i}`} className="border-b border-adminLine/60">
                      <td className="py-2 pr-3 text-adminMuted">{i + 1}</td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-adminFg/90">
                        {ref.bookId} {ref.chapter}:{ref.verseStart}
                        {ref.verseEnd !== ref.verseStart ? `–${ref.verseEnd}` : ""}
                      </td>
                      <td className="max-w-md py-2 pr-3 text-[12px] leading-snug text-adminFg/85">{previewLine(cwd, ref, locale)}</td>
                      <td className="py-2">
                        <Link
                          href={readHref(ref)}
                          className="text-[12px] font-medium text-adminFg underline underline-offset-2 hover:text-adminFg"
                        >
                          {g.openRead}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-adminMuted">{g.homeFootnote}</p>
          </>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-adminLine/80 bg-adminPanel/40 p-4 md:p-5">
        <h2 className="text-[13px] font-medium text-adminFg">{g.categoriesSection}</h2>
        <p className="mt-1 font-mono text-[11px] text-adminMuted">{g.fileCategories}</p>
        {!cat ? (
          <p className="mt-3 text-[12px] text-amber-700/90 dark:text-amber-300/90">{g.missingCategories}</p>
        ) : (
          <>
            {cat.sourceMeta ? (
              <div className="mt-4 rounded-md border border-adminLine/60 bg-adminBg/50 p-3 text-[12px] leading-relaxed text-adminMuted">
                <p className="font-medium text-adminFg/90">{g.sourceMetaHeading}</p>
                {cat.sourceMeta.sourceName ? (
                  <p className="mt-1">
                    <span className="text-adminMuted">{g.sourceNameLabel}</span> {cat.sourceMeta.sourceName}
                  </p>
                ) : null}
                {cat.sourceMeta.sourceUrl ? (
                  <p className="mt-1 break-all">
                    <span className="text-adminMuted">{g.sourceUrlLabel}</span>{" "}
                    <a href={cat.sourceMeta.sourceUrl} className="text-adminFg/80 underline underline-offset-2">
                      {cat.sourceMeta.sourceUrl}
                    </a>
                  </p>
                ) : null}
                {cat.sourceMeta.snapshotVersion ? (
                  <p className="mt-1">
                    <span className="text-adminMuted">{g.snapshotLabel}</span> {cat.sourceMeta.snapshotVersion}
                  </p>
                ) : null}
                {cat.sourceMeta.licenseOrTermsNote ? (
                  <p className="mt-2 text-[11px] leading-snug text-adminMuted">{cat.sourceMeta.licenseOrTermsNote}</p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-6 space-y-8">
              {cat.categories.map((c) => (
                <div key={c.id}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-[13px] font-medium text-adminFg">
                      {locale === "en" ? c.labelEn : c.labelZh}
                    </h3>
                    <span className="font-mono text-[10px] text-adminMuted">id: {c.id}</span>
                    {c.themeIds?.length ? (
                      <span className="text-[11px] text-adminMuted">
                        {g.themeIdsLabel} {c.themeIds.join(", ")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[28rem] border-collapse text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-adminLine text-[11px] uppercase tracking-wide text-adminMuted">
                          <th className="py-2 pr-3 font-medium">{g.colRef}</th>
                          <th className="py-2 pr-3 font-medium">{g.colPreview}</th>
                          <th className="py-2 font-medium">{g.colRead}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.verseRefs.map((ref, j) => (
                          <tr key={`${c.id}-${j}`} className="border-b border-adminLine/60">
                            <td className="py-2 pr-3 font-mono text-[11px] text-adminFg/90">
                              {ref.bookId} {ref.chapter}:{ref.verseStart}
                              {ref.verseEnd !== ref.verseStart ? `–${ref.verseEnd}` : ""}
                            </td>
                            <td className="max-w-md py-2 pr-3 text-[12px] leading-snug text-adminFg/85">{previewLine(cwd, ref, locale)}</td>
                            <td className="py-2">
                              <Link href={readHref(ref)} className="text-[12px] font-medium underline underline-offset-2">
                                {g.openRead}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[11px] leading-relaxed text-adminMuted">{g.categoriesFootnote}</p>
          </>
        )}
      </section>
    </div>
  );
}
