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

  it.each(["/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r/evil.example"])(
    "拒绝浏览器规范化后会跳到站外的路径 %j",
    (next) => expect(sanitizeAuthNextPath(next)).toBe("/web"),
  );

  it.each(["/login?next=/web", "/register#signup", "/read/../login?next=/web", "/auth/callback/other"])(
    "规范化路径后拒绝登录回路 %j",
    (next) => expect(sanitizeAuthNextPath(next)).toBe("/web"),
  );

  it("保留合法站内深链的查询与片段", () => {
    expect(sanitizeAuthNextPath(" /read/JHN/3?verse=16#verse-16 ")).toBe("/read/JHN/3?verse=16#verse-16");
  });
});
