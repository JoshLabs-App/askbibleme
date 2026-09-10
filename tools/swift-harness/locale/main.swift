import Foundation

// 语言展示规则对拍 harness：协议见 tools/locale-check.mjs
var out: [String] = []
while let line = readLine() {
    if line.isEmpty { continue }
    let f = line.components(separatedBy: "\t")
    switch f[0] {
    case "tag": out.append(AppLocale.fromLanguageTag(f.count > 1 ? f[1] : "").rawValue)
    case "display":
        let app = AppLocale(rawValue: f[1]) ?? .en
        out.append(ReadDisplayLocale.resolve(appLocale: app, translationLanguage: f.count > 2 && !f[2].isEmpty ? f[2] : nil).rawValue)
    case "chrome":
        let app = AppLocale(rawValue: f[1]) ?? .en
        out.append(ReadDisplayLocale.chrome(appLocale: app, translationLanguage: f.count > 2 && !f[2].isEmpty ? f[2] : nil).rawValue)
    case "zhtw": out.append(ZhTw.convert(f.count > 1 ? f[1] : ""))
    case "book": out.append(BibleCatalog.book(id: f[1])?.name(AppLocale(rawValue: f[2]) ?? .en) ?? f[1])
    case "title": out.append(ReadChrome.chapterTitle(bookName: f[1], chapter: Int(f[2]) ?? 0, locale: AppLocale(rawValue: f[3]) ?? .en))
    case "label": out.append(ReadChrome.chapterLabel(Int(f[1]) ?? 0, locale: AppLocale(rawValue: f[2]) ?? .en))
    default: out.append("skip")
    }
}
let data = try! JSONSerialization.data(withJSONObject: out, options: [.withoutEscapingSlashes])
FileHandle.standardOutput.write(data)
