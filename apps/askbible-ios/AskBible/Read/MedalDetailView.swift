import SwiftUI
import UIKit

/// 成就大图：点成就墙上的勋章 / 书卷印章弹出来，光束转、奖牌弹出，底下可以写自己的名字，
/// 已获得的能做成一张 1080×1350 的分享图，直接分享或存相册。
///
/// 和安卓 `MedalDetail.kt` 是对等双写，版式抄的是「听到」(03MyClass)
/// —— Josh 2026-09-23「要跟听到一样」。配色跟羊皮卷。
///
/// 名字只存本机（UserDefaults），不进会员同步 —— 它只是印在图上的落款。
struct MedalDetail: Identifiable, Equatable {
    var id: String { key }
    let key: String
    let name: String
    let earned: Bool
    let tier: String
    let caption: String
    let fraction: Double
}

enum MedalProfile {
    private static let nameKey = "askbible-profile-display-name"
    static var displayName: String {
        get { UserDefaults.standard.string(forKey: nameKey) ?? "" }
        set { UserDefaults.standard.set(String(newValue.trimmingCharacters(in: .whitespaces).prefix(16)), forKey: nameKey) }
    }
}

struct MedalDetailView: View {
    let detail: MedalDetail
    var onDismiss: () -> Void

    @State private var shown = false
    @State private var spin: Double = 0
    @State private var name = MedalProfile.displayName
    @State private var editing = false
    @State private var busy = false
    @State private var toast: String?
    @State private var shareImage: UIImage?

