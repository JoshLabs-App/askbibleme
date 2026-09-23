package me.askbible.native_.update

import androidx.core.content.FileProvider

/**
 * 只为了和分享图那个 FileProvider **区分开**：manifest 合并器按 `android:name` 认元素，
 * 两个 provider 都写 `androidx.core.content.FileProvider` 会被当成同一个，
 * 报 authorities 冲突。继承一个空子类，名字不同，两个就能共存。
 *
 * 这个给 web 变体装 APK 用（authorities `${applicationId}.updates`）；
 * 分享成就图用的是 main 里那个 `${applicationId}.fileprovider`。
 */
class UpdateFileProvider : FileProvider()
