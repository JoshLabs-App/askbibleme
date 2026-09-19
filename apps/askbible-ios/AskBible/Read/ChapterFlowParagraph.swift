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
    /// 跟读高亮：当前节内的朗读进度（0…1），用来再插值定位到句
    var activeVerseProgress: Double = 0
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
        /// 跟读高亮：LOGO 黄。改成贴字铺之后不再是横贯整行的大色块，
        /// 按新色板的规矩叠透明度铺在羊皮底上；比划重点的灯油黄（.45）稍重一点，
        /// 让「机器读到这里」和「我自己划的」能分得开。
        static let activeFill = UIColor { t in
            UIColor(red: 1, green: 0.694, blue: 0.012, alpha: t.userInterfaceStyle == .dark ? 0.34 : 0.55)
        }
        static let bookmarkFill = UIColor { t in UIColor((t.userInterfaceStyle == .dark ? Parchment.dark : Parchment.light).verseBookmarkMarker) }
        static let searchFocusFill = UIColor { t in UIColor((t.userInterfaceStyle == .dark ? Parchment.dark : Parchment.light).verseSearchFocusBg) }

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
            // PaintGestureRecognizer: 在 touchesBegan 立刻进入 .began，强制 ScrollView pan gesture fail
            let pg = PaintGestureRecognizer(target: self, action: #selector(handlePaintGesture(_:)))
            pg.delegate = self
            pg.isEnabled = false
            addGestureRecognizer(pg)
            paintGesture = pg
        }

        /// 上一次 paintAt 的字符绝对下标；补齐快划跳过的字符
        private var prevPaintIdx: Int? = nil
        /// 划的过程只在本地记录，松手才提交给 SwiftUI——避免每字触发状态更新 + 写盘 + 全章重绘
        private var pendingPaints: [Int: (lo: Int, hi: Int)] = [:]
        /// 本地实时渲染：只更新 UIView，不走 SwiftUI 状态
        var liveHighlightRuns: [(range: NSRange, color: UIColor)] = []
        /// verse → 从 textStarts[verse].range.location 到正文第一个字的偏移（节号长度 + 间隔）
        var textOffsets: [Int: Int] = [:]

        // MARK: - 划重点手势识别器（立刻抢占 touch，阻止 ScrollView pan gesture 取消我们的触点）

        /// 在 touchesBegan 那一帧就进入 .began 态，UIKit 规则：任何还在 .possible 态的 recognizer（包括
        /// 父级 ScrollView 的 panGestureRecognizer）会被强制 fail，无法再调用 touchesCancelled。
        final class PaintGestureRecognizer: UIGestureRecognizer {
            override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
                super.touchesBegan(touches, with: event)
                state = .began
            }
            override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
                super.touchesMoved(touches, with: event)
                state = .changed
            }
            override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
                super.touchesEnded(touches, with: event)
                state = .ended
            }
            override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
                super.touchesCancelled(touches, with: event)
                state = .cancelled
            }
        }

        var paintGesture: PaintGestureRecognizer!

        /// 划重点期间：只让 paintGesture 运行，其余 recognizer 全部阻止
        override func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
            if paintColor != nil { return g === paintGesture }
            return super.gestureRecognizerShouldBegin(g)
        }

        /// 不允许 paintGesture 与任何其他 recognizer 同时识别，确保 pan gesture 被 fail 掉
        func gestureRecognizer(_ gr: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            return false
        }

        @objc private func handlePaintGesture(_ g: PaintGestureRecognizer) {
            let pt = g.location(in: self)
            switch g.state {
            case .began:
                painting = true
                prevPaintIdx = nil
                pendingPaints = [:]
                liveHighlightRuns = []
                paintAt(pt)
            case .changed:
                if painting { paintAt(pt) }
            case .ended:
                guard painting else { return }
                painting = false
                prevPaintIdx = nil
                for (verse, bounds) in pendingPaints { onPaint(verse, bounds.lo...bounds.hi) }
                pendingPaints = [:]
                // liveHighlightRuns 保持，等 updateUIView 在 highlightRuns 更新后再清除，
                // 避免 "SwiftUI 更新前黄色消失" 的闪烁；setNeedsDisplay 仍要调以确保当前帧可见
                setNeedsDisplay()
            default:
                if painting {
                    painting = false
                    prevPaintIdx = nil
                    pendingPaints = [:]
                    liveHighlightRuns = []
                    setNeedsDisplay()
                }
            }
        }

        /// 把触点换算成字符区间，只更新本地状态 + setNeedsDisplay，不调 onPaint。
        /// textStarts = textRanges（正文区间，不含节号），off = 0；
        /// 存入 pendingPaints 的下标以正文首字为 0（与 Web 存储格式一致）。
        private func paintAt(_ p: CGPoint) {
            let idx = layoutManager.characterIndex(for: p, in: container, fractionOfDistanceBetweenInsertionPoints: nil)
            let from = prevPaintIdx ?? idx
            prevPaintIdx = idx
            let lo = min(from, idx)
            let hi = max(from, idx)
            var dirty = false
            for (verse, range) in textStarts {
                let vLo = range.location
                let vHi = range.location + range.length - 1
                let iLo = max(lo, vLo)
                let iHi = min(hi, vHi)
                guard iLo <= iHi else { continue }
                let off = textOffsets[verse] ?? 0
                // 转成正文相对下标（节号+间隔算作 0，不会存成负数）
                let sLo = max(0, (iLo - range.location) - off)
                let sHi = max(0, (iHi - range.location) - off)
                if let ex = pendingPaints[verse] {
                    pendingPaints[verse] = (lo: min(ex.lo, sLo), hi: max(ex.hi, sHi))
                } else {
                    pendingPaints[verse] = (lo: sLo, hi: sHi)
                }
                dirty = true
            }
            if dirty {
                if let color = paintColor {
                    liveHighlightRuns = pendingPaints.compactMap { (verse, bounds) in
                        guard let r = textStarts.first(where: { $0.verse == verse })?.range else { return nil }
                        let off = textOffsets[verse] ?? 0
                        let visLo = bounds.lo == 0 ? r.location : r.location + off + bounds.lo
                        let visHi = r.location + off + bounds.hi
                        return (NSRange(location: visLo, length: max(1, visHi - visLo + 1)), color)
                    }
                }
                // 每次触点立刻提交，不等 .ended，确认 onPaint→storage 链路是否正常
                for (verse, bounds) in pendingPaints { onPaint(verse, bounds.lo...bounds.hi) }
                setNeedsDisplay()
            }
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

        /// 划重点模式：同时禁用父级 UIScrollView 的 isScrollEnabled 和 panGestureRecognizer，
        /// 防止 ScrollView 的 pan 手势抢占或取消我们的 paint pan（只禁 isScrollEnabled 不够）
        private var parentScrollEnabled: Bool = true
        func setParentScrollEnabled(_ enabled: Bool) {
            guard enabled != parentScrollEnabled else { return }
            parentScrollEnabled = enabled
            var view: UIView? = superview
            while let v = view {
                if let sv = v as? UIScrollView {
                    sv.isScrollEnabled = enabled
                    return
                }
                view = v.superview
            }
        }

        /// 进入/退出划重点模式时设 delaysContentTouches，让触点立即送达，不等 ScrollView 判断。
        /// isScrollEnabled 不在这里动——用户在没按下时仍可滚到目标位置，
        /// 按下时靠 cancelParentPanGesture 取消 pan，不依赖 isScrollEnabled 的竞态。
        func setPaintMode(_ paintMode: Bool) {
            var view: UIView? = superview
            while let v = view {
                if let sv = v as? UIScrollView {
                    sv.delaysContentTouches = !paintMode
                    return
                }
                view = v.superview
            }
        }

        /// 手指落下瞬间把父级 ScrollView 的 pan gesture 取消（disable→enable 清空状态）。
        /// pan 此时在 possible 态还没开始滚，cancel 后立刻恢复，不影响后续自由滚动。
        private func cancelParentPanGesture() {
            var view: UIView? = superview
            while let v = view {
                if let sv = v as? UIScrollView {
                    sv.panGestureRecognizer.isEnabled = false
                    sv.panGestureRecognizer.isEnabled = true
                    return
                }
                view = v.superview
            }
        }

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
            // 跟读高亮：贴着当前这一句的字铺（逐行取 rect），不再横贯整行 ——
            // 整行框在长节上看着就是「按行高亮」（Josh 2026-09-19）
            if let r = activeRange, r.length > 0 {
                Self.activeFill.setFill()
                for rect in rects(for: r) {
                    UIBezierPath(roundedRect: rect.insetBy(dx: -2, dy: -1), cornerRadius: 6).fill()
                }
            }
            // 搜索定位仍是圆角 8 整行框：要的是「跳到了这一节」的整节提示
            if let r = searchFocusRange, r.length > 0 {
                let glyphs = layoutManager.glyphRange(forCharacterRange: r, actualCharacterRange: nil)
                var box = layoutManager.boundingRect(forGlyphRange: glyphs, in: container)
                box.origin.x = 0
                box.size.width = bounds.width
                Self.searchFocusFill.setFill()
                UIBezierPath(roundedRect: box.integral, cornerRadius: 8).fill()
            }
            // 收藏：正文逐行铺 verseBookmarkMarker，圆角 6、上下各撑 1（RN verseTextHighlightStyle("bookmark") 圆角 2）
            Self.bookmarkFill.setFill()
            for r in bookmarkRanges {
                // RN 是圆角 2，真机上看还是方的；Josh 2026-09-09「四角要加弧边」→ 6
                for rect in rects(for: r) { UIBezierPath(roundedRect: rect.insetBy(dx: -2, dy: -1), cornerRadius: 6).fill() }
            }
            // 划重点：逐行铺用户选的颜色，压在正文底下
            for run in highlightRuns + liveHighlightRuns {
                // 颜色已由 VerseHighlightRules.fillColor 带好 alpha，这里不再二次压透明
                run.color.setFill()
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
        // 跟读高亮定位到「句」：时间轴只精确到节，节内按字数插值找当前句（VerseSentences）。
        // 整节铺底在长节上就是「按行高亮」，和耳朵对不上（Josh 2026-09-19）。
        v.activeRange = activeVerse.flatMap { a -> NSRange? in
            guard !bookmarked.contains(a) else { return nil }
            guard let body = built.textRanges.first(where: { $0.verse == a })?.range,
                  let text = verses.first(where: { $0.number == a })?.text,
                  let sentence = VerseSentences.sentence(at: activeVerseProgress, in: text)
            else { return built.ranges.first { $0.verse == a }?.range }
            // 句下标是「节正文」坐标，换算到整段文本坐标；越界就退回整节
            let loc = body.location + sentence.lowerBound
            let len = sentence.count
            guard loc >= body.location, loc + len <= body.location + body.length, len > 0 else {
                return built.ranges.first { $0.verse == a }?.range
            }
            return NSRange(location: loc, length: len)
        }
        v.searchFocusRange = searchFocus.flatMap { f in built.ranges.first { $0.verse == f }?.range }
        // 收藏高亮盖住整节（含节号与节末空格）：Josh 2026-09-11「标高亮时连节号也一起包含进去，
        // 不会在两句中断开」——原来只铺正文段，节号和两节之间会露白
        v.bookmarkRanges = built.ranges.filter { bookmarked.contains($0.verse) }.map(\.range)
        v.textStarts = built.textRanges
        v.textOffsets = [:]
        let inPaintMode = paintColor != nil || eraseMode
        v.paintColor = inPaintMode ? VerseHighlightRules.fillColor(paintColor ?? VerseHighlightRules.defaultColor) : nil
        v.onPaint = onPaint
        v.highlightRuns = Self.runs(highlights: highlights, textRanges: built.textRanges, fullRanges: built.ranges)
        // 划完之后 updateUIView 到来时，清掉实时预览（highlightRuns 已更新，不再需要 live 备份）
        if !v.painting { v.liveHighlightRuns = [] }
        v.setNeedsDisplay()
        // 进入划重点：启用 paintGesture（立刻抢占 touch 阻止 ScrollView pan），禁用滚动
        v.paintGesture.isEnabled = inPaintMode
        v.setParentScrollEnabled(!inPaintMode)
        v.setPaintMode(inPaintMode)
    }

    @available(iOS 16.0, *)
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: FlowTextView, context: Context) -> CGSize? {
        let width = proposal.width ?? UIScreen.main.bounds.width - 40
        return CGSize(width: width, height: uiView.height(for: width))
    }

    /// 把「节内字符下标 → 颜色」压成连续同色的区间，换算到整段文本坐标，少画几次。
    /// fullRanges：含节号+间隔的完整节范围；runStart==0 时视觉上从节号起画，保持连续感。
    static func runs(highlights: [Int: [Int: String]], textRanges: [(verse: Int, range: NSRange)], fullRanges: [(verse: Int, range: NSRange)] = []) -> [(range: NSRange, color: UIColor)] {
        var out: [(NSRange, UIColor)] = []
        for (verse, byIndex) in highlights {
            guard let base = textRanges.first(where: { $0.verse == verse })?.range, !byIndex.isEmpty else { continue }
            let fullStart = fullRanges.first(where: { $0.verse == verse })?.range.location ?? base.location
            let numOffset = base.location - fullStart  // 节号+间隔字符数
            let sorted = byIndex.keys.sorted()
            var runStart = sorted[0]
            var prev = sorted[0]
            var color = byIndex[sorted[0]] ?? VerseHighlightRules.defaultColor
            func flush(_ end: Int) {
                // runStart==0 时从节号起画（覆盖节号+间隔），保持高亮不留空头
                let loc = runStart == 0 ? fullStart : (base.location + runStart)
                let len = runStart == 0 ? (end - runStart + 1 + numOffset) : (end - runStart + 1)
                guard loc >= 0, len > 0, loc + len <= base.location + base.length else { return }
                out.append((NSRange(location: loc, length: len), VerseHighlightRules.fillColor(color)))
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
