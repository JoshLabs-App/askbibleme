package me.askbible.native_.ui

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import me.askbible.native_.data.Rgba

/** core 的 Rgba（零依赖）→ Compose Color。色值本身由 check:tokens 锁住。 */
fun Rgba.toColor(): Color = Color(argb.toULong() shl 32)

/** assets 里的图，按名字读一次缓存住 */
object AssetImages {
    private val cache = HashMap<String, ImageBitmap?>()

    fun load(context: Context, name: String): ImageBitmap? = cache.getOrPut(name) {
        runCatching {
            context.assets.open(name).use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
        }.getOrNull()
    }

    /** 缩略图用：按 inSampleSize 降采样到长边约 maxDim，别把整张海报解进内存 */
    fun loadThumb(context: Context, name: String, maxDim: Int): ImageBitmap? = cache.getOrPut("$name@$maxDim") {
        runCatching {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.assets.open(name).use { BitmapFactory.decodeStream(it, null, bounds) }
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxDim) sample *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = sample }
            context.assets.open(name).use { BitmapFactory.decodeStream(it, null, opts)?.asImageBitmap() }
        }.getOrNull()
    }
}

@Composable
fun rememberAssetImage(name: String): ImageBitmap? {
    val context = LocalContext.current
    return remember(name) { AssetImages.load(context, name) }
}

@Composable
fun rememberAssetThumb(name: String, maxDim: Int = 256): ImageBitmap? {
    val context = LocalContext.current
    return remember(name, maxDim) { AssetImages.loadThumb(context, name, maxDim) }
}
