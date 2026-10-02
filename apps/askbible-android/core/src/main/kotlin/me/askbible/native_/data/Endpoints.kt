package me.askbible.native_.data

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Callable
import java.util.concurrent.Executors

/**
 * 防封换线（docs/anti-block-endpoints.md、DECISIONS D-20）：代码里不写死单个域名。
 *
 * 每个角色内置一组候选域，启动后并发探测，取**列表里最靠前**那条通的并缓存；
 * 候选表本身从桶根的 endpoints.json 更新（真源 data/endpoints.json），加新域不用发版。
 * 三端同一套：iOS Endpoints.swift、网页 lib/endpoints/。照听到 Endpoints.kt 改的。
 *
 * 放在 :core（纯 JVM，对拍要用），所以不碰 Context：本地缓存通过 [Store] 交给 :app 用 SharedPreferences 实现。
 */
object Endpoints {

    /**
     * 内置默认候选域（`npm run check:endpoints` 核对它和 data/endpoints.json 一致）。
     * 每个角色的第一条就是老版本写死的那个地址，所以没探测前的行为和老版本一模一样。
     */
    enum class Role(val key: String, val builtin: List<String>) {
        /** R2 桶 askbible-media：金句语音、音乐、场景、勋章图、每日灵修、整本库、更新检查 */
        MEDIA("media", listOf("https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/", "https://askbible-media.joshlabs.app/")),
        /** 主站接口：在线译本、章节朗读地址解析、注销账号 */
        SITE("site", listOf("https://askbible.me/", "https://askbible-site.joshlabs.app/")),
        /** Supabase：登录、会员同步 */
        API("api", listOf("https://tgobadhdylarhssudplc.supabase.co/", "https://askbible-sb.joshlabs.app/")),
    }

    /** 本地缓存（:app 里是 SharedPreferences）。没接的时候（对拍）就只用内置表。 */
    interface Store {
        fun get(key: String): String?
        fun put(key: String, value: String)
    }

    /** 探测用的小文件。取不到（404）不算失败，见 probe()。 */
    private const val PROBE_PATH = "healthz.txt"
    /** 回前台时最多这么久重探一次 */
    private const val REFRESH_INTERVAL_MS = 10 * 60 * 1000L

    @Volatile private var store: Store? = null
    @Volatile private var lastRefreshAt = 0L
    private val chosen = HashMap<Role, String>()

    private fun host(r: Role): String = synchronized(chosen) { chosen[r] } ?: r.builtin[0]

    /** 不带结尾斜杠的当前域——原来那些 "$R2_PUBLIC_BASE/audio/…" 的拼法不用改 */
    val mediaBase: String get() = host(Role.MEDIA).trimEnd('/')
    val siteBase: String get() = host(Role.SITE).trimEnd('/')
    val apiBase: String get() = host(Role.API).trimEnd('/')

    /** 该角色认得的全部候选域（线上 + 内置），带结尾斜杠 */
    fun allHosts(r: Role): List<String> = candidates(r)

    /**
     * 把写死了某条 media 线路的绝对地址换到当前线路上（version.json 的 apkUrl、译本目录里的整本库下载地址这类数据）。
     * 不是 media 候选域的地址原样返回。
     */
    fun rebasedMedia(url: String): String {
        for (h in candidates(Role.MEDIA)) if (url.startsWith(h)) return host(Role.MEDIA) + url.substring(h.length)
        return url
    }

    /**
     * 进程启动时**同步**调一次：只读本地缓存，不联网（联网探测走 [refresh]）。
     * 要在第一次拼地址之前调，否则首屏那批请求会打到上次已经不通的域。
     */
    fun init(store: Store) {
        this.store = store
        synchronized(chosen) {
            for (r in Role.entries) store.get(hostKey(r))?.takeIf { it.isNotBlank() }?.let { chosen[r] = it }
        }
    }

    /** 在后台线程调（会阻塞到探测结束，最长约 20 秒）。[force] 为 false 时 10 分钟内不重复探。 */
    fun refresh(force: Boolean = false) {
        val now = System.currentTimeMillis()
        synchronized(this) {
            if (!force && now - lastRefreshAt < REFRESH_INTERVAL_MS) return
            lastRefreshAt = now
        }
        pickAll()
        fetchList()     // 新列表可能引入更靠前的候选，再挑一次
        pickAll()
    }

    private fun pickAll() {
        for (r in Role.entries) {
            val h = pick(r) ?: continue
            synchronized(chosen) { chosen[r] = h }
            store?.put(hostKey(r), h)
        }
    }

    /**
     * 并发探测该角色的全部候选域，取**列表里最靠前**的那个通的
     * （不是最快的：顺序稳定，不会每次启动换来换去）。全挂返回 null，保留原来的。
     */
    private fun pick(r: Role): String? {
        val list = candidates(r)
        if (list.isEmpty()) return null
        val pool = Executors.newFixedThreadPool(list.size)
        return try {
            val ok = pool.invokeAll(list.map { h -> Callable { probe(h) } }).map { runCatching { it.get() }.getOrDefault(false) }
            list.indices.firstOrNull { ok[it] }?.let { list[it] }
        } finally {
            pool.shutdown()
        }
    }

    /**
     * 通不通只看「有没有 HTTP 响应」：被墙表现为 DNS 失败 / TLS 重置 / 超时，而不是 404。
     * 所以探测文件没放的域（主站、Supabase）也照样算通。
     */
    private fun probe(host: String): Boolean = runCatching {
        val conn = (URL(host + PROBE_PATH).openConnection() as HttpURLConnection).apply {
            requestMethod = "HEAD"
            connectTimeout = 6_000; readTimeout = 6_000
            useCaches = false
        }
        try { conn.responseCode < 500 } finally { conn.disconnect() }
    }.getOrDefault(false)

    /** 从当前 media 域（桶根）拉候选表，存下来下次启动就生效 */
    private fun fetchList() {
        runCatching {
            val conn = (URL(host(Role.MEDIA) + "endpoints.json").openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000; readTimeout = 10_000; useCaches = false
            }
            val body = try {
                if (conn.responseCode != 200) return
                conn.inputStream.bufferedReader().use { it.readText() }
            } finally { conn.disconnect() }
            val roles = JSONObject(body).getJSONObject("roles")
            for (r in Role.entries) {
                val arr = roles.optJSONObject(r.key)?.optJSONArray("candidates") ?: continue
                val list = (0 until arr.length()).map { normalized(arr.getString(it)) }.filter { it.startsWith("https://") }
                // 换行分隔的字符串：候选域是**有序**的
                if (list.isNotEmpty()) store?.put(orderKey(r), list.joinToString("\n"))
            }
        }
    }

    /** 候选顺序：线上列表（缓存下来的）→ 内置，去重。线上表写坏了也不至于把客户端锁死。 */
    private fun candidates(r: Role): List<String> {
        val remote = store?.get(orderKey(r))?.split("\n") ?: emptyList()
        return (remote + r.builtin).map(::normalized).filter { it.startsWith("https://") }.distinct()
    }

    private fun normalized(s: String) = s.trim().let { if (it.endsWith("/") || it.isEmpty()) it else "$it/" }
    private fun hostKey(r: Role) = "host.${r.key}"
    private fun orderKey(r: Role) = "order.${r.key}"
}
