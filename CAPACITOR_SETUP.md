# Capacitor Android Setup Guide

This guide will help you convert your EduManage web app into a native Android app.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Java JDK 11 or higher** (for Android development)
3. **Android Studio** (for building APK)
4. **Android SDK** (installed via Android Studio)

## Step 1: Install Dependencies

Run the following command to install Capacitor and Android dependencies:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar
```

## Step 2: Initialize Capacitor

After installing dependencies, run:

```bash
npx cap init
```

When prompted:
- **App name**: EduManage
- **App ID**: com.edumanage.app (or your preferred package name)
- **Web dir**: dist

## Step 3: Add Android Platform

```bash
npx cap add android
```

## Step 4: Sync Your Web App

Build your app and sync with Capacitor:

```bash
npm run build
npx cap sync
```

## Step 5: Open in Android Studio

```bash
npx cap open android
```

This will open Android Studio with your Android project.

## Step 6: Build APK in Android Studio

1. In Android Studio, go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for the build to complete
3. The APK will be located at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Step 7: Generate Signed APK (For Production)

1. In Android Studio: **Build** → **Generate Signed Bundle / APK**
2. Select **APK**
3. Create or select a keystore
4. Fill in the keystore information
5. Select **release** build variant
6. The signed APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Quick Commands

- **Build and sync**: `npm run android:build`
- **Open Android Studio**: `npm run android:dev`
- **Sync only**: `npm run cap:sync`
- **Copy web assets**: `npm run cap:copy`

## Important Notes

1. **First time setup**: You may need to accept Android SDK licenses:
   ```bash
   cd android
   ./gradlew --version
   # Accept licenses when prompted
   ```

2. **Environment Variables**: Make sure your `.env` file has:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
   ```

3. **Permissions**: The app will request necessary permissions (internet, storage, etc.) automatically through Capacitor plugins.

4. **Testing**: You can test the app on an emulator or physical device through Android Studio.

## Troubleshooting

- If you get build errors, make sure Android SDK is properly installed
- If sync fails, try: `npx cap sync android --force`
- For Gradle issues, check that Java JDK 11+ is installed and JAVA_HOME is set
