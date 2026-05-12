/** 前台底栏（`HomeBottomNav`）与自然页湖水压层渐变同色 */
export const HOME_DOCK_NAV_BG = "#143C60" as const;

/**
 * 自然页底部 fixed 压层请用 `bottom` 避让底栏，勿用 `bottom-0` 叠在实色 nav 上。
 * 与 `HomeBottomNav` 一致：底栏总高 **70px**（`--home-bottom-nav-slot`）。
 * 视频槽高度：以主壳滚动区 `clientHeight` 为准（见 `NatureVideoExperience`）；`--home-bottom-nav-slot` 为回退与底栏约定。
 */
