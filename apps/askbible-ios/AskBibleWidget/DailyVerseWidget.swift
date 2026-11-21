import WidgetKit
import SwiftUI

private let appGroupId = "group.me.askbible.native"
private let textKey = "widget-verse-v1-text"
private let refKey  = "widget-verse-v1-ref"
private let idKey   = "widget-verse-v1-key"

private let sampleText = "凡劳苦担重担的人可以到我这里来，我就使你们得安息。"
private let sampleRef  = "马太福音 11:28"
private let sampleKey  = "MAT.11.28"

// MARK: - Timeline

struct VerseEntry: TimelineEntry {
    let date: Date
    let text: String
    let reference: String
    let verseKey: String
}

struct DailyVerseProvider: TimelineProvider {
    func placeholder(in context: Context) -> VerseEntry {
        VerseEntry(date: .now, text: sampleText, reference: sampleRef, verseKey: sampleKey)
    }

    func getSnapshot(in context: Context, completion: @escaping (VerseEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<VerseEntry>) -> Void) {
        let entry = readEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: entry.date)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func readEntry() -> VerseEntry {
        let ud = UserDefaults(suiteName: appGroupId)
        let text = ud?.string(forKey: textKey) ?? sampleText
        let ref  = ud?.string(forKey: refKey)  ?? sampleRef
        let key  = ud?.string(forKey: idKey)   ?? sampleKey
        return VerseEntry(date: .now, text: text, reference: ref, verseKey: key)
    }
}

// MARK: - View（支持日夜羊皮自适应 + 无衬线统一字体 + AskBible.me 品牌署名 + 锁屏矩形组件 + 点击深链直达）

private let lightCanvas = Color(red: 0xEC / 255, green: 0xD9 / 255, blue: 0xB9 / 255)
private let darkCanvas  = Color(red: 0x22 / 255, green: 0x1C / 255, blue: 0x18 / 255)
private let lightInk    = Color(red: 0x1C / 255, green: 0x14 / 255, blue: 0x10 / 255)
private let darkInk     = Color(red: 0xF4 / 255, green: 0xEB / 255, blue: 0xE1 / 255)
private let amberAccent = Color(red: 0xD9 / 255, green: 0x77 / 255, blue: 0x07 / 255)

struct DailyVerseWidgetView: View {
    let entry: VerseEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    private var ink: Color { colorScheme == .dark ? darkInk : lightInk }
    private var deepLinkURL: URL? {
        let encoded = entry.verseKey.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? sampleKey
        return URL(string: "askbible://verse?key=\(encoded)")
    }

    var body: some View {
        Group {
            if family == .accessoryRectangular {
                lockScreenRectangular
            } else {
                homeScreenCard
            }
        }
        .widgetURL(deepLinkURL)
    }

    /// iOS 锁屏矩形小组件（每天点亮屏幕看时间即温和相遇）
    private var lockScreenRectangular: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(entry.text)
                .font(.system(size: 12.5, weight: .semibold))
                .lineLimit(2)
                .widgetAccentable()
            Text("— \(entry.reference)")
                .font(.system(size: 10.5, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// 桌面小组件（日夜双色羊皮自适应，深夜看桌面不再刺眼）
    private var homeScreenCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 5) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(amberAccent)
                    .frame(width: 12, height: 3)
                Text("AskBible.me")
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(ink.opacity(0.48))
                Spacer()
            }
            .padding(.bottom, 8)

            Text(entry.text)
                .font(.system(size: family == .systemSmall ? 13.5 : 15, weight: .semibold))
                .foregroundStyle(ink)
                .lineSpacing(3.5)
                .lineLimit(family == .systemSmall ? 5 : 6)

            Spacer(minLength: 6)

            HStack(alignment: .center, spacing: 3) {
                Text(entry.reference)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(ink.opacity(0.65))
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(amberAccent)
                Spacer()
            }
        }
        .padding(family == .systemSmall ? 14 : 16)
    }
}

struct AdaptiveWidgetBackground: View {
    @Environment(\.colorScheme) private var colorScheme
    var body: some View {
        colorScheme == .dark ? darkCanvas : lightCanvas
    }
}

// MARK: - Widget

struct DailyVerseWidget: Widget {
    let kind = "DailyVerseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DailyVerseProvider()) { entry in
            DailyVerseWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    AdaptiveWidgetBackground()
                }
        }
        .configurationDisplayName("每日金句 · AskBible.me")
        .description("桌面与锁屏安静经文陪伴，轻点直达所在章节")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

// MARK: - Preview

#Preview(as: .systemMedium) {
    DailyVerseWidget()
} timeline: {
    VerseEntry(date: .now,
               text: "耶和华是我的牧者，我必不至缺乏。他使我躺卧在青草地上，领我在可安歇的水边。",
               reference: "诗篇 23:1-2",
               verseKey: "PSA.23.1")
}
