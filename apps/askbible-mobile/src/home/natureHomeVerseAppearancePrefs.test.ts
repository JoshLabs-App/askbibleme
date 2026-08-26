import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  platform: "android",
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.mem.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.mem.set(key, value);
    },
    removeItem: async (key: string) => {
      store.mem.delete(key);
    },
  },
}));

vi.mock("react-native", () => ({
  Platform: { get OS() { return store.platform; } },
}));

import {
  DEFAULT_TEXT_SCALE_INDEX,
  readNatureHomeTextScaleIndex,
  writeNatureHomeTextScaleIndex,
} from "./natureHomeVerseAppearancePrefs";
import { NATURE_HOME_PREFS_KEYS } from "./natureHomePrefsKeys";

describe("readNatureHomeTextScaleIndex", () => {
  beforeEach(() => {
    store.mem.clear();
    store.platform = "android";
  });

  it("keeps an explicit smaller-than-old-android-default step", async () => {
    await writeNatureHomeTextScaleIndex(DEFAULT_TEXT_SCALE_INDEX);
    const next = await readNatureHomeTextScaleIndex();
    expect(next).toBe(DEFAULT_TEXT_SCALE_INDEX);
    const raw = store.mem.get(NATURE_HOME_PREFS_KEYS.textScale);
    expect(raw).toContain(`"stepIndex":${DEFAULT_TEXT_SCALE_INDEX}`);
  });

  it("lets minus stay at one step below default", async () => {
    await writeNatureHomeTextScaleIndex(DEFAULT_TEXT_SCALE_INDEX - 1);
    await expect(readNatureHomeTextScaleIndex()).resolves.toBe(DEFAULT_TEXT_SCALE_INDEX - 1);
  });
});
