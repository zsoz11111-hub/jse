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
        versionCode = 6
        versionName = "1.5"
    }

    // 업데이트가 덮어쓰기로 설치되도록 항상 같은 서명 키를 씁니다 (키는 워크플로가 android/signing 에서 꺼내 둡니다)
    signingConfigs {
        create("jse") {
            storeFile = file("jse.keystore")
            storePassword = "jse-app-2026"
            keyAlias = "jse"
            keyPassword = "jse-app-2026"
        }
    }
    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("jse")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
