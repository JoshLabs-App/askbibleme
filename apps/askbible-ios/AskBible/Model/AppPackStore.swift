import CryptoKit
import Foundation

/// D-47 文件级 `pack-manifest.json` 增量热更存储。
///
/// 契约：
/// - 远端清单：`v3/app-pack/pack-manifest.json`（`schemaVersion`, `bundleId`, `builtAt`, `entry`, `files`）；
/// - 本机状态：`active.json`（`bundleId`, `installedOnBuiltinId`, `activatedAt`）；
/// - 重装新版原生壳时（`installedOnBuiltinId != currentBuiltinId`）自动淘汰旧沙盒包改用新版内置包；
/// - 0 流量本地复用：对 `active/`、`staging/` 与内置 `app-pack/` 中 `size + sha256` 一致的文件直接复用，仅下载变更文件；
/// - 全程静默后台校验，校验全部通过后写 `staging/` 并触发 `pack.readyToSwap`；空闲时由 `commitPendingSwap()` 原子切换，绝不弹窗。
final class AppPackStore: @unchecked Sendable {
    static let shared = AppPackStore()
    static let manifestFileName = "pack-manifest.json"
    static let activeStateFileName = "active.json"
    static let checkInterval: TimeInterval = 30 * 60

    private let rootDirectory: URL
    private let builtinDirectory: URL?
    private let currentBuiltinIdOverride: String?
    private let manifestBaseURLsOverride: [URL]?
    private let session: URLSession
    private let defaults: UserDefaults
    private let lastCheckKey = "askbible.apppack.last-check"
    private let lock = NSLock()

    private var activeState: ActiveState?
    private var activeManifest: Manifest?
    private var builtinManifest: Manifest?
    private var pendingBundleId: String?
    private var cachedFiles: [String: Data] = [:]
    private var isChecking = false
    private var lastError: String?
    private var inFlightTask: Task<CheckOutcome, Never>?
    private var periodicTimer: Timer?

    /// 供原生桥接在增量包就绪时向内核派发 `pack.readyToSwap`（绝不弹系统或壳层提示）
    var onReadyToSwap: ((String) -> Void)?

    init(
        rootDirectory: URL? = nil,
        builtinDirectory: URL? = Bundle.main.resourceURL?.appendingPathComponent("app-pack", isDirectory: true),
        currentBuiltinId: String? = nil,
        manifestBaseURLs: [URL]? = nil,
        session: URLSession = .shared,
        defaults: UserDefaults = .standard
    ) {
        if let rootDirectory {
            self.rootDirectory = rootDirectory
        } else {
            let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            self.rootDirectory = appSupport.appendingPathComponent("askbible-app-pack", isDirectory: true)
        }
        self.builtinDirectory = builtinDirectory
        self.currentBuiltinIdOverride = currentBuiltinId
        self.manifestBaseURLsOverride = manifestBaseURLs
        self.session = session
        self.defaults = defaults

        lock.lock()
        reloadStateLocked()
        lock.unlock()
    }

    private var activeDir: URL { rootDirectory.appendingPathComponent("active", isDirectory: true) }
    private var stagingDir: URL { rootDirectory.appendingPathComponent("staging", isDirectory: true) }
    private var activeStateURL: URL { rootDirectory.appendingPathComponent(Self.activeStateFileName) }

    var currentBuiltinId: String {
        lock.lock(); defer { lock.unlock() }
        return currentBuiltinIdLocked()
    }

    // MARK: - 启动一致性与只读文件解析

    private func reloadStateLocked() {
        let fm = FileManager.default
        try? fm.createDirectory(at: rootDirectory, withIntermediateDirectories: true)

        if let builtinDir = builtinDirectory,
           let m = Self.readManifest(at: builtinDir.appendingPathComponent(Self.manifestFileName)) {
            builtinManifest = m
        } else {
            builtinManifest = nil
        }

        let builtinId = currentBuiltinIdLocked()
        if let data = try? Data(contentsOf: activeStateURL),
           let state = try? JSONDecoder().decode(ActiveState.self, from: data) {
            if state.installedOnBuiltinId != builtinId {
                evictSandboxLocked()
            } else if let manifest = Self.readManifest(at: activeDir.appendingPathComponent(Self.manifestFileName)),
                      Self.isValidSafePath(manifest.entry),
                      fm.fileExists(atPath: activeDir.appendingPathComponent(manifest.entry).path) {
                activeState = state
                activeManifest = manifest
            } else {
                evictSandboxLocked()
            }
        } else {
            activeState = nil
            activeManifest = nil
        }

        if let staged = Self.readManifest(at: stagingDir.appendingPathComponent(Self.manifestFileName)),
           Self.verifyDirectory(stagingDir, matches: staged) {
            pendingBundleId = staged.bundleId
        } else {
            pendingBundleId = nil
        }
        cachedFiles.removeAll()
    }

