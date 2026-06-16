/** Shared HTML landing for App browser OAuth — tries to bounce back into the native app. */
export function buildMobileOAuthLandingHtml(message: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AskBible.me</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f3ead8; color: #2b1d15; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; }
      main { max-width: 420px; text-align: center; line-height: 1.6; }
    </style>
    <script>
      (function () {
        var search = window.location.search || "";
        var hash = window.location.hash || "";
        if (search.indexOf("code=") === -1 && hash.indexOf("access_token=") === -1) return;
        var deepLink = "askbible://auth/callback" + search + hash;
        var isAndroid = /Android/i.test(navigator.userAgent || "");
        var intentLink = isAndroid
          ? "intent://auth/callback" + search + hash + "#Intent;scheme=askbible;package=me.askbible;end"
          : deepLink;
        window.location.replace(isAndroid ? intentLink : deepLink);
        setTimeout(function () {
          if (isAndroid) window.location.replace(deepLink);
        }, 600);
        setTimeout(function () {
          var link = document.getElementById("open-app");
          if (link) link.style.display = "inline-block";
        }, 1200);
      })();
    </script>
  </head>
  <body>
    <main>
      <p>${escapeHtml(message)}</p>
      <p id="open-app" style="display:none;margin-top:16px;">
        <a href="#" onclick="location.replace('askbible://auth/callback'+(location.search||'')+(location.hash||''));return false;">打开 AskBible.me App</a>
      </p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
