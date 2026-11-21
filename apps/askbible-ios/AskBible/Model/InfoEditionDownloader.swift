import Foundation
import Combine

/// 「读后两版」内容库（info-edition.sqlite）按需下载器。
/// 首次点进「陪你探索 / 查找资料」时触发，下载到 Documents/info-edition.sqlite 后离线可读。
final class InfoEditionDownloader: NSObject, ObservableObject, URLSessionDownloadDelegate {
    enum State {
        case idle
        case downloading(Double)
        case done
        case failed(String)
    }

    static let shared = InfoEditionDownloader()

    private static var r2URL: URL { URL(string: Endpoints.mediaBase + "/bible/info-edition.sqlite")! }

    static var localFileURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("info-edition.sqlite")
    }

    @Published var state: State = .idle

    private var task: URLSessionDownloadTask?
    private lazy var session: URLSession = URLSession(configuration: .default, delegate: self, delegateQueue: nil)

    override init() {
        super.init()
        if Self.isValidSQLite(Self.localFileURL) {
            state = .done
        } else {
            // 旧版不校验 HTTP 状态，R2 404 时把错误文本存成了 sqlite，之后永远「加载失败」；这里清掉让它重下
            try? FileManager.default.removeItem(at: Self.localFileURL)
        }
    }

    /// 文件头 + 页结构完整（委托 PackStore 统一校验，挡住 404 错误页与半截截断包）
    static func isValidSQLite(_ url: URL) -> Bool {
        PackStore.isValidSQLiteFile(url)
    }

    func downloadIfNeeded() {
        if Self.isValidSQLite(Self.localFileURL) { state = .done; return }
        guard case .idle = state else { return }
        state = .downloading(0)
        task = session.downloadTask(with: Self.r2URL)
        task?.resume()
    }

    func resetForRetry() {
        if case .failed = state { state = .idle }
    }

    // MARK: URLSessionDownloadDelegate

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        let dest = Self.localFileURL
        if let http = downloadTask.response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            DispatchQueue.main.async { self.state = .failed("HTTP \(http.statusCode)") }
            return
        }
        do {
            try PackStore.installSQLiteAtomically(from: location, to: dest)
            DispatchQueue.main.async { InfoEditionDatabase.resetShared(); self.state = .done }
        } catch {
            DispatchQueue.main.async { self.state = .failed(error.localizedDescription) }
        }
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard totalBytesExpectedToWrite > 0 else { return }
        let progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        DispatchQueue.main.async { self.state = .downloading(progress) }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error {
            DispatchQueue.main.async { self.state = .failed(error.localizedDescription) }
        }
    }
}