    private func currentBuiltinIdLocked() -> String {
        if let currentBuiltinIdOverride, !currentBuiltinIdOverride.isEmpty {
            return currentBuiltinIdOverride
        }
        let info = Bundle.main.infoDictionary ?? [:]
        let shortVer = (info["CFBundleShortVersionString"] as? String) ?? "0"
        let buildVer = (info["CFBundleVersion"] as? String) ?? "0"
        let builtinVer = builtinManifest?.bundleId ?? "none"
        return "\(shortVer)+\(buildVer):\(builtinVer)"
    }

    private func evictSandboxLocked() {
        let fm = FileManager.default
        try? fm.removeItem(at: activeDir)
        try? fm.removeItem(at: stagingDir)
        try? fm.removeItem(at: activeStateURL)
        activeState = nil
        activeManifest = nil
        pendingBundleId = nil
        cachedFiles.removeAll()
    }

    /// 供 `LocalPackURLSchemeHandler` 0ms 解析本地静态内核文件（先读已激活热更沙盒，再读内置 `app-pack/`）。
    func resolveFile(relativePath rawPath: String) -> (data: Data, resolvedPath: String)? {
        let trimmed = rawPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if !trimmed.isEmpty && !Self.isValidSafePath(trimmed) { return nil }

        lock.lock()
        defer { lock.unlock() }

        let targetPath = trimmed.isEmpty ? (activeManifest?.entry ?? builtinManifest?.entry ?? "index.html") : trimmed
        let cacheKey = "\(activeState?.bundleId ?? builtinManifest?.bundleId ?? "builtin"):\(targetPath)"
        if let hit = cachedFiles[cacheKey] { return (hit, targetPath) }

        if let activeManifest, activeManifest.files[targetPath] != nil,
           let data = try? Data(contentsOf: activeDir.appendingPathComponent(targetPath)) {
            cachedFiles[cacheKey] = data
            return (data, targetPath)
        }
        if let builtinDir = builtinDirectory,
           let data = try? Data(contentsOf: builtinDir.appendingPathComponent(targetPath)) {
            cachedFiles[cacheKey] = data
            return (data, targetPath)
        }
        return nil
    }

    func activeEntryPath() -> String {
        lock.lock(); defer { lock.unlock() }
        return activeManifest?.entry ?? builtinManifest?.entry ?? "index.html"
    }

    func status() -> Status {
        lock.lock(); defer { lock.unlock() }
        let lastTs = defaults.double(forKey: lastCheckKey)
        let lastISO = lastTs > 0 ? ISO8601DateFormatter.millis.string(from: Date(timeIntervalSince1970: lastTs)) : nil
        return Status(
            activeBundleId: activeState?.bundleId ?? builtinManifest?.bundleId,
            activeSource: activeState != nil ? "sandbox" : (builtinManifest != nil ? "builtin" : "none"),
            pendingBundleId: pendingBundleId,
            installedOnBuiltinId: activeState?.installedOnBuiltinId,
            currentBuiltinId: currentBuiltinIdLocked(),
            lastCheckedAt: lastISO,
            isChecking: isChecking,
            lastError: lastError
        )
    }

    func statusDictionary() -> [String: Any] {
        let s = status()
        var out: [String: Any] = [
            "activeSource": s.activeSource,
            "currentBuiltinId": s.currentBuiltinId,
            "isChecking": s.isChecking,
            "hasPendingSwap": s.pendingBundleId != nil,
        ]
        if let v = s.activeBundleId { out["activeBundleId"] = v }
        if let v = s.pendingBundleId { out["pendingBundleId"] = v }
        if let v = s.installedOnBuiltinId { out["installedOnBuiltinId"] = v }
        if let v = s.lastCheckedAt { out["lastCheckedAt"] = v }
        if let v = s.lastError { out["lastError"] = v }
        return out
    }

    // MARK: - 30 分钟后台静默巡检

    @MainActor
    func startPeriodicChecks() {
        guard periodicTimer == nil else { return }
        periodicTimer = Timer.scheduledTimer(withTimeInterval: Self.checkInterval, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { _ = await self.refreshIfNeeded(force: false) }
        }
    }

    @MainActor
    func stopPeriodicChecks() {
        periodicTimer?.invalidate()
        periodicTimer = nil
    }

    // MARK: - 增量拉取与 0 流量复用

