import SwiftUI

/// 经文关联弹层。对应 RN 版 `ReadChapterVerseXrefSheet`：
/// 标题「{书名} {章}:{节} · 经文关联」，两区「被引用于」/「相关经文」，
/// 每条引用带目标经文预览（muted、0.9× 字号），点击跳转该章。
struct VerseXrefSheet: View {
    let bookName: String
    let chapter: Int
    let xrefs: VerseXrefs
    let size: ReadSize
    let snippet: (XrefTarget) -> String?
    let onOpen: (XrefTarget) -> Void
    let onClose: () -> Void
    var locale: AppLocale = .zhCN

    private let theme = Parchment.light

    var body: some View {
        ZStack(alignment: .bottom) {
            theme.modalBackdrop.ignoresSafeArea().onTapGesture(perform: onClose)

            VStack(alignment: .leading, spacing: 0) {
                Text("\(bookName) \(chapter):\(xrefs.verse) · 经文关联")
                    .font(.system(size: max(17, (size.metrics.verseFontSize * 0.95).rounded()), weight: .bold))
                    .foregroundStyle(theme.ink)
                    .padding(.bottom, 14)

                if xrefs.isEmpty {
                    Text("暂无关联经文")
                        .font(.system(size: (size.metrics.verseFontSize * 0.9).rounded()))
                        .foregroundStyle(theme.muted)
                } else {
                    // 内容装得下就直接铺开（弹层贴着内容收口），装不下才套 ScrollView 限高 420 ——
                    // 单用 ScrollView.frame(maxHeight:) 会把弹层永远撑到 420，下面一大片留白
                    ViewThatFits(in: .vertical) {
                        refList
                        ScrollView(showsIndicators: false) { refList }
                    }
                    .frame(maxHeight: 420)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 34)
            .frame(maxWidth: .infinity, alignment: .leading)
            .parchmentCard(cornerRadius: 18)
            .padding(.horizontal, 10)
        }
    }

    private var refList: some View {
        VStack(alignment: .leading, spacing: 18) {
            section("被引用于", xrefs.incoming)
            section("相关经文", xrefs.outgoing)
        }
    }

    @ViewBuilder
    private func section(_ title: String, _ refs: [XrefTarget]) -> some View {
        if !refs.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.muted)
                ForEach(refs) { ref in
                    Button { onOpen(ref) } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(ref.label(bookName: BibleCatalog.book(id: ref.bookId)?.name(locale) ?? ref.bookId))
                                .font(.system(size: size.metrics.verseFontSize * 0.9, weight: .semibold))
                                .foregroundStyle(theme.parchmentAccent)
                            if let text = snippet(ref) {
                                Text(text)
                                    .font(.system(size: (size.metrics.verseFontSize * 0.9 * 0.9).rounded()))
                                    .foregroundStyle(theme.muted)
                                    .lineLimit(3)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/// 睡眠定时弹层：30 分钟 / 60 分钟 / 关闭。到期只暂停。
/// 睡眠定时是壳层级的：朗读和音乐两个播放器一起设。这里只出 UI，谁来设由 RootView 决定。
struct SleepTimerSheet: View {
    let remainingLabel: String?
    let onPick: (Int?) -> Void
    let onClose: () -> Void
    private let theme = Parchment.light

    var body: some View {
        ZStack(alignment: .bottom) {
            theme.modalBackdrop.ignoresSafeArea().onTapGesture(perform: onClose)
            VStack(spacing: 10) {
                Text("睡眠定时")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(theme.ink)
                if let left = remainingLabel {
                    Text("剩余 \(left)")
                        .font(.system(size: 13))
                        .foregroundStyle(theme.muted)
                }
                ForEach(ChapterAudioPlayer.sleepOptionsMinutes, id: \.self) { m in
                    option("\(m) 分钟") { onPick(m); onClose() }
                }
                option("关闭定时") { onPick(nil); onClose() }
            }
            .padding(18)
            .frame(maxWidth: .infinity)
            .parchmentCard(cornerRadius: 18)
            .padding(.horizontal, 10)
            .padding(.bottom, 24)
        }
    }

    private func option(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.ink)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(RoundedRectangle(cornerRadius: 10).fill(theme.surface))
        }
        .buttonStyle(.plain)
    }
}
