# Technology Stack

**Analysis Date:** 2026-11-11

## Languages

**Primary:**
- TypeScript `~6.0.2` - Angular 22 standalone components, reactive Signal services, unit tests (`src/**/*.ts`), and Capacitor configuration (`capacitor.config.ts`)
- HTML5 / Angular Templates - Component views using Angular modern control flow (`@if`, `@for`, `@switch`) (`src/**/*.html`, `src/index.html`)
- CSS3 - Global design tokens, Chart.js tooltip styling, and component-scoped styles (`src/styles.css`, `src/**/*.css`)

**Secondary:**
- JavaScript (ESM & CommonJS) - Vercel serverless API endpoints (`api/notify.js`, `api/fcm-token.js`, `api/cron-reminder.js`), FCM Web Push service worker (`public/firebase-messaging-sw.js`), and build/maintenance scripts (`scripts/*.js`)
- SQL / PL/pgSQL - PostgreSQL DDL schemas, RLS policies, SQL views (`public.v_monthly_summary`), and `pg_net` database webhook triggers (`supabase/*.sql`)
- Java 21 - Native Android `BridgeActivity` subclass handling edge-to-edge system bar and cutout insets (`android/app/src/main/java/co/wearebdycr/expenseshome/MainActivity.java`)
- Groovy (Gradle DSL) - Android build, signing, and Capacitor plugin wiring (`android/build.gradle`, `android/app/build.gradle`, `android/variables.gradle`, `android/settings.gradle`)
- Google Apps Script (`.gs`) - Gmail-to-Supabase transaction parser and scheduled reminder trigger (`automation/bancolombia-sync/bancolombia-sync.gs`)
- Python 3 - Android adaptive icon and splash screen rasterization script (`scripts/generate-android-assets.py`)

## Runtime

**Environment:**
- Browser / PWA (ES2022 target) & Android WebView (`androidScheme: 'https'`)
- Node.js `v22` (CI target in `.github/workflows/*.yml` and `.gitlab/ci/*.yml`; `v24.15.0` observed locally) - Build toolchain, `scripts/*.js`, Vitest `jsdom` tests, and Vercel Serverless Functions (`api/*.js`)
- Java Temurin JDK 21 (`JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"` in `package.json`, `JavaVersion.VERSION_21` in `android/app/capacitor.build.gradle`; system default `17.0.10` observed locally)
- Android Runtime - `minSdkVersion 24` (Android 7.0), `compileSdkVersion 36`, `targetSdkVersion 36` (`android/variables.gradle`)
- Python `3.14.8` (observed locally) with external `magick` (ImageMagick) CLI for `scripts/generate-android-assets.py`

**Package Manager:**
- npm (`"packageManager": "npm@11.18.0"` declared in `package.json`; `11.12.1` observed locally)
- Lockfile: `package-lock.json` (present and used with `npm ci` in CI pipelines)
- Gradle Wrapper `8.14.3` (`android/gradle/wrapper/gradle-wrapper.properties`) for Android native dependencies

## Frameworks

**Core Frontend:**
- Angular `^22.2.1` (`@angular/core`, `@angular/common`, `@angular/compiler`, `@angular/forms`, `@angular/platform-browser`, `@angular/router`) - Standalone architecture, Signal-based state (`signal`, `computed`), `ChangeDetectionStrategy.OnPush`, `inject()` DI (`src/main.ts`, `src/app/app.config.ts`)
- Chart.js `^4.5.1` + `ng2-charts` `^10.0.0` - Interactive stacked bar, trend line, and doughnut charts (`provideCharts(withDefaultRegisterables())` in `src/app/app.config.ts`)
- RxJS `~7.8.0` - HTTP observable conversion (`firstValueFrom` in `src/app/core/notifications/adapters/fcm-notification.adapter.ts`)

**Backend & BaaS:**
- Supabase (`@supabase/supabase-js` `^2.117.2`) - Managed PostgreSQL database, Row Level Security (RLS), WebSocket Realtime (`postgres_changes`), Auth API, and `pg_net` database webhooks
- Vercel Serverless Functions (Node.js ESM handlers) - API endpoints under `api/` (`api/notify.js`, `api/fcm-token.js`, `api/cron-reminder.js`)

