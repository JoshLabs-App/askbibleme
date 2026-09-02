import { describe, expect, it } from "vitest";
import { resolvePlanPlayContentAhead } from "@/lib/read/plan-play-content-ahead";

describe("resolvePlanPlayContentAhead", () => {
  it("today with no ahead stays on calendar today", () => {
    expect(resolvePlanPlayContentAhead(0, 0)).toBe(0);
  });

  it("browsing Aug 30 from Aug 19 previews +11", () => {
    expect(resolvePlanPlayContentAhead(11, 0)).toBe(11);
  });

  it("after setting Aug 30 as today, today stays on the committed pool", () => {
    expect(resolvePlanPlayContentAhead(0, 11)).toBe(11);
  });

  it("after setting Aug 30 as today, tomorrow is the next chapter in that pool", () => {
    expect(resolvePlanPlayContentAhead(1, 11)).toBe(12);
  });

  it("after setting Aug 30 as today, yesterday is the previous chapter in that pool", () => {
    expect(resolvePlanPlayContentAhead(-1, 11)).toBe(10);
  });
});
