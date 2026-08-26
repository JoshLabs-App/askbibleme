import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { buildHomeVersePoolMenuRows, resolveHomeVersePoolMenuLabel } from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";
import { getHomeVersePoolScope, hydrateHomeVersePoolScope, setHomeVersePoolScope, subscribeHomeVersePoolScope } from "./homeVersePoolScopePrefs";
import { NatureHomeSettingsIconRow } from "./NatureHomeSettingsIconRow";
import { NatureHomeSettingsSelect, type NatureHomeSettingsSelectOption } from "./NatureHomeSettingsSelect";

export function NatureHomeVersePoolSection() {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void hydrateHomeVersePoolScope();
  }, []);
  const selected = useSyncExternalStore(
    subscribeHomeVersePoolScope,
    getHomeVersePoolScope,
    getHomeVersePoolScope,
  );
  const options = useMemo<NatureHomeSettingsSelectOption[]>(
    () =>
      buildHomeVersePoolMenuRows(locale)
        .filter((row) => row.kind !== "header")
        .map((row) => ({ id: row.scopeId, label: row.label })),
    [locale],
  );

  return (
    <NatureHomeSettingsIconRow icon="menu-book" accessibilityLabel={resolveHomeVersePoolMenuLabel(selected, locale)}>
      <NatureHomeSettingsSelect
        accessibilityLabel={resolveHomeVersePoolMenuLabel(selected, locale)}
        value={selected}
        options={options}
        open={open}
        onOpenChange={setOpen}
        onSelect={(id) => {
          setOpen(false);
          void setHomeVersePoolScope(id as Parameters<typeof setHomeVersePoolScope>[0]);
        }}
      />
    </NatureHomeSettingsIconRow>
  );
}