    @discardableResult
    func refreshIfNeeded(force: Bool = false) async -> CheckOutcome {
        let now = Date().timeIntervalSince1970
        lock.lock()
        if let existing = inFlightTask {
            lock.unlock()
            return await existing.value
        }
        if !force, now - defaults.double(forKey: lastCheckKey) < Self.checkInterval {
            lock.unlock()
            return .throttled
        }
        isChecking = true
        lastError = nil
        let task = Task<CheckOutcome, Never> { [weak self] in
            guard let self else { return .failed("deallocated") }
            return await self.performRefresh(now: now)
        }
        inFlightTask = task
        lock.unlock()

        let outcome = await task.value
        lock.lock()
        isChecking = false
        inFlightTask = nil
        lock.unlock()
        return outcome
    }

    private func performRefresh(now: TimeInterval) async -> CheckOutcome {
        let baseURLs = candidateBaseURLs()
        var fetched: (manifest: Manifest, preferredBase: URL)?
        for base in baseURLs {
            var req = URLRequest(url: base.appendingPathComponent(Self.manifestFileName), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12)
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            guard let (data, resp) = try? await session.data(for: req),
                  let http = resp as? HTTPURLResponse, http.statusCode == 200,
                  let manifest = try? JSONDecoder().decode(Manifest.self, from: data),
                  Self.isValidManifest(manifest) else { continue }
            fetched = (manifest, base)
            break
        }

        guard let (manifest, preferredBase) = fetched else {
            lock.lock(); lastError = "manifest_unreachable"; lock.unlock()
            return .unreachable
        }
        defaults.set(now, forKey: lastCheckKey)

        lock.lock()
        let activeId = activeState?.bundleId ?? builtinManifest?.bundleId
        let activeMatches = (activeId == manifest.bundleId) && (activeState == nil || Self.verifyDirectory(activeDir, matches: manifest))
        let pendingMatches = (pendingBundleId == manifest.bundleId) && Self.verifyDirectory(stagingDir, matches: manifest)
        lock.unlock()

        if activeMatches { return .upToDate(manifest.bundleId) }
        if pendingMatches {
            notifyReadyToSwap(bundleId: manifest.bundleId)
            return .readyToSwap(manifest.bundleId)
        }

        let orderedBases = [preferredBase] + baseURLs.filter { $0 != preferredBase }
        do {
            try await stageManifest(manifest, baseURLs: orderedBases)
            lock.lock(); pendingBundleId = manifest.bundleId; lastError = nil; lock.unlock()
            notifyReadyToSwap(bundleId: manifest.bundleId)
            return .readyToSwap(manifest.bundleId)
        } catch {
            lock.lock(); lastError = error.localizedDescription; lock.unlock()
            return .failed(error.localizedDescription)
        }
    }

    private func notifyReadyToSwap(bundleId: String) {
        guard let callback = onReadyToSwap else { return }
        DispatchQueue.main.async { callback(bundleId) }
    }

