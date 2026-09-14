import WidgetKit
import SwiftUI

private let appGroupId = "group.me.askbible.native"
private let textKey = "widget-verse-v1-text"
private let refKey  = "widget-verse-v1-ref"

private let sampleText = "凡自高的，必降为卑；自卑的，必升为高。"
private let sampleRef  = "马太福音 23:12"

// MARK: - Timeline

struct VerseEntry: TimelineEntry {
    let date: Date
    let text: String
    let reference: String
}

struct DailyVerseProvider: TimelineProvider {
    func placeholder(in context: Context) -> VerseEntry {
        VerseEntry(date: .now, text: sampleText, reference: sampleRef)
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
        return VerseEntry(date: .now, text: text, reference: ref)
    }
}

// MARK: - View

private let canvas = Color(red: 0xec/255, green: 0xd9/255, blue: 0xb9/255)
private let ink    = Color(red: 0x1c/255, green: 0x14/255, blue: 0x10/255)

struct DailyVerseWidgetView: View {
    let entry: VerseEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        ZStack(alignment: .topLeading) {
            canvas.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // 装饰引号
                Text("\u{201C}")
                    .font(.system(size: family == .systemSmall ? 30 : 40, weight: .light, design: .serif))
                    .foregroundStyle(ink.opacity(0.22))
                    .padding(.bottom, -12)

                // 经文正文
                Text(entry.text)
                    .font(.system(size: family == .systemSmall ? 14 : 15, design: .serif))
                    .foregroundStyle(ink)
                    .lineSpacing(3)
                    .lineLimit(family == .systemSmall ? 6 : 9)

                Spacer(minLength: 4)

                // 书卷章节 + 品牌
                HStack(alignment: .bottom) {
                    Text(entry.reference)
                        .font(.system(size: 11, weight: .semibold, design: .serif))
                        .foregroundStyle(ink.opacity(0.55))
                    Spacer()
                    Text("AskBible")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(ink.opacity(0.35))
                }
            }
            .padding(family == .systemSmall ? 14 : 16)
        }
    }
}

// MARK: - Widget

struct DailyVerseWidget: Widget {
    let kind = "DailyVerseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DailyVerseProvider()) { entry in
            DailyVerseWidgetView(entry: entry)
                .containerBackground(canvas, for: .widget)
        }
        .configurationDisplayName("每日金句")
        .description("首页当前的经文金句")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    DailyVerseWidget()
} timeline: {
    VerseEntry(date: .now, text: sampleText, reference: sampleRef)
}

#Preview(as: .systemMedium) {
    DailyVerseWidget()
} timeline: {
    VerseEntry(date: .now,
               text: "耶和华是我的牧者，我必不至缺乏。他使我躺卧在青草地上，领我在可安歇的水边。",
               reference: "诗篇 23:1-2")
}
