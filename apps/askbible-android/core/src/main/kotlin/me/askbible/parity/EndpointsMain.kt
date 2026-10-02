package me.askbible.parity

import me.askbible.native_.data.Endpoints

/**
 * 防封换线的联网自检 harness（core --endpoints），tools/endpoints-live-check.mjs 用。
 * 场景：上次缓存的线路和候选表第一条都是连不上的域 → 探测后必须落到一条真能连上的线路，
 * 并且候选表被线上 endpoints.json 换掉。输出与 Swift 侧同形状的 JSON。
 */
fun endpointsMain() {
    val dead = "https://blocked.invalid/"
    val mem = HashMap<String, String>()
    for (r in Endpoints.Role.entries) {
        mem["host.${r.key}"] = dead
        mem["order.${r.key}"] = dead
    }
    Endpoints.init(object : Endpoints.Store {
        override fun get(key: String): String? = mem[key]
        override fun put(key: String, value: String) { mem[key] = value }
    })
    val before = listOf(Endpoints.mediaBase, Endpoints.siteBase, Endpoints.apiBase)
    Endpoints.refresh(force = true)
    val after = listOf(Endpoints.mediaBase, Endpoints.siteBase, Endpoints.apiBase)
    fun arr(l: List<String>) = l.joinToString(",", "[", "]") { jsonString(it) }
    println("{\"before\":${arr(before)},\"after\":${arr(after)},\"media\":${arr(Endpoints.allHosts(Endpoints.Role.MEDIA))}," +
        "\"site\":${arr(Endpoints.allHosts(Endpoints.Role.SITE))},\"api\":${arr(Endpoints.allHosts(Endpoints.Role.API))}}")
}
