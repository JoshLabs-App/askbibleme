import { describe, expect, it } from "vitest";
import worker from "../../workers/askbible-sync/src/index.js";
import { mergeSyncBlobs } from "../../workers/askbible-sync/src/merge.js";
import { mergeMemberReadingSyncPush } from "./merge";

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

function makeMockD1(options: {
  initialDoc?: {
    user_id: string;
    schema_version: number;
    revision: string;
    blobs_json: string;
    updated_at: number;
  } | null;
  onBeforeWrite?: (attempt: number, state: { doc: typeof options.initialDoc }) => void;
}) {
  const state = {
    doc: options.initialDoc ? { ...options.initialDoc } : null,
    writeAttempts: 0,
  };
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          args = params;
          return stmt;
        },
        async first() {
          if (sql.includes("FROM sessions WHERE token_hash")) {
            return {
              token_hash: args[0],
              user_id: "user-1",
              email: "user1@example.com",
              expires_at: Date.now() + 86_400_000,
            };
          }
          if (sql.includes("FROM users WHERE id")) {
            return {
              id: "user-1",
              email: "user1@example.com",
              display_name: "User 1",
              locale: "zh-CN",
              is_admin: 0,
              created_at: 1000,
              updated_at: 1000,
            };
          }
          if (sql.includes("FROM reading_sync_docs WHERE user_id")) {
            return state.doc ? { ...state.doc } : null;
          }
          return null;
        },
        async run() {
          if (sql.startsWith("UPDATE sessions")) {
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("INSERT INTO reading_sync_docs")) {
            state.writeAttempts += 1;
            options.onBeforeWrite?.(state.writeAttempts, state);
            const [userId, revision, blobsJson, updatedAt] = args as [string, string, string, number];
            if (state.doc) {
              return { meta: { changes: 0 } };
            }
            state.doc = {
              user_id: userId,
              schema_version: 1,
              revision,
              blobs_json: blobsJson,
              updated_at: updatedAt,
            };
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("UPDATE reading_sync_docs")) {
            state.writeAttempts += 1;
            options.onBeforeWrite?.(state.writeAttempts, state);
            const [revision, blobsJson, updatedAt, userId, expectedRev] = args as [
              string,
              string,
              number,
              string,
              string,
            ];
            if (!state.doc || state.doc.user_id !== userId || state.doc.revision !== expectedRev) {
              return { meta: { changes: 0 } };
            }
            state.doc = {
              ...state.doc,
              revision,
              blobs_json: blobsJson,
              updated_at: updatedAt,
            };
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
  return { db, state };
}

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

  it("retains deleted bookmark tombstone for 60 days and blocks offline old device resurrection", () => {
    const nowMs = 10_000;
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
    const afterDelete = mergeSyncBlobs(cloud, clientDeleted, nowMs);
    expect(afterDelete.bookmarks.value["JHN:3:16"]).toEqual({ deleted: true, deletedAt: 2000 });
    expect(afterDelete.bookmarks.value["ROM:8:28"]).toBeDefined();

    // Offline old device pushes stale savedAt=1000 with newer blob.updatedAt: must NOT resurrect!
    const staleOfflinePush = {
      bookmarks: {
        updatedAt: "2026-11-21T00:00:00.000Z",
        value: {
          "JHN:3:16": { savedAt: 1000, text: "神爱世人" },
        },
      },
    };
    const afterStale = mergeSyncBlobs(afterDelete, staleOfflinePush, nowMs + 1000);
    expect(afterStale.bookmarks.value["JHN:3:16"]).toEqual({ deleted: true, deletedAt: 2000 });

    // User re-bookmarks with newer savedAt=3000: must win!
    const rebookmarked = {
      bookmarks: {
        updatedAt: "2026-11-21T01:00:00.000Z",
        value: {
          "JHN:3:16": { savedAt: 3000, text: "神爱世人" },
        },
      },
    };
    const afterRebookmark = mergeSyncBlobs(afterStale, rebookmarked, nowMs + 2000);
    expect(afterRebookmark.bookmarks.value["JHN:3:16"]).toEqual({ savedAt: 3000, text: "神爱世人" });

    // Expired tombstone (> 60 days) is garbage collected
    const expired = mergeSyncBlobs(
      afterDelete,
      { bookmarks: { updatedAt: "2027-01-25T00:00:00.000Z", value: {} } },
      2000 + SIXTY_DAYS_MS + 1,
    );
    expect(expired.bookmarks.value["JHN:3:16"]).toBeUndefined();
  });

  it("prevents partial-verse and full-verse highlight erasure resurrection via _t and lets newer re-highlight win", () => {
    const nowMs = 5000;
    const initial = {
      highlights: {
        updatedAt: "2026-11-20T10:00:00.000Z",
        value: {
          "cuv:GEN:1:1": [
            { i: 0, c: "#FFB103" },
            { i: 1, c: "#FFB103" },
            { i: 2, c: "#A3B565" },
          ],
          "cuv:JHN:3:16": [{ i: 0, c: "#4E86A0" }],
          _t: { "cuv:GEN:1:1": 1000, "cuv:JHN:3:16": 1000 },
        },
      },
    };
    const deviceErased = {
      highlights: {
        updatedAt: "2026-11-20T11:00:00.000Z",
        value: {
          "cuv:GEN:1:1": [{ i: 2, c: "#A3B565" }], // erased half-verse (0,1)
          // cuv:JHN:3:16 fully erased (absent from top-level keys)
          _t: { "cuv:GEN:1:1": 2000, "cuv:JHN:3:16": 2000 },
        },
      },
    };
    const afterErase = mergeSyncBlobs(initial, deviceErased, nowMs);
    expect(afterErase.highlights.value["cuv:GEN:1:1"]).toEqual([{ i: 2, c: "#A3B565" }]);
    expect(afterErase.highlights.value["cuv:JHN:3:16"]).toBeUndefined();
    expect(afterErase.highlights.value._t).toEqual({
      "cuv:GEN:1:1": 2000,
      "cuv:JHN:3:16": 2000,
    });

    // Stale offline device (both with older _t=1000 and legacy without _t) pushes old snapshot with newer blob.updatedAt
    const staleWithOldT = {
      highlights: {
        updatedAt: "2026-11-20T12:00:00.000Z",
        value: {
          "cuv:GEN:1:1": [
            { i: 0, c: "#FFB103" },
            { i: 1, c: "#FFB103" },
            { i: 2, c: "#A3B565" },
          ],
          "cuv:JHN:3:16": [{ i: 0, c: "#4E86A0" }],
          _t: { "cuv:GEN:1:1": 1000, "cuv:JHN:3:16": 1000 },
        },
      },
    };
    const afterStaleWithOldT = mergeSyncBlobs(afterErase, staleWithOldT, nowMs + 100);
    expect(afterStaleWithOldT.highlights.value["cuv:GEN:1:1"]).toEqual([{ i: 2, c: "#A3B565" }]);
    expect(afterStaleWithOldT.highlights.value["cuv:JHN:3:16"]).toBeUndefined();

    const staleLegacyNoT = {
      highlights: {
        updatedAt: "2026-11-20T13:00:00.000Z",
        value: {
          "cuv:GEN:1:1": [{ i: 0, c: "#FFB103" }],
          "cuv:JHN:3:16": [{ i: 0, c: "#4E86A0" }],
        },
      },
    };
    const afterStaleLegacy = mergeSyncBlobs(afterStaleWithOldT, staleLegacyNoT, nowMs + 200);
    expect(afterStaleLegacy.highlights.value["cuv:GEN:1:1"]).toEqual([{ i: 2, c: "#A3B565" }]);
    expect(afterStaleLegacy.highlights.value["cuv:JHN:3:16"]).toBeUndefined();

    // Newer re-highlight at t=3000 wins
    const rehighlighted = {
      highlights: {
        updatedAt: "2026-11-20T14:00:00.000Z",
        value: {
          "cuv:JHN:3:16": [{ i: 3, c: "#C0625F" }],
          _t: { "cuv:JHN:3:16": 3000 },
        },
      },
    };
    const afterRehighlight = mergeSyncBlobs(afterStaleLegacy, rehighlighted, nowMs + 300);
    expect(afterRehighlight.highlights.value["cuv:JHN:3:16"]).toEqual([{ i: 3, c: "#C0625F" }]);
    expect(afterRehighlight.highlights.value._t["cuv:JHN:3:16"]).toBe(3000);

    // Web client merge.ts stays 100% aligned with Worker merge.js
    const webMerged = mergeMemberReadingSyncPush(afterErase as never, staleWithOldT as never, nowMs + 100);
    expect(webMerged.highlights?.value).toEqual(afterStaleWithOldT.highlights.value);
  });

  it("retries POST /v1/sync/reading CAS loop on concurrent D1 conflict (changes: 0) without losing either write", async () => {
    const initialBlobs = {
      bookmarks: {
        updatedAt: "2026-11-20T09:00:00.000Z",
        value: {
          "cuv:GEN:1:1": { bookId: "GEN", chapter: 1, verse: 1, translationId: "cuv", savedAt: 500 },
        },
      },
    };
    const mock = makeMockD1({
      initialDoc: {
        user_id: "user-1",
        schema_version: 1,
        revision: "rev-initial",
        blobs_json: JSON.stringify(initialBlobs),
        updated_at: 900,
      },
      onBeforeWrite(attempt, state) {
        if (attempt === 1 && state.doc) {
          // Simulate concurrent Device B committing rev-concurrent-b right before Device A's UPDATE
          state.doc = {
            ...state.doc,
            revision: "rev-concurrent-b",
            blobs_json: JSON.stringify({
              bookmarks: {
                updatedAt: "2026-11-20T10:00:00.000Z",
                value: {
                  "cuv:GEN:1:1": { bookId: "GEN", chapter: 1, verse: 1, translationId: "cuv", savedAt: 500 },
                  "cuv:PSA:23:1": { bookId: "PSA", chapter: 23, verse: 1, translationId: "cuv", savedAt: 1500 },
                },
              },
            }),
            updated_at: 1500,
          };
        }
      },
    });

    const req = new Request("https://sync.askbible.me/v1/sync/reading", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        blobs: {
          bookmarks: {
            updatedAt: "2026-11-20T10:01:00.000Z",
            value: {
              "cuv:ROM:8:28": { bookId: "ROM", chapter: 8, verse: 28, translationId: "cuv", savedAt: 1600 },
            },
          },
        },
      }),
    });

    const res = await worker.fetch(req, { DB: mock.db });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      doc: { revision: string; blobs: { bookmarks: { value: Record<string, unknown> } } };
    };
    expect(body.ok).toBe(true);
    expect(mock.state.writeAttempts).toBe(2);
    // Both concurrent Device B ("cuv:PSA:23:1") AND Device A ("cuv:ROM:8:28") are preserved!
    expect(body.doc.blobs.bookmarks.value["cuv:GEN:1:1"]).toBeDefined();
    expect(body.doc.blobs.bookmarks.value["cuv:PSA:23:1"]).toBeDefined();
    expect(body.doc.blobs.bookmarks.value["cuv:ROM:8:28"]).toBeDefined();
  });

  it("retries concurrent INSERT conflict (ON CONFLICT DO NOTHING -> changes: 0) and merges row", async () => {
    const mock = makeMockD1({
      initialDoc: null,
      onBeforeWrite(attempt, state) {
        if (attempt === 1) {
          // Concurrent device inserted first row between SELECT and INSERT
          state.doc = {
            user_id: "user-1",
            schema_version: 1,
            revision: "rev-first-insert",
            blobs_json: JSON.stringify({
              highlights: {
                updatedAt: "2026-11-20T10:00:00.000Z",
                value: {
                  "cuv:PSA:23:1": [{ i: 0, c: "#FFB103" }],
                  _t: { "cuv:PSA:23:1": 1000 },
                },
              },
            }),
            updated_at: 1000,
          };
        }
      },
    });

    const req = new Request("https://sync.askbible.me/v1/sync/reading", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        blobs: {
          highlights: {
            updatedAt: "2026-11-20T10:01:00.000Z",
            value: {
              "cuv:JHN:3:16": [{ i: 1, c: "#A3B565" }],
              _t: { "cuv:JHN:3:16": 2000 },
            },
          },
        },
      }),
    });

    const res = await worker.fetch(req, { DB: mock.db });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      doc: { blobs: { highlights: { value: Record<string, unknown> } } };
    };
    expect(mock.state.writeAttempts).toBe(2);
    expect(body.doc.blobs.highlights.value["cuv:PSA:23:1"]).toEqual([{ i: 0, c: "#FFB103" }]);
    expect(body.doc.blobs.highlights.value["cuv:JHN:3:16"]).toEqual([{ i: 1, c: "#A3B565" }]);
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

  it("supports reusable, non-expiring, zero-cooldown store reviewer demo OTP credentials", async () => {
    const { db } = makeMockD1({ initialDoc: null });
    const env = {
      DB: db,
      REVIEWER_DEMO_EMAIL: "play-review-demo@askbible.me",
      REVIEWER_DEMO_OTP: "482917",
    };

    // Repeated sendOtp calls do not require Resend or hit 45s cooldown
    for (let i = 0; i < 3; i++) {
      const sendRes = await worker.fetch(
        new Request("https://askbible-sync.joshlabs.app/v1/auth/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "  PLAY-REVIEW-DEMO@askbible.me ", locale: "en" }),
        }),
        env
      );
      expect(sendRes.status).toBe(200);
      const sendBody = (await sendRes.json()) as { ok: boolean; email: string };
      expect(sendBody.ok).toBe(true);
      expect(sendBody.email).toBe("play-review-demo@askbible.me");
    }

    // Wrong codes return 401 without locking out the demo account after 5 attempts
    for (let i = 0; i < 6; i++) {
      const badRes = await worker.fetch(
        new Request("https://askbible-sync.joshlabs.app/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "play-review-demo@askbible.me", code: "000000", locale: "en" }),
        }),
        env
      );
      expect(badRes.status).toBe(401);
    }

    // Correct code remains reusable across multiple reviewer sessions
    for (let i = 0; i < 2; i++) {
      const okRes = await worker.fetch(
        new Request("https://askbible-sync.joshlabs.app/v1/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "play-review-demo@askbible.me",
            code: "482917",
            locale: "en",
            platform: "android",
          }),
        }),
        env
      );
      expect(okRes.status).toBe(200);
      const okBody = (await okRes.json()) as { ok: boolean; sessionToken: string; user: { email: string } };
      expect(okBody.ok).toBe(true);
      expect(okBody.sessionToken.length).toBeGreaterThan(20);
      expect(okBody.user.email).toBe("play-review-demo@askbible.me");
    }
  });
});