    var body: some View {
        ZStack {
            Color(parchment: 0x1C1410, opacity: 0.55)
                .ignoresSafeArea()
                .onTapGesture { onDismiss() }

            card
                .scaleEffect(shown ? 1 : 0.35)
                .opacity(shown ? 1 : 0)
                .animation(.spring(response: 0.42, dampingFraction: 0.62), value: shown)
        }
        .onAppear {
            shown = true
            withAnimation(.linear(duration: 14).repeatForever(autoreverses: false)) { spin = 360 }
        }
        .overlay(alignment: .bottom) {
            if let toast {
                Text(toast)
                    .font(.system(size: 14))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 10)
                    .background(Color.black.opacity(0.75), in: Capsule())
                    .padding(.bottom, 60)
                    .transition(.opacity)
            }
        }
        .alert(SiteCopy.t("native.medalNameTitle"), isPresented: $editing) {
            TextField("", text: $name)
            Button(SiteCopy.t("native.save")) { MedalProfile.displayName = name; name = MedalProfile.displayName }
            Button(SiteCopy.t("native.cancel"), role: .cancel) { name = MedalProfile.displayName }
        } message: {
            Text(SiteCopy.t("native.medalNameHint"))
        }
        .sheet(item: Binding(get: { shareImage.map { SharePayload(image: $0, text: shareText) } },
                             set: { if $0 == nil { shareImage = nil } })) { payload in
            ActivityView(items: [payload.image, payload.text])
        }
    }

    private var card: some View {
        VStack(spacing: 6) {
            ZStack {
                if detail.earned {
                    rays.rotationEffect(.degrees(spin))
                    Circle()
                        .fill(RadialGradient(colors: [Color(rgb: 0xFFF0CE).opacity(0.8), .clear],
                                             center: .center, startRadius: 0, endRadius: 100))
                        .frame(width: 200, height: 200)
                }
                MedalIcon(key: detail.key, tier: detail.earned ? 3 : 0, tierCount: 3, size: 168)
                    .opacity(detail.earned ? 1 : 0.5)
            }
            .frame(width: 230, height: 230)

            Text(detail.name)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(Color(parchment: 0x1C1410))
                .multilineTextAlignment(.center)
            Text(detail.tier)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color(rgb: detail.earned ? 0xD97707 : 0x5C4030))
            if !detail.caption.isEmpty {
                Text(detail.caption).font(.system(size: 13)).foregroundStyle(Color(parchment: 0x5C4030))
            }
            if !detail.earned {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color(parchment: 0xC9A672, opacity: 0.3))
                        Capsule().fill(Color(rgb: 0xFFB101).opacity(0.85))
                            .frame(width: geo.size.width * max(0.02, detail.fraction))
                    }
                }
                .frame(width: 220, height: 5)
                .padding(.top, 10)
            }

            Button { editing = true } label: {
                Text(name.isEmpty ? SiteCopy.t("native.medalNamePrompt") : name)
                    .font(.system(size: 15))
                    .foregroundStyle(Color(parchment: 0x1C1410))
                    .padding(.horizontal, 16).padding(.vertical, 7)
                    .background(Color(parchment: 0x2A1810, opacity: 0.07), in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 12)

            if detail.earned {
                HStack(spacing: 10) {
                    actionButton(busy ? SiteCopy.t("native.medalShareBusy") : SiteCopy.t("native.medalShare")) {
                        run { image in shareImage = image }
                    }
                    actionButton(SiteCopy.t("native.medalSaveToAlbum"), ghost: true) {
                        run { image in
                            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                            flash(SiteCopy.t("native.medalShareSaved"))
                        }
                    }
                }
                .padding(.top, 14)
            } else {
                Text(SiteCopy.t("native.medalLockedShareHint"))
                    .font(.system(size: 13))
                    .foregroundStyle(Color(parchment: 0x5C4030))
                    .multilineTextAlignment(.center)
                    .padding(.top, 14)
            }
        }
        .padding(.horizontal, 22).padding(.vertical, 24)
        .frame(maxWidth: 380)
        .background(Color(parchment: 0xF5EBE0), in: RoundedRectangle(cornerRadius: 26))
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(Color(parchment: 0xC9A672, opacity: 0.35), lineWidth: 1))
        .padding(20)
    }

    /// 24 根光束，隔一根画一根 —— 和安卓那边同一个画法
    private var rays: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2
            let rect = CGRect(x: size.width / 2 - r, y: size.height / 2 - r, width: r * 2, height: r * 2)
            for i in stride(from: 0, to: 24, by: 2) {
                var path = Path()
                path.move(to: CGPoint(x: rect.midX, y: rect.midY))
                path.addArc(center: CGPoint(x: rect.midX, y: rect.midY), radius: r,
                            startAngle: .degrees(Double(i) * 15), endAngle: .degrees(Double(i) * 15 + 7),
                            clockwise: false)
                ctx.fill(path, with: .color(Color(rgb: 0xD97707).opacity(0.27)))
            }
        }
        .frame(width: 230, height: 230)
    }

    private func actionButton(_ label: String, ghost: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ghost ? Color(parchment: 0x1C1410) : .white)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background {
                    if ghost {
                        RoundedRectangle(cornerRadius: 14).stroke(Color(parchment: 0xC9A672, opacity: 0.35), lineWidth: 1)
                    } else {
                        RoundedRectangle(cornerRadius: 14).fill(Color(rgb: 0xD97707).opacity(busy ? 0.5 : 1))
                    }
                }
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }

    private var shareText: String {
        let who = name.isEmpty ? "" : "\(name) "
        let tier = detail.tier.isEmpty ? "" : " · \(detail.tier)"
        return SiteCopy.f("native.medalShareText", ["who": who, "name": detail.name, "tier": tier])
            + "\nhttps://askbible.me\nhttps://askbible-media.joshlabs.app/download.html"
    }

    private func run(_ then: @escaping (UIImage) -> Void) {
        busy = true
        Task {
            var art: UIImage?
            if let url = MedalCatalog.imageURL(detail.key) {
                // ?? 的右边是 autoclosure，不能放 await —— 拆成两句
                if let hit = MedalImage.cached(url) { art = hit } else { art = await MedalImage.load(url) }
            }
            let image = MedalCard.render(detail: detail, name: name, art: art)
            busy = false
            then(image)
        }
    }

    private func flash(_ text: String) {
        withAnimation { toast = text }
        Task {
            try? await Task.sleep(for: .seconds(1.8))
            withAnimation { toast = nil }
        }
    }
}

private struct SharePayload: Identifiable {
    var id: String { text }
    let image: UIImage
    let text: String
}

/// UIActivityViewController 的薄包装：SwiftUI 没有原生分享面板可以带图 + 带文案
private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

