import CryptoKit
import Foundation

/// 本地离线包托管与 SHA-256 静默原子热更新（DECISIONS D-44 / D-46，对齐 JoshBox PackStore）。
///
/// 原则：
/// 1. 核心译本（cuv-simp / cuv-trad / web-en / ust-en / scripture-xrefs）随包内置，飞行模式 0ms 秒开；
/// 2. 联网后台比对 `v2/catalog.json` 的 `sha256`，仅在哈希不一致时下载到临时 `.part` 文件；
/// 3. 严格校验 SQLite 100 字节文件头（魔数 + 页大小 + 页数防截断）与 SHA-256，全部通过才原子替换落盘；
/// 4. 任何网络中断、CDN 错误页或截断文件绝不覆盖旧包或内置包。
enum PackStore {
    struct PackDescriptor: Codable, Equatable {
        let id: String
        let kind: String
        let path: String
        let sha256: String
        let sizeBytes: Int
    }

    struct PackCatalog: Codable, Equatable {
        let schemaVersion: Int?
        let version: Int?
        let generatedAt: String?
        let packs: [PackDescriptor]
    }

    struct RefreshOutcome: Equatable {
        let catalogReachable: Bool
        let updatedCount: Int
    }

    struct WebPackCapsule: Codable, Equatable {
        let schemaVersion: Int?
        let version: String?
        let files: [String: String]
    }

    struct WebPackSnapshot {
        let version: String
        let isHotPack: Bool
        let sha256: String
        let files: [String: Data]
    }

    enum PackError: LocalizedError {
        case badHTTPStatus(Int)
        case invalidSQLite
        case invalidWebPack
        case blacklistedWebPack
        case sha256Mismatch(expected: String, actual: String)
        case sizeMismatch(expected: Int, actual: Int)

        var errorDescription: String? {
            switch self {
            case .badHTTPStatus(let code): return "HTTP \(code)"
            case .invalidSQLite: return "invalid sqlite pack"
            case .invalidWebPack: return "invalid web-pack capsule"
            case .blacklistedWebPack: return "blacklisted web-pack sha256"
            case .sha256Mismatch: return "pack sha256 mismatch"
            case .sizeMismatch: return "pack size mismatch"
            }
        }
    }

    static let webPackId = "ui.web-pack"
    static let badWebPackShaKey = "askbible.packstore.bad-webpack-sha256"

    private static let sqliteMagic = Data("SQLite format 3\u{0}".utf8)
    private static let shaPrefix = "askbible.packstore.sha256."
    private static let lastCheckKey = "askbible.packstore.last-check"
    private static let checkInterval: TimeInterval = 6 * 3600
    private static let webPackLock = NSLock()
    private static var cachedWebPack: WebPackSnapshot?

    /// 将 catalog 里的语义 id（如 `bible.cuv-simp`、`companion.xrefs`）映射为本地资源/落盘文件名 stem。
    static func localPackKey(for pack: PackDescriptor) -> String {
        if pack.id == "companion.xrefs" || pack.path.hasSuffix("/scripture-xrefs.sqlite") || pack.path == "bible/scripture-xrefs.sqlite" {
            return "scripture-xrefs"
        }
        if pack.id.hasPrefix("bible.") {
            return String(pack.id.dropFirst("bible.".count))
        }
        let base = URL(fileURLWithPath: pack.path).deletingPathExtension().lastPathComponent
        return base.isEmpty ? pack.id : base
    }

