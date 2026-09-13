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

    private static let r2URL = URL(string: "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/bible/info-edition.sqlite")!

    static var localFileURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("info-edition.sqlite")
    }

    @Published var state: State = .idle

    private var task: URLSessionDownloadTask?
    private lazy var session: URLSession = URLSession(configuration: .default, delegate: self, delegateQueue: nil)

    override init() {
        super.init()
        if FileManager.default.fileExists(atPath: Self.localFileURL.path) {
            state = .done
        }
    }

    func downloadIfNeeded() {
        guard case .idle = state, !FileManager.default.fileExists(atPath: Self.localFileURL.path) else {
            if FileManager.default.fileExists(atPath: Self.localFileURL.path) { state = .done }
            return
        }
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
        do {
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.moveItem(at: location, to: dest)
            DispatchQueue.main.async { self.state = .done }
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
