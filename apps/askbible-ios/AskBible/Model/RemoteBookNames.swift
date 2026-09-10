import Foundation

/// 在线译本自己的书卷名（该版本的语言）：网站 `/api/mobile/bible/youversion/books?versionId=`。
///
/// 内置译本的书卷名在 BibleCatalog 里（中英两份），够用；但西班牙语等版本读出来的是西语正文，
/// 目录页 / 章标题还写着中文或英文书卷名就对不上（Josh 2026-09-10）。
/// 每个版本一份，落盘 Caches/book-names/<版本号>.tsv，取到就一直用。与 Kotlin 的 RemoteBookNames 对等。
enum RemoteBookNames {
    static let endpoint = "https://askbible.me/api/mobile/bible/youversion/books"

    private static let lock = NSLock()
    /// 版本号 → (书卷 id → 该版本的书卷名)
    nonisolated(unsafe) private static var memory: [String: [String: String]] = [:]
    /// 取到新的一份就 +1，界面据此重画
    nonisolated(unsafe) private(set) static var revision = 0

    /// 这个译本要不要用远端书卷名：只有目录接口带进来的那些（内置 20 本有自己的中英名）
    static func usesRemoteNames(_ t: ScriptureTranslation) -> Bool {
        t.id.hasPrefix("yv-") && !t.remoteId.isEmpty
    }

    /// 该译本下这一卷的名字；没有就返回 nil（调用方退回 BibleCatalog 的中英名）
    static func name(_ t: ScriptureTranslation, bookId: String) -> String? {
        guard usesRemoteNames(t) else { return nil }
        let book = bookId.trimmingCharacters(in: .whitespaces).uppercased()
        lock.lock()
        if let hit = memory[t.remoteId] { lock.unlock(); return hit[book] }
        lock.unlock()
        let disk = readDisk(t.remoteId)
        guard !disk.isEmpty else { return nil }
        lock.lock(); memory[t.remoteId] = disk; revision &+= 1; lock.unlock()
        return disk[book]
    }

    /// 切到这个译本时叫一次：盘里有就只读盘，没有才走网
    @discardableResult
    static func ensure(_ t: ScriptureTranslation) async -> Bool {
        guard usesRemoteNames(t) else { return false }
        lock.lock()
        let cached = memory[t.remoteId]
        lock.unlock()
        if cached != nil { return false }
        let disk = readDisk(t.remoteId)
        if !disk.isEmpty {
            lock.lock(); memory[t.remoteId] = disk; revision &+= 1; lock.unlock()
            return true
        }
        guard let url = URL(string: "\(endpoint)?versionId=\(t.remoteId)") else { return false }
        var req = URLRequest(url: url, timeoutInterval: 30)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let list = root["books"] as? [[String: Any]] else { return false }
        var map: [String: String] = [:]
        for item in list {
            let id = ((item["id"] as? String) ?? "").trimmingCharacters(in: .whitespaces).uppercased()
            let title = ((item["title"] as? String) ?? "").trimmingCharacters(in: .whitespaces)
            if !id.isEmpty, !title.isEmpty { map[id] = title }
        }
        guard !map.isEmpty else { return false }
        lock.lock(); memory[t.remoteId] = map; revision &+= 1; lock.unlock()
        writeDisk(t.remoteId, map)
        return true
    }

    // MARK: 落盘（一行一卷的 TSV，读起来比 JSON 快得多）

    private static var dir: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("book-names", isDirectory: true)
    }

    private static func file(_ remoteId: String) -> URL { dir.appendingPathComponent("\(remoteId).tsv") }

    private static func readDisk(_ remoteId: String) -> [String: String] {
        guard let data = try? Data(contentsOf: file(remoteId)), let text = String(data: data, encoding: .utf8) else { return [:] }
        var out: [String: String] = [:]
        for line in text.split(separator: "\n", omittingEmptySubsequences: true) {
            let f = line.components(separatedBy: "\t")
            if f.count == 2, !f[0].isEmpty, !f[1].isEmpty { out[f[0]] = f[1] }
        }
        return out
    }

    private static func writeDisk(_ remoteId: String, _ map: [String: String]) {
        let text = map.sorted { $0.key < $1.key }
            .map { "\($0.key)\t\($0.value.replacingOccurrences(of: "\t", with: " "))" }
            .joined(separator: "\n")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? text.data(using: .utf8)?.write(to: file(remoteId), options: .atomic)
    }
}
