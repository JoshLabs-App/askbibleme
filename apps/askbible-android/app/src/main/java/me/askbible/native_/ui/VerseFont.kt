package me.askbible.native_.ui

import android.content.Context
import android.graphics.Typeface
import androidx.compose.ui.text.font.FontFamily

/**
 * 首页金句的字体（DECISIONS D-19）：思源宋体 700 的子集 AskBibleSong，和网页版首页同一套
 * （scripts/build-verse-font.py 生成，字表 = 站内中文译本用到的全部字）。
 * 字体里只有中文：含汉字的用它；英文、在线版本的其它文字和日文用系统衬线体，免得一句里两种字体混排。
 */
object VerseFont {
    @Volatile private var song: FontFamily? = null

    private fun song(context: Context): FontFamily = song ?: FontFamily(
        Typeface.createFromAsset(context.assets, "fonts/AskBibleSong-Bold.ttf")).also { song = it }

    fun family(context: Context, text: String): FontFamily =
        if (isChinese(text)) song(context) else FontFamily.Serif

    /** 有汉字、没有假名（日文译本的汉字很多不在字表里） */
    fun isChinese(text: String): Boolean =
        text.any { it in '一'..'鿿' } && text.none { it in '぀'..'ヿ' }
}
