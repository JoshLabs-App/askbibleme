import CryptoKit
import Foundation

/// 本地离线包托管与 SHA-256 静默原子热更新（DECISIONS D-44，对齐 JoshBox PackStore）。
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
        let version: Int
        let generatedAt: String?
        let packs: [PackDescriptor]
    }

    enum PackError: LocalizedError {
        case badHTTPStatus(Int)
        case invalidSQLite
        case sha256Mismatch(expected: String, actual: String)
        case sizeMismatch(expected: Int, actual: Int)

        var errorDescription: String? {
            switch self {
            case .badHTTPStatus(let code): return "HTTP \(code)"
            case .invalidSQLite: return "invalid sqlite pack"
            case .sha256Mismatch: return "pack sha256 mismatch"
            case .sizeMismatch: return "pack size mismatch"
            }
        }
    }

    private static let sqliteMagic = Data("SQLite format 3\u{0}".utf8)
    private static let shaPrefix = "askbible.packstore.sha256."
    private static let lastCheckKey = "askbible.packstore.last-check"
    private static let checkInterval: TimeInterval = 6 * 3600

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
    private static func activeLocalFile(for packId: String) -> URL? {
        if packId == "info-edition" {
            let u = InfoEditionDownloader.localFileURL
            return FileManager.default.fileExists(atPath: u.path) ? u : nil
        }
        if ScriptureDatabase.isInstalled(packId) {
            return ScriptureDatabase.installedFile(packId)
        }
        return Bundle.main.url(forResource: packId, withExtension: "sqlite")
    }

    /// 启动/回前台后台静默检查热更：只对本机已存在（内置或已下载）且 SHA-256 发生变化的包做静默原子更新
    static func refreshInstalledPacksIfNeeded(force: Bool = false, defaults: UserDefaults = .standard) async {
        let now = Date().timeIntervalSince1970
        if !force, now - defaults.double(forKey: lastCheckKey) < checkInterval { return }
        guard let catalog = await fetchCatalog() else { return }
        defaults.set(now, forKey: lastCheckKey)

        for pack in catalog.packs where pack.path.hasSuffix(".sqlite") {
            guard let currentURL = activeLocalFile(for: pack.id) else { continue }
            let cachedSha = defaults.string(forKey: shaPrefix + pack.id)
            let localSha: String? = cachedSha ?? sha256Hex(of: currentURL)
            if let localSha, cachedSha == nil {
                defaults.set(localSha, forKey: shaPrefix + pack.id)
            }
            guard let localSha, localSha != pack.sha256.lowercased() else { continue }

            let rel = pack.path.hasPrefix("/") ? pack.path : "/" + pack.path
            let sourceURL = URL(string: Endpoints.siteBase + rel)
            guard let sourceURL else { continue }
            do {
                let (tmp, resp) = try await URLSession.shared.download(from: sourceURL)
                guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { continue }
                let dest = pack.id == "info-edition"
                    ? InfoEditionDownloader.localFileURL
                    : ScriptureDatabase.installedFile(pack.id)
                try installSQLiteAtomically(
                    from: tmp,
                    to: dest,
                    expectedSha256: pack.sha256,
                    expectedSizeBytes: pack.sizeBytes
                )
                defaults.set(pack.sha256.lowercased(), forKey: shaPrefix + pack.id)
            } catch {
                // 静默失败：保留现有内置包或旧包，绝不影响当前阅读
            }
        }
    }
}
