import Foundation
import Combine

struct DevotionalDay: Decodable, Identifiable {
    let md: String
    let title: String
    let verse: String
    let ref: String
    let paragraphs: [String]
    let audio: String?
    let audioSec: Int?
    var id: String { md }
    var dateLabel: String { md.split(separator: "-").compactMap { Int($0) }.enumerated().map { "\($0.element)\($0.offset == 0 ? "月" : "日")" }.joined() }
    var audioURL: URL? { audio.flatMap(URL.init(string:)) }
}

/// 与安卓同一份授权内容：只在中文管理员界面出现，全文仅缓存到设备，不进入安装包或仓库。
@MainActor
final class SolidJoys: ObservableObject {
    @Published private(set) var days: [String: DevotionalDay] = [:]
    @Published private(set) var failed = false
    @Published private(set) var loading = false
    private var loadedFile: String?
    private var generation = UUID()
    static let title = "约翰·派博每日灵修"

    static func available(locale: AppLocale, isAdmin: Bool) -> Bool { isAdmin && locale != .en }
    func day(_ date: Date) -> DevotionalDay? {
        let c = Calendar.current.dateComponents([.month, .day], from: date)
        let key = c.month == 2 && c.day == 29 ? "02-28" : String(format: "%02d-%02d", c.month!, c.day!)
        return days[key]
    }
    func load(locale: AppLocale) async {
        let name = locale == .zhTW ? "solid-joys-zh-tw.json" : "solid-joys-zh.json"
        if loadedFile == name { return }
        let requestID = UUID(); generation = requestID
        loading = true; failed = false
        days = [:]
        defer { if generation == requestID { loading = false } }
        do {
            let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            let cache = directory.appendingPathComponent(name)
            struct Payload: Decodable { let days: [DevotionalDay] }
            var payload: Payload?
            if let cached = try? Data(contentsOf: cache), let parsed = try? JSONDecoder().decode(Payload.self, from: cached), parsed.days.count >= 360 { payload = parsed }
            if payload == nil {
                let (data, response) = try await URLSession.shared.data(from: URL(string: Endpoints.mediaBase + "/devotionals/" + name)!)
                guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
                let parsed = try JSONDecoder().decode(Payload.self, from: data)
                guard parsed.days.count >= 360 else { throw URLError(.cannotParseResponse) }
                try data.write(to: cache, options: .atomic)
                payload = parsed
            }
            guard !Task.isCancelled, generation == requestID, let payload else { return }
            days = Dictionary(payload.days.map { ($0.md, $0) }, uniquingKeysWith: { _, last in last })
            loadedFile = name
        } catch { if !Task.isCancelled, generation == requestID { failed = true } }
    }
}
