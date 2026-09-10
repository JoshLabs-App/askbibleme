package me.askbible.native_.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** 章正文按交付方式取（与 iOS ScriptureStore.loadChapterAsync 对等） */
object ChapterLoader {
    /** 内置 / 已下载 → sqlite；下载型没装 → 先下再读；在线 → RemoteChapterStore；取不到返回 null（页面提示重试） */
    suspend fun load(context: Context, downloader: TranslationDownloader, translationId: String, bookId: String, chapter: Int): List<LoadedVerse>? {
        val t = ScriptureTranslation.find(translationId)
        when (t?.delivery) {
            TranslationDelivery.ONLINE -> return RemoteChapterStore.load(context, t, bookId, chapter)?.map { LoadedVerse(it.verse, it.text, null, 0, false) }
            TranslationDelivery.DOWNLOAD -> if (!downloader.ensure(t)) return null
            else -> {}
        }
        return withContext(Dispatchers.IO) {
            ScriptureDatabase.open(context, translationId)?.let { db -> try { db.loadChapter(bookId, chapter) } finally { db.close() } }
        }
    }

    /** 本机有库（内置 / 已下载）才能搜索 */
    fun hasLocalText(context: Context, translationId: String): Boolean {
        val t = ScriptureTranslation.find(translationId) ?: return true
        return when (t.delivery) {
            TranslationDelivery.BUNDLED -> true
            TranslationDelivery.DOWNLOAD -> TranslationDownloader.isInstalled(context, translationId)
            TranslationDelivery.ONLINE -> false
        }
    }

    /** 搜索回退：在线译本改用同语言的内置译本（RN pickFallbackTranslationId 的思路）；本机有库返回 null */
    fun searchFallbackId(context: Context, translationId: String): String? {
        if (hasLocalText(context, translationId)) return null
        val zh = ScriptureTranslation.find(translationId)?.isZh ?: true
        return if (zh) "cuv-simp" else "web-en"
    }
}
