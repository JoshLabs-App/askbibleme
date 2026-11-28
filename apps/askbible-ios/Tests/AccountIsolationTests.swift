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

    func testAppPackStoreIncrementalReuseAtomicSwapAndBuiltinEviction() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("apppack-\(UUID().uuidString)", isDirectory: true)
        let sandbox = root.appendingPathComponent("sandbox", isDirectory: true)
        let builtin = root.appendingPathComponent("builtin", isDirectory: true)
        try FileManager.default.createDirectory(at: sandbox, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: builtin, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let builtinIndex = Data("<html>builtin</html>".utf8)
        let vendorJS = Data("console.log('shared-vendor-v1');".utf8)
        let appV1JS = Data("console.log('app-v1');".utf8)
        let appV2JS = Data("console.log('app-v2');".utf8)
        let indexV2 = Data("<html>v2</html>".utf8)

        try builtinIndex.write(to: builtin.appendingPathComponent("index.html"))
        try vendorJS.write(to: builtin.appendingPathComponent("vendor.js"))
        let builtinManifest = AppPackStore.Manifest(
            schemaVersion: 1,
            bundleId: "builtin-1",
            builtAt: "2026-11-27T00:00:00Z",
            entry: "index.html",
            files: [
                "index.html": .init(size: builtinIndex.count, sha256: PackStore.sha256Hex(of: builtinIndex)),
                "vendor.js": .init(size: vendorJS.count, sha256: PackStore.sha256Hex(of: vendorJS)),
            ]
        )
        try JSONEncoder().encode(builtinManifest).write(to: builtin.appendingPathComponent("pack-manifest.json"))

        let manifestV1 = AppPackStore.Manifest(
            schemaVersion: 1,
            bundleId: "20261127-v1",
            builtAt: "2026-11-27T01:00:00Z",
            entry: "index.html",
            files: [
                "index.html": .init(size: builtinIndex.count, sha256: PackStore.sha256Hex(of: builtinIndex)),
                "vendor.js": .init(size: vendorJS.count, sha256: PackStore.sha256Hex(of: vendorJS)),
                "app.js": .init(size: appV1JS.count, sha256: PackStore.sha256Hex(of: appV1JS)),
            ]
        )
        let manifestV2 = AppPackStore.Manifest(
            schemaVersion: 1,
            bundleId: "20261127-v2",
            builtAt: "2026-11-27T02:00:00Z",
            entry: "index.html",
            files: [
                "index.html": .init(size: indexV2.count, sha256: PackStore.sha256Hex(of: indexV2)),
                "vendor.js": .init(size: vendorJS.count, sha256: PackStore.sha256Hex(of: vendorJS)),
                "app.js": .init(size: appV2JS.count, sha256: PackStore.sha256Hex(of: appV2JS)),
            ]
        )

        var requestedPaths: [String] = []
        var activeRemoteManifest = manifestV1
        var activeAppJS = appV1JS
        var activeIndexHTML = builtinIndex

        route { req in
            let path = req.request.url?.path ?? ""
            requestedPaths.append(path)
            if path.hasSuffix("/pack-manifest.json") {
                let data = try! JSONEncoder().encode(activeRemoteManifest)
                let resp = HTTPURLResponse(url: req.request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
                req.client?.urlProtocol(req, didReceive: resp, cacheStoragePolicy: .notAllowed)
                req.client?.urlProtocol(req, didLoad: data)
                req.client?.urlProtocolDidFinishLoading(req)
            } else if path.hasSuffix("/app.js") {
                let resp = HTTPURLResponse(url: req.request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/javascript"])!
                req.client?.urlProtocol(req, didReceive: resp, cacheStoragePolicy: .notAllowed)
                req.client?.urlProtocol(req, didLoad: activeAppJS)
                req.client?.urlProtocolDidFinishLoading(req)
            } else if path.hasSuffix("/index.html") {
                let resp = HTTPURLResponse(url: req.request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "text/html"])!
                req.client?.urlProtocol(req, didReceive: resp, cacheStoragePolicy: .notAllowed)
                req.client?.urlProtocol(req, didLoad: activeIndexHTML)
                req.client?.urlProtocolDidFinishLoading(req)
            } else {
                XCTFail("Unexpected network fetch for unchanged/unknown file: \(path)")
                req.reply(404)
            }
        }

        let baseURL = URL(string: "https://pack-test.askbible.invalid/v3/app-pack/")!
        let store = AppPackStore(
            rootDirectory: sandbox,
            builtinDirectory: builtin,
            currentBuiltinId: "1.1.11+151:builtin-1",
            manifestBaseURLs: [baseURL],
            defaults: defaults
        )

        var readyEvents: [String] = []
        store.onReadyToSwap = { readyEvents.append($0) }

        let firstOutcome = await store.refreshIfNeeded(force: true)
        XCTAssertEqual(firstOutcome, .readyToSwap("20261127-v1"))
        // index.html and vendor.js matched builtin -> 0 network traffic; only app.js downloaded
        XCTAssertFalse(requestedPaths.contains { $0.hasSuffix("/vendor.js") })
        XCTAssertFalse(requestedPaths.contains { $0.hasSuffix("/index.html") })
        XCTAssertTrue(requestedPaths.contains { $0.hasSuffix("/app.js") })

        // Before commitPendingSwap(), active pack must still serve builtin index.html
        XCTAssertEqual(store.resolveFile(relativePath: "index.html")?.data, builtinIndex)
        XCTAssertNil(store.resolveFile(relativePath: "app.js"))

        let swap1 = store.commitPendingSwap()
        XCTAssertTrue(swap1.swapped)
        XCTAssertEqual(swap1.bundleId, "20261127-v1")
        XCTAssertEqual(store.resolveFile(relativePath: "app.js")?.data, appV1JS)

        // Verify active.json records bundleId, installedOnBuiltinId, activatedAt
        let activeJSON = try Data(contentsOf: sandbox.appendingPathComponent("active.json"))
        let activeState = try JSONDecoder().decode(AppPackStore.ActiveState.self, from: activeJSON)
        XCTAssertEqual(activeState.bundleId, "20261127-v1")
        XCTAssertEqual(activeState.installedOnBuiltinId, "1.1.11+151:builtin-1")
        XCTAssertFalse(activeState.activatedAt.isEmpty)

        // Second incremental update: vendor.js unchanged -> 0 traffic; index.html & app.js changed -> downloaded
        requestedPaths.removeAll()
        activeRemoteManifest = manifestV2
        activeAppJS = appV2JS
        activeIndexHTML = indexV2

        let secondOutcome = await store.refreshIfNeeded(force: true)
        XCTAssertEqual(secondOutcome, .readyToSwap("20261127-v2"))
        XCTAssertFalse(requestedPaths.contains { $0.hasSuffix("/vendor.js") })
        XCTAssertTrue(requestedPaths.contains { $0.hasSuffix("/index.html") })
        XCTAssertTrue(requestedPaths.contains { $0.hasSuffix("/app.js") })

        let swap2 = store.commitPendingSwap()
        XCTAssertTrue(swap2.swapped)
        XCTAssertEqual(store.resolveFile(relativePath: "index.html")?.data, indexV2)
        XCTAssertEqual(store.resolveFile(relativePath: "app.js")?.data, appV2JS)

        // Reinstall newer native build (installedOnBuiltinId != currentBuiltinId) must evict old sandbox pack
        let reloaded = AppPackStore(
            rootDirectory: sandbox,
            builtinDirectory: builtin,
            currentBuiltinId: "1.1.12+152:builtin-2",
            manifestBaseURLs: [baseURL],
            defaults: defaults
        )
        XCTAssertEqual(reloaded.resolveFile(relativePath: "index.html")?.data, builtinIndex)
        XCTAssertNil(reloaded.resolveFile(relativePath: "app.js"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: sandbox.appendingPathComponent("active.json").path))
    }

    func testLocalDBRouterServesChapterSearchAndTranslationsAndNoStoreHeader() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("localdb-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        let sqliteURL = dir.appendingPathComponent("cuv-simp.sqlite")
        var db: OpaquePointer?
        XCTAssertEqual(sqlite3_open(sqliteURL.path, &db), SQLITE_OK)
        let setupSQL = """
        CREATE TABLE meta(key TEXT, value TEXT);
        CREATE TABLE verse(book_id TEXT, chapter INTEGER, verse INTEGER, text TEXT, speech_spans TEXT, flags INTEGER, theme_repeat_count INTEGER);
        INSERT INTO verse VALUES('JHN', 3, 16, '神爱世人，甚至将他的独生子赐给他们。', NULL, 0, 5);
        """
        XCTAssertEqual(sqlite3_exec(db, setupSQL, nil, nil, nil), SQLITE_OK)
        sqlite3_close(db)

        let router = LocalDBRouter(directory: dir)
        XCTAssertTrue(router.canHandle(path: "/local-db/chapter"))
        XCTAssertTrue(router.canHandle(path: "/local-db/search"))
        XCTAssertTrue(router.canHandle(path: "/local-db/translations"))

        let chapterRes = router.handle(url: URL(string: "askbible-pack://app/local-db/chapter?t=cuv-simp&b=JHN&c=3")!)
        XCTAssertEqual(chapterRes.statusCode, 200)
        let chapterJSON = try XCTUnwrap(try JSONSerialization.jsonObject(with: chapterRes.body) as? [String: Any])
        XCTAssertEqual(chapterJSON["ok"] as? Bool, true)
        let verses = try XCTUnwrap(chapterJSON["verses"] as? [[String: Any]])
        XCTAssertEqual(verses.count, 1)
        XCTAssertEqual(verses[0]["verse"] as? Int, 16)
        XCTAssertEqual(verses[0]["isGolden"] as? Bool, true)

        let searchRes = router.handle(url: URL(string: "askbible-pack://app/local-db/search?t=cuv-simp&q=%E7%8B%AC%E7%94%9F%E5%AD%90&limit=50")!)
        XCTAssertEqual(searchRes.statusCode, 200)
        let searchJSON = try XCTUnwrap(try JSONSerialization.jsonObject(with: searchRes.body) as? [String: Any])
        XCTAssertEqual(searchJSON["total"] as? Int, 1)

        let trRes = router.handle(url: URL(string: "askbible-pack://app/local-db/translations")!)
        XCTAssertEqual(trRes.statusCode, 200)
        let trJSON = try XCTUnwrap(try JSONSerialization.jsonObject(with: trRes.body) as? [String: Any])
        let translations = try XCTUnwrap(trJSON["translations"] as? [[String: Any]])
        XCTAssertFalse(translations.isEmpty)
        XCTAssertEqual(LocalPackURLSchemeHandler.noCacheHeader, "no-store, no-cache")
    }
}
