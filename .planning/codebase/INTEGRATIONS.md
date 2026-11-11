# External Integrations

**Analysis Date:** 2026-11-11

## APIs & External Services

**Push Notifications & Remote Configuration (Firebase):**
- Firebase Cloud Messaging (FCM) Web & Native Push
  - Web SDK/Client: `firebase` (`firebase/app`, `firebase/messaging`) in `src/app/core/services/push-notification.service.ts` + compat Service Worker (`10.13.0` loaded from `https://www.gstatic.com/firebasejs/10.13.0/`) in `public/firebase-messaging-sw.js` + `public/manifest.json`
  - Android Native SDK/Client: `@capacitor/push-notifications` and `@capacitor/local-notifications` in `src/app/core/services/push-notification.service.ts`, wired with `com.google.gms.google-services` (`4.4.4`) in `android/build.gradle` and `android/app/build.gradle`
  - Hexagonal Notification Port/Adapter: `NOTIFICATION_PROVIDER` (`src/app/core/notifications/notification-provider.interface.ts`) bound in `src/app/app.config.ts` to `FcmNotificationAdapter` (`src/app/core/notifications/adapters/fcm-notification.adapter.ts`) targeting `/api/notify`
  - Backend Dispatch (`api/notify.js`, `api/cron-reminder.js`): Generates Google OAuth2 access tokens via RS256 JWT (`https://oauth2.googleapis.com/token`, scope `https://www.googleapis.com/auth/firebase.messaging`) and sends messages to FCM HTTP v1 (`https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`), with fallback to legacy endpoint (`https://fcm.googleapis.com/fcm/send`). Automatically deletes `UNREGISTERED` / `NOT_FOUND` / `INVALID_ARGUMENT` tokens from `fcm_tokens`
  - Auth Env Vars: `FIREBASE_SERVICE_ACCOUNT` / `FIREBASE_SERVICE_ACCOUNT_KEY` / `FIREBASE_ADMIN_CREDENTIALS` or (`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` + `FIREBASE_PROJECT_ID`), legacy `FIREBASE_SERVER_KEY` / `FCM_SERVER_KEY`, and client Web/VAPID config `FIREBASE_*` vars
- Firebase Remote Config
  - SDK/Client: `firebase/remote-config` (`getRemoteConfig`, `fetchAndActivate`, `getValue`) in `src/app/core/services/remote-config.service.ts`
  - Parameters fetched: `daily_reminder_morning_hour`, `daily_reminder_evening_hour`, `daily_reminder_hour`, `daily_reminder_message`, `daily_reminder_morning_message`, `daily_reminder_evening_message`, `tc_weekly_budget`, `budget_hogar`, `budget_alimentacion`, `budget_restaurantes`, `budget_transporte`, `budget_entretenimiento`, `alert_threshold_pct`, `enable_push_alerts` (1h cache in production, 0ms in dev; merges with Supabase `category_budgets` and `localStorage`)

**Exchange Rate / TRM APIs (USD -> COP):**
- Superintendencia Financiera de Colombia (Datos Abiertos Socrata API)
  - Endpoint: `https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciahasta%20DESC`
  - Client: Native `fetch` with 6-second `AbortController` timeout in `src/app/core/services/trm.service.ts` (`TrmService`), unauthenticated public endpoint
- ExchangeRate-API (Secondary Fallback)
  - Endpoint: `https://open.er-api.com/v6/latest/USD`
  - Client: Native `fetch` in `src/app/core/services/trm.service.ts`, unauthenticated public endpoint; falls back to `localStorage` (`expenses_home_trm_v2`) or `3155` constant

