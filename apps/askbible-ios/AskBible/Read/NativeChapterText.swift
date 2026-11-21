import SwiftUI
import UIKit
import os

/// 整章原生可选文档（1 步即选即染浮条 + 双语琥珀竖线夹注 + 无叠乘精准字号）。
struct NativeChapterText: UIViewRepresentable {
    /// 阅读器内字号完全由 Aa 7 档控制，不再叠乘全局 appTextSize 造成字号暴涨
    private var textScale: CGFloat { 1.0 }

    let identity: String
    let groups: [[LoadedVerse]]
    let meta: ChapterSegmentMeta
    let contrast: [Int: String]
    let metrics: ReadTypographyMetrics
    let theme: Parchment
    let locale: AppLocale
    let bookName: String
    let chapter: Int
    let xrefs: Set<Int>
    let bookmarked: Set<Int>
    let highlights: [Int: [Int: String]]
    let activeVerse: Int?
    let activeProgress: Double
    let focusVerse: Int?
    let focusKeyword: String?
    let scrollToTopToken: Int
    let header: AnyView
    let footer: AnyView
    var onTapNumber: (Int) -> Void
    var onBookmark: ([Int]) -> Void
    var onHighlight: (Int) -> Void
    /// 1 步即选即染回调：(节号, 节内字符范围, 颜料 hex 或 nil 表示擦除)
    var onInstantPaint: (Int, ClosedRange<Int>, String?) -> Void = { _, _, _ in }
    /// 打开羊皮卷金句书签图面板：(出处如「约翰福音 3:16」, 选中正文)
    var onOpenShareCard: (String, String) -> Void = { _, _ in }
    var onCopiedToast: () -> Void = {}
    var onReadVerses: ([Int]) -> Void
    var onReachedEnd: () -> Void

    func makeUIView(context: Context) -> ChapterTextView {
        ChapterTextView()
    }

    static func dismantleUIView(_ uiView: ChapterTextView, coordinator: ()) {
        uiView.stopSelection()
    }

    func updateUIView(_ view: ChapterTextView, context: Context) {
        let changedChapter = view.chapterIdentity != identity
        view.configuration = self
        view.header.rootView = AnyView(header.environment(\.parchment, theme))
        view.footer.rootView = AnyView(footer.environment(\.parchment, theme))
        let built = buildDocument()
        let selected = view.selectedRange
        let offset = view.contentOffset

        if view.attributedText != built.text {
            view.textStorage.beginEditing()
            if view.text != built.text.string {
                view.textStorage.setAttributedString(built.text)
            } else {
                view.textStorage.setAttributes([:], range: NSRange(location: 0, length: view.textStorage.length))
                built.text.enumerateAttributes(in: NSRange(location: 0, length: built.text.length)) { attrs, range, _ in
                    view.textStorage.setAttributes(attrs, range: range)
                }
            }
            view.textStorage.endEditing()
            if !changedChapter, NSMaxRange(selected) <= built.text.length {
                view.selectedRange = selected
                view.setContentOffset(offset, animated: false)
            }
        }
        view.verseRanges = built.ranges
        view.numberRanges = built.numbers
        view.textRanges = built.textRanges
        view.contrastRanges = built.contrastRanges
        view.tintColor = UIColor(theme.accentOt)
        view.setNeedsLayout()

        if changedChapter {
            view.chapterIdentity = identity
            view.selectedRange = NSRange(location: 0, length: 0)
            view.resignFirstResponder()
            view.hidePopover()
            view.lastFocus = nil
            view.lastActive = nil
            view.lastVisibleVerses = []
            view.pendingVerse = nil
            view.scrollTopPending = true
        }
        if view.topToken != scrollToTopToken {
            view.topToken = scrollToTopToken
            view.scrollTopPending = true
        }
        if let focusVerse, view.lastFocus != focusVerse {
            view.lastFocus = focusVerse
            view.pendingVerse = focusVerse
        }
        if let activeVerse, view.lastActive != activeVerse {
            view.lastActive = activeVerse
            if view.selectedRange.length == 0 { view.pendingVerse = activeVerse }
        }
        view.refreshPopoverContent()
    }

