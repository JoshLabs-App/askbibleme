import Foundation

// 读后两版归一化对拍 harness：协议见 tools/info-edition-check.mjs（记录以「换行 + U+001E + 换行」分隔）
let raw = try! String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
let cases = raw.components(separatedBy: "\n\u{1e}\n").filter { !$0.isEmpty }
var out: [[String: Any]] = []
for c in cases {
    let nl = c.firstIndex(of: "\n") ?? c.endIndex
    let variant = String(c[..<nl])
    let markdown = nl < c.endIndex ? String(c[c.index(after: nl)...]) : ""
    let text = InfoEditionFormat.readerText(markdown, variant: variant == "info" ? .info : .guide)
    let split = InfoEditionFormat.splitPrimaryHeading(text)
    out.append(["h": split.heading as Any? ?? NSNull(), "b": split.body])
}
let data = try! JSONSerialization.data(withJSONObject: out)
FileHandle.standardOutput.write(data)
