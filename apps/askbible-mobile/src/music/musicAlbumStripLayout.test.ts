import { describe, expect, it } from "vitest";
import { albumStripContentWidth, albumStripScrollX } from "./musicAlbumStripLayout";

describe("albumStripContentWidth", () => {
  it("is zero for an empty row", () => {
    expect(albumStripContentWidth(0)).toBe(0);
  });

  it("includes item width and gaps", () => {
    expect(albumStripContentWidth(1)).toBe(56);
    expect(albumStripContentWidth(6)).toBe(56 * 6 + 12 * 5);
  });
});

describe("albumStripScrollX", () => {
  it("stays at 0 when the row fits", () => {
    expect(albumStripScrollX(3, 500, 4)).toBe(0);
  });

  it("clamps to the last reachable offset", () => {
    const count = 6;
    const viewport = 320;
    const maxScroll = albumStripContentWidth(count) - viewport;
    expect(albumStripScrollX(5, viewport, count)).toBe(maxScroll);
  });

  it("centers a middle item when there is room on both sides", () => {
    const count = 6;
    const viewport = 320;
    const itemLeft = 2 * (56 + 12);
    const expected = itemLeft - (viewport - 56) / 2;
    expect(albumStripScrollX(2, viewport, count)).toBe(expected);
  });
});