    private func buildDocument() -> (
        text: NSAttributedString,
        ranges: [(Int, NSRange)],
        numbers: [(Int, NSRange)],
        textRanges: [(Int, NSRange)],
        contrastRanges: [NSRange]
    ) {
        let out = NSMutableAttributedString(string: "")
        var ranges: [(Int, NSRange)] = []
        var numbers: [(Int, NSRange)] = []
        var textRanges: [(Int, NSRange)] = []
        var contrastRanges: [NSRange] = []

        for group in groups {
            let headings = group.first.flatMap { meta.headings[$0.number] } ?? []
            for heading in headings {
                let style = NSMutableParagraphStyle()
                style.alignment = .center
                style.paragraphSpacingBefore = 18
                style.paragraphSpacing = 16
                out.append(NSAttributedString(string: locale.zh(heading) + "\n", attributes: [
                    .font: UIFont.systemFont(ofSize: (metrics.verseFontSize + 1) * textScale, weight: .semibold),
                    .foregroundColor: UIColor(Color(parchment: 0x70451F)),
                    .paragraphStyle: style
                ]))
            }
            let hasContrast = group.contains { contrast[$0.number] != nil }
            let units: [[LoadedVerse]] = hasContrast ? group.map { [$0] } : [group]
            for (unitIdx, unit) in units.enumerated() {
                let built = ChapterFlowParagraph(verses: unit, metrics: metrics, theme: theme, xrefVerses: xrefs, activeVerse: nil).build(scale: textScale)
                let text = NSMutableAttributedString(attributedString: built.text)
                for (number, range) in built.ranges where bookmarked.contains(number) {
                    text.addAttribute(.backgroundColor, value: UIColor(theme.verseBookmarkMarker).withAlphaComponent(0.32), range: range)
                }
                for run in ChapterFlowParagraph.runs(highlights: highlights, textRanges: built.textRanges, fullRanges: built.ranges) {
                    text.addAttribute(.backgroundColor, value: run.color, range: run.range)
                }
                if let activeVerse, !bookmarked.contains(activeVerse),
                   let verse = unit.first(where: { $0.number == activeVerse }),
                   let body = built.textRanges.first(where: { $0.verse == activeVerse })?.range,
                   let sentence = VerseSentences.sentence(at: activeProgress, in: verse.text),
                   sentence.upperBound < body.length {
                    text.addAttribute(.backgroundColor, value: ChapterFlowParagraph.FlowTextView.activeFill,
                                      range: NSRange(location: body.location + sentence.lowerBound, length: sentence.count))
                }
                if let focusVerse {
                    let matches = ChapterFlowParagraph.keywordRanges(verse: focusVerse, keyword: focusKeyword, verses: unit, textRanges: built.textRanges)
                    let marks = matches.isEmpty ? built.ranges.filter { $0.verse == focusVerse }.map(\.range) : matches
                    for range in marks { text.addAttribute(.backgroundColor, value: UIColor(theme.verseSearchFocusBg), range: range) }
                }
                let start = out.length
                ranges += built.ranges.map { ($0.verse, NSRange(location: start + $0.range.location, length: $0.range.length)) }
                numbers += built.numberRanges.map { ($0.verse, NSRange(location: start + $0.range.location, length: $0.range.length)) }
                textRanges += built.textRanges.map { ($0.verse, NSRange(location: start + $0.range.location, length: $0.range.length)) }
                out.append(text)

                let isLastUnit = unitIdx == units.count - 1
                let secondary = hasContrast ? unit.first.flatMap { contrast[$0.number] } : nil
                if let secondary {
                    let mainBreak = NSMutableParagraphStyle()
                    mainBreak.paragraphSpacing = 6
                    out.append(NSAttributedString(string: "\n", attributes: [
                        .font: UIFont.systemFont(ofSize: metrics.verseFontSize * textScale),
                        .paragraphStyle: mainBreak
                    ]))
                    // 古典双语琥珀夹注：不重复印节号，左侧微缩进 14pt 并配 2pt 暖琥珀竖线
                    let secFontSize = max(13.5, metrics.verseFontSize * 0.84 * textScale)
                    let secLineHeight = max(metrics.verseLineHeight * 0.80 * textScale, secFontSize * 1.42)
                    let secStyle = NSMutableParagraphStyle()
                    secStyle.firstLineHeadIndent = 14
                    secStyle.headIndent = 14
                    secStyle.minimumLineHeight = secLineHeight
                    secStyle.maximumLineHeight = secLineHeight
                    secStyle.paragraphSpacing = isLastUnit ? 18 : 12
                    let cStart = out.length
                    out.append(NSAttributedString(string: "\(secondary)\n", attributes: [
                        .font: UIFont.systemFont(ofSize: secFontSize),
                        .foregroundColor: UIColor(theme.muted),
                        .paragraphStyle: secStyle
                    ]))
                    contrastRanges.append(NSRange(location: cStart, length: max(0, out.length - cStart - 1)))
                } else {
                    let spacing: CGFloat = isLastUnit ? 16 : 10
                    out.append(NSAttributedString(string: "\n", attributes: [
                        .font: UIFont.systemFont(ofSize: metrics.verseFontSize * textScale),
                        .paragraphStyle: { let p = NSMutableParagraphStyle(); p.paragraphSpacing = spacing; return p }()
                    ]))
                }
            }
        }
        return (out, ranges, numbers, textRanges, contrastRanges)
    }

