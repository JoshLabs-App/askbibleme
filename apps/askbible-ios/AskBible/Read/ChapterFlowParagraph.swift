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
    /// 多节选择态：单击整节都算切换选中，不再只认节号（Josh 2026-09-11）
    var tapWholeVerse = false
    /// 划重点：节号 → （节内字符下标 → 颜色）
    var highlights: [Int: [Int: String]] = [:]
    /// 划重点模式下手指划过的颜色；nil = 不在该模式（擦除用 eraseMode）
    var paintColor: String?
    var eraseMode = false
    var onPaint: (Int, ClosedRange<Int>) -> Void = { _, _ in }
    var onTapVerseNumber: (Int) -> Void = { _ in }
    /// 双击正文 → 收藏 / 取消收藏（RN 420ms 内两次点按）
    var onDoubleTapVerse: (Int) -> Void = { _ in }
    /// 长按正文 → 操作单（复制 / 收藏 / 分享）
    var onLongPressVerse: (Int) -> Void = { _ in }

    /// iOS 用 en space 作节号与正文的间隔（READ_VERSE_NUM_BODY_GAP）
    static let numberGap = "\u{2002}"

    final class FlowTextView: UIView, UIGestureRecognizerDelegate {
        let storage = NSTextStorage()
        let layoutManager = NSLayoutManager()
        let container = NSTextContainer(size: .zero)
        var ranges: [(verse: Int, range: NSRange)] = []
        /// 节号那几个字符的区间（点它开串珠）
        var numberRanges: [(verse: Int, range: NSRange)] = []
        /// 单击命中的区间：平时是节号，选择态是整节
        var tapRanges: [(verse: Int, range: NSRange)] = []
        var onTapVerseNumber: (Int) -> Void = { _ in }
        var onDoubleTapVerse: (Int) -> Void = { _ in }
        var onLongPressVerse: (Int) -> Void = { _ in }
        /// 跟读中的那节的字符区间；高亮不走 backgroundColor 属性，而是照 RN `verseAudioFollowOverlay`
        /// 画一个圆角 8、横贯整行宽的框（Josh：读的时候的背景框要四角弧形）
        var activeRange: NSRange?
        var searchFocusRange: NSRange?
        /// 已收藏的节的正文区间（不含节号）
        var bookmarkRanges: [NSRange] = []
        /// 划重点：每段连续同色字符的区间（正文坐标已换算成整段文本坐标）
        var highlightRuns: [(range: NSRange, color: UIColor)] = []
        /// 划重点模式：手指划过即上色；nil = 不在该模式
        var paintColor: UIColor?
        var painting = false
        /// (节号, 该节正文在整段文本里的起点) —— 拖动时把字符下标换算回「节内下标」
        var textStarts: [(verse: Int, range: NSRange)] = []
        /// 划过一段：节号 + 节内字符区间
        var onPaint: (Int, ClosedRange<Int>) -> Void = { _, _ in }
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
            // 划重点：手指划过要标的字（Josh 2026-09-11「直接用手划动，划过的就高亮」）
            let pan = UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
            pan.maximumNumberOfTouches = 1
            pan.delegate = self
            addGestureRecognizer(pan)
            paintPan = pan
        }

        private weak var paintPan: UIPanGestureRecognizer?

        /// 划重点模式下才吃掉滚动；平时让 ScrollView 正常滚
        override func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
            if g === paintPan { return paintColor != nil || painting }
            return super.gestureRecognizerShouldBegin(g)
        }

        @objc private func panned(_ g: UIPanGestureRecognizer) {
            guard paintColor != nil || painting else { return }
            switch g.state {
            case .began, .changed:
                painting = true
                paintAt(g.location(in: self))
            default:
                painting = false
            }
        }

        /// 把触点换算成「哪一节的第几个字」，通知上层上色
        private func paintAt(_ p: CGPoint) {
            let idx = layoutManager.characterIndex(for: p, in: container, fractionOfDistanceBetweenInsertionPoints: nil)
            guard let hit = textStarts.first(where: { NSLocationInRange(idx, $0.range) }) else { return }
            let local = idx - hit.range.location
            guard local >= 0, local < hit.range.length else { return }
            onPaint(hit.verse, local...local)
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
            // 划重点：逐行铺用户选的颜色，压在正文底下
            for run in highlightRuns {
                run.color.withAlphaComponent(0.45).setFill()
                for rect in rects(for: run.range) {
                    UIBezierPath(roundedRect: rect.insetBy(dx: 0, dy: -1), cornerRadius: 3).fill()
                }
            }
            layoutManager.drawBackground(forGlyphRange: range, at: .zero)
            layoutManager.drawGlyphs(forGlyphRange: range, at: .zero)
        }

        @objc private func tapped(_ g: UITapGestureRecognizer) {
            if let v = verse(at: g.location(in: self), in: tapRanges.isEmpty ? numberRanges : tapRanges) { onTapVerseNumber(v) }
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
        v.tapRanges = tapWholeVerse ? built.ranges : built.numberRanges
        v.onDoubleTapVerse = onDoubleTapVerse
        v.onLongPressVerse = onLongPressVerse
        // 已收藏的节不再画跟读高亮（RN audioActive = !bookmarked && …）
        v.activeRange = activeVerse.flatMap { a in bookmarked.contains(a) ? nil : built.ranges.first { $0.verse == a }?.range }
        v.searchFocusRange = searchFocus.flatMap { f in built.ranges.first { $0.verse == f }?.range }
        // 收藏高亮盖住整节（含节号与节末空格）：Josh 2026-09-11「标高亮时连节号也一起包含进去，
        // 不会在两句中断开」——原来只铺正文段，节号和两节之间会露白
        v.bookmarkRanges = built.ranges.filter { bookmarked.contains($0.verse) }.map(\.range)
        v.textStarts = built.textRanges
        v.paintColor = (paintColor != nil || eraseMode) ? UIColor(Color(hex: paintColor ?? VerseHighlightRules.defaultColor)) : nil
        v.onPaint = onPaint
        v.highlightRuns = Self.runs(highlights: highlights, textRanges: built.textRanges)
        v.setNeedsDisplay()
    }

    @available(iOS 16.0, *)
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: FlowTextView, context: Context) -> CGSize? {
        let width = proposal.width ?? UIScreen.main.bounds.width - 40
        return CGSize(width: width, height: uiView.height(for: width))
    }

    /// 把「节内字符下标 → 颜色」压成连续同色的区间，换算到整段文本坐标，少画几次
    static func runs(highlights: [Int: [Int: String]], textRanges: [(verse: Int, range: NSRange)]) -> [(range: NSRange, color: UIColor)] {
        var out: [(NSRange, UIColor)] = []
        for (verse, byIndex) in highlights {
            guard let base = textRanges.first(where: { $0.verse == verse })?.range, !byIndex.isEmpty else { continue }
            let sorted = byIndex.keys.sorted()
            var runStart = sorted[0]
            var prev = sorted[0]
            var color = byIndex[sorted[0]] ?? VerseHighlightRules.defaultColor
            func flush(_ end: Int) {
                let loc = base.location + runStart
                let len = end - runStart + 1
                guard loc >= base.location, loc + len <= base.location + base.length else { return }
                out.append((NSRange(location: loc, length: len), UIColor(Color(hex: color))))
            }
            for i in sorted.dropFirst() {
                let c = byIndex[i] ?? VerseHighlightRules.defaultColor
                if i == prev + 1, c == color { prev = i; continue }
                flush(prev)
                runStart = i; prev = i; color = c
            }
            flush(prev)
        }
        return out
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
