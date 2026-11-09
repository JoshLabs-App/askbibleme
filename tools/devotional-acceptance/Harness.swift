import SwiftUI

@main
struct DevotionalAcceptanceApp: App {
    var body: some Scene { WindowGroup { Harness().modifier(ParchmentSchemeInjector()).preferredColorScheme(ProcessInfo.processInfo.arguments.contains("-devotional-dark") ? .dark : nil) } }
}
struct Harness: View {
    @StateObject var content = SolidJoys()
    @StateObject var player = DevotionalPlayer()
    @StateObject var chapter = ChapterAudioPlayer()
    @State private var index = 0
    @State private var active = false
    @State private var naturalEnds = 0
    @AppStorage("devotional.after-reading") var enabled = false
    private let today = PlanDates.localDateString(Date())
    var body: some View {
        VStack {
            Text("\(naturalEnds)|\(index)|\(player.isPlaying)|\(player.failed)").accessibilityIdentifier("harness.status")
            HStack {
                Button("播放计划") { index = 0; active = true; playChapter() }
                Button("下一章") { chapter.remoteNext() }
                Button("停止") { chapter.pause(); player.stop(); active = false }
            }.buttonStyle(.bordered)
            ScrollView { DevotionalCard(content: content, player: player, date: Date(), locale: .zhCN).padding(20) }
        }
        .task {
            AppLocale.current = .zhCN
            await content.load(locale: .zhCN)
            chapter.onSkipNext = {
                if index == 0 { index = 1; playChapter() }
                else { chapter.pause(); active = false }
            }
            chapter.onFinished = {
                naturalEnds += 1
                print("DEVOTIONAL_CHECK natural-end \(naturalEnds)"); fflush(stdout)
                let handoff = PlanDevotionalHandoff.shouldPlay(naturalEnd: true, active: active, count: 2, index: index, listeningDay: today, today: today, enabled: enabled, available: true)
                if index == 0 { index = 1; playChapter() } else { active = false }
                if handoff, let day = content.day(Date()) { player.play(day) }
            }
            player.onWillPlay = { chapter.pause() }
            chapter.onWillPlay = { player.stop() }
            if ProcessInfo.processInfo.arguments.contains("--auto-plan") {
                enabled = true; index = 0; active = true; playChapter()
                print("DEVOTIONAL_CHECK READY"); fflush(stdout)
                for _ in 0..<80 {
                    try? await Task.sleep(for: .milliseconds(500))
                    if naturalEnds == 2 && player.isPlaying && player.duration > 0 {
                        print("DEVOTIONAL_CHECK PASS natural=2 actualPlaying=true duration=\(player.duration) state=\(UIApplication.shared.applicationState.rawValue)"); fflush(stdout)
                        return
                    }
                }
                print("DEVOTIONAL_CHECK FAIL natural=\(naturalEnds) playing=\(player.isPlaying) failed=\(player.failed)"); fflush(stdout)
            }
        }
    }
    func playChapter() {
        chapter.load(url: Bundle.main.url(forResource: "chapter", withExtension: "wav")!, key: "fixture-\(index)-\(UUID())", title: "验收经文 \(index + 1)")
        chapter.resume()
    }
}