    final class ChapterTextView: UITextView, UITextViewDelegate, UIGestureRecognizerDelegate {
        var configuration: NativeChapterText!
        var verseRanges: [(Int, NSRange)] = []
        var numberRanges: [(Int, NSRange)] = []
        var textRanges: [(Int, NSRange)] = []
        var contrastRanges: [NSRange] = []
        var chapterIdentity = ""
        var topToken = 0
        var lastFocus: Int?
        var lastActive: Int?
        var pendingVerse: Int?
        var scrollTopPending = false
        let header = UIHostingController(rootView: AnyView(EmptyView()))
        let footer = UIHostingController(rootView: AnyView(EmptyView()))
        let popover = UIHostingController(rootView: AnyView(EmptyView()))
        var lastVisibleVerses: [Int] = []
        private var initialLong: UILongPressGestureRecognizer!
        private var pendingMenu: DispatchWorkItem?
        private let selectionFill = CAShapeLayer()
        private let contrastBarLayer = CAShapeLayer()

        init() {
            super.init(frame: .zero, textContainer: nil)
            isEditable = false
            isSelectable = true
            backgroundColor = .clear
            layer.insertSublayer(contrastBarLayer, at: 0)
            layer.insertSublayer(selectionFill, at: 1)
            textContainer.lineFragmentPadding = 0
            showsVerticalScrollIndicator = false
            alwaysBounceVertical = true
            delegate = self
            accessibilityIdentifier = "read.chapter.text"

            header.view.backgroundColor = .clear
            footer.view.backgroundColor = .clear
            popover.view.backgroundColor = .clear
            popover.view.isHidden = true
            addSubview(header.view)
            addSubview(footer.view)
            addSubview(popover.view)

            initialLong = UILongPressGestureRecognizer(target: self, action: #selector(beginSelection(_:)))
            initialLong.minimumPressDuration = 0.42
            initialLong.delegate = self
            addGestureRecognizer(initialLong)

            let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
            tap.delegate = self
            tap.cancelsTouchesInView = false
            addGestureRecognizer(tap)

            for gesture in gestureRecognizers ?? [] where gesture !== initialLong && gesture is UILongPressGestureRecognizer {
                gesture.require(toFail: initialLong)
            }
        }
        required init?(coder: NSCoder) { fatalError() }

        override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
            // 由我们定制的深沉香木 1 步即选即染胶囊接管，不再叠加系统白色气泡菜单遮挡
            false
        }