    /// 计算文件 SHA-256（流式分块读取，不把整本 SQLite 一次性塞进内存）
    static func sha256Hex(of url: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        var hasher = SHA256()
        while autoreleasepool(invoking: {
            let chunk = handle.readData(ofLength: 64 * 1024)
            if chunk.isEmpty { return false }
            hasher.update(data: chunk)
            return true
        }) {}
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    /// 严格校验 SQLite 文件完整性：16 字节魔数 + 合法 2 的幂页大小 + 文件长度整除页大小 + 页数防截断（与安卓 SQLiteDownload 对称）
    static func isValidSQLiteFile(_ url: URL) -> Bool {
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
              let sizeNum = attrs[.size] as? NSNumber else { return false }
        let size = sizeNum.int64Value
        guard size >= 100, let handle = try? FileHandle(forReadingFrom: url) else { return false }
        defer { try? handle.close() }
        let header = handle.readData(ofLength: 100)
        guard header.count == 100, header.prefix(16) == sqliteMagic else { return false }

        let encodedPageSize = Int(header[16]) * 256 + Int(header[17])
        let pageSize = encodedPageSize == 1 ? 65_536 : encodedPageSize
        guard (512...65_536).contains(pageSize), (pageSize & (pageSize - 1)) == 0, size % Int64(pageSize) == 0 else {
            return false
        }
        func uint32(_ offset: Int) -> Int64 {
            (0..<4).reduce(0) { ($0 << 8) | Int64(header[offset + $1]) }
        }
        let pageCount = uint32(28)
        return pageCount == 0 || uint32(24) != uint32(92) || size == pageCount * Int64(pageSize)
    }

    /// 校验并原子替换安装 SQLite 包（校验不过直接抛错并清理临时文件，绝不污染目标路径）
    static func installSQLiteAtomically(
        from downloadedTempURL: URL,
        to destinationURL: URL,
        expectedSha256: String? = nil,
        expectedSizeBytes: Int? = nil
    ) throws {
        let fm = FileManager.default
        let parent = destinationURL.deletingLastPathComponent()
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        let staging = parent.appendingPathComponent(".\(destinationURL.lastPathComponent).\(UUID().uuidString).part")
        defer { try? fm.removeItem(at: staging) }

        if fm.fileExists(atPath: staging.path) { try? fm.removeItem(at: staging) }
        try fm.moveItem(at: downloadedTempURL, to: staging)

        if let expectedSizeBytes, expectedSizeBytes > 0,
           let size = (try? fm.attributesOfItem(atPath: staging.path)[.size] as? NSNumber)?.intValue,
           size != expectedSizeBytes {
            throw PackError.sizeMismatch(expected: expectedSizeBytes, actual: size)
        }
        guard isValidSQLiteFile(staging) else {
            throw PackError.invalidSQLite
        }
        if let expected = expectedSha256?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !expected.isEmpty {
            let actual = sha256Hex(of: staging) ?? ""
            guard actual == expected else {
                throw PackError.sha256Mismatch(expected: expected, actual: actual)
            }
        }

        if fm.fileExists(atPath: destinationURL.path) {
            _ = try fm.replaceItemAt(destinationURL, withItemAt: staging)
        } else {
            try fm.moveItem(at: staging, to: destinationURL)
        }
    }

    /// 拉取线上 `v2/catalog.json`（优先走主站同源静态目录，回退 media 域）
    static func fetchCatalog() async -> PackCatalog? {
        let candidates = [
            Endpoints.siteBase + "/v2/catalog.json",
            Endpoints.mediaBase + "/v2/catalog.json",
        ]
        for raw in candidates {
            guard let url = URL(string: raw) else { continue }
            var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 12)
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            guard let (data, resp) = try? await URLSession.shared.data(for: req),
                  let http = resp as? HTTPURLResponse, http.statusCode == 200,
                  let catalog = try? JSONDecoder().decode(PackCatalog.self, from: data),
                  !catalog.packs.isEmpty else { continue }
            return catalog
        }
        return nil
    }

    /// 当前本机正在生效的离线包路径（已热更版本优先，否则内置 Bundle）
    private static func activeLocalFile(for localKey: String) -> URL? {
        if localKey == "info-edition" {
            let u = InfoEditionDownloader.localFileURL
            return FileManager.default.fileExists(atPath: u.path) ? u : nil
        }
        if ScriptureDatabase.isInstalled(localKey) {
            return ScriptureDatabase.installedFile(localKey)
        }
        return Bundle.main.url(forResource: localKey, withExtension: "sqlite")
    }

