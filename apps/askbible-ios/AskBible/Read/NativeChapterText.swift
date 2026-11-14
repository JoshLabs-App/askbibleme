import SwiftUI
import UIKit
import os

/// A single selectable document for the whole chapter. UITextView owns both
/// selection and scrolling, including dragging a handle beyond the visible page.
struct NativeChapterText: UIViewRepresentable {
    @Environment(\.appTextSize) private var appSize
    @ScaledMetric(relativeTo: .body) private var systemScale = 1.0
    private var textScale: CGFloat { appTextScale(appSize, system: systemScale) }

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
        view.header.rootView = AnyView(header.environment(\.appTextSize, appSize).environment(\.parchment, theme))
        view.footer.rootView = AnyView(footer.environment(\.appTextSize, appSize).environment(\.parchment, theme))
        let built = buildDocument()
        let selected = view.selectedRange
        let offset = view.contentOffset
        // Attribute changes (audio, bookmarks, theme) must not replace the text or
        // reset the user's selection, handles, or scroll position.
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
        view.tintColor = UIColor(theme.accentOt)
        view.setNeedsLayout()
        if changedChapter {
            view.chapterIdentity = identity
            view.selectedRange = NSRange(location: 0, length: 0)
            view.resignFirstResponder()
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
    }

    private func buildDocument() -> (text: NSAttributedString, ranges: [(Int, NSRange)], numbers: [(Int, NSRange)]) {
        let out = NSMutableAttributedString(string: "")
        var ranges: [(Int, NSRange)] = []
        var numbers: [(Int, NSRange)] = []
        for group in groups {
            let headings = group.first.flatMap { meta.headings[$0.number] } ?? []
            for heading in headings {
                let style = NSMutableParagraphStyle()
                style.alignment = .center
                style.paragraphSpacingBefore = 18
                style.paragraphSpacing = 16
                out.append(NSAttributedString(string: locale.zh(heading) + "\n", attributes: [
                    .font: UIFont.systemFont(ofSize: (metrics.verseFontSize + 1) * textScale, weight: .semibold),
                    .foregroundColor: UIColor(theme.ink), .paragraphStyle: style
                ]))
            }
            let built = ChapterFlowParagraph(verses: group, metrics: metrics, theme: theme, xrefVerses: xrefs, activeVerse: nil).build(scale: textScale)
            let text = NSMutableAttributedString(attributedString: built.text)
            for (number, range) in built.ranges where bookmarked.contains(number) {
                text.addAttribute(.backgroundColor, value: UIColor(theme.verseBookmarkMarker), range: range)
            }
            for run in ChapterFlowParagraph.runs(highlights: highlights, textRanges: built.textRanges, fullRanges: built.ranges) {
                text.addAttribute(.backgroundColor, value: run.color, range: run.range)
            }
            if let activeVerse, !bookmarked.contains(activeVerse),
               let verse = group.first(where: { $0.number == activeVerse }),
               let body = built.textRanges.first(where: { $0.verse == activeVerse })?.range,
               let sentence = VerseSentences.sentence(at: activeProgress, in: verse.text),
               sentence.upperBound < body.length {
                text.addAttribute(.backgroundColor, value: ChapterFlowParagraph.FlowTextView.activeFill,
                                  range: NSRange(location: body.location + sentence.lowerBound, length: sentence.count))
            }
            if let focusVerse {
                let matches = ChapterFlowParagraph.keywordRanges(verse: focusVerse, keyword: focusKeyword, verses: group, textRanges: built.textRanges)
                let marks = matches.isEmpty ? built.ranges.filter { $0.verse == focusVerse }.map(\.range) : matches
                for range in marks { text.addAttribute(.backgroundColor, value: UIColor(theme.verseSearchFocusBg), range: range) }
            }
            let start = out.length
            ranges += built.ranges.map { ($0.verse, NSRange(location: start + $0.range.location, length: $0.range.length)) }
            numbers += built.numberRanges.map { ($0.verse, NSRange(location: start + $0.range.location, length: $0.range.length)) }
            out.append(text)
            out.append(NSAttributedString(string: "\n", attributes: [
                .font: UIFont.systemFont(ofSize: metrics.verseFontSize * textScale),
                .paragraphStyle: { let p = NSMutableParagraphStyle(); p.paragraphSpacing = 16; return p }()
            ]))
            for verse in group {
                if let secondary = contrast[verse.number] {
                    out.append(NSAttributedString(string: "\(verse.number)\u{2002}\(secondary)\n", attributes: [
                        .font: UIFont.systemFont(ofSize: metrics.verseFontSize * 0.82 * textScale),
                        .foregroundColor: UIColor(theme.muted)
                    ]))
                }
            }
        }
        return (out, ranges, numbers)
    }