        override func buildMenu(with builder: any UIMenuBuilder) {
            builder.remove(menu: .lookup)
            builder.remove(menu: .share)
            builder.remove(menu: .standardEdit)
        }

        override func layoutSubviews() {
            let width = max(0, bounds.width - 40)
            guard width > 0 else { super.layoutSubviews(); return }
            let top = header.sizeThatFits(in: CGSize(width: width, height: .greatestFiniteMagnitude)).height
            let bottom = footer.sizeThatFits(in: CGSize(width: width, height: .greatestFiniteMagnitude)).height
            let inset = UIEdgeInsets(top: top, left: 20, bottom: bottom + 24, right: 20)
            if textContainerInset != inset { textContainerInset = inset }
            super.layoutSubviews()
            header.view.frame = CGRect(x: 20, y: 0, width: width, height: top)
            layoutManager.ensureLayout(for: textContainer)
            let textHeight = layoutManager.usedRect(for: textContainer).height
            footer.view.frame = CGRect(x: 20, y: top + textHeight, width: width, height: bottom)
            if scrollTopPending {
                scrollTopPending = false
                setContentOffset(CGPoint(x: 0, y: -adjustedContentInset.top), animated: false)
            }
            if let verse = pendingVerse, let range = verseRanges.first(where: { $0.0 == verse })?.1 {
                pendingVerse = nil
                scrollRangeToVisible(range)
            }
            updateContrastBars()
            updateSelectionFill()
            positionPopoverIfVisible()
            reportVisibleVerses()
        }

        /// 为每一段双语对照绘制左侧 2pt 暖琥珀夹注细竖线
        private func updateContrastBars() {
            contrastBarLayer.frame = CGRect(origin: .zero, size: contentSize)
            guard configuration != nil, !contrastRanges.isEmpty else {
                contrastBarLayer.path = nil
                return
            }
            let path = UIBezierPath()
            for r in contrastRanges where r.length > 0 && NSMaxRange(r) <= textStorage.length {
                let glyphs = layoutManager.glyphRange(forCharacterRange: r, actualCharacterRange: nil)
                let rect = layoutManager.boundingRect(forGlyphRange: glyphs, in: textContainer)
                guard rect.height > 2 else { continue }
                let barRect = CGRect(
                    x: textContainerInset.left + 2,
                    y: textContainerInset.top + rect.minY + 3,
                    width: 2.2,
                    height: max(8, rect.height - 6)
                )
                path.append(UIBezierPath(roundedRect: barRect, cornerRadius: 1.1))
            }
            contrastBarLayer.fillColor = UIColor(configuration.theme.accentOt).withAlphaComponent(0.45).cgColor
            contrastBarLayer.path = path.cgPath
        }

        private func updateSelectionFill() {
            selectionFill.frame = CGRect(origin: .zero, size: contentSize)
            guard selectedRange.length > 0, let selectedTextRange else { selectionFill.path = nil; return }
            let path = UIBezierPath()
            for selection in selectionRects(for: selectedTextRange) where !selection.rect.isEmpty {
                path.append(UIBezierPath(roundedRect: selection.rect.insetBy(dx: -1, dy: 0), cornerRadius: 4))
            }
            selectionFill.fillColor = tintColor.withAlphaComponent(0.18).cgColor
            selectionFill.path = path.cgPath
        }

        private func reportVisibleVerses() {
            guard configuration != nil, !verseRanges.isEmpty else { return }
            let visible = CGRect(x: 0, y: contentOffset.y - textContainerInset.top,
                                 width: bounds.width, height: bounds.height)
            let glyphs = layoutManager.glyphRange(forBoundingRect: visible, in: textContainer)
            let characters = layoutManager.characterRange(forGlyphRange: glyphs, actualGlyphRange: nil)
            let numbers = verseRanges.filter { NSIntersectionRange($0.1, characters).length > 0 }.map { $0.0 }
            guard numbers != lastVisibleVerses else { return }
            lastVisibleVerses = numbers
            let callback = configuration.onReadVerses
            DispatchQueue.main.async { callback(numbers) }
        }

