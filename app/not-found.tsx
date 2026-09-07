import Link from "next/link";

export default function NotFound() {
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
        404
      </p>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 500, margin: 0 }}>这里没有经文</h1>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(43,29,21,0.76)", maxWidth: 360 }}>
        这个页面不存在，或者已经挪走了。
      </p>
      <Link
        href="/"
        style={{
          marginTop: "0.5rem",
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
          textDecoration: "none",
        }}
      >
        回到首页
      </Link>
    </div>
  );
}
