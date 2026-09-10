import Foundation

// 从 stdin 读 [{text, spans, themeRepeatCount}]，输出各自的切分与金句判定。
// 与 App 共用同一份 VerseAnnotations.swift —— 对拍的就是它。
struct Input: Decodable {
    let text: String
    let spans: String
    let themeRepeatCount: Int
}
struct OutPart: Encodable {
    let kind: String
    let text: String
}
struct Output: Encodable {
    let parts: [OutPart]?
    let isGolden: Bool
}

let data = FileHandle.standardInput.readDataToEndOfFile()
let inputs = try JSONDecoder().decode([Input].self, from: data)
let results = inputs.map { input -> Output in
    let parts = VerseAnnotations.speechParts(text: input.text, rawSpans: input.spans)
    return Output(
        parts: parts?.map { OutPart(kind: $0.kind.rawValue, text: $0.text) },
        isGolden: VerseAnnotations.showsGoldenThemeMarker(themeRepeatCount: input.themeRepeatCount)
    )
}
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
FileHandle.standardOutput.write(try encoder.encode(results))