        override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            if gestureRecognizer === initialLong {
                let point = gestureRecognizer.location(in: self)
                if !popover.view.isHidden, popover.view.frame.insetBy(dx: -8, dy: -8).contains(point) { return false }
                guard verse(at: point) != nil else { return false }
                guard selectedRange.length > 0, let selectedTextRange else { return true }
                let start = caretRect(for: selectedTextRange.start).insetBy(dx: -24, dy: -24)
                let end = caretRect(for: selectedTextRange.end).insetBy(dx: -24, dy: -24)
                guard !start.contains(point), !end.contains(point), let index = character(at: point) else { return false }
                return !NSLocationInRange(index, selectedRange)
            }
            return true
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            gestureRecognizer !== initialLong && otherGestureRecognizer !== initialLong
        }

        private func character(at point: CGPoint) -> Int? {
            let p = CGPoint(x: point.x - textContainerInset.left, y: point.y - textContainerInset.top)
            guard layoutManager.usedRect(for: textContainer).contains(p) else { return nil }
            return layoutManager.characterIndex(for: p, in: textContainer, fractionOfDistanceBetweenInsertionPoints: nil)
        }

        private func verse(at point: CGPoint) -> (Int, NSRange)? {
            guard let index = character(at: point) else { return nil }
            return verseRanges.first { NSLocationInRange(index, $0.1) }
        }

        @objc private func beginSelection(_ gesture: UILongPressGestureRecognizer) {
            guard gesture.state == .began, let (_, range) = verse(at: gesture.location(in: self)) else { return }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            becomeFirstResponder()
            selectedRange = range
            showPopoverNow()
        }

