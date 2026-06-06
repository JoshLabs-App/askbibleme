"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type Props = {
  initialScriptureTexts: Record<string, string>;
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
  const [year, setYear] = useState(defaultBirthDate().year);
  const [month, setMonth] = useState(defaultBirthDate().month);
  const [day, setDay] = useState(defaultBirthDate().day);

  useEffect(() => {
    if (!open) return;
    const profile = readExploreYearDayProfile();
    if (profile.displayName) setName(profile.displayName);
    if (profile.birthDate) {
      setYear(profile.birthDate.year);
      setMonth(profile.birthDate.month);
      setDay(profile.birthDate.day);
    }
  }, [open]);

  if (!open) return null;

  const save = () => {
    const birthDate = clampBirthDateToToday(clampBirthDate({ year, month, day }));
    if (!isValidBirthDate(birthDate)) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    writeExploreYearDayProfile({ birthDate, displayName: trimmed });
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-ink/10 bg-canvas px-5 py-6 shadow-lg"
      >
        <h2 className="font-serif text-[1.2rem] font-medium text-ink/90">{t("pages.explore.birthYearModalTitle")}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t("pages.explore.birthYearModalHint")}</p>

        <label className="mt-5 block text-[13px] font-medium text-ink/75">
          {t("pages.explore.birthYearModalNameLabel")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("pages.explore.birthYearModalNamePlaceholder")}
            className="mt-1.5 w-full rounded-xl border border-ink/12 bg-canvas/80 px-3 py-2.5 text-[15px] outline-none focus:border-ink/25"
          />
        </label>

        <p className="mt-4 text-[13px] font-medium text-ink/75">{t("pages.explore.birthYearModalDateLabel")}</p>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-ink/12 bg-canvas/80 px-3 py-2.5 text-[15px] outline-none"
            aria-label="year"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-ink/12 bg-canvas/80 px-3 py-2.5 text-[15px] outline-none"
            aria-label="month"
          />
          <input
            type="number"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="rounded-xl border border-ink/12 bg-canvas/80 px-3 py-2.5 text-[15px] outline-none"
            aria-label="day"
          />
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-ink/12 px-4 py-2.5 text-[14px] font-medium text-ink/75"
          >
            {t("pages.explore.birthYearModalCancel")}
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-canvas"
          >
            {t("pages.explore.birthYearModalSave")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExploreYearDayCountContent({ initialScriptureTexts }: Props) {
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

  const bottomContext =
    locale === "en"
      ? {
          prose: "Global life expectancy is still brief. Our days pass quickly, but they are precious before God.",
          scripture:
            "The days of our years are threescore years and ten; and if by reason of strength they be fourscore years...",
          ref: "Psalm 90:10",
        }
      : {
          prose: "据 Our World in Data 数据，2023年全球平均预期寿命约为73岁。",
          scripture:
            "圣经《诗篇》90篇说：「我们一生的年日是七十岁，若是强壮可到八十岁；但其中所矜夸的，不过是劳苦愁烦，转眼成空，我们便如飞而去。」",
          ref: "诗篇 90:10",
        };

  const openRef = (ref: YearDayCountScriptureRef) => {
    window.location.href = `/read/${ref.bookId}/${ref.chapter}?verse=${ref.verseStart}`;
  };

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-5 pb-24 pt-6 text-ink sm:max-w-2xl md:px-8">
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

      <section className="mt-10 space-y-3 text-[14px] leading-relaxed text-ink/72">
        <p>{bottomContext.prose}</p>
        <p>{bottomContext.scripture}</p>
        <p className="text-right text-[12px] font-semibold text-ink/45">— {bottomContext.ref}</p>
      </section>

      <BirthSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
