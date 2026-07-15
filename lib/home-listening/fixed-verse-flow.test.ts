import { describe, expect, it } from "vitest";
import {
  buildFixedVerseFlow,
  HOME_LISTENING_GROUP_FLOW_LENGTH,
  homeListeningPosition,
} from "./fixed-verse-flow";

describe("fixed home listening flow", () => {
  it("plays every verse in a seven-verse group four times", () => {
    const keys = ["A", "B", "C", "D", "E", "F", "G"];
    const flow = buildFixedVerseFlow(keys, 0, HOME_LISTENING_GROUP_FLOW_LENGTH);
    expect(flow).toHaveLength(28);
    for (const key of keys) {
      expect(flow.filter((value) => value === key)).toHaveLength(4);
    }
    expect(flow.some((value, index) => index > 0 && value === flow[index - 1])).toBe(false);
  });

  it("moves to the next source group after one fixed flow", () => {
    const keys = Array.from({ length: 14 }, (_, index) => `V${index}`);
    expect(buildFixedVerseFlow(keys, 0, 1)).toEqual(["V0"]);
    expect(buildFixedVerseFlow(keys, 28, 1)).toEqual(["V7"]);
  });

  it("wraps the final partial group within the selected range", () => {
    const keys = Array.from({ length: 8 }, (_, index) => `V${index}`);
    const secondGroup = buildFixedVerseFlow(keys, 28, 28);
    expect(new Set(secondGroup)).toEqual(new Set(["V7", "V0", "V1", "V2", "V3", "V4", "V5"]));
    expect(secondGroup[0]).toBe("V7");
  });

  it("reports seven groups as one completed journey", () => {
    expect(homeListeningPosition(0)).toMatchObject({ stage: 1, group: 1, completedStages: 0 });
    expect(homeListeningPosition(28 * 6)).toMatchObject({ stage: 1, group: 7 });
    expect(homeListeningPosition(28 * 7)).toMatchObject({ stage: 2, group: 1, completedStages: 1 });
  });
});
