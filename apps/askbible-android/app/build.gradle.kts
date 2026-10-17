import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "me.askbible.native_"
    compileSdk = 36

    defaultConfig {
        // Josh 2026-09-14：Play 沿用 me.askbible 顶替 RN 版；debug 加后缀仍是 me.askbible.native，可与商店版并排装
        applicationId = "me.askbible"
        minSdk = 26
        targetSdk = 36
        // 必须大于 Play 上 RN 版已用过的 versionCode（RN android/app/build.gradle = 238）
        versionCode = 247
        versionName = "1.0.50"
    }

    // Google 原生登录（Credential Manager）要的 Web client ID：和网页 / RN 同一个，只在本机 .env.local（gitignore）或环境变量里。
    // 都读不到就用 RN app.config.js 里同一个兜底值（client ID 是公开值，不是密钥；本机 .env.local 丢过一次，别让打包靠它）
    val googleWebClientId = run {
        val keys = listOf("GOOGLE_WEB_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID", "GOOGLE_OAUTH_WEB_CLIENT_ID")
        keys.firstNotNullOfOrNull { System.getenv(it)?.trim()?.takeIf(String::isNotEmpty) }
            ?: listOf("../../.env.local", "../askbible-mobile/.env.local", "../askbible-mobile/.env").map { rootProject.file(it) }
                .filter { it.exists() }
                .flatMap { it.readLines() }
                .mapNotNull { line ->
                    val eq = line.indexOf('=')
                    if (line.trimStart().startsWith("#") || eq < 0) null
                    else line.substring(0, eq).trim().removePrefix("export ").trim() to line.substring(eq + 1).trim().trim('"', '\'')
                }
                .let { pairs -> keys.firstNotNullOfOrNull { k -> pairs.firstOrNull { it.first == k && it.second.isNotEmpty() }?.second } }
            ?: "827770827257-cigkgaq8k1m8qiu9ogq6n60d4s5uqili.apps.googleusercontent.com"
    }
    defaultConfig.buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")

    // 与 RN 同一把 upload key：凭据只在本机 apps/askbible-mobile/android/keystore.properties（gitignore）
    val uploadProps = rootProject.file("../askbible-mobile/android/keystore.properties")
    signingConfigs {
        if (uploadProps.exists()) create("upload") {
            val p = Properties().apply { uploadProps.inputStream().use { load(it) } }
            storeFile = rootProject.file("../askbible-mobile/android/app/" + p.getProperty("MYAPP_UPLOAD_STORE_FILE"))
            storePassword = p.getProperty("MYAPP_UPLOAD_STORE_PASSWORD")
            keyAlias = p.getProperty("MYAPP_UPLOAD_KEY_ALIAS")
            keyPassword = p.getProperty("MYAPP_UPLOAD_KEY_PASSWORD")
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".native"
            buildConfigField("boolean", "SELF_UPDATE", "false")
        }
        release {
            isMinifyEnabled = false
            signingConfigs.findByName("upload")?.let { signingConfig = it }
            // Play 版严禁自带「下载 APK 就地安装」，会被下架；商店渠道由 Play 自己推更新
            buildConfigField("boolean", "SELF_UPDATE", "false")
        }
        /**
         * 下载页（askbible-media.joshlabs.app/download.html）分发的包。
         * 和 release 一样的 applicationId 和签名（所以能覆盖升级老的网页版），
         * 唯一区别是开了 SELF_UPDATE：进 App 查 version.json，有新版就弹窗下载安装。
         * deploy_android.py 走的就是这个变体（.android-deploy.json 的 gradle_task）。
         */
        create("web") {
            initWith(getByName("release"))
            matchingFallbacks += listOf("release")
            buildConfigField("boolean", "SELF_UPDATE", "true")
        }
        /**
         * 侧载到真机用：和 release 完全一样（同一把 upload key、不开 minify），
         * 只是 applicationId 带 .native 后缀，能和商店版 me.askbible 并排装。
         *
         * 为什么要它：手机上的 me.askbible 是 Play 装的，被 Play App Signing 重签过，
         * 本地 upload key 打的包覆盖不上去（INSTALL_FAILED_UPDATE_INCOMPATIBLE），
         * 而卸载重装会清掉 Josh 手机上的登录和设置。
         * 「装到手机一律 Release」（APP/CLAUDE.md 7.0）和「别清真机数据」两条规矩，
         * 靠这个变体同时满足。对应 8.2 里的 gradle_task: assembleSideloadRelease。
         */
        create("sideload") {
            initWith(getByName("release"))
            applicationIdSuffix = ".native"
            matchingFallbacks += listOf("release")
            buildConfigField("boolean", "SELF_UPDATE", "false")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }

    // 圣经库不能被压缩 —— SQLiteDatabase 要按文件随机读，压缩过的 asset 打不开
    androidResources { noCompress += listOf("sqlite") }
}

// core 为了 JVM 对拍带了 org.json；Android 框架自带同名类，这里排除掉避免重复
configurations.all { exclude(group = "org.json", module = "json") }

dependencies {
    implementation(project(":core"))
    implementation(platform("androidx.compose:compose-bom:2025.01.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    // Google 登录的后备：Supabase 浏览器 OAuth（RN expo-web-browser.openAuthSessionAsync = Custom Tabs）
    implementation("androidx.browser:browser:1.8.0")
    // Google 登录优先走系统账号选择（Credential Manager → id_token → Supabase signInWithIdToken），不经 supabase.co 网页
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-session:1.5.1")
    // 商店版的应用内更新（Play 官方；站外分发版走自家的 AppUpdater）
    implementation("com.google.android.play:app-update-ktx:2.1.0")
    // 商店版的应用内评价（站外版没有这个入口，跳 Play 商店页）
    implementation("com.google.android.play:review-ktx:2.0.2")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
