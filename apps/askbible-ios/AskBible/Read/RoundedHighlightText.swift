import SwiftUI
import UIKit

/// 带圆角底色的多行文本（TextKit 自绘）。SwiftUI 的 AttributedString.backgroundColor 只能画方角，
/// 搜索结果的关键词高亮要跟章页的跟读框一样是弧形的（Josh），所以关键词段的底色在 draw 里逐行画圆角 4 的框，
/// 再画字。截到 maxLines 行时，被省略号吃掉的那段不画。与 Android SearchScreen 的 drawBehind 对等。
struct RoundedHighlightText: UIViewRepresentable {
    let text: NSAttributedString
    let highlightRanges: [NSRange]
    var fill: UIColor
    var cornerRadius: CGFloat = 4
    var maxLines = 4

    final class HighlightView: UIView {
        let storage = NSTextStorage()
        let layoutManager = NSLayoutManager()
        let container = NSTextContainer(size: .zero)
        var ranges: [NSRange] = []
        var fill = UIColor.clear
        var radius: CGFloat = 4

        override init(frame: CGRect) {
            super.init(frame: frame)
            container.lineFragmentPadding = 0
            container.lineBreakMode = .byTruncatingTail
            layoutManager.addTextContainer(container)
            storage.addLayoutManager(layoutManager)
            isOpaque = false
            backgroundColor = .clear
            contentMode = .redraw
        }

        required init?(coder: NSCoder) { fatalError() }

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
            let visible = layoutManager.glyphRange(for: container)
            // 截到 maxLines 行时，末行被省略号顶掉的那段字形仍算「已排版」，得从 truncatedGlyphRange 起截掉，
            // 不然落在省略号后面的命中会在「…」上画出一个框
            var drawable = visible
            if visible.length > 0 {
                let cut = layoutManager.truncatedGlyphRange(inLineFragmentForGlyphAt: NSMaxRange(visible) - 1)
                if cut.location != NSNotFound, cut.location > visible.location {
                    drawable = NSRange(location: visible.location, length: cut.location - visible.location)
                }
            }
            fill.setFill()
            for r in ranges {
                let glyphs = layoutManager.glyphRange(forCharacterRange: r, actualCharacterRange: nil)
                let shown = NSIntersectionRange(glyphs, drawable)
                guard shown.length > 0 else { continue }
                // 行框带着段落 lineSpacing（末行没有），直接用会让中间行的框比末行高一截；按字体行高收口，四行框一样高
                let charIndex = layoutManager.characterIndexForGlyph(at: shown.location)
                let lineHeight = (storage.attribute(.font, at: charIndex, effectiveRange: nil) as? UIFont)?.lineHeight
                layoutManager.enumerateEnclosingRects(forGlyphRange: shown, withinSelectedGlyphRange: NSRange(location: NSNotFound, length: 0), in: container) { box, _ in
                    var rect = box
                    if let lineHeight { rect.size.height = min(rect.height, ceil(lineHeight)) }
                    UIBezierPath(roundedRect: rect.insetBy(dx: -1, dy: 0), cornerRadius: self.radius).fill()
                }
            }
            layoutManager.drawGlyphs(forGlyphRange: visible, at: .zero)
        }
    }

    func makeUIView(context: Context) -> HighlightView {
        let v = HighlightView(frame: .zero)
        v.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return v
    }

    func updateUIView(_ v: HighlightView, context: Context) {
        v.container.maximumNumberOfLines = maxLines
        v.storage.setAttributedString(text)
        v.ranges = highlightRanges
        v.fill = fill
        v.radius = cornerRadius
        v.setNeedsDisplay()
    }

    @available(iOS 16.0, *)
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: HighlightView, context: Context) -> CGSize? {
        let width = proposal.width ?? UIScreen.main.bounds.width - 40
        return CGSize(width: width, height: uiView.height(for: width))
    }
}