        @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
            let pt = gesture.location(in: self)
            // 点在浮动染色胶囊内部：交给 SwiftUI 按钮自己响应
            if !popover.view.isHidden, popover.view.frame.insetBy(dx: -6, dy: -6).contains(pt) {
                return
            }
            // 已有选区时轻点正文空白或其他地方：收起选区与胶囊
            if selectedRange.length > 0 {
                clearSelection()
                return
            }
            guard let index = character(at: pt) else { return }
            // 点在带串珠的节号上 → 开经文关联弹层
            if let number = numberRanges.first(where: { NSLocationInRange(index, $0.1) })?.0,
               configuration.xrefs.contains(number) {
                configuration.onTapNumber(number)
                return
            }
            // 轻点单节经文正文 → 直接选中该节并浮出 1 步染色胶囊（媲美 Apple Books 丝滑点选）
            if let (_, vRange) = verseRanges.first(where: { NSLocationInRange(index, $0.1) }) {
                UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                becomeFirstResponder()
                selectedRange = vRange
                showPopoverNow()
            }
        }

        func clearSelection() {
            pendingMenu?.cancel()
            selectedRange = NSRange(location: 0, length: 0)
            resignFirstResponder()
            hidePopover()
            updateSelectionFill()
        }

        func hidePopover() {
            popover.view.isHidden = true
        }

        func stopSelection() {
            pendingMenu?.cancel()
            hidePopover()
            resignFirstResponder()
        }

        private func schedulePopover() {
            pendingMenu?.cancel()
            guard selectedRange.length > 0 else {
                hidePopover()
                return
            }
            let work = DispatchWorkItem { [weak self] in
                guard let self, self.selectedRange.length > 0 else { return }
                if self.hasActiveGesture(self) || self.isDragging || self.isDecelerating {
                    self.schedulePopover()
                } else {
                    self.showPopoverNow()
                }
            }
            pendingMenu = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.18, execute: work)
        }

        private func hasActiveGesture(_ view: UIView) -> Bool {
            (view.gestureRecognizers ?? []).contains { $0.state == .began || $0.state == .changed }
                || view.subviews.contains { hasActiveGesture($0) }
        }

        func refreshPopoverContent() {
            guard configuration != nil, selectedRange.length > 0 else {
                hidePopover()
                return
            }
            let c = configuration!
            let activeColor = dominantSelectedColor()
            let nums = selectedNumbers
            let isBookmarked = !nums.isEmpty && nums.allSatisfy { c.bookmarked.contains($0) }

            popover.rootView = AnyView(
                SelectionHighlightPopover(
                    locale: c.locale,
                    activeColor: activeColor,
                    isBookmarked: isBookmarked,
                    onPickColor: { [weak self] hex in
                        self?.applyInstantHighlight(hex)
                    },
                    onCopy: { [weak self] in
                        guard let self else { return }
                        self.copy(nil)
                        c.onCopiedToast()
                        self.clearSelection()
                    },
                    onBookmark: { [weak self] in
                        guard let self, !nums.isEmpty else { return }
                        c.onBookmark(nums)
                        self.clearSelection()
                    },
                    onShareCard: { [weak self] in
                        guard let self, let snap = self.selectedSnapshot else { return }
                        self.clearSelection()
                        c.onOpenShareCard(snap.ref, snap.body)
                    }
                )
            )
        }

        private func showPopoverNow() {
            guard window != nil, selectedRange.length > 0 else { hidePopover(); return }
            refreshPopoverContent()
            popover.view.isHidden = false
            bringSubviewToFront(popover.view)
            positionPopoverIfVisible()
        }

        private func positionPopoverIfVisible() {
            guard !popover.view.isHidden, selectedRange.length > 0, let selectedTextRange else { return }
            let rects = selectionRects(for: selectedTextRange).map(\.rect).filter { !$0.isEmpty }
            let anchor = rects.first ?? caretRect(for: selectedTextRange.start)
            let maxW = max(240, bounds.width - 24)
            let size = popover.sizeThatFits(in: CGSize(width: maxW, height: 120))
            let popW = min(maxW, max(252, size.width))
            let popH = max(72, size.height)

            let minVisibleY = contentOffset.y + adjustedContentInset.top + 54
            let x = min(max(12, anchor.midX - popW / 2), bounds.width - popW - 12)
            var y = anchor.minY - popH - 10
            if y < minVisibleY {
                let bottomAnchor = rects.last ?? anchor
                y = bottomAnchor.maxY + 12
            }
            popover.view.frame = CGRect(x: x, y: y, width: popW, height: popH)
        }

        /// 判断当前选中区域是否整段已经是同一种高亮色（若是则再点该色即擦除）
        private func dominantSelectedColor() -> String? {
            guard configuration != nil, selectedRange.length > 0 else { return nil }
            var found: String?
            var count = 0
            for (verse, bodyRange) in textRanges {
                let inter = self.bodyIntersection(verse: verse, bodyRange: bodyRange)
                guard let inter else { continue }
                let byIdx = configuration.highlights[verse] ?? [:]
                for i in inter {
                    guard let col = byIdx[i] else { return nil }
                    let norm = VerseHighlightRules.normalizeColor(col)
                    if let f = found, f != norm { return nil }
                    found = norm
                    count += 1
                }
            }
            return count > 0 ? found : nil
        }

        private func bodyIntersection(verse: Int, bodyRange: NSRange) -> ClosedRange<Int>? {
            let inter = NSIntersectionRange(selectedRange, bodyRange)
            if inter.length > 0 {
                let s = max(0, inter.location - bodyRange.location)
                let e = min(max(0, bodyRange.length - 1), s + inter.length - 1)
                return s <= e ? (s...e) : nil
            }
            if let full = verseRanges.first(where: { $0.0 == verse })?.1,
               NSIntersectionRange(selectedRange, full).length > 0,
               bodyRange.length > 0 {
                return 0...(bodyRange.length - 1)
            }
            return nil
        }

        private func applyInstantHighlight(_ pickedHex: String) {
            guard let c = configuration else { return }
            let norm = VerseHighlightRules.normalizeColor(pickedHex)
            let nextColor: String? = (dominantSelectedColor() == norm) ? nil : norm
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            for (verse, bodyRange) in textRanges {
                if let localRange = bodyIntersection(verse: verse, bodyRange: bodyRange) {
                    c.onInstantPaint(verse, localRange, nextColor)
                }
            }
            clearSelection()
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            updateSelectionFill()
            schedulePopover()
        }

        private var selectedNumbers: [Int] {
            verseRanges.filter { NSIntersectionRange($0.1, selectedRange).length > 0 }.map { $0.0 }
        }

        private var selectedSnapshot: (ref: String, body: String)? {
            let source = text as NSString
            guard selectedRange.length > 0, NSMaxRange(selectedRange) <= source.length,
                  let first = selectedNumbers.first, let last = selectedNumbers.last else { return nil }
            let reference = first == last ? "\(first)" : "\(first)–\(last)"
            let body = textRanges.compactMap { entry -> String? in
                let overlap = NSIntersectionRange(entry.1, selectedRange)
                if overlap.length > 0 {
                    return source.substring(with: overlap).trimmingCharacters(in: .whitespacesAndNewlines)
                }
                if let full = verseRanges.first(where: { $0.0 == entry.0 })?.1,
                   NSIntersectionRange(selectedRange, full).length > 0,
                   NSMaxRange(entry.1) <= source.length {
                    return source.substring(with: entry.1).trimmingCharacters(in: .whitespacesAndNewlines)
                }
                return nil
            }.filter { !$0.isEmpty }.joined(separator: "\n")
            guard !body.isEmpty else { return nil }
            return ("\(configuration.bookName) \(configuration.chapter):\(reference)", body)
        }

        override func copy(_ sender: Any?) {
            guard let snap = selectedSnapshot else { return }
            UIPasteboard.general.string = "\(snap.ref) \(snap.body)"
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            guard configuration != nil, !verseRanges.isEmpty else { return }
            if selectedRange.length > 0 {
                positionPopoverIfVisible()
            }
            reportVisibleVerses()
            if footer.view.frame.minY > 0, contentOffset.y + bounds.height - adjustedContentInset.bottom >= footer.view.frame.minY {
                let callback = configuration.onReachedEnd
                DispatchQueue.main.async { callback() }
            }
        }
    }
}

