/**
 * 与羊皮卷等 `.dark` 自定义 CSS 对齐：Tailwind `darkMode: "class"` 依赖 `html.dark`，
 * 勿仅靠 `prefers-color-scheme`（否则会出现浅羊皮底 + `dark:text-stone-*` 浅字）。
 */
export const SYNC_HTML_DARK_CLASS_BOOT_SCRIPT = `
(function () {
  var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (!mq) return;
  function sync() {
    document.documentElement.classList.toggle("dark", mq.matches);
  }
  sync();
  if (mq.addEventListener) mq.addEventListener("change", sync);
  else if (mq.addListener) mq.addListener(sync);
})();
`.trim();
