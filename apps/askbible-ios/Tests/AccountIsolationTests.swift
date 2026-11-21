import XCTest
import Foundation
import SQLite3

/// Intercepts every request, including logout/account deletion. Tests never contact a real account.
private final class AccountURLProtocol: URLProtocol {
    static var handler: ((AccountURLProtocol) -> Void)?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() { Self.handler?(self) }
    override func stopLoading() {}

    func reply(_ status: Int = 200, _ value: Any = [:]) {
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil,
                                       headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: try! JSONSerialization.data(withJSONObject: value))
        client?.urlProtocolDidFinishLoading(self)
    }
}

@MainActor
final class AccountIsolationTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suiteName: String!
    private var engines: [MemberReadingSyncEngine] = []

    override func setUp() async throws {
        suiteName = "me.askbible.account-isolation-tests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
        clearTestRunnerStores()
        URLProtocol.registerClass(AccountURLProtocol.self)
        route { request in self.defaultReply(request) }
    }

    override func tearDown() async throws {
        engines.forEach { $0.cancelPendingWork() }
        engines = []
        defaults.removePersistentDomain(forName: suiteName)
        clearTestRunnerStores()
        AccountURLProtocol.handler = { $0.reply(200, ["ok": true]) }
    }

    private func clearTestRunnerStores() {
        for key in UserDefaults.standard.dictionaryRepresentation().keys
            where key.hasPrefix("askbible") || key.hasPrefix("selah") {
            UserDefaults.standard.removeObject(forKey: key)
        }
    }

    private func route(_ body: @escaping @MainActor (AccountURLProtocol) -> Void) {
        AccountURLProtocol.handler = { request in Task { @MainActor in body(request) } }
    }

    private func normalizedPath(_ url: URL) -> String {
        let p = url.path
        return p.hasPrefix("/api/sync/") ? String(p.dropFirst("/api/sync".count)) : p
    }

    private func defaultReply(_ request: AccountURLProtocol) {
        let path = normalizedPath(request.request.url!)
        let method = request.request.httpMethod ?? "GET"
        if path == "/v1/sync/reading" && method == "GET" {
            request.reply(200, ["ok": true, "doc": NSNull()])
        } else if path == "/v1/sync/reading" && method == "POST" {
            request.reply(200, ["ok": true, "doc": ["revision": "rev-1", "updatedAt": "2026-11-20T00:00:00.000Z", "blobs": [:]]])
        } else if path == "/v1/auth/profile" && method == "PATCH" {
            request.reply(200, ["ok": true])
        } else if path == "/v1/auth/logout" {
            request.reply(200, ["ok": true])
        } else {
            XCTFail("Unexpected intercepted request: \(method) \(path)")
            request.reply(500)
        }
    }

    private func session(_ id: String = "A", expiringSoon: Bool = false) -> MemberSession {
        MemberSession(
            sessionToken: "token-\(id)",
            expiresAt: ISO8601DateFormatter.millis.string(from: Date().addingTimeInterval(expiringSoon ? 3600 : 7 * 86_400)),
            user: MemberUser(id: id, email: "\(id)@example.invalid", name: "Test", locale: "en")
        )
    }

    private func auth(_ id: String = "A", expiringSoon: Bool = false) throws -> MemberAuthStore {
        defaults.set(try JSONEncoder().encode(session(id, expiringSoon: expiringSoon)), forKey: MemberAuthRules.sessionKey)
        return MemberAuthStore(defaults: defaults)
    }

    private func otpSessionReply(_ id: String = "A") -> [String: Any] {
        [
            "ok": true,
            "sessionToken": "fresh-\(id)",
            "expiresAt": ISO8601DateFormatter.millis.string(from: Date().addingTimeInterval(365 * 86_400)),
            "user": ["id": id, "email": "\(id)@example.invalid", "name": "Test"],
        ]
    }

    private func sessionVerifyReply(_ id: String = "A") -> [String: Any] {
        [
            "ok": true,
            "expiresAt": ISO8601DateFormatter.millis.string(from: Date().addingTimeInterval(365 * 86_400)),
            "user": ["id": id, "email": "\(id)@example.invalid", "name": "Test"],
        ]
    }

    private func sync(_ auth: MemberAuthStore) -> (MemberReadingSyncEngine, VerseHighlightStore) {
        let engine = MemberReadingSyncEngine(defaults: defaults)
        let highlights = VerseHighlightStore()
        engine.attach(auth: auth, plans: ReadingPlanStore(), bookmarks: VerseBookmarkStore(), activity: ReadingActivityStore(),
                      search: SearchPrefs(), highlights: highlights, achievements: AchievementStore())
        engines.append(engine)
        return (engine, highlights)
    }

    func testTransientVerifyFailuresDoNotSignOutTheCurrentAccount() async throws {
        for status in [429, 503] {
            let auth = try auth(expiringSoon: true)
            route { request in
                if self.normalizedPath(request.request.url!) == "/v1/auth/session" {
                    request.reply(status, ["error": "temporarily unavailable"])
                } else {
                    self.defaultReply(request)
                }
            }
            let token = await auth.ensureFreshToken()
            XCTAssertEqual(token, "token-A")
            XCTAssertEqual(auth.user?.id, "A", "HTTP \(status) must preserve the account")
            XCTAssertEqual(MemberAuthStore(defaults: defaults).user?.id, "A")
        }
    }

    func testLegacyV1JwtSessionIsCleanlyDroppedWithoutDeletingLocalStores() throws {
        let legacyJwt = """
        {"sessionToken":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJBIn0.sig","expiresAt":"2030-01-01T00:00:00.000Z","user":{"id":"A","email":"a@example.invalid","name":"A"}}
        """.data(using: .utf8)!
        defaults.set(legacyJwt, forKey: MemberAuthRules.sessionKey)
        let store = MemberAuthStore(defaults: defaults)
        XCTAssertNil(store.user)
        XCTAssertNil(defaults.data(forKey: MemberAuthRules.sessionKey))
    }

    func testVerifyCannotRestoreSessionAfterSignOut() async throws {
        let auth = try auth()
        let started = expectation(description: "verify suspended")
        var held: AccountURLProtocol?
        route { request in
            if self.normalizedPath(request.request.url!) == "/v1/auth/session" {
                held = request; started.fulfill()
            } else {
                self.defaultReply(request)
            }
        }
        let operation = Task { await auth.verifyRemote() }
        await fulfillment(of: [started], timeout: 5)
        auth.signOut()
        held!.reply(200, sessionVerifyReply("A"))
        await operation.value
        XCTAssertNil(auth.user)
        XCTAssertNil(defaults.data(forKey: MemberAuthRules.sessionKey))
    }

    func testOlderOtpSignInCannotReplaceNewerAccount() async throws {
        let auth = MemberAuthStore(defaults: defaults)
        let started = expectation(description: "first login suspended")
        var held: AccountURLProtocol?
        var calls = 0
        route { request in
            if self.normalizedPath(request.request.url!) == "/v1/auth/otp/verify" {
                calls += 1
                if calls == 1 { held = request; started.fulfill() }
                else { request.reply(200, self.otpSessionReply("B")) }
            } else {
                self.defaultReply(request)
            }
        }
        let first = Task { await auth.verifyOtp(email: "A@example.invalid", code: "123456", locale: "en") }
        await fulfillment(of: [started], timeout: 5)
        let secondError = await auth.verifyOtp(email: "B@example.invalid", code: "654321", locale: "en")
        XCTAssertNil(secondError)
        held!.reply(200, otpSessionReply("A"))
        _ = await first.value
        XCTAssertEqual(auth.user?.id, "B")
        XCTAssertEqual(MemberAuthStore(defaults: defaults).user?.id, "B")
    }

    func testConcurrentSlidingVerifyUsesOneRequest() async throws {
        let auth = try auth(expiringSoon: true)
        let started = expectation(description: "verify suspended")
        var held: AccountURLProtocol?
        var verifyCalls = 0
        route { request in
            if self.normalizedPath(request.request.url!) == "/v1/auth/session" {
                verifyCalls += 1; held = request; started.fulfill()
            } else {
                self.defaultReply(request)
            }
        }
        let first = Task { await auth.ensureFreshToken() }
        await fulfillment(of: [started], timeout: 5)
        let second = Task { await auth.ensureFreshToken() }
        await Task.yield()
        held!.reply(200, sessionVerifyReply("A"))
        let firstToken = await first.value
        let secondToken = await second.value
        XCTAssertEqual(firstToken, "token-A")
        XCTAssertEqual(secondToken, "token-A")
        XCTAssertEqual(verifyCalls, 1)
    }

    func testRenameDuringVerifyPreservesNewDisplayName() async throws {
        let auth = try auth(expiringSoon: true)
        let started = expectation(description: "verify suspended")
        var held: AccountURLProtocol?
        route { request in
            if self.normalizedPath(request.request.url!) == "/v1/auth/session" {
                held = request; started.fulfill()
            } else {
                self.defaultReply(request)
            }
        }
        let first = Task { await auth.ensureFreshToken() }
        await fulfillment(of: [started], timeout: 5)
        let renamed = await auth.updateDisplayName("New Name")
        XCTAssertTrue(renamed)
        held!.reply(200, sessionVerifyReply("A"))
        _ = await first.value
        XCTAssertEqual(auth.user?.name, "New Name")
        let stored = try XCTUnwrap(defaults.data(forKey: MemberAuthRules.sessionKey))
        let persisted = try JSONDecoder().decode(MemberSession.self, from: stored)
        XCTAssertEqual(persisted.user.name, "New Name")
    }

    func testLatePullCannotRestoreClearedReadingData() async throws {
        let auth = try auth()
        let (engine, highlights) = sync(auth)
        let started = expectation(description: "pull suspended")
        var held: AccountURLProtocol?
        route { request in
            if self.normalizedPath(request.request.url!) == "/v1/sync/reading" {
                held = request; started.fulfill()
            } else {
                self.defaultReply(request)
            }
        }
        let operation = Task { await engine.run(reason: "login") }
        await fulfillment(of: [started], timeout: 5)
        auth.signOut()
        engine.resetForAccountChange()
        held!.reply(200, [
            "ok": true,
            "doc": [
                "revision": "old",
                "blobs": ["highlights": ["value": ["cuv:GEN:1:1": [["i": 0, "c": "#FFB103"]]]]],
            ],
        ])
        let outcome = await operation.value
        XCTAssertEqual(outcome, .skipped)
        XCTAssertTrue(highlights.store.isEmpty)
        let meta = MemberReadingSyncRules.Meta.parse(defaults.string(forKey: MemberReadingSyncRules.metaKey))
        XCTAssertNil(meta.boundUserId)
        XCTAssertTrue(meta.requirePullOnly)
    }

    func testLatePushCannotMergeDataAfterAccountSwitch() async throws {
        let auth = try auth()
        let (engine, highlights) = sync(auth)
        highlights.paint(translationId: "cuv", bookId: "GEN", chapter: 1, verse: 1, range: 0...2, color: "#FFB103")
        engine.cancelPendingWork()
        let started = expectation(description: "push suspended")
        var held: AccountURLProtocol?
        var writes = 0
        route { request in
            let path = self.normalizedPath(request.request.url!)
            if path == "/v1/sync/reading", request.request.httpMethod == "POST" {
                writes += 1; held = request; started.fulfill()
            } else if path == "/v1/auth/otp/verify" {
                request.reply(200, self.otpSessionReply("B"))
            } else {
                self.defaultReply(request)
            }
        }
        let operation = Task { await engine.run(reason: "login") }
        await fulfillment(of: [started], timeout: 5)
        auth.signOut()
        engine.resetForAccountChange()
        let loginError = await auth.verifyOtp(email: "B@example.invalid", code: "123456", locale: "en")
        XCTAssertNil(loginError)
        highlights.paint(translationId: "cuv", bookId: "JHN", chapter: 1, verse: 1, range: 0...1, color: "#FFB103")
        held!.reply(200, [
            "ok": true,
            "doc": [
                "revision": "late-A",
                "blobs": ["highlights": ["value": ["cuv:GEN:1:1": [["i": 0, "c": "#FFB103"]]]]],
            ],
        ])
        let outcome = await operation.value
        XCTAssertEqual(outcome, .skipped)
        XCTAssertEqual(writes, 1)
        XCTAssertEqual(Set(highlights.store.keys), ["cuv:JHN:1:1"])
        XCTAssertEqual(Set(VerseHighlightStore().store.keys), ["cuv:JHN:1:1"])
    }

    func testAccountSwitchClearsPersistedHighlights() throws {
        let auth = try auth()
        let (engine, highlights) = sync(auth)
        highlights.paint(translationId: "cuv", bookId: "GEN", chapter: 1, verse: 1, range: 0...2, color: "#FFB103")
        XCTAssertFalse(VerseHighlightStore().store.isEmpty)
        engine.resetForAccountChange()
        XCTAssertTrue(highlights.store.isEmpty)
        XCTAssertTrue(VerseHighlightStore().store.isEmpty)
    }

    func testFailedAccountDeletionPreservesLocalProgress() async throws {
        let auth = try auth()
        let (engine, highlights) = sync(auth)
        highlights.paint(translationId: "cuv", bookId: "GEN", chapter: 1, verse: 1, range: 0...2, color: "#FFB103")
        route { request in
            if request.request.httpMethod == "DELETE" { request.reply(503, ["error": "network"]) }
            else { self.defaultReply(request) }
        }
        engine.cancelPendingWork()
        let error = await auth.deleteAccount()
        XCTAssertNotNil(error)
        XCTAssertEqual(auth.user?.id, "A")
        XCTAssertFalse(highlights.store.isEmpty)
        XCTAssertFalse(VerseHighlightStore().store.isEmpty)
    }

    func testHighlightOnlyGuestProgressIsUploadedInSingleRoundTrip() async throws {
        let auth = try auth()
        let (engine, highlights) = sync(auth)
        highlights.paint(translationId: "cuv", bookId: "GEN", chapter: 1, verse: 1, range: 0...2, color: "#FFB103")
        engine.cancelPendingWork()
        var writes = 0
        route { request in
            let path = self.normalizedPath(request.request.url!)
            if path == "/v1/sync/reading", request.request.httpMethod == "POST" {
                writes += 1
                request.reply(200, [
                    "ok": true,
                    "doc": [
                        "revision": "rev-merged",
                        "updatedAt": "2026-11-20T00:00:00.000Z",
                        "blobs": ["highlights": ["updatedAt": "2026-11-20T00:00:00.000Z", "value": ["cuv:GEN:1:1": [["i": 0, "c": "#FFB103"]]]]],
                    ],
                ])
            } else {
                self.defaultReply(request)
            }
        }
        let outcome = await engine.run(reason: "login")
        XCTAssertEqual(outcome, .ok)
        XCTAssertEqual(writes, 1)
        XCTAssertFalse(highlights.store.isEmpty)
    }

    func testPackStoreValidatesSQLitePagesAndSha256BeforeAtomicSwap() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("packstore-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        let validSrc = dir.appendingPathComponent("valid.sqlite")
        var db: OpaquePointer?
        XCTAssertEqual(sqlite3_open(validSrc.path, &db), SQLITE_OK)
        XCTAssertEqual(sqlite3_exec(db, "CREATE TABLE meta(key TEXT, value TEXT); INSERT INTO meta VALUES('v','1');", nil, nil, nil), SQLITE_OK)
        sqlite3_close(db)

        XCTAssertTrue(PackStore.isValidSQLiteFile(validSrc))
        let sha = try XCTUnwrap(PackStore.sha256Hex(of: validSrc))

        let dest = dir.appendingPathComponent("installed.sqlite")
        let tmpCopy1 = dir.appendingPathComponent("dl1.tmp")
        try FileManager.default.copyItem(at: validSrc, to: tmpCopy1)
        try PackStore.installSQLiteAtomically(from: tmpCopy1, to: dest, expectedSha256: sha)
        XCTAssertTrue(PackStore.isValidSQLiteFile(dest))

        // Corrupt / truncated download must never overwrite the already-installed valid SQLite pack
        let truncated = dir.appendingPathComponent("truncated.tmp")
        let raw = try Data(contentsOf: dest)
        try raw.prefix(raw.count - 128).write(to: truncated)
        XCTAssertFalse(PackStore.isValidSQLiteFile(truncated))
        XCTAssertThrowsError(try PackStore.installSQLiteAtomically(from: truncated, to: dest, expectedSha256: sha))
        XCTAssertEqual(PackStore.sha256Hex(of: dest), sha)
    }

    func testPackStoreDecodesV2CatalogSchemaAndMapsLocalPackKeys() throws {
        let json = """
        {"schemaVersion":2,"generatedAt":"2026-11-20T00:00:00Z","packs":[
          {"id":"bible.cuv-simp","kind":"sqlite","path":"bible/cuv-simp.sqlite","sha256":"abc123","sizeBytes":5013504},
          {"id":"companion.xrefs","kind":"sqlite","path":"bible/scripture-xrefs.sqlite","sha256":"def456","sizeBytes":1728512}
        ]}
        """.data(using: .utf8)!
        let catalog = try JSONDecoder().decode(PackStore.PackCatalog.self, from: json)
        XCTAssertEqual(catalog.schemaVersion, 2)
        XCTAssertEqual(catalog.packs.count, 2)
        XCTAssertEqual(PackStore.localPackKey(for: catalog.packs[0]), "cuv-simp")
        XCTAssertEqual(PackStore.localPackKey(for: catalog.packs[1]), "scripture-xrefs")
    }
}