/// 1 步即选即染深沉香木浮动胶囊（四色颜料圆点 + 复制 · 收藏 · 书签图）
private struct SelectionHighlightPopover: View {
    let locale: AppLocale
    let activeColor: String?
    let isBookmarked: Bool
    var onPickColor: (String) -> Void
    var onCopy: () -> Void
    var onBookmark: () -> Void
    var onShareCard: () -> Void

    var body: some View {
        VStack(spacing: 9) {
            HStack(spacing: 16) {
                ForEach(VerseHighlightRules.palette, id: \.self) { hex in
                    let isCurrent = activeColor == hex
                    Button { onPickColor(hex) } label: {
                        ZStack {
                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 28, height: 28)
                                .overlay(
                                    Circle().strokeBorder(.white.opacity(isCurrent ? 0.95 : 0.22), lineWidth: isCurrent ? 2 : 0.75)
                                )
                            if isCurrent {
                                Image(systemName: "xmark")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Color(rgb: 0x1C1410))
                            }
                        }
                        .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 14) {
                actionText(AppLocale.pick("复制", "Copy", locale), action: onCopy)
                dot
                actionText(
                    isBookmarked
                    ? AppLocale.pick("取消收藏", "Saved", locale)
                    : AppLocale.pick("收藏", "Save", locale),
                    highlight: isBookmarked,
                    action: onBookmark
                )
                dot
                actionText(AppLocale.pick("书签图", "Card", locale), highlight: true, action: onShareCard)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(rgb: 0x241A13, opacity: 0.96))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.14), lineWidth: 0.75)
                )
        )
        .shadow(color: .black.opacity(0.28), radius: 12, y: 5)
    }

    private var dot: some View {
        Text("·")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(.white.opacity(0.35))
    }

    private func actionText(_ title: String, highlight: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(highlight ? Color(rgb: 0xFFB103) : Color(rgb: 0xF4EBE1))
                .padding(.vertical, 2)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
