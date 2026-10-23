# GymSphere Android App (Flutter)

Flutter client covering the same roles and flows as the web app: owner, trainer and member, with
the same design tokens (background F8F8F8, ink 2B2B2B, Montserrat, 22-radius cards, 6 percent
black card shadow).

## Permissions

Declared in `android/app/src/main/AndroidManifest.xml`:

- `android.permission.CAMERA` - scanning the daily check-in/check-out QR code.
- `android.permission.ACCESS_FINE_LOCATION` - verifying the member is within the gym radius.
- `android.permission.ACCESS_BACKGROUND_LOCATION` (optional) - only requested if the member turns
  on geofence auto check-out, with a dedicated explanation screen shown first.

## Running locally

```
flutter pub get
flutter run --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
            --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

## Building the release APK

```
flutter build apk --release \
  --dart-define=SUPABASE_URL=https://your-project-ref.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

The signed APK is produced at `build/app/outputs/flutter-apk/app-release.apk`.

## Screen priority implemented in this scaffold

1. Login (`lib/auth/login_screen.dart`)
2. Member home (`lib/member/member_home_screen.dart`)
3. Scanner check-in/check-out (`lib/member/scanner_screen.dart`)
4. Owner attendance QR display (`lib/owner/owner_attendance_screen.dart`)
5. Trainer attendance/home (`lib/trainer/trainer_home_screen.dart`)

Remaining screens (members list, analytics, settings, progress charts, etc.) follow the same
widgets, theme and API calls as the equivalent web pages in `src/pages`, and are straightforward
to add following this scaffold's patterns.