/// 分享图：1080×1350，羊皮卷底 + 光束 + 奖牌 + 名称/档位 + 落款 + 两个链接。
/// 和安卓 `medalCardBitmap` 是同一套版式和坐标，改一边记得改另一边。
enum MedalCard {
    static func render(detail: MedalDetail, name: String, art: UIImage?) -> UIImage {
        let size = CGSize(width: 1080, height: 1350)
        return UIGraphicsImageRenderer(size: size, format: {
            let f = UIGraphicsImageRendererFormat.default()
            f.scale = 1
            return f
        }()).image { ctx in
            let cg = ctx.cgContext
            let w = size.width, h = size.height

            // 羊皮卷底
            let colors = [UIColor(rgb: 0xFFFCF5).cgColor, UIColor(rgb: 0xF5EBE0).cgColor, UIColor(rgb: 0xECD9B9).cgColor]
            if let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                     colors: colors as CFArray, locations: [0, 0.55, 1]) {
                cg.drawLinearGradient(grad, start: .zero, end: CGPoint(x: w * 0.3, y: h), options: [])
            }

            let cx = w / 2, cy: CGFloat = 560
            for i in 0..<24 {
                let start = CGFloat(i) * 15 * .pi / 180
                let end = start + 6.4 * .pi / 180
                cg.move(to: CGPoint(x: cx, y: cy))
                cg.addArc(center: CGPoint(x: cx, y: cy), radius: 470, startAngle: start, endAngle: end, clockwise: false)
                cg.setFillColor(i % 2 == 0
                                ? UIColor.white.withAlphaComponent(0.55).cgColor
                                : UIColor(rgb: 0xD97707).withAlphaComponent(0.14).cgColor)
                cg.fillPath()
            }
            if let glow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                     colors: [UIColor.white.withAlphaComponent(0.92).cgColor,
                                              UIColor.white.withAlphaComponent(0).cgColor] as CFArray,
                                     locations: [0, 1]) {
                cg.drawRadialGradient(glow, startCenter: CGPoint(x: cx, y: cy), startRadius: 0,
                                      endCenter: CGPoint(x: cx, y: cy), endRadius: 380, options: [])
            }

            draw(SiteCopy.t("native.medalCardBrand"), at: 128, cx: cx, w: w,
                 font: .systemFont(ofSize: 34), color: UIColor(rgb: 0x8A6A33))
            cg.setStrokeColor(UIColor(rgb: 0x8A6A33).withAlphaComponent(0.35).cgColor)
            cg.setLineWidth(2)
            cg.move(to: CGPoint(x: cx - 60, y: 158))
            cg.addLine(to: CGPoint(x: cx + 60, y: 158))
            cg.strokePath()

            if let art {
                let box: CGFloat = 520
                let k = min(box / art.size.width, box / art.size.height)
                let dw = art.size.width * k, dh = art.size.height * k
                art.draw(in: CGRect(x: cx - dw / 2, y: cy - dh / 2, width: dw, height: dh))
            }

            draw(detail.name, at: 960, cx: cx, w: w,
                 font: .systemFont(ofSize: 76, weight: .bold), color: UIColor(rgb: 0x1C1410))
            if !detail.tier.isEmpty {
                draw(detail.tier, at: 1024, cx: cx, w: w,
                     font: .systemFont(ofSize: 40), color: UIColor(rgb: 0xD97707))
            }
            if !name.isEmpty {
                let font = UIFont.systemFont(ofSize: 38)
                let tw = (name as NSString).size(withAttributes: [.font: font]).width
                let box = CGRect(x: cx - tw / 2 - 34, y: 1062, width: tw + 68, height: 74)
                let path = UIBezierPath(roundedRect: box, cornerRadius: 37)
                UIColor.white.withAlphaComponent(0.75).setFill()
                path.fill()
                UIColor(rgb: 0xD97707).withAlphaComponent(0.3).setStroke()
                path.lineWidth = 2
                path.stroke()
                draw(name, at: 1112, cx: cx, w: w, font: font, color: UIColor(rgb: 0x5C4030))
            }
            draw("askbible.me", at: 1222, cx: cx, w: w,
                 font: .systemFont(ofSize: 32), color: UIColor(rgb: 0x5C4030).withAlphaComponent(0.9))
            draw("askbible-media.joshlabs.app/download.html", at: 1272, cx: cx, w: w,
                 font: .systemFont(ofSize: 28), color: UIColor(rgb: 0x5C4030).withAlphaComponent(0.62))
        }
    }

    /// 居中画一行字；y 给的是基线，和安卓 drawText 的语义对齐
    private static func draw(_ text: String, at y: CGFloat, cx: CGFloat, w: CGFloat,
                             font: UIFont, color: UIColor) {
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        let s = text as NSString
        let size = s.size(withAttributes: attrs)
        s.draw(at: CGPoint(x: cx - size.width / 2, y: y - font.ascender), withAttributes: attrs)
    }
}

private extension UIColor {
    convenience init(rgb: Int) {
        self.init(red: CGFloat((rgb >> 16) & 0xFF) / 255,
                  green: CGFloat((rgb >> 8) & 0xFF) / 255,
                  blue: CGFloat(rgb & 0xFF) / 255, alpha: 1)
    }
}
