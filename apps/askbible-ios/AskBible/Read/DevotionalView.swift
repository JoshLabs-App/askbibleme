import SwiftUI

struct DevotionalCard: View {
    @ObservedObject var content: SolidJoys
    @ObservedObject var player: DevotionalPlayer
    let date: Date
    let locale: AppLocale
    @AppStorage("devotional.after-reading") private var autoRead = false
    @Environment(\.parchment) private var theme
    @ScaledMetric(relativeTo: .body) private var textScale = 1.0
    @State private var showingArticle = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(locale.zh("今日灵修")).font(.system(size: 14 * textScale, weight: .semibold))
                if let day = content.day(date) { Text(locale.zh(day.dateLabel)).font(.system(size: 14 * textScale)) }
            }.foregroundStyle(theme.muted)
            Toggle(isOn: $autoRead) {
                Text(locale.zh("读经后接着听")).font(.system(size: 15 * textScale)).foregroundStyle(theme.ink)
            }
            .tint(theme.ink).frame(minHeight: 44)
            .accessibilityIdentifier("devotional.afterReading")
            if let day = content.day(date) {
                Button { showingArticle = true } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(day.title).font(.system(size: 19 * textScale, weight: .semibold)).foregroundStyle(theme.ink)
                        Text(day.verse).font(.system(size: 15 * textScale)).foregroundStyle(theme.muted).lineLimit(2)
                    }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                }.buttonStyle(.plain)
                DevotionalControls(day: day, player: player, locale: locale)
            } else if content.failed {
                Button(locale.zh("灵修没有载入，点这里重试")) { Task { await content.load(locale: locale) } }
                    .font(.system(size: 15 * textScale)).foregroundStyle(theme.muted).frame(minHeight: 44)
            } else { Text(locale.zh("正在准备今日灵修…")).font(.system(size: 15 * textScale)).foregroundStyle(theme.muted) }
        }
        .padding(18).background(RoundedRectangle(cornerRadius: 18).fill(theme.surface))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(theme.border, lineWidth: 0.5))
        .sheet(isPresented: $showingArticle) {
            if let day = content.day(date) {
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            Text(locale.zh(day.dateLabel)).foregroundStyle(theme.muted)
                            Text(day.title).font(.system(size: 24 * textScale, weight: .bold))
                            Text(day.verse).font(.system(size: 18 * textScale))
                            Text(day.ref).foregroundStyle(theme.muted)
                            DevotionalControls(day: day, player: player, locale: locale)
                            ForEach(Array(day.paragraphs.enumerated()), id: \.offset) { _, paragraph in
                                Text(paragraph).font(.system(size: 18 * textScale)).lineSpacing(7)
                            }
                            Divider()
                            Text("John Piper / Desiring God").font(.system(size: 15 * textScale))
                            Link(locale.zh("译文与音频：忠信福音事工"), destination: URL(string: "https://www.befaithful.net")!).font(.system(size: 15 * textScale))
                        }.foregroundStyle(theme.ink).padding(20)
                    }.background(theme.canvas)
                    .navigationTitle(locale.zh("今日灵修"))
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button(locale.zh("关闭")) { showingArticle = false } } }
                }
            }
        }
    }
}

struct DevotionalControls: View {
    let day: DevotionalDay
    @ObservedObject var player: DevotionalPlayer
    let locale: AppLocale
    @Environment(\.parchment) private var theme
    @ScaledMetric(relativeTo: .body) private var textScale = 1.0
    private var mine: Bool { player.currentKey == day.md }
    var body: some View {
        if day.audioURL != nil {
            VStack(spacing: 6) {
                HStack {
                    if mine && player.isLoading { ProgressView() }
                    if mine && player.failed { Text(locale.zh("音频未能播放，请重试")).font(.system(size: 14 * textScale)) }
                    Spacer()
                    Button {
                        if mine && player.wantsPlayback { player.remotePause() } else { player.play(day) }
                    } label: {
                        Label(locale.zh(mine && player.wantsPlayback ? "暂停" : "收听"), systemImage: mine && player.wantsPlayback ? "pause.fill" : "play.fill")
                            .font(.system(size: 15 * textScale)).frame(minWidth: 80, minHeight: 44)
                    }.buttonStyle(.plain).accessibilityIdentifier("devotional.play")
                }
                if mine && player.duration > 0 {
                    Slider(value: Binding(get: { min(player.position, player.duration) }, set: { player.remoteSeek(to: $0) }), in: 0...player.duration)
                        .accessibilityLabel(locale.zh("播放进度"))
                }
            }.foregroundStyle(theme.ink).tint(theme.ink)
        }
    }
}
