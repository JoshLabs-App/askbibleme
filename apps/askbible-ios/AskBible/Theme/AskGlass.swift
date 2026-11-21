import SwiftUI

/// 圆角与浮层阴影常量（D-45：全端对齐安卓羊皮卷实底版面，禁用苹果 Liquid Glass / Material）。
enum AskCorner {
    static let control: CGFloat = 26
    static let card: CGFloat = 16
    static let sheet: CGFloat = 16
}

enum AskElevation {
    case content
    case floating
    case overlay

    var radius: CGFloat {
        switch self {
        case .content: return 0
        case .floating: return 14
        case .overlay: return 24
        }
    }

    var opacity: Double {
        switch self {
        case .content: return 0
        case .floating: return 0.18
        case .overlay: return 0.26
        }
    }

    var yOffset: CGFloat {
        switch self {
        case .content: return 0
        case .floating: return 4
        case .overlay: return 8
        }
    }
}

extension View {
    func askFloatingShadow(_ level: AskElevation = .floating) -> some View {
        shadow(color: .black.opacity(level.opacity), radius: level.radius, x: 0, y: level.yOffset)
    }
}
