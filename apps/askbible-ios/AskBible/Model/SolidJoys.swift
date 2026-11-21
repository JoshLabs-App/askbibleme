import Foundation
import Combine

struct DevotionalDay: Decodable, Identifiable, Equatable {
    let md: String
    let title: String
    let verse: String
    let ref: String
    let refBook: String?
    let refChapter: Int?
    let paragraphs: [String]
    let audio: String?
    let audioSec: Int?
    var id: String { md }
    var month: Int { Int(md.prefix(2)) ?? 1 }
    var dayOfMonth: Int { Int(md.suffix(2)) ?? 1 }
    var dateLabel: String { "\(month)月\(dayOfMonth)日" }
    var audioURL: URL? { audio.flatMap(URL.init(string:)) }
    var brief: String {
        paragraphs.first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) ?? verse
    }
    var minutesText: String? {
        guard let sec = audioSec, sec > 0 else { return nil }
        return "约 \(max(1, Int((Double(sec) / 60.0).rounded()))) 分钟"
    }
    func briefMatching(_ query: String) -> String {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return brief }
        if let hit = paragraphs.first(where: { $0.localizedStandardContains(q) }) {
            return hit
        }
        if !verse.isEmpty, verse.localizedStandardContains(q) {
            return verse
        }
        return brief
    }
    func matches(_ query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return true }
        if title.localizedStandardContains(q)
            || ref.localizedStandardContains(q)
            || verse.localizedStandardContains(q)
            || md.localizedStandardContains(q)
            || dateLabel.localizedStandardContains(q) {
            return true
        }
        return paragraphs.contains(where: { $0.localizedStandardContains(q) })
    }
}

/// 与安卓同一份授权内容：只在中文界面出现，全文仅缓存到设备，不进入安装包或仓库。
@MainActor
final class SolidJoys: ObservableObject {
    @Published private(set) var days: [String: DevotionalDay] = [:]
    @Published private(set) var orderedDays: [DevotionalDay] = []
    @Published private(set) var failed = false
    @Published private(set) var loading = false
    private var loadedFile: String?
    private var generation = UUID()
    static let title = "约翰·派博每日灵修"
    static let creditAuthor = "John Piper / Desiring God"
    static let creditTranslation = "忠信福音事工"
    static let creditLink = "https://www.befaithful.net"

    static func available(locale: AppLocale, isAdmin: Bool = true) -> Bool { locale != .en }
    static func dateForKey(_ md: String) -> Date {
        let parts = md.split(separator: "-").compactMap { Int($0) }
        let cal = Calendar.current
        let year = cal.component(.year, from: Date())
        guard parts.count == 2,
              let d = cal.date(from: DateComponents(year: year, month: parts[0], day: parts[1])) else {
            return Date()
        }
        return d
    }
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
        days = [:]; orderedDays = []
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
            let byKey = Dictionary(payload.days.map { ($0.md, $0) }, uniquingKeysWith: { _, last in last })
            days = byKey
            orderedDays = byKey.values.sorted { $0.md < $1.md }
            loadedFile = name
        } catch { if !Task.isCancelled, generation == requestID { failed = true } }
    }
}