    private func stageManifest(_ manifest: Manifest, baseURLs: [URL]) async throws {
        let fm = FileManager.default
        try fm.createDirectory(at: rootDirectory, withIntermediateDirectories: true)
        let workDir = rootDirectory.appendingPathComponent(".staging-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: workDir, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: workDir) }

        let reusableIndex = buildReusableFileIndex()

        for (relPath, meta) in manifest.files.sorted(by: { $0.key < $1.key }) {
            let expectedSha = meta.sha256.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let destFile = workDir.appendingPathComponent(relPath)
            try fm.createDirectory(at: destFile.deletingLastPathComponent(), withIntermediateDirectories: true)

            if let localSource = findReusableFile(relPath: relPath, size: meta.size, sha256: expectedSha, index: reusableIndex) {
                try fm.copyItem(at: localSource, to: destFile)
                continue
            }

            try await downloadVerifiedFile(relPath: relPath, meta: meta, expectedSha: expectedSha, baseURLs: baseURLs, destFile: destFile)
        }

        try JSONEncoder().encode(manifest).write(to: workDir.appendingPathComponent(Self.manifestFileName), options: .atomic)
        guard Self.verifyDirectory(workDir, matches: manifest) else { throw PackStore.PackError.invalidWebPack }

        if fm.fileExists(atPath: stagingDir.path) { try fm.removeItem(at: stagingDir) }
        try fm.moveItem(at: workDir, to: stagingDir)
    }

    private func downloadVerifiedFile(relPath: String, meta: FileMeta, expectedSha: String, baseURLs: [URL], destFile: URL) async throws {
        var lastErr: Error = URLError(.cannotLoadFromNetwork)
        for base in baseURLs {
            guard Self.isValidSafePath(relPath) else { continue }
            let fileURL = base.appendingPathComponent(relPath.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
            var req = URLRequest(url: fileURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
            req.setValue("*/*", forHTTPHeaderField: "Accept")
            do {
                let (data, resp) = try await session.data(for: req)
                guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                    lastErr = PackStore.PackError.badHTTPStatus((resp as? HTTPURLResponse)?.statusCode ?? 0)
                    continue
                }
                guard data.count == meta.size else {
                    lastErr = PackStore.PackError.sizeMismatch(expected: meta.size, actual: data.count)
                    continue
                }
                let actualSha = PackStore.sha256Hex(of: data)
                guard actualSha == expectedSha else {
                    lastErr = PackStore.PackError.sha256Mismatch(expected: expectedSha, actual: actualSha)
                    continue
                }
                try data.write(to: destFile, options: .atomic)
                return
            } catch {
                lastErr = error
            }
        }
        throw lastErr
    }

    // MARK: - 空闲原子切换

    @discardableResult
    func commitPendingSwap() -> SwapResult {
        lock.lock(); defer { lock.unlock() }
        let fm = FileManager.default
        guard let manifest = Self.readManifest(at: stagingDir.appendingPathComponent(Self.manifestFileName)),
              Self.verifyDirectory(stagingDir, matches: manifest) else {
            return SwapResult(swapped: false, bundleId: nil, activatedAt: nil, reason: "no_valid_staging")
        }

        let backupDir = rootDirectory.appendingPathComponent(".active-backup-\(UUID().uuidString)", isDirectory: true)
        var movedOld = false
        do {
            if fm.fileExists(atPath: activeDir.path) {
                try fm.moveItem(at: activeDir, to: backupDir)
                movedOld = true
            }
            try fm.moveItem(at: stagingDir, to: activeDir)
            let activatedAt = ISO8601DateFormatter.millis.string(from: Date())
            let nextState = ActiveState(bundleId: manifest.bundleId, installedOnBuiltinId: currentBuiltinIdLocked(), activatedAt: activatedAt)
            try JSONEncoder().encode(nextState).write(to: activeStateURL, options: .atomic)
            if movedOld { try? fm.removeItem(at: backupDir) }

            activeState = nextState
            activeManifest = manifest
            pendingBundleId = nil
            cachedFiles.removeAll()
            return SwapResult(swapped: true, bundleId: manifest.bundleId, activatedAt: activatedAt, reason: nil)
        } catch {
            if !fm.fileExists(atPath: activeDir.path), movedOld, fm.fileExists(atPath: backupDir.path) {
                try? fm.moveItem(at: backupDir, to: activeDir)
            }
            return SwapResult(swapped: false, bundleId: nil, activatedAt: nil, reason: error.localizedDescription)
        }
    }

    // MARK: - 0 流量本地复用索引

    private struct LocalHashKey: Hashable {
        let size: Int
        let sha256: String
    }

    private func buildReusableFileIndex() -> [LocalHashKey: URL] {
        var dirs: [URL] = [activeDir, stagingDir]
        if let builtinDirectory { dirs.append(builtinDirectory) }
        var index: [LocalHashKey: URL] = [:]
        let fm = FileManager.default
        for dir in dirs where fm.fileExists(atPath: dir.path) {
            guard let enumerator = fm.enumerator(at: dir, includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey]) else { continue }
            for case let fileURL as URL in enumerator where fileURL.lastPathComponent != Self.manifestFileName {
                guard let vals = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                      vals.isRegularFile == true, let size = vals.fileSize,
                      let sha = PackStore.sha256Hex(of: fileURL)?.lowercased() else { continue }
                let key = LocalHashKey(size: size, sha256: sha)
                if index[key] == nil { index[key] = fileURL }
            }
        }
        return index
    }

    private func findReusableFile(relPath: String, size: Int, sha256: String, index: [LocalHashKey: URL]) -> URL? {
        var direct: [URL] = [activeDir.appendingPathComponent(relPath), stagingDir.appendingPathComponent(relPath)]
        if let builtinDirectory { direct.append(builtinDirectory.appendingPathComponent(relPath)) }
        for url in direct where Self.fileMatches(url, expectedSize: size, expectedSha256: sha256) {
            return url
        }
        return index[LocalHashKey(size: size, sha256: sha256)]
    }

    private func candidateBaseURLs() -> [URL] {
        if let manifestBaseURLsOverride, !manifestBaseURLsOverride.isEmpty { return manifestBaseURLsOverride }
        return [Endpoints.mediaBase + "/v3/app-pack/", Endpoints.siteBase + "/v3/app-pack/"].compactMap(URL.init(string:))
    }
}
