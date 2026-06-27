import WidgetKit
import SwiftUI
import UIKit

private let appGroupId = "group.me.askbible.shared"
private let snapshotKey = "askbible-daily-verse-widget-v1"
private let rotationAnchorIndexKey = "askbible-widget-rotation-anchor-index"
private let rotationAnchorMsKey = "askbible-widget-rotation-anchor-ms"
private let rotationPoolKey = "askbible-widget-rotation-pool-key"
private let rotationIntervalSecKey = "askbible-widget-rotation-interval-sec"
private let defaultRotationIntervalSec: TimeInterval = 10
private let timelineEntryCount = 48
private let widgetVerseFadeSec: Double = 0.42

struct WidgetVerseItem: Codable {
    let verseKey: String
    let lines: [String]
    let ref: String
}

struct DailyVerseSnapshot: Codable {
    let version: Int
    let date: String
    let locale: String
    let translationId: String
    let scopeId: String
    let rotationPoolKey: String?
    let rotationIntervalSec: Int?
    let verses: [WidgetVerseItem]?
    let verseKey: String?
    let lines: [String]?
    let ref: String?
}

struct DailyVerseEntry: TimelineEntry {
    let date: Date
    let verseLine: String
    let ref: String
    let verseKey: String
    let locale: String
    let isPlaceholder: Bool
}

private func joinWidgetVerseLines(_ lines: [String]) -> String {
    lines
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .first { !$0.isEmpty } ?? ""
}

