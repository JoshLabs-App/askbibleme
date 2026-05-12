/** 前台底栏（`HomeBottomNav`）与自然页湖水压层渐变同色 */
export const HOME_DOCK_NAV_BG = "#143C60" as const;

/**
 * 自然页底部 fixed 压层请用 `bottom` 避让底栏，勿用 `bottom-0` 叠在实色 nav 上。
 * 与 `HomeBottomNav` 对齐：`pt-1.5` + `min-h-[3rem]` / `sm:min-h-[3.25rem]` + `pb-[max(0.5rem,env(safe-area-inset-bottom))]`。
 * Tailwind 类字面量写在 `NatureVideoExperience.tsx` 以便 JIT 收录。
 */