    /// 热更 UI 胶囊落盘路径：`Application Support/web-pack/web-pack.json`
    static var hotWebPackFileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("web-pack", isDirectory: true)
            .appendingPathComponent("web-pack.json")
    }

    static func sha256Hex(of data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    static func badWebPackSha256Set(defaults: UserDefaults = .standard) -> Set<String> {
        let raw = defaults.string(forKey: badWebPackShaKey) ?? ""
        let items = raw.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }.filter { !$0.isEmpty }
        return Set(items)
    }

    static func isBadWebPackSha256(_ sha256: String, defaults: UserDefaults = .standard) -> Bool {
        let norm = sha256.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return !norm.isEmpty && badWebPackSha256Set(defaults: defaults).contains(norm)
    }

    static func markBadWebPackSha256(_ sha256: String, defaults: UserDefaults = .standard) {
        let norm = sha256.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !norm.isEmpty else { return }
        var list = (defaults.string(forKey: badWebPackShaKey) ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty && $0 != norm }
        list.append(norm)
        if list.count > 20 { list = Array(list.suffix(20)) }
        defaults.set(list.joined(separator: ","), forKey: badWebPackShaKey)
    }

    private static func parseWebPackSnapshot(from data: Data, isHotPack: Bool, sha256: String) -> WebPackSnapshot? {
        guard let capsule = try? JSONDecoder().decode(WebPackCapsule.self, from: data),
              let html = capsule.files["index.html"], !html.isEmpty,
              let js = capsule.files["app.js"], !js.isEmpty else {
            return nil
        }
        var encoded: [String: Data] = [:]
        encoded.reserveCapacity(capsule.files.count)
        for (name, content) in capsule.files {
            encoded[name] = Data(content.utf8)
        }
        let ver = (capsule.version?.isEmpty == false ? capsule.version : nil) ?? String(sha256.prefix(12))
        return WebPackSnapshot(version: ver, isHotPack: isHotPack, sha256: sha256, files: encoded)
    }

    /// 读取本地离线 UI 胶囊（优先热更槽 `Application Support/web-pack/web-pack.json`，异常或黑名单时瞬切内置 Bundle），内存缓存实现 0ms 直出。
    static func loadWebPackFiles(defaults: UserDefaults = .standard) -> WebPackSnapshot? {
        webPackLock.lock()
        defer { webPackLock.unlock() }
        if let cached = cachedWebPack { return cached }

        let fm = FileManager.default
        let hotURL = hotWebPackFileURL
        if fm.fileExists(atPath: hotURL.path) {
            if let data = try? Data(contentsOf: hotURL) {
                let sha = sha256Hex(of: data)
                if !isBadWebPackSha256(sha, defaults: defaults),
                   let snap = parseWebPackSnapshot(from: data, isHotPack: true, sha256: sha) {
                    cachedWebPack = snap
                    return snap
                }
            }
            // 热更包损坏或已进看门狗黑名单：立即清理并回退内置包
            try? fm.removeItem(at: hotURL)
        }

        if let builtinURL = Bundle.main.url(forResource: "web-pack", withExtension: "json"),
           let data = try? Data(contentsOf: builtinURL) {
            let sha = sha256Hex(of: data)
            if let snap = parseWebPackSnapshot(from: data, isHotPack: false, sha256: sha) {
                cachedWebPack = snap
                return snap
            }
        }
        return nil
    }

    /// 看门狗触发回滚：记录当前热更包的 SHA-256 到黑名单，删除本地热更包并清空内存缓存，瞬间退回 builtin 胶囊。
    static func rollbackHotWebPack(defaults: UserDefaults = .standard) {
        webPackLock.lock()
        defer { webPackLock.unlock() }

        let hotURL = hotWebPackFileURL
        var badSha: String? = cachedWebPack?.isHotPack == true ? cachedWebPack?.sha256 : nil
        if badSha == nil, FileManager.default.fileExists(atPath: hotURL.path) {
            badSha = sha256Hex(of: hotURL)
        }
        if let badSha, !badSha.isEmpty {
            markBadWebPackSha256(badSha, defaults: defaults)
        }
        try? FileManager.default.removeItem(at: hotURL)
        defaults.removeObject(forKey: shaPrefix + webPackId)
        cachedWebPack = nil
    }

    /// 校验并原子安装 `ui.web-pack` 单文件胶囊（大小 + SHA-256 + JSON 与必需入口文件 + 黑名单校验）
    static func installWebPackAtomically(
        from downloadedTempURL: URL,
        to destinationURL: URL = hotWebPackFileURL,
        expectedSha256: String? = nil,
        expectedSizeBytes: Int? = nil,
        defaults: UserDefaults = .standard
    ) throws {
        let fm = FileManager.default
        let parent = destinationURL.deletingLastPathComponent()
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        let staging = parent.appendingPathComponent(".\(destinationURL.lastPathComponent).\(UUID().uuidString).part")
        defer { try? fm.removeItem(at: staging) }

        if fm.fileExists(atPath: staging.path) { try? fm.removeItem(at: staging) }
        try fm.moveItem(at: downloadedTempURL, to: staging)

        if let expectedSizeBytes, expectedSizeBytes > 0,
           let size = (try? fm.attributesOfItem(atPath: staging.path)[.size] as? NSNumber)?.intValue,
           size != expectedSizeBytes {
            throw PackError.sizeMismatch(expected: expectedSizeBytes, actual: size)
        }
        let actualSha = sha256Hex(of: staging) ?? ""
        if let expected = expectedSha256?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !expected.isEmpty {
            guard actualSha == expected else {
                throw PackError.sha256Mismatch(expected: expected, actual: actualSha)
            }
        }
        guard !actualSha.isEmpty, !isBadWebPackSha256(actualSha, defaults: defaults) else {
            throw PackError.blacklistedWebPack
        }
        guard let data = try? Data(contentsOf: staging),
              parseWebPackSnapshot(from: data, isHotPack: true, sha256: actualSha) != nil else {
            throw PackError.invalidWebPack
        }

        if fm.fileExists(atPath: destinationURL.path) {
            _ = try fm.replaceItemAt(destinationURL, withItemAt: staging)
        } else {
            try fm.moveItem(at: staging, to: destinationURL)
        }
        webPackLock.lock()
        cachedWebPack = nil
        webPackLock.unlock()
    }

    /// 启动/回前台后台静默检查热更，或用户点「检查更新」时强制同步（`force = true`）。
    @discardableResult
    static func refreshInstalledPacksIfNeeded(force: Bool = false, defaults: UserDefaults = .standard) async -> RefreshOutcome {
        async let appPackOutcome = AppPackStore.shared.refreshIfNeeded(force: force)
        let now = Date().timeIntervalSince1970
        if !force, now - defaults.double(forKey: lastCheckKey) < checkInterval {
            _ = await appPackOutcome
            return RefreshOutcome(catalogReachable: true, updatedCount: 0)
        }
        guard let catalog = await fetchCatalog() else {
            let packOutcome = await appPackOutcome
            let stagedCount: Int = if case .readyToSwap = packOutcome { 1 } else { 0 }
            return RefreshOutcome(catalogReachable: packOutcome != .unreachable, updatedCount: stagedCount)
        }
        defaults.set(now, forKey: lastCheckKey)

        var updated = 0
        for pack in catalog.packs {
            if pack.id == webPackId || pack.kind == "web-pack" {
                let targetSha = pack.sha256.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                guard !targetSha.isEmpty, !isBadWebPackSha256(targetSha, defaults: defaults) else { continue }
                let localSha = loadWebPackFiles(defaults: defaults)?.sha256
                guard localSha != targetSha else { continue }

                let rel = pack.path.hasPrefix("/") ? pack.path : "/" + pack.path
                let sourceCandidates = [
                    Endpoints.mediaBase + rel,
                    Endpoints.siteBase + rel,
                ]
                for rawSource in sourceCandidates {
                    guard let sourceURL = URL(string: rawSource) else { continue }
                    do {
                        let (tmp, resp) = try await URLSession.shared.download(from: sourceURL)
                        guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { continue }
                        try installWebPackAtomically(
                            from: tmp,
                            to: hotWebPackFileURL,
                            expectedSha256: targetSha,
                            expectedSizeBytes: pack.sizeBytes,
                            defaults: defaults
                        )
                        defaults.set(targetSha, forKey: shaPrefix + webPackId)
                        updated += 1
                        break
                    } catch {
                        // 失败则尝试下一条候选线，绝不破坏本地已有胶囊
                    }
                }
                continue
            }

            guard pack.path.hasSuffix(".sqlite") else { continue }
            let localKey = localPackKey(for: pack)
            guard let currentURL = activeLocalFile(for: localKey) else { continue }
            let shaKey = shaPrefix + localKey
            let cachedSha = force ? nil : defaults.string(forKey: shaKey)
            let localSha: String? = cachedSha ?? sha256Hex(of: currentURL)
            if let localSha, cachedSha == nil {
                defaults.set(localSha, forKey: shaKey)
            }
            guard let localSha, localSha != pack.sha256.lowercased() else { continue }

            let rel = pack.path.hasPrefix("/") ? pack.path : "/" + pack.path
            let sourceCandidates = [
                Endpoints.mediaBase + rel,
                Endpoints.siteBase + rel,
            ]
            for rawSource in sourceCandidates {
                guard let sourceURL = URL(string: rawSource) else { continue }
                do {
                    let (tmp, resp) = try await URLSession.shared.download(from: sourceURL)
                    guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { continue }
                    let dest = localKey == "info-edition"
                        ? InfoEditionDownloader.localFileURL
                        : ScriptureDatabase.installedFile(localKey)
                    try installSQLiteAtomically(
                        from: tmp,
                        to: dest,
                        expectedSha256: pack.sha256,
                        expectedSizeBytes: pack.sizeBytes
                    )
                    defaults.set(pack.sha256.lowercased(), forKey: shaKey)
                    LocalDBRouter.shared.invalidate(translationId: localKey)
                    updated += 1
                    break
                } catch {
                    // 当前线路失败则试下一条候选线，绝不破坏本地已有库
                }
            }
        }
        if case .readyToSwap = await appPackOutcome {
            updated += 1
        }
        return RefreshOutcome(catalogReachable: true, updatedCount: updated)
    }

    // MARK: - D-47 静态内核增量包协调入口

    @discardableResult
    static func refreshAppPackIfNeeded(force: Bool = false) async -> AppPackStore.CheckOutcome {
        await AppPackStore.shared.refreshIfNeeded(force: force)
    }

    @discardableResult
    static func commitPendingAppPackSwap() -> AppPackStore.SwapResult {
        AppPackStore.shared.commitPendingSwap()
    }

    static func appPackStatus() -> AppPackStore.Status {
        AppPackStore.shared.status()
    }
}
