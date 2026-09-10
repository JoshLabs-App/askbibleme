import SwiftUI

/// 章末「读后两版」入口。对应 RN ReadChapterPostReadingEditions + PostReadingBookPage + ReadChapterInfoEditionBlock：
/// 标题「继续阅读与思考」+ 引导语 + 细线；左右两页书脊卡「陪你探索 / 查找资料」；点开后在下方铺出该版正文（纸面卡片），
/// 末尾「返回」；再往下是「上一章 / 回到顶部 / 下一章」。字号随阅读档位 textScale = verseFontSize / 16。
struct PostReadingEditions: View {
    let bookId: String
    let chapter: Int
    var size: ReadSize = .default
    let theme: Parchment
    var prev: ChapterNeighbor?
    var next: ChapterNeighbor?
    var onNavigate: (_ bookId: String, _ chapter: Int) -> Void
    var onBackToTop: () -> Void
    @Binding var active: InfoEditionVariant?

    private var scale: CGFloat { max(0.8, min(2.8, size.metrics.verseFontSize / 16)) }
    private func sx(_ n: CGFloat) -> CGFloat { (n * scale * 10).rounded() / 10 }

    private static let lead = Color(red: 120 / 255, green: 75 / 255, blue: 30 / 255, opacity: 0.9)
    private static let hint = Color(red: 140 / 255, green: 90 / 255, blue: 42 / 255, opacity: 0.92)
    private static let navInk = Color(rgb: 0x8C5A2A)
    private static let paper = Color(rgb: 0xF2E4CF)

    var body: some View {
        VStack(spacing: 0) {
            heading
            bookSpread
            if let v = active {
                EditionBlock(bookId: bookId, chapter: chapter, variant: v, size: size, theme: theme, onBack: { active = nil })
                bottomRow
            }
        }
        .padding(.top, 32)
    }

    private var heading: some View {
        VStack(spacing: 0) {
            Text("继续阅读与思考")
                .font(.system(size: sx(22), weight: .semibold)).tracking(0.8)
                .lineSpacing(max(0, sx(30) - sx(22)))
                .foregroundStyle(theme.ink).multilineTextAlignment(.center)
                .padding(.bottom, 10)
            Text("你可以先安静查阅资料，再回到经文里。")
                .font(.system(size: sx(13))).lineSpacing(max(0, sx(21) - sx(13)))
                .foregroundStyle(Self.lead).multilineTextAlignment(.center)
                .padding(.horizontal, 18).padding(.bottom, 10)
            Text("点按下方任一卡片进入")
                .font(.system(size: sx(12), weight: .medium)).tracking(0.2)
                .lineSpacing(max(0, sx(18) - sx(12)))
                .foregroundStyle(Self.hint).multilineTextAlignment(.center)
                .padding(.bottom, 8)
            GeometryReader { geo in
                Rectangle().fill(Color(red: 72 / 255, green: 52 / 255, blue: 34 / 255, opacity: 0.28))
                    .frame(width: min(224, geo.size.width * 0.56), height: 1 / UIScreen.main.scale)
                    .frame(maxWidth: .infinity)
            }
            .frame(height: 1)
        }
        .padding(.bottom, 20)
    }