**Mobile / Native Android:**
- Capacitor `^8.5.2` (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`) - Native Android wrapper over `dist/expenses-home/browser` (`capacitor.config.ts`)
- AndroidX (`appcompat:1.7.1`, `coordinatorlayout:1.3.0`, `core-splashscreen:1.2.0`, `core:1.17.0`, `activity:1.11.0`, `fragment:1.8.9`, `webkit:1.14.0` in `android/variables.gradle`)

**Testing:**
- Vitest `^4.0.8` with `jsdom` `^28.0.0` - Unit and component testing executed through `@angular/build:unit-test` (`angular.json`, `tsconfig.spec.json`)
- Android Instrumentation/JVM Test Deps (scaffolded in `android/app/build.gradle`): JUnit `4.13.2`, AndroidX JUnit `1.3.0`, Espresso Core `3.7.0`

**Build & Quality Dev Tooling:**
- Angular CLI & Build `^22.2.1` (`@angular/cli`, `@angular/build`, `@angular/compiler-cli`) - Application builder (`@angular/build:application`) and dev server (`@angular/build:dev-server`)
- ESLint `^10.11.0` + `angular-eslint` `^22.5.0` + `typescript-eslint` `^8.71.0` + `eslint-plugin-security` `^4.2.0` - Flat config SAST & Angular accessibility/template linting (`eslint.config.mjs`)
- Prettier `^3.8.1` - Code formatting including Angular HTML templates (`.prettierrc`)
- Android Gradle Plugin `8.13.0` & Google Services Gradle Plugin `4.4.4` (`android/build.gradle`)

## Key Dependencies

**Critical Application Dependencies (`package.json`):**
- `@supabase/supabase-js` `^2.117.2` - Database queries, Realtime subscriptions, and session checks (`src/app/core/services/supabase.service.ts`, `api/*.js`)
- `firebase` `^12.19.0` - Modular Web SDK (`firebase/app`, `firebase/messaging`, `firebase/remote-config`) for Web Push tokens (`src/app/core/services/push-notification.service.ts`) and dynamic budgets/reminder settings (`src/app/core/services/remote-config.service.ts`)
- `chart.js` `^4.5.1` & `ng2-charts` `^10.0.0` - Financial charts across `gastos`, `ingresos`, `resumen`, `categoria`, and `deudas` features
- `@capacitor/push-notifications` `^8.1.3` & `@capacitor/local-notifications` `^8.3.1` - Native Android FCM registration and foreground/local alert scheduling (`src/app/core/services/push-notification.service.ts`)
- `@capgo/capacitor-native-biometric` `^8.8.0` - Native fingerprint/face authentication (`src/app/core/services/auth-pin.service.ts`)
- `@capacitor/app` `^8.1.2` - Hardware back button navigation (`src/app/core/services/navigation.service.ts`) and `appStateChange` lifecycle monitoring (`src/app/core/services/auth-pin.service.ts`)
- `@capacitor/haptics` `^8.0.2` - Tactile keypad feedback (`src/app/shared/ui/pin-lock/pin-lock.ts`)
- `@capacitor/splash-screen` `^8.0.2` & `@capacitor/status-bar` `^8.0.4` - Configured in `capacitor.config.ts` (auto-registered in `android/app/src/main/assets/capacitor.plugins.json`)
- `@angular/cdk` `^22.2.1` - Declared in `package.json` dependencies (no active imports observed in `src/`)
- `tslib` `^2.3.0` - TypeScript runtime helpers

**Build / Lint / Test DevDependencies (`package.json`):**
- `@angular/build` `^22.2.1`, `@angular/cli` `^22.2.1`, `@angular/compiler-cli` `^22.2.1`
- `@angular-eslint/builder` `^22.5.0`, `@angular-eslint/eslint-plugin` `^22.5.0`, `@angular-eslint/eslint-plugin-template` `^22.5.0`, `@angular-eslint/schematics` `^22.5.0`, `@angular-eslint/template-parser` `^22.5.0`, `angular-eslint` `^22.5.0`
- `eslint` `^10.11.0`, `eslint-plugin-security` `^4.2.0`, `typescript-eslint` `^8.71.0`, `prettier` `^3.8.1`
- `vitest` `^4.0.8`, `jsdom` `^28.0.0`, `typescript` `~6.0.2`

## Configuration

**Environment Generation (`scripts/set-env.js`):**
- Executed automatically via npm lifecycle hooks (`prestart`, `prebuild`, `pretest`, `pretest:ci`) or explicitly (`npm run config:env:dev`, `npm run config:env:prod`)
- Reads `.env` locally (never overriding CI `process.env` variables) and resolves `dev` vs `prod` via `--env=`, `APP_ENV`, Git branch (`main`/`release/*` -> prod, `develop`/`feature/*`/`fix/*` -> dev), `VERCEL_ENV`, or `NODE_ENV`
- Generates gitignored `src/environments/environment.ts` and `src/environments/environment.development.ts`

**TypeScript & Angular Build:**
- `tsconfig.json`: Strict compiler flags (`noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`, `experimentalDecorators`, `target: "ES2022"`, `module: "preserve"`) and Angular template strictness (`strictInjectionParameters`, `strictInputAccessModifiers`)
- `tsconfig.app.json`: Excludes `src/**/*.spec.ts`; `tsconfig.spec.json`: Enables `vitest/globals`
- `angular.json`: `@angular/build:application` outputting to `dist/expenses-home/browser`; production budgets (`initial` 1.5MB warn / 2.0MB error, `anyComponentStyle` 10kB warn / 15kB error), `inlineCritical: false`, `outputHashing: "all"`; `public/` mapped as static assets

**Linting & Formatting:**
- `eslint.config.mjs`: Enforces `app` camelCase directive and kebab-case component selectors, `pluginSecurity.configs.recommended` (with `security/detect-object-injection` disabled for dictionary indexing), Angular template accessibility rules, and relaxed `no-explicit-any`/`no-unused-vars` in `**/*.spec.ts`
- `.prettierrc`: `printWidth: 100`, `singleQuote: true`, Angular HTML parser override
- `.editorconfig`: UTF-8, 2-space indent, single quotes for `.ts`

**Mobile & Hosting Config:**
- `capacitor.config.ts`: `appId: 'co.wearebdycr.expenseshome'`, `appName: 'Finanzas Hogar'`, `webDir: 'dist/expenses-home/browser'`, `server.androidScheme: 'https'`, plugin configs for `SplashScreen`, `StatusBar` (`#0F172A`, `DARK`), `PushNotifications`, `LocalNotifications`
- `android/app/build.gradle`: `debug` build type appends `.dev` applicationIdSuffix (`co.wearebdycr.expenseshome.dev`) and `-dev` version suffix; `release` uses `RELEASE_STORE_FILE` properties or falls back to debug keystore; `versionCode` derives from `GITHUB_RUN_NUMBER` (default `2`); conditionally applies `com.google.gms.google-services` when `android/app/google-services.json` exists
- `android/app/src/main/AndroidManifest.xml`: Declares `INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`, `USE_BIOMETRIC`, and `USE_FINGERPRINT` permissions
- `vercel.json`: Sets `buildCommand: "npm run build"`, `outputDirectory: "dist/expenses-home/browser"`, `cleanUrls: true`, daily cron `/api/cron-reminder` (`0 0 * * *`), SPA rewrite for non-`/api/` routes, and HTTP security headers (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`)
- `.vscode/`: `extensions.json` (`angular.ng-template`), `launch.json`, and `tasks.json` for Chrome debugging on `localhost:4200`

## Platform Requirements

**Development:**
- Node.js 22+ and npm (`npm@11.18.0` target)
- Temurin JDK 21 and Android SDK (Platform 36, Build Tools 36.0.0) for local APK builds (`npm run apk:dev`, `npm run apk:prod`)
- Python 3 + ImageMagick (`magick`) only if regenerating launcher/splash assets via `scripts/generate-android-assets.py`
- `.env` (or CI env vars) providing Supabase and Firebase project configuration; optional `android/app/google-services.json` for native Android FCM

**Production:**
- Vercel (Edge CDN for Angular SPA + Node.js Serverless Functions in `api/` + Cron)
- Supabase PostgreSQL project (tables, `v_monthly_summary` view, Realtime publication, `pg_net` triggers)
- Firebase project (FCM HTTP v1 service account + Web Push VAPID + Remote Config)
- Android 7.0+ (`minSdkVersion 24`, targeting API 36) for native APK distribution

---

*Stack analysis: 2026-11-11*