    final class ChapterTextView: UITextView, UITextViewDelegate, UIGestureRecognizerDelegate, UIEditMenuInteractionDelegate {
        var configuration: NativeChapterText!
        var verseRanges: [(Int, NSRange)] = []
        var numberRanges: [(Int, NSRange)] = []
        var chapterIdentity = ""
        var topToken = 0
        var lastFocus: Int?
        var lastActive: Int?
        var pendingVerse: Int?
        var scrollTopPending = false
        let header = UIHostingController(rootView: AnyView(EmptyView()))
        let footer = UIHostingController(rootView: AnyView(EmptyView()))
        var lastVisibleVerses: [Int] = []
        private var initialLong: UILongPressGestureRecognizer!
        private lazy var verseMenu = UIEditMenuInteraction(delegate: self)
        private var pendingMenu: DispatchWorkItem?
        private let selectionFill = CAShapeLayer()

        init() {
            super.init(frame: .zero, textContainer: nil)
            isEditable = false
            isSelectable = true
            backgroundColor = .clear
            layer.insertSublayer(selectionFill, at: 0)
            textContainer.lineFragmentPadding = 0
            showsVerticalScrollIndicator = false
            alwaysBounceVertical = true
            delegate = self
            addInteraction(verseMenu)
            accessibilityIdentifier = "read.chapter.text"
            header.view.backgroundColor = .clear
            footer.view.backgroundColor = .clear
            addSubview(header.view)
            addSubview(footer.view)
            initialLong = UILongPressGestureRecognizer(target: self, action: #selector(beginSelection(_:)))
            initialLong.minimumPressDuration = 0.45
            initialLong.delegate = self
            addGestureRecognizer(initialLong)
            let tap = UITapGestureRecognizer(target: self, action: #selector(tapNumber(_:)))
            tap.delegate = self
            tap.cancelsTouchesInView = false
            addGestureRecognizer(tap)
            // The initial long press selects a verse, rather than UIKit's word.
            // Existing handles continue to use UIKit's own text interactions.
            for gesture in gestureRecognizers ?? [] where gesture !== initialLong && gesture is UILongPressGestureRecognizer {
                gesture.require(toFail: initialLong)
            }
        }
        required init?(coder: NSCoder) { fatalError() }

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
            updateSelectionFill()
            reportVisibleVerses()
        }
        private func updateSelectionFill() {
            selectionFill.frame = CGRect(origin: .zero, size: contentSize)
            guard selectedRange.length > 0, let selectedTextRange else { selectionFill.path = nil; return }
            let path = UIBezierPath()
            for selection in selectionRects(for: selectedTextRange) where !selection.rect.isEmpty {
                path.append(UIBezierPath(rect: selection.rect))
            }
            selectionFill.fillColor = tintColor.withAlphaComponent(0.20).cgColor
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
                // Let UIKit own interactions once a selection exists (including
                // a stationary press on a selection handle).
                let point = gestureRecognizer.location(in: self)
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
            becomeFirstResponder()
            selectedRange = range
            presentSelectionMenu()
        }
        private func presentSelectionMenu() {
            guard window != nil, let selectedTextRange, selectedRange.length > 0 else { return }
            let visible = bounds.insetBy(dx: 20, dy: 12)
            let rect = selectionRects(for: selectedTextRange).map(\.rect).first(where: { $0.intersects(visible) }) ?? caretRect(for: selectedTextRange.end)
            let point = CGPoint(x: min(visible.maxX, max(visible.minX, rect.midX)),
                                y: min(visible.maxY - 44, max(visible.minY + 44, rect.minY)))
            let menu = UIEditMenuConfiguration(identifier: nil, sourcePoint: point)
            menu.preferredArrowDirection = .down
            verseMenu.presentEditMenu(with: menu)
        }
        private func hasActiveGesture(_ view: UIView) -> Bool {
            (view.gestureRecognizers ?? []).contains { $0.state == .began || $0.state == .changed }
                || view.subviews.contains { hasActiveGesture($0) }
        }
        func stopSelection() {
            pendingMenu?.cancel()
            verseMenu.dismissMenu()
            resignFirstResponder()
        }
        private func scheduleSelectionMenu() {
            pendingMenu?.cancel()
            let work = DispatchWorkItem { [weak self] in
                guard let self, self.selectedRange.length > 0 else { return }
                if self.hasActiveGesture(self) || self.isDragging || self.isDecelerating {
                    self.scheduleSelectionMenu()
                } else {
                    self.presentSelectionMenu()
                }
            }
            pendingMenu = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
        }
        @objc private func tapNumber(_ gesture: UITapGestureRecognizer) {
            guard selectedRange.length == 0, let index = character(at: gesture.location(in: self)),
                  let number = numberRanges.first(where: { NSLocationInRange(index, $0.1) })?.0,
                  configuration.xrefs.contains(number) else { return }
            configuration.onTapNumber(number)
        }
        func textViewDidChangeSelection(_ textView: UITextView) {
            updateSelectionFill()
            scheduleSelectionMenu()
            #if DEBUG
            Logger(subsystem: "me.askbible", category: "Selection").notice("selection location=\(textView.selectedRange.location) length=\(textView.selectedRange.length)")
            #endif
        }
        private var selectedNumbers: [Int] {
            verseRanges.filter { NSIntersectionRange($0.1, selectedRange).length > 0 }.map { $0.0 }
        }
        private var clipboardText: String? {
            let source = text as NSString
            guard selectedRange.length > 0, NSMaxRange(selectedRange) <= source.length,
                  let first = selectedNumbers.first, let last = selectedNumbers.last else { return nil }
            let reference = first == last ? "\(first)" : "\(first)–\(last)"
            // Section headings are editorial, so do not copy them as Scripture.
            // Intersect each verse with the actual UTF-16 selection: partial first
            // and last verses stay partial rather than silently expanding.
            let body = verseRanges.compactMap { entry -> String? in
                let overlap = NSIntersectionRange(entry.1, selectedRange)
                guard overlap.length > 0 else { return nil }
                return source.substring(with: overlap).trimmingCharacters(in: .whitespacesAndNewlines)
            }.filter { !$0.isEmpty }.joined(separator: "\n")
            return "\(configuration.bookName) \(configuration.chapter):\(reference)\n\(body)"
        }
        override func copy(_ sender: Any?) {
            guard let value = clipboardText else { return }
            UIPasteboard.general.string = value
        }
        func editMenuInteraction(_ interaction: UIEditMenuInteraction, menuFor configuration: UIEditMenuConfiguration, suggestedActions: [UIMenuElement]) -> UIMenu? {
            selectionMenu(suggestedActions)
        }
        func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            selectionMenu(suggestedActions)
        }
        private func selectionMenu(_ suggestedActions: [UIMenuElement]) -> UIMenu? {
            let c = configuration!
            let numbers = selectedNumbers
            guard !numbers.isEmpty else { return UIMenu(children: suggestedActions) }
            let remove = numbers.allSatisfy { c.bookmarked.contains($0) }
            return UIMenu(children: [
                UIAction(title: AppLocale.pick("复制", "Copy", c.locale), image: UIImage(systemName: "doc.on.doc")) { [weak self] _ in self?.copy(nil) },
                UIAction(title: AppLocale.pick(remove ? "取消收藏" : "收藏", remove ? "Remove bookmark" : "Bookmark", c.locale), image: UIImage(systemName: remove ? "bookmark.slash" : "bookmark")) { [weak self] _ in
                    c.onBookmark(numbers)
                    if !remove { self?.copy(nil) }
                },
                UIAction(title: AppLocale.pick("划重点", "Highlight", c.locale), image: UIImage(systemName: "highlighter")) { _ in if let first = numbers.first { c.onHighlight(first) } },
                UIAction(title: AppLocale.pick("分享", "Share", c.locale), image: UIImage(systemName: "square.and.arrow.up")) { [weak self] _ in
                    guard let self, let value = self.clipboardText else { return }
                    let sheet = UIActivityViewController(activityItems: [value], applicationActivities: nil)
                    sheet.popoverPresentationController?.sourceView = self
                    sheet.popoverPresentationController?.sourceRect = self.selectedTextRange.map { self.firstRect(for: $0) } ?? self.bounds
                    var responder: UIResponder? = self
                    while let current = responder {
                        if let controller = current as? UIViewController { controller.present(sheet, animated: true); break }
                        responder = current.next
                    }
                }
            ])
        }
        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            guard configuration != nil, !verseRanges.isEmpty else { return }
            // While selecting, keep the final verse on screen instead of scrolling
            // the selection handles into the hosted post-reading material.
            if selectedRange.length > 0 {
                let end = textContainerInset.top + layoutManager.usedRect(for: textContainer).height
                let maximum = max(-adjustedContentInset.top, end - bounds.height + 24)
                if contentOffset.y > maximum + 0.5 {
                    setContentOffset(CGPoint(x: contentOffset.x, y: maximum), animated: false)
                }
            }
            reportVisibleVerses()
            if footer.view.frame.minY > 0, contentOffset.y + bounds.height - adjustedContentInset.bottom >= footer.view.frame.minY {
                let callback = configuration.onReachedEnd
                DispatchQueue.main.async { callback() }
            }
        }
    }
}
