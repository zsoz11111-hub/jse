plugins {
    id("com.android.application")
}

android {
    namespace = "kr.jse.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "kr.jse.app"
        minSdk = 29
        targetSdk = 34
        versionCode = 3
        versionName = "1.2"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
