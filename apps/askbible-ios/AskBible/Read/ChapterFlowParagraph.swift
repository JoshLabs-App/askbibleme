import SwiftUI
import UIKit

/// 连排段落：一段里的各节接排成一个文本块（RN 默认 verseParagraphFlow = true）。
///
/// 用 TextKit 自绘（NSLayoutManager 直接画进一个普通 UIView），不用 UITextView：
/// UITextView 是 UIScrollView 的子类，套在 SwiftUI ScrollView 里多一层滚动视图和一堆文本交互手势，
/// 而这里只需要「画出来 + 点到哪一节」。普通 UIView 没有任何手势，滚动全归外层，行为最简单。
/// （曾怀疑 UITextView 吞滚动，后来查明是模拟器滑动起点落在了播放坞上，并非 UITextView 的问题。）
/// 点击用 layoutManager.characterIndex(for:) 反查落在哪一节；跟读高亮只是给该节区间加 backgroundColor。
struct ChapterFlowParagraph: UIViewRepresentable {
    let verses: [LoadedVerse]
    let metrics: ReadTypographyMetrics
    let theme: Parchment
    let xrefVerses: Set<Int>
    let activeVerse: Int?
    /// 已收藏的节：正文铺 verseBookmarkMarker 底（圆角 2），并压过跟读高亮（RN：bookmarked 时不画 audioActive）
    var bookmarked: Set<Int> = []
    /// 搜索结果跳进来的那节：verseSearchFocusBg 整行框
    var searchFocus: Int? = nil
    /// 点节号（有串珠的才亮）→ 经文关联
    var onTapVerseNumber: (Int) -> Void = { _ in }
    /// 双击正文 → 收藏 / 取消收藏（RN 420ms 内两次点按）
    var onDoubleTapVerse: (Int) -> Void = { _ in }
    /// 长按正文 → 操作单（复制 / 收藏 / 分享）
    var onLongPressVerse: (Int) -> Void = { _ in }

    /// iOS 用 en space 作节号与正文的间隔（READ_VERSE_NUM_BODY_GAP）
    static let numberGap = "\u{2002}"

    final class FlowTextView: UIView {
        let storage = NSTextStorage()
        let layoutManager = NSLayoutManager()
        let container = NSTextContainer(size: .zero)
        var ranges: [(verse: Int, range: NSRange)] = []
        /// 节号那几个字符的区间（点它开串珠）
        var numberRanges: [(verse: Int, range: NSRange)] = []
        var onTapVerseNumber: (Int) -> Void = { _ in }
        var onDoubleTapVerse: (Int) -> Void = { _ in }
        var onLongPressVerse: (Int) -> Void = { _ in }
        /// 跟读中的那节的字符区间；高亮不走 backgroundColor 属性，而是照 RN `verseAudioFollowOverlay`
        /// 画一个圆角 8、横贯整行宽的框（Josh：读的时候的背景框要四角弧形）
        var activeRange: NSRange?
        var searchFocusRange: NSRange?
        /// 已收藏的节的正文区间（不含节号）
        var bookmarkRanges: [NSRange] = []
        static let activeFill = UIColor(red: 1, green: 0.694, blue: 0.012, alpha: 1)
        static let bookmarkFill = UIColor(Parchment.light.verseBookmarkMarker)
        static let searchFocusFill = UIColor(Parchment.light.verseSearchFocusBg)

