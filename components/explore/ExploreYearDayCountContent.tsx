"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExploreBirthDatePicker } from "@/components/explore/ExploreBirthDatePicker";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  getCenturyTimeline,
  lifeBatteryFilledSegments,
  LIFE_BATTERY_SEGMENT_COUNT,
} from "@/lib/explore/century-timeline";
import type { ExploreBirthDate } from "@/lib/explore/explore-birth-date";
import {
  defaultBirthDate,
  isValidBirthDate,
  clampBirthDate,
  clampBirthDateToToday,
} from "@/lib/explore/explore-birth-date";
import {
  isExploreYearDayProfileComplete,
  readExploreYearDayProfile,
  writeExploreYearDayProfile,
} from "@/lib/explore/explore-birth-year-prefs";
import {
  formatYearDayCountRef,
  YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET,
  YEAR_DAY_COUNT_SCRIPTURES,
  type YearDayCountScriptureRef,
} from "@/lib/explore/year-day-count-refs";
import {
  BIBLICAL_LIFESPAN_NT_SCALE_YEARS,
  BIBLICAL_LIFESPAN_SCALE_YEARS,
  biblicalLifespanBarWidthPct,
  getBiblicalLifespans,
  isBiblicalLifespanNewTestamentEra,
} from "@/lib/explore/biblical-lifespans";
import { PARCHMENT_CONTROL_SURFACE_CLASS } from "@/lib/shell/parchment-control-surface";
import { ExploreYearsDaysEternitySection } from "@/components/explore/ExploreYearsDaysEternitySection";
import {
  filterEternityProse,
  filterEternityScriptures,
  formatScriptureBlockBody,
} from "@/lib/explore/years-days-eternity-blocks";
import { YEARS_DAYS_ETERNITY_EN } from "@/lib/explore/years-days-eternity-content-en";
import { YEARS_DAYS_ETERNITY_ZH } from "@/lib/explore/years-days-eternity-content";
import { applyZhTwToYearsDaysEternityBlocks } from "@/lib/explore/years-days-eternity-zh-tw";

type Props = {
  initialScriptureTexts: Record<string, string>;
  enScriptureBodyByRef?: Record<string, string>;
  enRefLabelByRaw?: Record<string, string>;
};

