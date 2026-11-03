import SwiftUI

private struct AppTextSizeKey: EnvironmentKey { static let defaultValue = "system" }
extension EnvironmentValues {
    var appTextSize: String { get { self[AppTextSizeKey.self] } set { self[AppTextSizeKey.self] = newValue } }
}
struct AppTextSizeHost: ViewModifier {
    @AppStorage("askbible_app_text_size") private var choice = "system"
    func body(content: Content) -> some View { content.environment(\.appTextSize,choice) }
}
private struct AskScaledFont: ViewModifier {
    let size: CGFloat
    let weight: Font.Weight
    let design: Font.Design
    @Environment(\.appTextSize) private var choice
    @ScaledMetric(relativeTo:.body) private var systemScale = 1.0
    func body(content: Content) -> some View {
        let scale: CGFloat = choice == "standard" ? 1 : choice == "large" ? 1.3 : choice == "extra" ? 1.6 : systemScale
        content.font(.system(size:size*scale,weight:weight,design:design))
    }
}
extension View {
    func askFont(size: CGFloat, weight: Font.Weight = .regular, design: Font.Design = .default) -> some View {
        modifier(AskScaledFont(size:size,weight:weight,design:design))
    }
}
struct AppTextSizePicker: View {
    let locale: AppLocale
    @AppStorage("askbible_app_text_size") private var choice = "system"
    @Environment(\.parchment) private var theme
    var body: some View {
        VStack(alignment:.leading,spacing:8) {
            Text(AppLocale.pick("全局字号", "App text size",locale)).askFont(size:16,weight:.semibold)
            ForEach(["system","standard","large","extra"],id:\.self) { key in
                Button { choice=key } label: {
                    HStack {
                        Image(systemName:choice==key ? "largecircle.fill.circle" : "circle")
                        Text(label(key)).askFont(size:15)
                        Spacer()
                    }.frame(minHeight:44).contentShape(Rectangle())
                }.buttonStyle(.plain)
            }
            Text(AppLocale.pick("预览：你的话是我脚前的灯。", "Preview: Your word is a lamp to my feet.",locale)).askFont(size:16)
        }.foregroundStyle(theme.ink).padding(12)
    }
    private func label(_ key:String)->String {
        switch key {
        case "standard": return AppLocale.pick("标准","Standard",locale)
        case "large": return AppLocale.pick("大","Large",locale)
        case "extra": return AppLocale.pick("特大","Extra large",locale)
        default: return AppLocale.pick("跟随系统","Follow system",locale)
        }
    }
}

func appTextScale(_ choice: String, system: CGFloat) -> CGFloat {
    choice == "standard" ? 1 : choice == "large" ? 1.3 : choice == "extra" ? 1.6 : system
}
