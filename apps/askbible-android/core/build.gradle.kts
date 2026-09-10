plugins {
    id("org.jetbrains.kotlin.jvm")
    application
}

kotlin { jvmToolchain(17) }

// 纯 Kotlin，零 Android 依赖 —— 所以对拍能在 JVM 上直接跑，不需要模拟器。
// 依赖 Context/SQLiteDatabase 的 ScriptureDatabase 留在 :app。
application { mainClass.set("me.askbible.parity.MainKt") }

// 收藏 JSON 的解析规则要进对拍（JVM 上跑），所以 core 自带 org.json；:app 里排除它，用 Android 框架自带的那份
dependencies { implementation("org.json:json:20240303") }
