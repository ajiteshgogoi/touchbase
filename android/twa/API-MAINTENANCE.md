# Android TWA API Level Maintenance

## Current Status
- compileSdk: 35 (Android 15)
- targetSdk: 35 (Android 15)
- minSdk: 21 (Android 5.0)

## Recent Updates
- July 2025: Updated to target Android 15 (API 35) to meet Google Play requirements

## Upcoming Requirements
Google Play requires that apps target an API level that is within one year of the latest Android release.

- **Next Action Required**: Update target API level by August 31, 2025
- Update will be required once Android 15 is released and has been available for one year

## Update Process
1. When a new Android version is released:
   - Update `compileSdk` to the new API level
   - Update `targetSdk` to the new API level
   - Test the app thoroughly with the new API level
   - Update any deprecated APIs or behavior changes

2. Required changes typically include:
   - android/twa/app/build.gradle:
     ```gradle
     android {
         compileSdk [new-api-level]
         defaultConfig {
             targetSdk [new-api-level]
             // Other config remains unchanged
         }
     }
     ```

## Version History
- July 2025: Updated to Android 15 (API 35)
- Previous: Android 14 (API 34)
- Next update expected: When Android 16 becomes stable

## Important Links
- [Android API Levels Reference](https://developer.android.com/tools/releases/platforms)
- [Google Play Target API Requirements](https://developer.android.com/google/play/requirements/target-sdk)