function LifeDayBattery({ filledSegments }: { filledSegments: number }) {
  const filled = Math.min(LIFE_BATTERY_SEGMENT_COUNT, Math.max(0, Math.round(filledSegments)));
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <div className="flex h-[72px] w-[120px] rounded-xl border-[3px] border-ink/55 bg-[#fffcf5]/95 p-2">
        <div className="flex h-full w-full gap-1">
          {Array.from({ length: LIFE_BATTERY_SEGMENT_COUNT }, (_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${i < filled ? "bg-[#FFB103]" : "bg-[#34C759]"}`}
            />
          ))}
        </div>
      </div>
      <div className="h-7 w-2 rounded-sm bg-ink/55" />
    </div>
  );
}

function BirthSettingsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [selectedDate, setSelectedDate] = useState<ExploreBirthDate>(() => defaultBirthDate());

  useEffect(() => {
    if (!open) return;
    const profile = readExploreYearDayProfile();
    if (profile.displayName) setName(profile.displayName);
    if (profile.birthDate) setSelectedDate(profile.birthDate);
    else setSelectedDate(defaultBirthDate());
  }, [open]);

  if (!open) return null;

  const save = () => {
    const birthDate = clampBirthDateToToday(clampBirthDate(selectedDate));
    if (!isValidBirthDate(birthDate)) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    writeExploreYearDayProfile({ birthDate, displayName: trimmed });
    onSaved();
    onClose();
  };

  return (
    <div className={`${PARCHMENT_CONTROL_SURFACE_CLASS.modalOverlay} parchment-control-overlay--fullscreen-form`}>
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-[1] mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 py-6 sm:max-w-lg ${PARCHMENT_CONTROL_SURFACE_CLASS.sheet} parchment-control-sheet--fullscreen-form`}
      >
        <h2 className="text-center font-serif text-[1.2rem] font-medium text-ink/90">
          {t("pages.explore.birthYearModalTitle")}
        </h2>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-muted">
          {t("pages.explore.birthYearModalHint")}
        </p>

        <label className={PARCHMENT_CONTROL_SURFACE_CLASS.label}>
          {t("pages.explore.birthYearModalNameLabel")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("pages.explore.birthYearModalNamePlaceholder")}
            className={`mt-1.5 text-center ${PARCHMENT_CONTROL_SURFACE_CLASS.field}`}
          />
        </label>

        <p className={PARCHMENT_CONTROL_SURFACE_CLASS.label}>
          {t("pages.explore.birthYearModalDateLabel")}
        </p>
        <ExploreBirthDatePicker value={selectedDate} onChange={setSelectedDate} />

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 ${PARCHMENT_CONTROL_SURFACE_CLASS.btn}`}
          >
            {t("pages.explore.birthYearModalCancel")}
          </button>
          <button
            type="button"
            onClick={save}
            className={`flex-1 ${PARCHMENT_CONTROL_SURFACE_CLASS.btnPrimary}`}
          >
            {t("pages.explore.birthYearModalSave")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExploreYearDayCountContent({
  initialScriptureTexts,
  enScriptureBodyByRef,
  enRefLabelByRaw,
}: Props) {
  const { t, locale } = useLocale();
  const [birthDate, setBirthDate] = useState<ExploreBirthDate | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const profile = readExploreYearDayProfile();
    if (!isExploreYearDayProfileComplete(profile)) {
      setSettingsOpen(true);
    }
    setBirthDate(profile.birthDate);
  }, [refreshKey]);

  const now = useMemo(() => new Date(), [refreshKey]);
  const century = useMemo(
    () => (birthDate != null ? getCenturyTimeline(birthDate, now) : null),
    [birthDate, now],
  );
  const filledSegments = century != null ? lifeBatteryFilledSegments(century.progress) : 0;
  const lifespans = getBiblicalLifespans(locale);

  const lifeDayTarget = YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET;
  const orderedRefs = useMemo(() => [...YEAR_DAY_COUNT_SCRIPTURES].reverse(), []);

  const lifeExpectancyIntro = useMemo(() => {
    if (locale === "en") return YEARS_DAYS_ETERNITY_EN.intro;
    if (locale === "zh-TW") return applyZhTwToYearsDaysEternityBlocks(YEARS_DAYS_ETERNITY_ZH.intro);
    return YEARS_DAYS_ETERNITY_ZH.intro;
  }, [locale]);

  const openRef = (ref: YearDayCountScriptureRef) => {
    window.location.href = `/read/${ref.bookId}/${ref.chapter}?verse=${ref.verseStart}`;
  };

  return (
    <div className="relative mx-auto w-full max-w-xl flex-1 px-5 pb-24 pt-6 text-ink sm:max-w-2xl md:px-8">
      <Link
        href="/explore"
        className="text-[13px] font-medium text-ink/72 underline decoration-ink/20 underline-offset-[0.2em]"
      >
        {t("pages.explore.yearDayCountBack")}
      </Link>

      <header className="mt-4 text-center">
        <h1 className="font-serif text-[clamp(1.5rem,4vw,1.9rem)] font-medium text-ink/92">
          {t("pages.explore.yearDayCountTitle")}
        </h1>
        <div className="mx-auto mt-4 h-px w-10 bg-border/55" />
        <p className="mt-4 text-[14px] leading-relaxed text-ink/72">{t("pages.explore.yearDayCountLead")}</p>
      </header>

      <section className="mt-8 flex flex-col items-center gap-4">
        {century != null ? (
          <Link
            href={`/read/${lifeDayTarget.bookId}/${lifeDayTarget.chapter}?verse=${lifeDayTarget.verseStart}`}
            className="text-[15px] font-medium text-amber-900/88 underline decoration-amber-800/25 underline-offset-[0.2em]"
          >
            {t("pages.explore.centuryTimelineLifeDayPrefix")}
            {century.lifeDay.toLocaleString()}
            {t("pages.explore.centuryTimelineLifeDaySuffix")}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-[15px] font-medium text-amber-900/88 underline decoration-amber-800/25 underline-offset-[0.2em]"
          >
            {t("pages.explore.centuryTimelineUnset")}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (century == null) setSettingsOpen(true);
          }}
          className="rounded-xl transition hover:opacity-90"
        >
          <LifeDayBattery filledSegments={filledSegments} />
        </button>

        {century != null ? (
          <p className="text-[12px] text-muted">
            {century.startYear} — {century.endYear} · {t("pages.explore.centuryTimelineAge", { age: String(century.ageYears) })}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="text-[12px] font-medium text-ink/55 underline decoration-ink/20 underline-offset-[0.15em]"
        >
          {t("pages.explore.birthYearSettingsLabel")}
        </button>
      </section>

      <section className="mt-8 border-y border-ink/10">
        <div className="max-h-[140px] overflow-y-auto">
          {orderedRefs.map((ref, index) => {
            const text = initialScriptureTexts[ref.id]?.trim();
            const refLabel = formatYearDayCountRef(ref, locale);
            return (
              <div
                key={ref.id}
                className={`px-2.5 py-2.5 ${index > 0 ? "border-t border-ink/8" : ""}`}
              >
                <p className="text-[16px] leading-relaxed text-ink/78">
                  {text || t("pages.explore.yearDayCountScripturePending")}{" "}
                  <button
                    type="button"
                    onClick={() => openRef(ref)}
                    className="text-[12px] font-semibold text-ink/50 underline decoration-ink/20 underline-offset-[0.12em]"
                  >
                    {refLabel}
                  </button>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-[1.05rem] font-medium text-ink/88">
          {t("pages.explore.yearDayCountLifespanHeading")}
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          {t("pages.explore.yearDayCountLifespanScale", { years: String(BIBLICAL_LIFESPAN_SCALE_YEARS) })}
        </p>
        <ul className="mt-4 space-y-3">
          {lifespans.map((entry) => {
            const scale = isBiblicalLifespanNewTestamentEra(entry.era)
              ? BIBLICAL_LIFESPAN_NT_SCALE_YEARS
              : BIBLICAL_LIFESPAN_SCALE_YEARS;
            const barPct = biblicalLifespanBarWidthPct(entry.years, scale);
            return (
              <li key={entry.id}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-medium text-ink/85">{entry.name}</span>
                  <span className="shrink-0 text-ink/55">{entry.lifespanDisplay}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/8">
                  <div className="h-full rounded-full bg-amber-700/75" style={{ width: `${barPct}%` }} />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openRef({
                      id: entry.id,
                      bookId: entry.bookId,
                      chapter: entry.chapter,
                      verseStart: entry.verseStart,
                      verseEnd: entry.verseEnd,
                    })
                  }
                  className="mt-0.5 text-[11px] text-ink/45 underline decoration-ink/15"
                >
                  {entry.refDisplay}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10 space-y-3 text-center text-[14px] leading-relaxed text-ink/72">
        {filterEternityProse(lifeExpectancyIntro).map((lines, i) => (
          <p key={`prose-${i}`}>{lines.join(locale === "en" ? " " : "")}</p>
        ))}
        {filterEternityScriptures(lifeExpectancyIntro).map((block, i) => (
          <div key={`scripture-${i}`} className="w-full max-w-[380px] mx-auto">
            <p>{formatScriptureBlockBody(block.lines)}</p>
            <p className="mt-1 text-right text-[12px] font-semibold text-ink/45">— {block.ref}</p>
          </div>
        ))}
      </section>

      <ExploreYearsDaysEternitySection
        enScriptureBodyByRef={enScriptureBodyByRef}
        enRefLabelByRaw={enRefLabelByRaw}
      />

      <BirthSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
