import Foundation
// 环境音槽位表对拍 harness：输出 [{id,label,labelEn,file,gain,url}] + defaultSlotId
struct Row: Encodable { let id: String; let label: String; let labelEn: String; let file: String; let gain: Float; let url: String? }
struct Out: Encodable { let slots: [Row]; let defaultSlotId: String }
let out = Out(slots: AmbientScenes.slots.map {
    Row(id: $0.id, label: $0.label, labelEn: $0.labelEn, file: $0.file, gain: $0.gain, url: AmbientScenes.remoteURL(id: $0.id)?.absoluteString)
}, defaultSlotId: AmbientScenes.defaultSlotId)
let enc = JSONEncoder(); enc.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(out))
