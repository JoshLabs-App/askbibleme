import XCTest
import Foundation

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
        // Shared URLSession may still deliver a best-effort logout; keep all requests intercepted.
        AccountURLProtocol.handler = { $0.reply(200) }
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

    private func defaultReply(_ request: AccountURLProtocol) {
        let path = request.request.url!.path
        if path.contains("askbible_profiles") {
            request.reply(200, [["display_name": "Test", "locale": "en"]])
        } else if path.contains("member_reading_sync_documents") {
            request.reply(200, [])
        } else if path == "/auth/v1/logout" {
            request.reply(200)
        } else {
            XCTFail("Unexpected intercepted request: \(path)")
            request.reply(500)
        }
    }

    private func session(_ id: String = "A", expiring: Bool = false) -> MemberSession {
        MemberSession(sessionToken: "token-\(id)",
                      expiresAt: ISO8601DateFormatter.millis.string(from: Date().addingTimeInterval(expiring ? 30 : 3600)),
                      user: MemberUser(id: id, email: "\(id)@example.invalid", name: "Test", locale: "en"),
                      refreshToken: "refresh-\(id)")
    }

    private func auth(_ id: String = "A", expiring: Bool = false) throws -> MemberAuthStore {
        defaults.set(try JSONEncoder().encode(session(id, expiring: expiring)), forKey: MemberAuthRules.sessionKey)
        return MemberAuthStore(defaults: defaults)
    }

    private func tokenReply(_ id: String = "A") -> [String: Any] {
        ["access_token": "fresh-\(id)", "refresh_token": "next-\(id)", "expires_at": Date().timeIntervalSince1970 + 3600,
         "user": ["id": id, "email": "\(id)@example.invalid"]]
    }

    private func sync(_ auth: MemberAuthStore) -> (MemberReadingSyncEngine, VerseHighlightStore) {
        let engine = MemberReadingSyncEngine(defaults: defaults)
        let highlights = VerseHighlightStore()
        engine.attach(auth: auth, plans: ReadingPlanStore(), bookmarks: VerseBookmarkStore(), activity: ReadingActivityStore(),
                      search: SearchPrefs(), highlights: highlights, achievements: AchievementStore())
        engines.append(engine)
        return (engine, highlights)
    }

    func testTransientRefreshFailuresDoNotSignOutTheCurrentAccount() async throws {
        for status in [429, 503] {
            let auth = try auth(expiring: true)
            route { request in
                if request.request.url!.path == "/auth/v1/token" { request.reply(status, ["error": "temporarily unavailable"]) }
                else { self.defaultReply(request) }
            }
            _ = await auth.ensureFreshToken()
            XCTAssertEqual(auth.user?.id, "A", "HTTP \(status) must preserve the account")
            XCTAssertEqual(MemberAuthStore(defaults: defaults).user?.id, "A")
        }
    }

    func testVerifyCannotRestoreSessionAfterSignOut() async throws {
        let auth = try auth()
        let started = expectation(description: "verify suspended")
        var held: AccountURLProtocol?
        route { request in
            if request.request.url!.path == "/auth/v1/user" { held = request; started.fulfill() }
            else { self.defaultReply(request) }
        }
        let operation = Task { await auth.verifyRemote() }
        await fulfillment(of: [started], timeout: 5)
        auth.signOut()
        held!.reply(200, ["id": "A", "email": "A@example.invalid"])
        await operation.value
        XCTAssertNil(auth.user)
        XCTAssertNil(defaults.data(forKey: MemberAuthRules.sessionKey))
    }

    func testOlderSignInCannotReplaceNewerAccount() async throws {
        let auth = MemberAuthStore(defaults: defaults)
        let started = expectation(description: "first login suspended")
        var held: AccountURLProtocol?
        var calls = 0
        route { request in
            if request.request.url!.path == "/auth/v1/token" {
                calls += 1
                if calls == 1 { held = request; started.fulfill() }
                else { request.reply(200, self.tokenReply("B")) }
            } else { self.defaultReply(request) }
        }
        let first = Task { await auth.signIn(email: "A@example.invalid", password: "test", locale: "en") }
        await fulfillment(of: [started], timeout: 5)
        let secondError = await auth.signIn(email: "B@example.invalid", password: "test", locale: "en")
        XCTAssertNil(secondError)
        held!.reply(200, tokenReply("A"))
        _ = await first.value
        XCTAssertEqual(auth.user?.id, "B")
        XCTAssertEqual(MemberAuthStore(defaults: defaults).user?.id, "B")
    }

    func testConcurrentRefreshUsesOneRequest() async throws {
        let auth = try auth(expiring: true)
        let started = expectation(description: "refresh suspended")
        var held: AccountURLProtocol?
        var refreshCalls = 0
        route { request in
            if request.request.url!.path == "/auth/v1/token" {
                refreshCalls += 1; held = request; started.fulfill()
            } else { self.defaultReply(request) }
        }
        let first = Task { await auth.ensureFreshToken() }
        await fulfillment(of: [started], timeout: 5)
        let second = Task { await auth.ensureFreshToken() }
        // Give the second caller a turn while the first request remains suspended.
        await Task.yield()
        held!.reply(200, tokenReply())
        let firstToken = await first.value
        let secondToken = await second.value
        XCTAssertEqual(firstToken, "fresh-A")
        XCTAssertEqual(secondToken, "fresh-A")
        XCTAssertEqual(refreshCalls, 1)
    }

    func testRenameDuringRefreshPreservesNameAndRotatedCredentials() async throws {
        let auth = try auth(expiring: true)
        let started = expectation(description: "refresh suspended")
        var held: AccountURLProtocol?
        var refreshCalls = 0
        route { request in
            if request.request.url!.path == "/auth/v1/token" {
                refreshCalls += 1
                if refreshCalls == 1 { held = request; started.fulfill() }
                else { request.reply(400, ["error": "refresh token already used"]) }
            } else { self.defaultReply(request) }
        }
        let first = Task { await auth.ensureFreshToken() }
        await fulfillment(of: [started], timeout: 5)
        let renamed = await auth.updateDisplayName("New Name")
        XCTAssertTrue(renamed)
        let second = Task { await auth.ensureFreshToken() }
        await Task.yield()
        held!.reply(200, tokenReply())
        let firstToken = await first.value
        let secondToken = await second.value
        XCTAssertEqual(firstToken, "fresh-A")
        XCTAssertEqual(secondToken, "fresh-A")
        XCTAssertEqual(refreshCalls, 1)
        XCTAssertEqual(auth.user?.name, "New Name")
        let stored = try XCTUnwrap(defaults.data(forKey: MemberAuthRules.sessionKey))
        let persisted = try JSONDecoder().decode(MemberSession.self, from: stored)
        XCTAssertEqual(persisted.sessionToken, "fresh-A")
        XCTAssertEqual(persisted.refreshToken, "next-A")
        XCTAssertEqual(persisted.user.name, "New Name")
    }

    func testCancelledRefreshWaiterRetainsRotatedCredentialsForCurrentAccount() async throws {
        let auth = try auth(expiring: true)
        let started = expectation(description: "refresh suspended")
        var held: AccountURLProtocol?
        route { request in
            if request.request.url!.path == "/auth/v1/token" { held = request; started.fulfill() }
            else { self.defaultReply(request) }
        }
        let operation = Task { await auth.ensureFreshToken() }
        await fulfillment(of: [started], timeout: 5)
        operation.cancel()
        held!.reply(200, tokenReply())
        _ = await operation.value
        XCTAssertEqual(auth.sessionToken, "fresh-A")
        XCTAssertEqual(MemberAuthStore(defaults: defaults).sessionToken, "fresh-A")
    }

    func testRefreshCannotRestoreSessionAfterSignOut() async throws {
        let auth = try auth(expiring: true)
        let started = expectation(description: "refresh suspended")
        route { request in
            if request.request.url!.path == "/auth/v1/token" { started.fulfill() }
            else { self.defaultReply(request) }
        }
        let operation = Task { await auth.ensureFreshToken() }
        await fulfillment(of: [started], timeout: 5)
        auth.signOut()
        let token = await operation.value
        XCTAssertNil(token)
        XCTAssertNil(auth.user)
        XCTAssertNil(MemberAuthStore(defaults: defaults).user)
    }

    func testLatePullCannotRestoreClearedReadingData() async throws {
        let auth = try auth()
        let (engine, highlights) = sync(auth)
        let started = expectation(description: "pull suspended")
        var held: AccountURLProtocol?
        route { request in
            if request.request.url!.path.contains("member_reading_sync_documents") { held = request; started.fulfill() }
            else { self.defaultReply(request) }
        }
        let operation = Task { await engine.run(reason: "login") }
        await fulfillment(of: [started], timeout: 5)
        auth.signOut()
        engine.resetForAccountChange()
        held!.reply(200, [["revision": "old", "blobs": ["highlights": ["value": ["cuv:GEN:1:1": [["i": 0, "c": "#FFB103"]]]]]]])
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
            if request.request.url!.path.contains("member_reading_sync_documents"), request.request.httpMethod == "POST" {
                writes += 1; held = request; started.fulfill()
            } else if request.request.url!.path == "/auth/v1/token" {
                request.reply(200, self.tokenReply("B"))
            } else { self.defaultReply(request) }
        }
        let operation = Task { await engine.run(reason: "login") }
        await fulfillment(of: [started], timeout: 5)
        auth.signOut()
        engine.resetForAccountChange()
        let loginError = await auth.signIn(email: "B@example.invalid", password: "test", locale: "en")
        XCTAssertNil(loginError)
        highlights.paint(translationId: "cuv", bookId: "JHN", chapter: 1, verse: 1, range: 0...1, color: "#FFB103")
        held!.reply(201)
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

    func testHighlightOnlyGuestProgressIsUploaded() async throws {
        let auth = try auth()
        let (engine, highlights) = sync(auth)
        highlights.paint(translationId: "cuv", bookId: "GEN", chapter: 1, verse: 1, range: 0...2, color: "#FFB103")
        engine.cancelPendingWork()
        var writes = 0
        route { request in
            if request.request.url!.path.contains("member_reading_sync_documents"), request.request.httpMethod == "POST" {
                writes += 1; request.reply(201)
            } else { self.defaultReply(request) }
        }
        let outcome = await engine.run(reason: "login")
        XCTAssertEqual(outcome, .ok)
        XCTAssertGreaterThan(writes, 0)
        XCTAssertFalse(highlights.store.isEmpty)
    }
}
