import type { Metadata } from "next";

/**
 * 下载页：`askbible.me/app`。
 *
 * **为什么放在自己站上**（Josh 2026-09-23）：成就分享图、口头传播都要带这个地址，
 * `askbible-media.joshlabs.app/download.html` 又长又不像自家的。
 * APK 本体仍然放 R2（几十兆，不走 Render），页面归我们。
 *
 * 版本号从 R2 的 `version.json` 现取（`deploy_android.py` 每次发版都会写），
 * 所以发安卓版**不需要**重新部署网站。
 */
export const metadata: Metadata = {
  title: "下载 AskBible",
  description: "AskBible 安卓版下载。iPhone / iPad 请到 App Store。",
};

/** 一小时新鲜期：发版后最多一小时页面上的版本号就跟上了 */
export const revalidate = 3600;

const VERSION_URL = "https://askbible-media.joshlabs.app/version.json";
const APK_URL = "https://askbible-media.joshlabs.app/downloads/android/AskBible-latest.apk";

type VersionInfo = { version?: string; versionCode?: number; apkUrl?: string; notes?: string; date?: string };

async function loadVersion(): Promise<VersionInfo | null> {
  try {
    const res = await fetch(VERSION_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as VersionInfo;
  } catch {
    // 取不到就退回静态直链 —— 页面照常能下，只是不显示版本号
    return null;
  }
}

export default async function AppDownloadPage() {
  const info = await loadVersion();
  const apk = info?.apkUrl || APK_URL;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "48px 20px",
        background: "linear-gradient(160deg,#FFFCF5 0%,#F5EBE0 55%,#ECD9B9 100%)",
        color: "#1C1410",
        fontFamily:
          'ui-sans-serif,system-ui,-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
        textAlign: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/app-icon.png"
        alt="AskBible"
        width={104}
        height={104}
        style={{ borderRadius: 24, boxShadow: "0 8px 28px rgba(92,64,48,.22)" }}
      />

      <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>AskBible</h1>
      <p style={{ margin: 0, fontSize: 15, color: "#5C4030", maxWidth: 420, lineHeight: 1.7 }}>
        读经、听读、按计划跟进度，遇到不懂的地方随时问。
      </p>

      <a
        href={apk}
        style={{
          marginTop: 10,
          display: "inline-block",
          padding: "15px 44px",
          borderRadius: 999,
          background: "#D97707",
          color: "#fff",
          fontSize: 17,
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: "0 6px 20px rgba(217,119,7,.32)",
        }}
      >
        下载安卓版
      </a>

      <p style={{ margin: 0, fontSize: 13, color: "#6E5240" }}>
        {info?.version ? `版本 ${info.version}` : "最新版"}
        {info?.versionCode ? ` (${info.versionCode})` : ""} · Android 8.0+
      </p>

      {info?.notes ? (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "#5C4030",
            maxWidth: 420,
            lineHeight: 1.7,
            background: "rgba(255,255,255,.55)",
            border: "1px solid rgba(217,119,7,.22)",
            borderRadius: 14,
            padding: "12px 16px",
          }}
        >
          {info.notes}
        </p>
      ) : null}

      <p style={{ margin: "14px 0 0", fontSize: 13, color: "#6E5240", lineHeight: 1.8 }}>
        装完之后有新版会在 App 里提示，点一下就更新。
        <br />
        iPhone / iPad 请到 App Store 搜「AskBible」。
      </p>

      <a href="https://askbible.me" style={{ marginTop: 6, fontSize: 13, color: "#D97707" }}>
        askbible.me
      </a>
    </main>
  );
}
