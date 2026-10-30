/** 电视自带浏览器（LG webOS、三星 Tizen、索尼 / 飞利浦 / Fire TV 等）。遥控器操作不了界面，要自动进入电视模式。 */
export function isTvBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Web0S|webOS|SMART-TV|SmartTV|Tizen|BRAVIA|HbbTV|NetCast|GoogleTV|AFTT|AFTM|AFTS|CrKey|VIDAA/i.test(
    navigator.userAgent,
  );
}
