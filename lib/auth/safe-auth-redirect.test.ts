import { describe, expect, it } from "vitest";
import { sanitizeAuthNextPath } from "./safe-auth-redirect";

describe("sanitizeAuthNextPath", () => {
  it("没带 next 时回网页版首页，不回官网", () => {
    expect(sanitizeAuthNextPath(null)).toBe("/web");
    expect(sanitizeAuthNextPath("  ")).toBe("/web");
  });

  it("旧链接里的 next=/ 也回网页版首页", () => {
    expect(sanitizeAuthNextPath("/")).toBe("/web");
  });

  it("站内深链原样保留", () => {
    expect(sanitizeAuthNextPath("/read/JHN/3")).toBe("/read/JHN/3");
  });

  it("站外地址和登录页自身一律回退", () => {
    expect(sanitizeAuthNextPath("https://evil.example")).toBe("/web");
    expect(sanitizeAuthNextPath("//evil.example")).toBe("/web");
    expect(sanitizeAuthNextPath("/login")).toBe("/web");
    expect(sanitizeAuthNextPath("/auth/callback?code=x")).toBe("/web");
  });
});