**Banking Alert Automation (Gmail & Google Apps Script):**
- Bancolombia Email Sync (`automation/bancolombia-sync/bancolombia-sync.gs`)
  - Triggers: Time-based Apps Script triggers (`syncBancolombiaEmails` every 5–60 min; `sendDailyReminder7pm` daily at 19:00 `America/Bogota`)
  - Reads Gmail messages from `notificacionesbancolombia.com` via `GmailApp.search`, parses COP amounts/merchants/card digits (`SHARED_TC_DIGITS`), writes via `UrlFetchApp.fetch` to Supabase REST API (`/rest/v1/expenses`, `/rest/v1/tc_expenses`, `/rest/v1/incomes`), and triggers `/api/notify` and `/api/cron-reminder`
  - Auth: Apps Script `PropertiesService` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PROCESSED_MESSAGE_IDS`)

## Data Storage

**Databases:**
- Supabase (Managed PostgreSQL)
  - Connection: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (frontend/scripts/GAS) and `SUPABASE_SERVICE_ROLE_KEY` (Vercel API endpoints in `api/*.js`)
  - Frontend Client: `@supabase/supabase-js` singleton in `src/app/core/services/supabase.service.ts` (uses in-memory proxy mock when `VITEST` or `NODE_ENV === 'test'`)
  - Maintenance Scripts: Node `https` REST client in `scripts/migrate-compartido.js` and `scripts/populate-dev.js` (enforces HTTPS + `*.supabase.co` SSRF allowlist)
  - Schema & Migrations (`supabase/*.sql`, consolidated in `supabase/fix_all_tables_rls_and_schemas.sql`):
    - `public.persons` - Household members (`Benny`, `Charlie`, `Compartido`)
    - `public.expenses` - Daily expenses with optional USD/TRM columns (`currency`, `amount_usd`, `exchange_rate`) (`src/app/features/gastos/data/expenses.service.ts`)
    - `public.incomes` - Income records (`src/app/features/ingresos/data/incomes.service.ts`)
    - `public.debts` - Loans and amortization metadata (`src/app/features/deudas/data/debts.service.ts`)
    - `public.tc_cards` - Credit card metadata (`src/app/features/tc-compartida/data/tc.service.ts`)
    - `public.tc_expenses` - Shared/credit card transactions with USD/TRM columns (`src/app/features/tc-compartida/data/tc.service.ts`, `src/app/features/gastos/data/expenses.service.ts`)
    - `public.projects` & `public.project_expenses` - Project budgets and expenses (`src/app/features/proyectos/data/projects.service.ts`)
    - `public.fixed_expenses` - Recurring monthly bills with `dia_limite_mes` and `dias_anticipacion_alerta` (`supabase/deploy_fixed_expenses.sql`, `supabase/add_due_alert_columns_to_fixed_expenses.sql`, `src/app/features/gastos-fijos/data/fixed-expenses.service.ts`)
    - `public.category_budgets` - Shared category budget limits plus cron deduplication markers (`__cron_fixed_expenses__`, `__cron_reminder_7pm__`) (`src/app/core/services/remote-config.service.ts`, `api/cron-reminder.js`)
    - `public.fcm_tokens` - Registered FCM device tokens (`src/app/core/services/push-notification.service.ts`, `api/fcm-token.js`, `api/notify.js`, `api/cron-reminder.js`)
    - `public.app_users` - Synced username/salted-SHA-256 credentials (`supabase/create_app_users.sql`, `src/app/core/services/auth-pin.service.ts`)
    - SQL View `public.v_monthly_summary` (`supabase/v_monthly_summary.sql`) - Server-side monthly aggregation queried by `src/app/features/resumen/data/resumen.service.ts`
  - Realtime (`postgres_changes`): Subscribed across `expenses`, `incomes`, `debts`, `tc_cards`, `tc_expenses`, `projects`, `project_expenses`, `fixed_expenses`, and `category_budgets`
  - Row Level Security (RLS): `supabase/fix_rls_for_automation.sql` and `supabase/fix_all_tables_rls_and_schemas.sql` enable permissive `FOR ALL TO anon, authenticated` policies (`app_access_*`) superseding earlier authenticated-only policies (`supabase/security_hardening_rls.sql`)

**File Storage:**
- None (no object/blob storage integration; static assets live in `public/`)

**Caching / Client Persistence:**
- Browser/WebView `localStorage` used as offline-tolerant cache and state store in `AuthPinService`, `RemoteConfigService`, `PushNotificationService`, `FixedExpensesService`, `DebtsService`, `ProjectsService`, `TcService`, `TrmService`, `NavigationService`, and `DailyReminderService`

## Authentication & Identity

**App Session & Biometrics:**
- Custom credential & biometric lock (`src/app/core/services/auth-pin.service.ts`, UI in `src/app/shared/ui/auth-login/auth-login.ts`, legacy keypad in `src/app/shared/ui/pin-lock/pin-lock.ts`)
  - Hashes passwords with Web Crypto `SHA-256` + per-user random salt, seeds default family profiles (`charlie`, `benny`, `admin`) locally, syncs new registrations to `public.app_users`, enforces 10-minute inactivity timeout (`INACTIVITY_TIMEOUT_MS`), and locks out for 30s after 5 failed attempts
  - Native biometric verification on Android via `@capgo/capacitor-native-biometric` (`NativeBiometric.isAvailable`, `NativeBiometric.verifyIdentity`)

**Supabase Auth & API Authorization:**
- `SupabaseAuthService` (`src/app/core/services/supabase-auth.service.ts`) wraps `supabase.client.auth` (`getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`) and is injected in `src/app/app.ts` for sign-out; `PushNotificationService.dispatchPushNotification` checks `getSession()` for a user JWT before falling back to `environment.supabaseAnonKey`
- Serverless endpoint auth: `api/notify.js` validates `Authorization: Bearer` against `NOTIFY_SECRET` / `CRON_SECRET`, `SUPABASE_ANON_KEY`, or `supabase.auth.getUser(token)`; `api/cron-reminder.js` validates against `CRON_SECRET` / `NOTIFY_SECRET` or `SUPABASE_ANON_KEY`; `api/fcm-token.js` has no Bearer token check

## Monitoring & Observability

**Error Tracking:**
- Global Angular browser error listener (`provideBrowserGlobalErrorListeners()` in `src/app/app.config.ts`); no external APM/Sentry SDK

**Logs:**
- Standard `console.log`/`console.warn`/`console.error` across frontend, Vercel functions, and CI scripts; Google Apps Script `Logger.log`; `pg_net` HTTP response log table `net._http_response` documented in `supabase/database_webhooks_notifications.sql`

## CI/CD & Deployment

**Hosting & Serverless Runtime:**
- Vercel (`vercel.json`): Hosts Angular SPA (`dist/expenses-home/browser`), exposes Node.js serverless endpoints (`/api/notify`, `/api/fcm-token`, `/api/cron-reminder`), runs daily Vercel Cron at `0 0 * * *` (`00:00 UTC` / `19:00 America/Bogota`), and enforces CSP allowing `https://*.supabase.co`, `wss://*.supabase.co`, `https://*.googleapis.com`, `https://*.firebaseio.com`, and `https://www.gstatic.com`

**GitHub Actions (`.github/workflows/`):**
- `.github/workflows/tests.yml`: Runs `npm run config:env` and `npm run test:ci` (Vitest) on `main`/`develop` push & PR
- `.github/workflows/scan.yml`: Runs `npm run lint` (ESLint + `eslint-plugin-security` SAST) and `npm run audit` (`continue-on-error: true`)
- `.github/workflows/deploy.yml`: Triggered via `workflow_run` on `main` only after both Tests and Scan workflows pass; builds production bundle and uploads `app-dist` artifact
- `.github/workflows/android-apk.yml`: Uses Temurin JDK 21, Android SDK 36 (`build-tools;36.0.0`), Node 22, injects `GOOGLE_SERVICES_JSON` (patched via `scripts/patch-google-services.js`), builds `FinanzasHogar-dev.apk` on `develop` and `FinanzasHogar-release.apk` on `main`, uploads APKs as artifacts
- `.github/workflows/reminders-cron.yml`: Scheduled daily at `0 0 * * *` (7:00 PM Colombia) invoking `https://finanzas-hogar-control-familiar.vercel.app/api/cron-reminder` via `curl` with `CRON_SECRET` or `SUPABASE_ANON_KEY`

**GitLab CI (`.gitlab-ci.yml`, `.gitlab/ci/`):**
- Parent-child pipeline orchestration: `.gitlab/ci/tests.gitlab-ci.yml` (`npm run test:ci`), `.gitlab/ci/scan.gitlab-ci.yml` (`npm run lint`, `npm run audit`), `.gitlab/ci/deploy.gitlab-ci.yml` (`npm run build` + `npx vercel --prod --yes` / `npx vercel --yes` when `VERCEL_TOKEN` is set), and `.gitlab/ci/android.gitlab-ci.yml` (`node:22` + `ghcr.io/cirruslabs/android-sdk:34` building dev/release APKs)

## Environment Configuration

**Required Env Var Names (Values Never Stored/Quoted):**
- Frontend Environment Generator (`scripts/set-env.js`): `APP_ENV`, `NODE_ENV`, `VERCEL_ENV`, `CI_COMMIT_BRANCH`, `GITHUB_REF_NAME`, `SUPABASE_URL`, `SUPABASE_URL_DEV`, `SUPABASE_URL_PROD`, `SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY_DEV`, `SUPABASE_ANON_KEY_PROD`, `APP_BASE_URL`, `APP_BASE_URL_DEV`, `APP_BASE_URL_PROD`, `FIREBASE_API_KEY`, `FIREBASE_API_KEY_DEV`, `FIREBASE_API_KEY_PROD`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_AUTH_DOMAIN_DEV`, `FIREBASE_AUTH_DOMAIN_PROD`, `FIREBASE_PROJECT_ID`, `FIREBASE_PROJECT_ID_DEV`, `FIREBASE_PROJECT_ID_PROD`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_STORAGE_BUCKET_DEV`, `FIREBASE_STORAGE_BUCKET_PROD`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_MESSAGING_SENDER_ID_DEV`, `FIREBASE_MESSAGING_SENDER_ID_PROD`, `FIREBASE_APP_ID`, `FIREBASE_APP_ID_DEV`, `FIREBASE_APP_ID_PROD`, `FIREBASE_MEASUREMENT_ID`, `FIREBASE_MEASUREMENT_ID_DEV`, `FIREBASE_MEASUREMENT_ID_PROD`, `FIREBASE_VAPID_KEY`, `FIREBASE_VAPID_KEY_DEV`, `FIREBASE_VAPID_KEY_PROD`
- Vercel Serverless API (`api/notify.js`, `api/fcm-token.js`, `api/cron-reminder.js`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_ADMIN_CREDENTIALS`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVER_KEY`, `FCM_SERVER_KEY`, `CRON_SECRET`, `NOTIFY_SECRET`, `NODE_ENV`
- Scripts & CI/CD & Android Signing (`scripts/*.js`, `.github/workflows/*.yml`, `.gitlab/ci/*.yml`, `android/app/build.gradle`): `DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`, `GOOGLE_SERVICES_JSON`, `GITHUB_RUN_NUMBER`, `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`, `VERCEL_TOKEN`, `PIPELINE_TARGET`, `TARGET_ENV`, `NG_CLI_ANALYTICS`, `CI`, `GRADLE_OPTS`

**Secrets & Generated Config Locations (Existence Only):**
- `.env` and `.env.example` exist in repository root (local secrets and template; contents not inspected)
- `config.json` and `remote_config.json` exist in repository root (Firebase/config artifacts; contents not inspected)
- `.npmrc` exists in repository root (contents not inspected)
- `src/environments/environment.ts` and `src/environments/environment.development.ts` are gitignored generated targets created at build/start/test time by `scripts/set-env.js`
- `android/app/google-services.json` is not present locally and is injected during CI builds via `GOOGLE_SERVICES_JSON` and patched by `scripts/patch-google-services.js`

## Webhooks & Callbacks

**Incoming (Vercel Serverless Endpoints):**
- `POST /api/notify` (`api/notify.js`) - Receives either direct notification payloads (from `PushNotificationService`, `FcmNotificationAdapter`, or Google Apps Script) or Supabase `pg_net` database webhook payloads (`type`, `table`, `record`, `old_record`) and dispatches FCM push messages
- `GET | POST | DELETE /api/fcm-token` (`api/fcm-token.js`) - Registers, counts, or removes device FCM tokens in `public.fcm_tokens`
- `GET | POST /api/cron-reminder` (`api/cron-reminder.js`) - Invoked daily at `00:00 UTC` (`19:00` Colombia) by Vercel Cron (`vercel.json`), GitHub Actions (`.github/workflows/reminders-cron.yml`), or Apps Script (`sendDailyReminder7pm`); enforces 18:45–20:15 `America/Bogota` window (unless `?force=true`), checks due `fixed_expenses` and missing daily `expenses`, and sends FCM reminders

**Outgoing (Database & External Callbacks):**
- Supabase Database Webhooks (`supabase/database_webhooks_notifications.sql`): PL/pgSQL trigger function `public.handle_expense_notify()` invokes `net.http_post` asynchronously on `AFTER INSERT OR DELETE` across `public.expenses`, `public.tc_expenses`, `public.incomes`, and `public.debts` to `https://finanzas-hogar-control-familiar.vercel.app/api/notify`

---

*Integration audit: 2026-11-11*
