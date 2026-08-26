import WidgetKit
import SwiftUI
import UIKit

private let appGroupId = "group.me.askbible.shared"
private let snapshotKey = "askbible-daily-verse-widget-v1"
private let rotationAnchorIndexKey = "askbible-widget-rotation-anchor-index"
private let rotationAnchorMsKey = "askbible-widget-rotation-anchor-ms"
private let rotationPoolKey = "askbible-widget-rotation-pool-key"
private let rotationIntervalSecKey = "askbible-widget-rotation-interval-sec"
private let followVerseKeyKey = "askbible-widget-follow-verse-key"
private let followFrozenKey = "askbible-widget-follow-frozen"
private let defaultRotationIntervalSec: TimeInterval = 10
private let timelineEntryCount = 12
/// 换句：旧句淡出 → 安静半秒 → 新句淡入（与首页同节奏）。
private let verseFadeOutSec: TimeInterval = 1.2
private let verseFadeGapSec: TimeInterval = 0.5
private let verseFadeInSec: TimeInterval = 1.2
/// WidgetKit 会截断过大 timeline；4 步足够体感平滑。
private let verseFadeSteps = 4

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
    /// 换句时分步淡出/淡入（1 = 全显，0 = 全隐）。
    let contentOpacity: Double
}

private func joinWidgetVerseLines(_ lines: [String]) -> String {
    let parts = lines
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
    return parts.joined()
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
        // 字号固定：小挂件 18 / 4 行；中号 19.5 / 6 行。超长截断，不随字数缩放。
        if isSmall {
            return WidgetTypography(verseFontSize: 18, maxLines: 4)
        }
        return WidgetTypography(verseFontSize: 19.5, maxLines: 6)
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

    static func isFollowFrozen() -> Bool {
        guard let defaults = sharedDefaults() else { return false }
        if defaults.object(forKey: followFrozenKey) == nil { return false }
        if defaults.bool(forKey: followFrozenKey) { return true }
        return defaults.integer(forKey: followFrozenKey) != 0
    }

    static func followVerseKey() -> String? {
        let key = sharedDefaults()?.string(forKey: followVerseKeyKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines).uppercased() ?? ""
        return key.isEmpty ? nil : key
    }

    /// App 当前金句跟随：钉住索引；freeze 时停墙钟轮换，解冻后从该句继续墙钟。
    static func followAppVerse(verseKey: String?, verseKeys: [String], freeze: Bool) {
        guard let defaults = sharedDefaults() else { return }
        let key = verseKey?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() ?? ""
        if key.isEmpty || verseKeys.isEmpty {
            defaults.set(false, forKey: followFrozenKey)
            defaults.removeObject(forKey: followVerseKeyKey)
            return
        }
        let idx = verseKeys.firstIndex { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == key } ?? 0
        let now = Date().timeIntervalSince1970 * 1000
        defaults.set(idx, forKey: rotationAnchorIndexKey)
        defaults.set(now, forKey: rotationAnchorMsKey)
        defaults.set(freeze, forKey: followFrozenKey)
        if freeze {
            defaults.set(key, forKey: followVerseKeyKey)
        } else {
            defaults.removeObject(forKey: followVerseKeyKey)
        }
    }

    static func currentIndex(at date: Date, verseCount: Int, verseKeys: [String] = []) -> Int {
        guard verseCount > 0 else { return 0 }
        if isFollowFrozen(), let followKey = followVerseKey(), !verseKeys.isEmpty {
            if let idx = verseKeys.firstIndex(where: {
                $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == followKey
            }) {
                return idx
            }
            let idx = anchorIndex()
            return ((idx % verseCount) + verseCount) % verseCount
        }
        let elapsedMs = date.timeIntervalSince1970 * 1000 - anchorMs()
        let steps = max(0, Int(elapsedMs / (rotationIntervalSec() * 1000)))
        let idx = anchorIndex() + steps
        return ((idx % verseCount) + verseCount) % verseCount
    }

    static func advanceOnTap(verseCount: Int) {
        guard verseCount > 0, let defaults = sharedDefaults() else { return }
        if isFollowFrozen() { return }
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

/// 点击挂件：打开 App 首页（不进读经章、不控制播放）。
private let widgetOpenHomeURL = URL(string: "askbible://")!

struct DailyVerseProvider: TimelineProvider {
    func placeholder(in context: Context) -> DailyVerseEntry {
        DailyVerseEntry(
            date: Date(),
            verseLine: "你们要将一切的忧虑卸给神，因为祂顾念你们。",
            ref: "彼得前书 5:7",
            verseKey: "1PE.5.7",
            locale: "zh-TW",
            isPlaceholder: true,
            contentOpacity: 1
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyVerseEntry) -> Void) {
        completion(makeEntry(at: Date(), contentOpacity: 1))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyVerseEntry>) -> Void) {
        let now = Date()
        if WidgetRotationState.isFollowFrozen() {
            // 金句朗读跟随时只钉当前句，等 App reloadWidget 再刷新。
            completion(Timeline(entries: [makeEntry(at: now, contentOpacity: 1, syncPool: true)], policy: .never))
            return
        }

        let interval = max(
            WidgetRotationState.rotationIntervalSec(),
            verseFadeOutSec + verseFadeGapSec + verseFadeInSec + 1
        )
        let anchorMs = WidgetRotationState.anchorMs()
        let nowMs = now.timeIntervalSince1970 * 1000
        let elapsedMs = max(0, nowMs - anchorMs)
        let currentStep = Int(elapsedMs / (interval * 1000))
        // 池同步只做一次，勿在每个 fade entry 里写 UserDefaults。
        var entries: [DailyVerseEntry] = [makeEntry(at: now, contentOpacity: 1, syncPool: true)]

        // 每个换句边界：旧句先分步淡到 0，过界后再让新句从 0 分步淡入。
        for stepOffset in 0..<timelineEntryCount {
            let boundaryStep = currentStep + stepOffset + 1
            let boundaryMs = anchorMs + Double(boundaryStep) * interval * 1000
            let boundary = Date(timeIntervalSince1970: boundaryMs / 1000.0)
            if boundary.timeIntervalSince(now) > interval * Double(timelineEntryCount) + 1 {
                break
            }

            for fadeStep in 1...verseFadeSteps {
                let progress = Double(fadeStep) / Double(verseFadeSteps)
                // 保证仍落在边界前，currentIndex 仍是旧句。
                let t = boundary.addingTimeInterval(-verseFadeOutSec * (1.0 - progress) - 0.02)
                if t > now {
                    entries.append(makeEntry(at: t, contentOpacity: max(0, 1.0 - progress), syncPool: false))
                }
            }

            // 旧句消失后安静半秒（opacity 保持 0）。
            let quietAt = boundary.addingTimeInterval(verseFadeGapSec * 0.5)
            if quietAt >= now {
                entries.append(makeEntry(at: quietAt, contentOpacity: 0, syncPool: false))
            }

            for fadeStep in 0...verseFadeSteps {
                let progress = Double(fadeStep) / Double(verseFadeSteps)
                let t = boundary.addingTimeInterval(verseFadeGapSec + verseFadeInSec * progress)
                if t >= now {
                    entries.append(makeEntry(at: t, contentOpacity: min(1, progress), syncPool: false))
                }
            }
        }

        entries.sort { $0.date < $1.date }
        var deduped: [DailyVerseEntry] = []
        for entry in entries {
            if let last = deduped.last, abs(last.date.timeIntervalSince(entry.date)) < 0.015 {
                deduped[deduped.count - 1] = entry
            } else {
                deduped.append(entry)
            }
        }
        completion(Timeline(entries: deduped, policy: .atEnd))
    }

    private func makeEntry(at date: Date, contentOpacity: Double, syncPool: Bool = true) -> DailyVerseEntry {
        let snapshot = loadDailyVerseSnapshot()
        if syncPool, let snapshot {
            let trimmedPoolKey = snapshot.rotationPoolKey?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let poolKey = trimmedPoolKey.isEmpty ? snapshot.date : trimmedPoolKey
            let interval = snapshot.rotationIntervalSec.map { TimeInterval(max(1, $0)) }
                ?? defaultRotationIntervalSec
            WidgetRotationState.syncRotationPool(poolKey, intervalSec: interval)
        }
        let verses = resolvedVerses(from: snapshot)
        let opacity = min(1, max(0, contentOpacity))
        if !verses.isEmpty {
            let keys = verses.map { $0.verseKey }
            let idx = WidgetRotationState.currentIndex(at: date, verseCount: verses.count, verseKeys: keys)
            let verse = verses[idx]
            return DailyVerseEntry(
                date: date,
                verseLine: verse.line,
                ref: verse.ref,
                verseKey: verse.verseKey,
                locale: snapshot?.locale ?? "en",
                isPlaceholder: false,
                contentOpacity: opacity
            )
        }
        return DailyVerseEntry(
            date: date,
            verseLine: "Tap to open",
            ref: "",
            verseKey: "",
            locale: snapshot?.locale ?? "en",
            isPlaceholder: true,
            contentOpacity: opacity
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

private func widgetJustifiedVerseText(_ line: String, fontSize: CGFloat, truncate: Bool = false) -> AttributedString {
    let trimmed = widgetVerseLineForDisplay(line)
    var attributed = AttributedString(trimmed)
    guard !trimmed.isEmpty else { return attributed }

    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = .justified
    paragraphStyle.lineBreakMode = truncate ? .byTruncatingTail : .byCharWrapping
    paragraphStyle.lineSpacing = 4
    paragraphStyle.firstLineHeadIndent = fontSize * 1

    var container = AttributeContainer()
    container.paragraphStyle = paragraphStyle
    attributed.mergeAttributes(container)
    return attributed
}

private func widgetSerifFont(size: CGFloat) -> UIFont {
    let base = UIFont.systemFont(ofSize: size, weight: .regular)
    if let serif = base.fontDescriptor.withDesign(.serif) {
        return UIFont(descriptor: serif, size: size)
    }
    return base
}

/// 小挂件：按固定字号量高，超高则预截断加省略号（不依赖 SwiftUI / UILabel 自动缩小）。
private func widgetPreTruncatedVerseLine(
    _ line: String,
    fontSize: CGFloat,
    maxLines: Int,
    maxWidth: CGFloat,
    chineseIndent: Bool
) -> String {
    let trimmed = widgetVerseLineForDisplay(line)
    guard !trimmed.isEmpty, maxWidth > 1, maxLines > 0 else { return trimmed }

    let font = widgetSerifFont(size: fontSize)
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = 4
    paragraph.alignment = chineseIndent ? .justified : .natural
    paragraph.lineBreakMode = chineseIndent ? .byCharWrapping : .byWordWrapping
    if chineseIndent {
        paragraph.firstLineHeadIndent = fontSize
    }
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .paragraphStyle: paragraph,
    ]
    let maxHeight = ceil(font.lineHeight * CGFloat(maxLines) + 4 * CGFloat(max(0, maxLines - 1))) + 1

    func fits(_ s: String) -> Bool {
        let rect = (s as NSString).boundingRect(
            with: CGSize(width: maxWidth, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attrs,
            context: nil
        )
        return ceil(rect.height) <= maxHeight
    }

    if fits(trimmed) { return trimmed }

    var low = 0
    var high = trimmed.count
    var best = "…"
    while low <= high {
        let mid = (low + high) / 2
        let end = trimmed.index(trimmed.startIndex, offsetBy: mid)
        let candidate = String(trimmed[..<end]).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
        if fits(candidate) {
            best = candidate
            low = mid + 1
        } else {
            high = mid - 1
        }
    }
    return best
}

struct DailyVerseWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: DailyVerseEntry

    private var typography: WidgetTypography {
        WidgetTypography.resolve(verseLine: entry.verseLine, isSmall: family == .systemSmall)
    }

    private var horizontalInset: CGFloat {
        family == .systemSmall ? 6 : 10
    }

    var body: some View {
        let isSmall = family == .systemSmall
        let displayLine = widgetVerseLineForDisplay(entry.verseLine)
        let useJustifiedChinese = widgetUsesChineseLocale(entry.locale)
        // 上 15 / 下 10。
        let topInset: CGFloat = 15
        let bottomInset: CGFloat = 10
        let edgeInset: CGFloat = 10
        // systemSmall 内容区大约宽度（扣掉左右边距后），用于预截断量宽。
        let smallVerseWidth: CGFloat = 155 - edgeInset * 2 - horizontalInset * 2

        Link(destination: widgetOpenHomeURL) {
            VStack(alignment: .leading, spacing: 0) {
                if isSmall {
                    let truncated = widgetPreTruncatedVerseLine(
                        displayLine,
                        fontSize: typography.verseFontSize,
                        maxLines: typography.maxLines,
                        maxWidth: smallVerseWidth,
                        chineseIndent: useJustifiedChinese
                    )
                    Text(truncated)
                        .font(.system(size: typography.verseFontSize, weight: .regular, design: .serif))
                        .foregroundStyle(widgetVerseInk)
                        .lineSpacing(4)
                        .multilineTextAlignment(.leading)
                        .lineLimit(typography.maxLines)
                        .truncationMode(.tail)
                        .allowsTightening(false)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                } else {
                    Group {
                        if useJustifiedChinese {
                            Text(widgetJustifiedVerseText(
                                displayLine,
                                fontSize: typography.verseFontSize,
                                truncate: false
                            ))
                        } else {
                            Text(displayLine)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    .font(.system(size: typography.verseFontSize, weight: .regular, design: .serif))
                    .foregroundStyle(widgetVerseInk)
                    .lineSpacing(4)
                    .lineLimit(typography.maxLines)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .layoutPriority(1)
                }

                if isSmall {
                    Spacer(minLength: 0)
                }

                if !entry.ref.isEmpty {
                    Text(entry.ref)
                        .font(.system(size: isSmall ? 13.5 : 14.5, weight: .medium, design: .serif))
                        .foregroundStyle(widgetRefInk)
                        .multilineTextAlignment(.trailing)
                        .lineLimit(1)
                        .allowsTightening(false)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(.top, isSmall ? 8 : 10)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            // 不用 .id(verseKey)：换句 remount 会造成硬切/抖动；透明度由 timeline 分步驱动。
            .opacity(entry.contentOpacity)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.horizontal, horizontalInset)
            .clipped()
            .transaction { $0.animation = nil }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // 上 15、下 10，左右 10；裁切防顶出。
        .padding(.top, topInset)
        .padding(.bottom, bottomInset)
        .padding(.horizontal, edgeInset)
        .clipped()
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
        .description("Rotating verses on your schedule — tap to open AskBible.me")
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
        isPlaceholder: false,
        contentOpacity: 1
    )
}
