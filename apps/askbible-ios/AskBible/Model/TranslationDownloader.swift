import Foundation
import Combine

/// 下载型译本（KJV）：从 R2 拉整本 sqlite 到 Application Support/scripture/<id>.sqlite，装好后离线可读
/// （RN scripture-translation-download.ts；RN 2026-09 起 KJV 不再打包、按需下载）。
@MainActor
final class TranslationDownloader: ObservableObject {
    enum State: Equatable { case idle, downloading(Double), done, failed(String) }
    @Published private(set) var states: [String: State] = [:]
    private var tasks: [String: Task<Void, Never>] = [:]

    // 落盘位置由 ScriptureDatabase 定义（它要能脱离下载器单独编译）
    nonisolated static var directory: URL { ScriptureDatabase.installedDirectory }
    nonisolated static func localFile(_ id: String) -> URL { ScriptureDatabase.installedFile(id) }
    nonisolated static func isInstalled(_ id: String) -> Bool { ScriptureDatabase.isInstalled(id) }

    func state(_ id: String) -> State {
        if let s = states[id] { return s }
        return Self.isInstalled(id) ? .done : .idle
    }

    /// 没装就下；已在下就等它
    func ensure(_ t: ScriptureTranslation) async -> Bool {
        guard t.delivery == .download, let url = URL(string: t.downloadUrl) else { return true }
        if Self.isInstalled(t.id) { states[t.id] = .done; return true }
        if let running = tasks[t.id] { await running.value; return Self.isInstalled(t.id) }
        let task = Task { await self.download(t.id, from: url) }
        tasks[t.id] = task
        await task.value
        tasks[t.id] = nil
        return Self.isInstalled(t.id)
    }

    private func download(_ id: String, from url: URL) async {
        states[id] = .downloading(0)
        do {
            let (tmp, resp) = try await URLSession.shared.download(from: url, delegate: nil)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                states[id] = .failed("HTTP \((resp as? HTTPURLResponse)?.statusCode ?? 0)"); return
            }
            let dest = Self.localFile(id)
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: tmp, to: dest)
            states[id] = .done
        } catch {
            states[id] = .failed(error.localizedDescription)
        }
    }
}
