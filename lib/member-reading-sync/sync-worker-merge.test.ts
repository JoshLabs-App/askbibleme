import { describe, expect, it } from "vitest";
import { mergeSyncBlobs } from "../../workers/askbible-sync/src/merge.js";

describe("askbible-sync server-side authoritative merger (D-44)", () => {
  it("erased chapter or token highlights do not resurrect from older cloud copy", () => {
    const cloud = {
      highlights: {
        updatedAt: "2026-11-20T10:00:00.000Z",
        value: {
          "cuv:GEN:1:1": [
            { i: 0, c: "#FFB103" },
            { i: 2, c: "#7FB069" },
          ],
          "cuv:JHN:3:16": [{ i: 1, c: "#FFB103" }],
        },
      },
    };
    const clientErased = {
      highlights: {
        updatedAt: "2026-11-20T12:00:00.000Z",
        value: {
          "cuv:GEN:1:1": [{ i: 0, c: "" }],
          "cuv:JHN:3:16": [],
        },
      },
    };
    const merged = mergeSyncBlobs(cloud, clientErased);
    expect(merged.highlights.value["cuv:JHN:3:16"]).toBeUndefined();
    expect(merged.highlights.value["cuv:GEN:1:1"]).toEqual([{ i: 2, c: "#7FB069" }]);
  });

  it("deleted bookmark tombstone wins over older saved bookmark", () => {
    const cloud = {
      bookmarks: {
        updatedAt: "2026-11-20T10:00:00.000Z",
        value: {
          "JHN:3:16": { savedAt: 1000, text: "神爱世人" },
          "ROM:8:28": { savedAt: 1000, text: "万事互相效力" },
        },
      },
    };
    const clientDeleted = {
      bookmarks: {
        updatedAt: "2026-11-20T12:00:00.000Z",
        value: {
          "JHN:3:16": { deleted: true, deletedAt: 2000 },
        },
      },
    };
    const merged = mergeSyncBlobs(cloud, clientDeleted);
    expect(merged.bookmarks.value["JHN:3:16"]).toBeUndefined();
    expect(merged.bookmarks.value["ROM:8:28"]).toBeDefined();
  });

  it("merges tripleLoopProgress and achievements monotonically across devices", () => {
    const base = {
      tripleLoopProgress: {
        updatedAt: "2026-11-18T00:00:00.000Z",
        value: {
          ot: { bookId: "EXO", chapter: 4 },
          nt: { bookId: "MAT", chapter: 2 },
          wisdom: { bookId: "PSA", chapter: 10 },
          chaptersReadKeys: { ot: ["GEN:1"], nt: ["MAT:1"], wisdom: ["PSA:1"] },
          startedAt: "2026-11-01",
        },
      },
      achievements: {
        updatedAt: "2026-11-18T00:00:00.000Z",
        value: {
          version: 1,
          versesRead: 120,
          earned: { first_read: { tier: 1, at: 2000 } },
        },
      },
    };
    const incoming = {
      tripleLoopProgress: {
        updatedAt: "2026-11-19T00:00:00.000Z",
        value: {
          ot: { bookId: "GEN", chapter: 9 },
          nt: { bookId: "MRK", chapter: 1 },
          wisdom: { bookId: "PSA", chapter: 23 },
          chaptersReadKeys: { ot: ["GEN:2"], nt: ["MRK:1"], wisdom: ["PSA:23"] },
          startedAt: "2026-10-15",
        },
      },
      achievements: {
        updatedAt: "2026-11-19T00:00:00.000Z",
        value: {
          version: 1,
          versesRead: 80,
          earned: { first_read: { tier: 2, at: 3000 } },
        },
      },
    };
    const merged = mergeSyncBlobs(base, incoming);
    expect(merged.tripleLoopProgress.value.ot).toEqual({ bookId: "EXO", chapter: 4 });
    expect(merged.tripleLoopProgress.value.nt).toEqual({ bookId: "MRK", chapter: 1 });
    expect(merged.tripleLoopProgress.value.wisdom).toEqual({ bookId: "PSA", chapter: 23 });
    expect(merged.tripleLoopProgress.value.startedAt).toBe("2026-10-15");
    expect(merged.tripleLoopProgress.value.chaptersRead).toEqual({ ot: 2, nt: 2, wisdom: 2 });
    expect(merged.achievements.value.versesRead).toBe(120);
    expect(merged.achievements.value.earned.first_read.tier).toBe(2);
  });
});