    /// bookSpread：两页各占一半，外圈圆角 12；页面本身透明（羊皮透出）
    private var bookSpread: some View {
        HStack(alignment: .top, spacing: 0) {
            page(.guide)
            page(.info)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func page(_ v: InfoEditionVariant) -> some View {
        let isActive = active == v
        let art = v == .guide ? "post-reading-discover" : "post-reading-consult"
        let title = v == .guide ? "陪你探索" : "查找资料"
        let blurb = v == .guide ? "通过问题引导去探索" : "整理资料供你参考"
        return Button {
            if active != v { active = v }
        } label: {
            VStack(spacing: 0) {
                if let img = BundleImage.load(art, ext: "png") {
                    Image(uiImage: img).resizable().aspectRatio(1, contentMode: .fill).opacity(0.8)
                } else {
                    Color.clear.aspectRatio(1, contentMode: .fill)
                }
                VStack(spacing: 7) {
                    Text(title)
                        .font(.system(size: sx(17), weight: .semibold)).tracking(0.6)
                        .lineSpacing(max(0, sx(24) - sx(17)))
                        .foregroundStyle(MarkdownBody.accent).multilineTextAlignment(.center)
                    Text(blurb)
                        .font(.system(size: sx(11))).lineSpacing(max(0, sx(17) - sx(11)))
                        .foregroundStyle(Color(red: 120 / 255, green: 75 / 255, blue: 30 / 255, opacity: 0.86))
                        .multilineTextAlignment(.center).frame(maxWidth: 168)
                    HStack(spacing: 2) {
                        Text(isActive ? "已选择" : "点按打开")
                            .font(.system(size: 11, weight: .medium)).tracking(0.2)
                            .foregroundStyle(Self.hint)
                        MaterialIcon(glyph: isActive ? MI.checkCircle : MI.chevronRight, size: 14,
                                     color: isActive ? Color(rgb: 0x7A633A) : Self.navInk)
                    }
                    .frame(minHeight: 18).padding(.top, 2)
                }
                .padding(.top, 4).padding(.horizontal, 12).padding(.bottom, 14)
                .frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
    }

    /// 底部「上一章 / 回到顶部 / 下一章」（上下各 50）
    private var bottomRow: some View {
        HStack(spacing: 0) {
            HStack {
                if let p = prev {
                    Button { onNavigate(p.bookId, p.chapter) } label: {
                        HStack(spacing: 1) {
                            MaterialIcon(glyph: MI.chevronLeft, size: 16, color: Self.navInk)
                            Text("上一章").font(.system(size: 13, weight: .medium)).tracking(0.1)
                                .foregroundStyle(Color(red: 140 / 255, green: 90 / 255, blue: 42 / 255, opacity: 0.88))
                        }
                        .padding(6)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onBackToTop) {
                Text("回到顶部").font(.system(size: sx(14), weight: .medium)).tracking(0.2)
                    .foregroundStyle(Color(red: 140 / 255, green: 90 / 255, blue: 42 / 255, opacity: 0.84))
                    .padding(.horizontal, 8).padding(.vertical, 6)
            }
            .buttonStyle(.plain)
            HStack {
                if let n = next {
                    Button { onNavigate(n.bookId, n.chapter) } label: {
                        HStack(spacing: 1) {
                            Text("下一章").font(.system(size: 13, weight: .medium)).tracking(0.1)
                                .foregroundStyle(Color(red: 140 / 255, green: 90 / 255, blue: 42 / 255, opacity: 0.88))
                            MaterialIcon(glyph: MI.chevronRight, size: 16, color: Self.navInk)
                        }
                        .padding(6)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.top, 50).padding(.bottom, 50)
    }
}

/// 展开的一版正文。对应 RN ReadChapterInfoEditionBlock：免责声明 → 通屏壳（顶部一道 15pt 的暗影）→
/// 纸面卡片（#F2E4CF、圆角 18、边 rgba(150,112,64,.18)、投影）→ 标题 + Markdown → 「返回」。
private struct EditionBlock: View {
    let bookId: String
    let chapter: Int
    let variant: InfoEditionVariant
    var size: ReadSize
    let theme: Parchment
    var onBack: () -> Void

    private var scale: CGFloat { max(0.8, min(2.8, size.metrics.verseFontSize / 16)) }
    private func sx(_ n: CGFloat) -> CGFloat { (n * scale * 10).rounded() / 10 }

    private var loaded: (heading: String?, body: String)? {
        guard let ch = InfoEditionDatabase.shared?.chapter(bookId: bookId, chapter: chapter, variant: variant) else { return nil }
        return InfoEditionFormat.splitPrimaryHeading(InfoEditionFormat.readerText(ch.markdown, variant: variant))
    }

    var body: some View {
        let content = loaded
        VStack(spacing: 0) {
            Text("以下仅为参考资料，请对照圣经慎思明辨")
                .font(.system(size: sx(12))).lineSpacing(max(0, sx(19) - sx(12)))
                .foregroundStyle(theme.muted).multilineTextAlignment(.center)
                .frame(maxWidth: 320).padding(.horizontal, 8)
                .padding(.top, 10).padding(.bottom, 14 + 4)

            VStack(alignment: .leading, spacing: 0) {
                if let content {
                    if let h = content.heading {
                        // titleStyles：24/700 强调色、行高 36、字距 .5、居中、上 30 下 22
                        Text(h)
                            .font(.system(size: sx(24), weight: .bold)).tracking(0.5)
                            .lineSpacing(max(0, sx(36) - sx(24)))
                            .foregroundStyle(MarkdownBody.accent).multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.top, sx(30)).padding(.bottom, 22)
                    }
                    MarkdownBody(markdown: content.body, size: size, theme: theme)
                } else {
                    Text("暂时无法加载本章讲解")
                        .font(.system(size: sx(13))).lineSpacing(max(0, sx(20) - sx(13)))
                        .foregroundStyle(theme.muted).frame(maxWidth: .infinity)
                }
                Button(action: onBack) {
                    Text("返回").font(.system(size: sx(14), weight: .semibold)).tracking(0.3)
                        .foregroundStyle(Color(rgb: 0x8C5A2A))
                        .padding(.horizontal, 8).padding(.vertical, 6)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .padding(.top, 50).padding(.bottom, 100)
            }
            .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18).fill(Color(rgb: 0xF2E4CF)))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Color(red: 150 / 255, green: 112 / 255, blue: 64 / 255, opacity: 0.18), lineWidth: 1))
            .shadow(color: .black.opacity(0.22), radius: 16, y: 8)
            .padding(.horizontal, 12).padding(.top, 14).padding(.bottom, 14)
            .frame(maxWidth: .infinity, minHeight: UIScreen.main.bounds.height, alignment: .top)
            .background(alignment: .top) {
                // bodyFullscreenShell 顶部的暗影：rgba(42,24,13,.48) → 15pt 内淡出
                LinearGradient(stops: [
                    .init(color: Color(red: 42 / 255, green: 24 / 255, blue: 13 / 255, opacity: 0.48), location: 0),
                    .init(color: Color(red: 29 / 255, green: 18 / 255, blue: 10 / 255, opacity: 0.31), location: 0.45),
                    .init(color: .clear, location: 1),
                ], startPoint: .top, endPoint: .bottom)
                .frame(height: 15)
            }
            .padding(.horizontal, -20)  // 通屏：越过章页 20 的内边距
        }
        .padding(.top, 24)
    }
}
