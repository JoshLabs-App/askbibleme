import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

import {
  defaultReadBibleTypographyPrefs,
  readBibleSizeAtMin,
  stepReadBibleSize,
} from "./read-bible-typography-prefs";

describe("android read bible size", () => {
  it("defaults one step smaller than iOS m", () => {
    expect(defaultReadBibleTypographyPrefs().size).toBe("s");
  });

  it("can go smaller than the old minimum", () => {
    expect(stepReadBibleSize("s", -1)).toBe("xs");
    expect(readBibleSizeAtMin("s")).toBe(false);
    expect(readBibleSizeAtMin("xs")).toBe(true);
    expect(stepReadBibleSize("xs", -1)).toBe("xs");
  });
});
