package me.askbible.parity

import me.askbible.native_.data.AmbientScenes

/** 环境音槽位表对拍 harness（core --ambient），输出与 Swift 侧同形状的 JSON */
fun ambientMain() {
    val sb = StringBuilder("{\"slots\":[")
    AmbientScenes.slots.forEachIndexed { i, s ->
        if (i > 0) sb.append(',')
        val url = AmbientScenes.remoteUrl(s.id)
        sb.append("{\"id\":").append(jsonString(s.id)).append(",\"label\":").append(jsonString(s.label))
            .append(",\"labelEn\":").append(jsonString(s.labelEn)).append(",\"file\":").append(jsonString(s.file))
            .append(",\"gain\":").append(s.gain).append(",\"url\":").append(if (url == null) "null" else jsonString(url)).append('}')
    }
    sb.append("],\"defaultSlotId\":").append(jsonString(AmbientScenes.DEFAULT_SLOT_ID)).append('}')
    println(sb)
}