private func stripExistingQuotes(_ line: String) -> String {
    var text = line.trimmingCharacters(in: .whitespacesAndNewlines)
    let quoteChars: [Character] = ["\u{201C}", "\u{201D}", "\"", "「", "」", "『", "』", "\u{300C}", "\u{300D}"]
    while let first = text.first, quoteChars.contains(first) {
        text.removeFirst()
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    while let last = text.last, quoteChars.contains(last) {
        text.removeLast()
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return text
}

private struct WidgetTypography {
    let verseFontSize: CGFloat
    let maxLines: Int

    static func resolve(verseLine: String, isSmall: Bool) -> WidgetTypography {
        let chars = verseLine.trimmingCharacters(in: .whitespacesAndNewlines).count
        let verseFont: CGFloat
        let maxLines: Int

        if isSmall {
            switch chars {
            case ...22: verseFont = 16.5
            case ...40: verseFont = 15
            case ...56: verseFont = 14
            default: verseFont = 13
            }
            maxLines = chars > 56 ? 6 : 5
        } else {
            switch chars {
            case ...34: verseFont = 18.5
            case ...56: verseFont = 17
            case ...84: verseFont = 15.5
            default: verseFont = 14.5
            }
            maxLines = chars > 84 ? 7 : 6
        }

        return WidgetTypography(verseFontSize: verseFont, maxLines: maxLines)
    }
}

struct WidgetRotationState {
    static func sharedDefaults() -> UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    static func syncRotationPool(_ poolKey: String, intervalSec: TimeInterval) {
        guard let defaults = sharedDefaults() else { return }
        let stored = defaults.string(forKey: rotationPoolKey)
        if stored != poolKey {
            defaults.set(poolKey, forKey: rotationPoolKey)
            defaults.set(0, forKey: rotationAnchorIndexKey)
            defaults.set(Date().timeIntervalSince1970 * 1000, forKey: rotationAnchorMsKey)
        }
        defaults.set(intervalSec, forKey: rotationIntervalSecKey)
    }

    static func rotationIntervalSec() -> TimeInterval {
        let raw = sharedDefaults()?.double(forKey: rotationIntervalSecKey) ?? 0
        return raw > 0 ? raw : defaultRotationIntervalSec
    }

    static func anchorIndex() -> Int {
        sharedDefaults()?.integer(forKey: rotationAnchorIndexKey) ?? 0
    }

    static func anchorMs() -> TimeInterval {
        let raw = sharedDefaults()?.double(forKey: rotationAnchorMsKey) ?? 0
        if raw <= 0 { return Date().timeIntervalSince1970 * 1000 }
        return raw
    }

    static func currentIndex(at date: Date, verseCount: Int) -> Int {
        guard verseCount > 0 else { return 0 }
        let elapsedMs = date.timeIntervalSince1970 * 1000 - anchorMs()
        let steps = max(0, Int(elapsedMs / (rotationIntervalSec() * 1000)))
        let idx = anchorIndex() + steps
        return ((idx % verseCount) + verseCount) % verseCount
    }

    static func advanceOnTap(verseCount: Int) {
        guard verseCount > 0, let defaults = sharedDefaults() else { return }
        let now = Date()
        let current = currentIndex(at: now, verseCount: verseCount)
        defaults.set((current + 1) % verseCount, forKey: rotationAnchorIndexKey)
        defaults.set(now.timeIntervalSince1970 * 1000, forKey: rotationAnchorMsKey)
    }
}

func loadDailyVerseSnapshot() -> DailyVerseSnapshot? {
    guard let defaults = UserDefaults(suiteName: appGroupId),
          let raw = defaults.string(forKey: snapshotKey),
          let data = raw.data(using: .utf8) else {
        return nil
    }
    return try? JSONDecoder().decode(DailyVerseSnapshot.self, from: data)
}

func resolvedVerses(from snapshot: DailyVerseSnapshot?) -> [(line: String, ref: String, verseKey: String)] {
    if let items = snapshot?.verses, !items.isEmpty {
        return items.compactMap { item in
            let line = stripExistingQuotes(joinWidgetVerseLines(item.lines))
            guard !line.isEmpty else { return nil }
            let ref = item.ref.trimmingCharacters(in: .whitespacesAndNewlines)
            return (line, ref, item.verseKey)
        }
    }
    if let snapshot {
        let line = stripExistingQuotes(joinWidgetVerseLines(snapshot.lines ?? []))
        if !line.isEmpty {
            let ref = snapshot.ref?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let verseKey = snapshot.verseKey?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return [(line, ref, verseKey)]
        }
    }
    return []
}

private func widgetReadChapterURL(verseKey: String) -> URL? {
    let trimmed = verseKey.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    guard !trimmed.isEmpty else { return URL(string: "askbible://") }
    let parts = trimmed.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 3,
          let chapter = Int(parts[1]), chapter >= 1,
          let verse = Int(parts[2]), verse >= 1 else {
        return URL(string: "askbible://")
    }
    let bookId = String(parts[0])
    guard bookId.range(of: #"^[A-Z0-9]{2,8}$"#, options: .regularExpression) != nil else {
        return URL(string: "askbible://")
    }
    return URL(string: "askbible://read/\(bookId)/\(chapter)?verse=\(verse)")
}

struct DailyVerseProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyVerseEntry {
        DailyVerseEntry(
            date: Date(),
            verseLine: "你们要将一切的忧虑卸给神，因为祂顾念你们。",
            ref: "彼得前书 5:7",
            verseKey: "1PE.5.7",
            locale: "zh-TW",
            isPlaceholder: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyVerseEntry) -> Void) {
        completion(makeEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyVerseEntry>) -> Void) {
        let now = Date()
        var entries: [DailyVerseEntry] = []
        let interval = WidgetRotationState.rotationIntervalSec()
        for i in 0..<timelineEntryCount {
            let date = now.addingTimeInterval(interval * Double(i))
            entries.append(makeEntry(at: date))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func makeEntry(at date: Date) -> DailyVerseEntry {
        let snapshot = loadDailyVerseSnapshot()
        if let snapshot {
            let trimmedPoolKey = snapshot.rotationPoolKey?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let poolKey = trimmedPoolKey.isEmpty ? snapshot.date : trimmedPoolKey
            let interval = snapshot.rotationIntervalSec.map { TimeInterval(max(1, $0)) }
                ?? defaultRotationIntervalSec
            WidgetRotationState.syncRotationPool(poolKey, intervalSec: interval)
        }
        let verses = resolvedVerses(from: snapshot)
        if !verses.isEmpty {
            let idx = WidgetRotationState.currentIndex(at: date, verseCount: verses.count)
            let verse = verses[idx]
            return DailyVerseEntry(
                date: date,
                verseLine: verse.line,
                ref: verse.ref,
                verseKey: verse.verseKey,
                locale: snapshot?.locale ?? "en",
                isPlaceholder: false
            )
        }
        return DailyVerseEntry(
            date: date,
            verseLine: "Tap to open",
            ref: "",
            verseKey: "",
            locale: snapshot?.locale ?? "en",
            isPlaceholder: true
        )
    }
}

private let widgetVerseInk = Color(red: 0.11, green: 0.08, blue: 0.06).opacity(0.94)
private let widgetRefInk = Color(red: 0.11, green: 0.08, blue: 0.06).opacity(0.82)

private func widgetUsesChineseLocale(_ locale: String) -> Bool {
    locale.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasPrefix("zh")
}

private func widgetVerseLineForDisplay(_ line: String) -> String {
    line.trimmingCharacters(in: .whitespacesAndNewlines)
}

private func widgetJustifiedVerseText(_ line: String, fontSize: CGFloat) -> AttributedString {
    let trimmed = widgetVerseLineForDisplay(line)
    var attributed = AttributedString(trimmed)
    guard !trimmed.isEmpty else { return attributed }

    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = .justified
    paragraphStyle.lineBreakMode = .byCharWrapping
    paragraphStyle.lineSpacing = 3
    paragraphStyle.firstLineHeadIndent = fontSize * 2

    var container = AttributeContainer()
    container.paragraphStyle = paragraphStyle
    attributed.mergeAttributes(container)
    return attributed
}

struct DailyVerseWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: DailyVerseEntry

    private var typography: WidgetTypography {
        WidgetTypography.resolve(verseLine: entry.verseLine, isSmall: family == .systemSmall)
    }

    private var contentPadding: EdgeInsets {
        if family == .systemSmall {
            return EdgeInsets(top: 20, leading: 22, bottom: 20, trailing: 14)
        }
        return EdgeInsets(top: 24, leading: 28, bottom: 24, trailing: 16)
    }

    var body: some View {
        let isSmall = family == .systemSmall
        let displayLine = widgetVerseLineForDisplay(entry.verseLine)
        let useJustifiedChinese = widgetUsesChineseLocale(entry.locale)

        VStack(alignment: .leading, spacing: 0) {
            Group {
                if useJustifiedChinese {
                    Text(widgetJustifiedVerseText(displayLine, fontSize: typography.verseFontSize))
                } else {
                    Text(displayLine)
                        .multilineTextAlignment(.leading)
                }
            }
            .font(.system(size: typography.verseFontSize, weight: .regular, design: .serif))
            .foregroundStyle(widgetVerseInk)
            .lineSpacing(3)
            .lineLimit(typography.maxLines)
            .minimumScaleFactor(0.88)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentTransition(.opacity)
            .animation(.easeInOut(duration: widgetVerseFadeSec), value: entry.verseKey)

            Spacer(minLength: 0)

            if !entry.ref.isEmpty {
                Text(entry.ref)
                    .font(.system(size: isSmall ? 11.5 : 12.5, weight: .medium, design: .serif))
                    .foregroundStyle(widgetRefInk)
                    .multilineTextAlignment(.trailing)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .contentTransition(.opacity)
                    .animation(.easeInOut(duration: widgetVerseFadeSec), value: entry.verseKey)
            }
        }
        .id(entry.verseKey)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(contentPadding)
        .widgetURL(widgetReadChapterURL(verseKey: entry.verseKey))
        .containerBackground(for: .widget) {
            Image("WidgetParchmentBg")
                .resizable()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct AskBibleDailyVerseWidget: Widget {
    let kind: String = "AskBibleDailyVerseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DailyVerseProvider()) { entry in
            DailyVerseWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Verse")
        .description("Rotating verses on your schedule — tap to open in Bible")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
        .containerBackgroundRemovable(false)
    }
}

#Preview(as: .systemMedium) {
    AskBibleDailyVerseWidget()
} timeline: {
    DailyVerseEntry(
        date: .now,
        verseLine: "他心裏的隱情顯露出來，就必將臉伏地，敬拜神，說：「神真是在你們中間了。」",
        ref: "哥林多前書 14:25",
        verseKey: "1CO.14.25",
        locale: "zh-TW",
        isPlaceholder: false
    )
}
