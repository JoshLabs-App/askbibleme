/** Widget verse text scale — synced to native widget + optional user override. */
export type WidgetTextScalePref = "auto" | "comfortable" | "compact";

export const WIDGET_TEXT_SCALE_VALUES: WidgetTextScalePref[] = ["auto", "comfortable", "compact"];

export function isWidgetTextScalePref(value: string): value is WidgetTextScalePref {
  return WIDGET_TEXT_SCALE_VALUES.includes(value as WidgetTextScalePref);
}

export function nextWidgetTextScalePref(current: WidgetTextScalePref): WidgetTextScalePref {
  const idx = WIDGET_TEXT_SCALE_VALUES.indexOf(current);
  return WIDGET_TEXT_SCALE_VALUES[(idx + 1) % WIDGET_TEXT_SCALE_VALUES.length]!;
}