        override init(frame: CGRect) {
            super.init(frame: frame)
            container.lineFragmentPadding = 0
            container.lineBreakMode = .byWordWrapping
            layoutManager.addTextContainer(container)
            storage.addLayoutManager(layoutManager)
            isOpaque = false
            backgroundColor = .clear
            contentMode = .redraw
            let double = UITapGestureRecognizer(target: self, action: #selector(doubleTapped(_:)))
            double.numberOfTapsRequired = 2
            let single = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
            single.require(toFail: double)
            let long = UILongPressGestureRecognizer(target: self, action: #selector(longPressed(_:)))
            long.minimumPressDuration = 0.45
            addGestureRecognizer(double)
            addGestureRecognizer(single)
            addGestureRecognizer(long)
        }

        private func verse(at p: CGPoint, in list: [(verse: Int, range: NSRange)]) -> Int? {
            let idx = layoutManager.characterIndex(for: p, in: container, fractionOfDistanceBetweenInsertionPoints: nil)
            return list.first { NSLocationInRange(idx, $0.range) }?.verse
        }

        /// 某段字符区间在版面上占的矩形（逐行），供收藏底色
        private func rects(for range: NSRange) -> [CGRect] {
            let glyphs = layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
            var out: [CGRect] = []
            layoutManager.enumerateEnclosingRects(forGlyphRange: glyphs, withinSelectedGlyphRange: NSRange(location: NSNotFound, length: 0), in: container) { r, _ in
                out.append(r)
            }
            return out
        }

        required init?(coder: NSCoder) { fatalError() }

        func setText(_ text: NSAttributedString) {
            storage.setAttributedString(text)
            setNeedsDisplay()
        }

        func height(for width: CGFloat) -> CGFloat {
            container.size = CGSize(width: width, height: .greatestFiniteMagnitude)
            layoutManager.ensureLayout(for: container)
            return ceil(layoutManager.usedRect(for: container).height)
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            container.size = CGSize(width: bounds.width, height: .greatestFiniteMagnitude)
            setNeedsDisplay()
        }

        override func draw(_ rect: CGRect) {
            container.size = CGSize(width: bounds.width, height: .greatestFiniteMagnitude)
            let range = layoutManager.glyphRange(for: container)
            // 圆角 8 整行框：跟读高亮 #FFB103 / 搜索定位 verseSearchFocusBg
            for (rangeOpt, fill) in [(activeRange, Self.activeFill), (searchFocusRange, Self.searchFocusFill)] {
                guard let r = rangeOpt, r.length > 0 else { continue }
                let glyphs = layoutManager.glyphRange(forCharacterRange: r, actualCharacterRange: nil)
                var box = layoutManager.boundingRect(forGlyphRange: glyphs, in: container)
                box.origin.x = 0
                box.size.width = bounds.width
                fill.setFill()
                UIBezierPath(roundedRect: box.integral, cornerRadius: 8).fill()
            }
            // 收藏：正文逐行铺 verseBookmarkMarker，圆角 6、上下各撑 1（RN verseTextHighlightStyle("bookmark") 圆角 2）
            Self.bookmarkFill.setFill()
            for r in bookmarkRanges {
                // RN 是圆角 2，真机上看还是方的；Josh 2026-09-09「四角要加弧边」→ 6
                for rect in rects(for: r) { UIBezierPath(roundedRect: rect.insetBy(dx: -2, dy: -1), cornerRadius: 6).fill() }
            }
            layoutManager.drawBackground(forGlyphRange: range, at: .zero)
            layoutManager.drawGlyphs(forGlyphRange: range, at: .zero)
        }

        @objc private func tapped(_ g: UITapGestureRecognizer) {
            if let v = verse(at: g.location(in: self), in: numberRanges) { onTapVerseNumber(v) }
        }

        @objc private func doubleTapped(_ g: UITapGestureRecognizer) {
            if let v = verse(at: g.location(in: self), in: ranges) { onDoubleTapVerse(v) }
        }

        @objc private func longPressed(_ g: UILongPressGestureRecognizer) {
            guard g.state == .began else { return }
            if let v = verse(at: g.location(in: self), in: ranges) { onLongPressVerse(v) }
        }
    }

    func makeUIView(context: Context) -> FlowTextView {
        let v = FlowTextView(frame: .zero)
        v.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return v
    }

    func updateUIView(_ v: FlowTextView, context: Context) {
        let built = build()
        v.setText(built.text)
        v.ranges = built.ranges
        v.numberRanges = built.numberRanges
        v.onTapVerseNumber = onTapVerseNumber
        v.onDoubleTapVerse = onDoubleTapVerse
        v.onLongPressVerse = onLongPressVerse
        // 已收藏的节不再画跟读高亮（RN audioActive = !bookmarked && …）
        v.activeRange = activeVerse.flatMap { a in bookmarked.contains(a) ? nil : built.ranges.first { $0.verse == a }?.range }
        v.searchFocusRange = searchFocus.flatMap { f in built.ranges.first { $0.verse == f }?.range }
        v.bookmarkRanges = built.textRanges.filter { bookmarked.contains($0.verse) }.map(\.range)
        v.setNeedsDisplay()
    }

    @available(iOS 16.0, *)
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: FlowTextView, context: Context) -> CGSize? {
        let width = proposal.width ?? UIScreen.main.bounds.width - 40
        return CGSize(width: width, height: uiView.height(for: width))
    }

    /// 对应 displayedParagraphVerseChunk：`${节号}${gap}${正文} `，节号加粗按有无串珠分色，正文按神言 / 人言着色
    private func build() -> (text: NSAttributedString, ranges: [(verse: Int, range: NSRange)], numberRanges: [(verse: Int, range: NSRange)], textRanges: [(verse: Int, range: NSRange)]) {
        let out = NSMutableAttributedString()
        var ranges: [(Int, NSRange)] = []
        var numberRanges: [(Int, NSRange)] = []
        var textRanges: [(Int, NSRange)] = []
        let para = NSMutableParagraphStyle()
        para.minimumLineHeight = metrics.verseLineHeight
        para.maximumLineHeight = metrics.verseLineHeight
        let bodyFont = UIFont.systemFont(ofSize: metrics.verseFontSize, weight: .medium)
        let numFont = UIFont.systemFont(ofSize: metrics.verseNumFontSize, weight: .bold)
        // 行高固定后小字号的节号会沉到基线下面，抬一点
        let numOffset = (metrics.verseFontSize - metrics.verseNumFontSize) * 0.35

        for v in verses {
            let start = out.length
            let numColor = UIColor(xrefVerses.contains(v.number) ? theme.verseNum : theme.verseNumMuted)
            out.append(NSAttributedString(string: "\(v.number)", attributes: [
                .font: numFont, .foregroundColor: numColor, .paragraphStyle: para, .baselineOffset: numOffset]))
            numberRanges.append((v.number, NSRange(location: start, length: out.length - start)))
            out.append(NSAttributedString(string: Self.numberGap, attributes: [.font: bodyFont, .paragraphStyle: para]))
            let textStart = out.length
            if let parts = v.speechParts {
                for p in parts {
                    let c: Color
                    switch p.kind { case .divine: c = theme.divineSpeech; case .human: c = theme.humanSpeech; case .plain: c = theme.inkSoft }
                    out.append(NSAttributedString(string: p.text, attributes: [.font: bodyFont, .foregroundColor: UIColor(c), .paragraphStyle: para]))
                }
            } else {
                out.append(NSAttributedString(string: v.text, attributes: [.font: bodyFont, .foregroundColor: UIColor(theme.inkSoft), .paragraphStyle: para]))
            }
            // 跟读高亮由 FlowTextView.draw 画圆角整行框，这里不再给字符区间加 backgroundColor
            textRanges.append((v.number, NSRange(location: textStart, length: out.length - textStart)))
            out.append(NSAttributedString(string: " ", attributes: [.font: bodyFont, .paragraphStyle: para]))
            ranges.append((v.number, NSRange(location: start, length: out.length - start)))
        }
        return (out, ranges, numberRanges, textRanges)
    }
}
