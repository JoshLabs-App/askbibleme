package me.askbible.native_.data

import android.content.Context
import kotlin.concurrent.thread

/**
 * [Endpoints]（在 :core，纯 JVM）的本地缓存：SharedPreferences `endpoints`。
 * 防封换线，见 docs/anti-block-endpoints.md。
 */
object EndpointsStore {
    private const val PREFS = "endpoints"

    /** 进程启动时同步调：只读盘，不联网 */
    fun attach(context: Context) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        Endpoints.init(object : Endpoints.Store {
            override fun get(key: String): String? = prefs.getString(key, null)
            override fun put(key: String, value: String) { prefs.edit().putString(key, value).apply() }
        })
    }

    /** 后台探测候选域、拉新的候选表；Endpoints 自己限 10 分钟一次 */
    fun refreshInBackground() {
        thread(name = "endpoints-refresh", isDaemon = true) { runCatching { Endpoints.refresh() } }
    }
}
