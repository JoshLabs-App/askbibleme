"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
        backgroundColor: "#ecd9b9",
        color: "#2b1d15",
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(77,53,34,0.62)",
        }}
      >
        出了一点小问题
      </p>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 500, margin: 0 }}>先歇一下，再试试</h1>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(43,29,21,0.76)", maxWidth: 360 }}>
        页面遇到了一点问题，刷新通常就能恢复。
      </p>
      <div style={{ marginTop: "0.5rem", display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            display: "inline-flex",
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            padding: "0 24px",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#fffdf8",
            backgroundColor: "#ffb101",
            border: "none",
            cursor: "pointer",
          }}
        >
          重试
        </button>
        <a
          href="/"
          style={{
            display: "inline-flex",
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            padding: "0 24px",
            fontSize: 15,
            fontWeight: 600,
            color: "#2b1d15",
            backgroundColor: "rgba(255,252,245,0.88)",
            border: "1px solid rgba(120,53,15,0.22)",
            textDecoration: "none",
          }}
        >
          回到首页
        </a>
      </div>
    </div>
  );
}
