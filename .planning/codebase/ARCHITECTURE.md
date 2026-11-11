<!-- refreshed: 2026-11-11 -->
# Architecture

**Analysis Date:** 2026-11-11

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                 Web Browser (PWA) / Android WebView (Capacitor 8)            │
│  `src/main.ts` -> `App` (`src/app/app.ts`) + `NavigationService` (Hash/State) │
│  Auth Gate: `AuthPinService` + `AuthLogin` (`@if (!authPinService.isUnlocked())`)│
├────────────────────┬─────────────────────────────┬───────────────────────────┤
│   Feature Pages    │    Feature Data Services    │    Shared UI & Utils      │
│  `src/app/features`│  Signals + LocalStorage     │  `src/app/shared/ui/*`    │
│  8 domain modules  │  + Optimistic Supabase CRUD │  `src/app/shared/utils/*` │
└─────────┬──────────┴──────────────┬──────────────┴─────────────┬─────────────┘
          │                         │                            │
          ▼                         ▼                            ▼
┌──────────────────────┐ ┌────────────────────────┐ ┌──────────────────────────┐
│   Core Services &    │ │  Ports & Adapters      │ │  External Client APIs    │
│   Platform Bridges   │ │  (Wave 2 Clean Slice)  │ │  - Firebase RemoteConfig │
│ - `SupabaseService`  │ │ - `NotificationProvider│ │  - Firebase Messaging SW │
│ - `SupabaseAuthSvc`  │ │   (`NOTIFICATION_PROV`)│ │  - `TrmService`          │
│ - `PushNotification` │ │ - `FcmNotificationAdp` │ │    (datos.gov.co /       │
│ - `DailyReminderSvc` │ │ - `FixedExpenseAlerts` │ │     open.er-api.com)     │
└─────────┬────────────┴────────────┬─────────────┴─────────────┬──────────────┘
          │                         │                           │
          ▼                         ▼                           ▼
┌──────────────────────┐ ┌────────────────────────┐ ┌──────────────────────────┐
│  Supabase PostgreSQL │ │ Vercel Serverless ESM  │ │  External Automation     │
│ - 10 public tables   │ │ - `api/notify.js`      │ │ - Google Apps Script     │
│ - `v_monthly_summary`│ │ - `api/fcm-token.js`   │ │   `automation/           │
│ - Realtime WebSocket │ │ - `api/cron-reminder.js│ │   bancolombia-sync/`      │
│ - `pg_net` triggers  │◄┴───(CRON 0 0 * * * UTC)─┴─┤ - GitHub Actions Cron    │
└──────────┬───────────┘                            └──────────────────────────┘
           │ DB Trigger (`tr_notify_on_*` via `pg_net`)
           └──────────────────────────────────────► `POST /api/notify` -> FCM v1
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| SDD Governance Triad | Architectural baseline, phased Wave roadmap, and completed change audit trail | `CONTEXT.md`, `PLAN.md`, `SUMMARY.md`, `.antigravity/rules.md` |
| Root Shell (`App`) | Auth gate (`AuthPinService`), page `@switch` rendering, quick fixed-expense modal, hardware back-button hookup | `src/app/app.ts`, `src/app/app.html` |
| Application Config | Bootstraps HTTP client, Charts, empty Router, and binds `NOTIFICATION_PROVIDER` to `FcmNotificationAdapter` | `src/app/app.config.ts` |
| Navigation & Back-Button | Signal-based active page (`currentPage`), URL hash & `localStorage` sync, Capacitor `backButton` priority stack | `src/app/core/services/navigation.service.ts` |
| Device Auth & Biometrics | Salted SHA-256 user login, 10-min inactivity TTL, 5-attempt lockout, Capacitor biometric verification, legacy PIN | `src/app/core/services/auth-pin.service.ts` |
| Supabase Client & Auth | Singleton `SupabaseClient` with automatic Vitest mock proxy; optional JWT session wrapper | `src/app/core/services/supabase.service.ts`, `src/app/core/services/supabase-auth.service.ts` |
| Notification Port & Adapter | Hexagonal outbound port (`NotificationProvider`) and `/api/notify` HTTP adapter (`FcmNotificationAdapter`) | `src/app/core/notifications/notification-provider.interface.ts`, `src/app/core/notifications/adapters/fcm-notification.adapter.ts` |
| Legacy Push & Remote Config | Direct FCM Web/Capacitor registration, foreground toast/system alerts, budget thresholds, Firebase Remote Config | `src/app/core/services/push-notification.service.ts`, `src/app/core/services/remote-config.service.ts` |
| Feature Domain Modules (8) | Vertical UI + Signal state + Supabase Realtime CRUD for expenses, incomes, summary, categories, fixed expenses, debts, shared credit cards, and projects | `src/app/features/*/` |
| Pure Financial/Date Calculators | Deterministic due-date clamping math, FIFO credit card amortization, French debt amortization | `src/app/features/gastos-fijos/utils/due-date-calculator.ts`, `src/app/features/tc-compartida/data/tc.service.ts`, `src/app/features/deudas/data/debt.model.ts` |
| Vercel Serverless API | FCM v1 JWT OAuth2 push dispatcher, DB webhook consumer, FCM token upsert, 7 PM Colombia fixed-expense & reminder cron | `api/notify.js`, `api/fcm-token.js`, `api/cron-reminder.js` |
| Native Android Bridge | Capacitor `BridgeActivity` computing system bar / cutout CSS safe-area variables (`--safe-area-top`, `--safe-area-bottom`) | `android/app/src/main/java/co/wearebdycr/expenseshome/MainActivity.java` |
| Build & Env Injector | Reads `.env` or CI env vars/git branch to emit `environment.ts` and `environment.development.ts` pre-build/test | `scripts/set-env.js` |

## Pattern Overview

**Overall:** Hybrid **Feature-First Angular 22 Standalone SPA** (Signal-driven, local-first + Supabase Realtime) undergoing incremental refactoring into **Clean Architecture / Ports & Adapters** via an **Agentic SDD (Spec-Driven Development)** workflow.

**Key Characteristics:**
- **SDD Lifecycle Control (`.antigravity/rules.md`):** Features and refactors progress through `PASO 0`–`PASO 4` across `CONTEXT.md` (baseline rules, invariants, No-Touch Zones), `PLAN.md` (Waves 0–2 decomposed into Phases A: Contracts, B: Pure Core + TDD, C: Adapters/Orchestrators, D: UI/Cron integration), and `SUMMARY.md` (completed task logs and test/lint verification records).
- **Two Architectural Generations Coexisting:**
  - *Original Feature Services* (`ExpensesService`, `TcService`, `DebtsService`, `ProjectsService`, `FixedExpensesService`) directly inject `SupabaseService`, `PushNotificationService`, and `ToastService` inside `providedIn: 'root'` singletons.
  - *Wave 1 & Wave 2 Modularized Slices* (`NavigationService`, `calcularVencimientoGastoFijo`, `NotificationProvider`, `FcmNotificationAdapter`, `FixedExpenseAlertsService`) enforce pure functions, explicit contracts/type-guards, zero `any`, and dependency inversion via Angular `InjectionToken`.
- **Local-First Optimistic State + Cloud Realtime:** Feature services hydrate immediately from `localStorage` (when cached), render via `signal()`/`computed()`, write optimistically, reconcile against Supabase PostgreSQL, and listen to `postgres_changes` Realtime channels while guarding against self-echo via `lastLocalMutationTime`.
- **Multi-Runtime Execution:** One Angular codebase powers both the Vercel-hosted Web PWA (`vercel.json`) and the Capacitor 8 Android APK (`capacitor.config.ts`), supported by Node.js ESM serverless functions (`api/`), PostgreSQL triggers (`supabase/`), and a standalone Google Apps Script bank email parser (`automation/bancolombia-sync/bancolombia-sync.gs`).

## Layers

**Pure Domain & Contracts Layer:**
- Purpose: Defines immutable TypeScript domain entities, type guards, and deterministic side-effect-free financial/calendar calculations.
- Location: `src/app/features/*/data/*.model.ts`, `src/app/features/gastos-fijos/utils/due-date-calculator.ts`, `calculateAmortizedPendingDebt` in `src/app/features/tc-compartida/data/tc.service.ts`
- Contains: Interfaces (`Expense`, `TcExpense`, `Debt`, `Project`, `FixedExpense`, `GastoFijoAlerta`, `ResultadoCalculoVencimiento`), type guards (`isValidDiaLimiteMes`, `isGastoFijoAlerta`, `isValidSidebarPage`), pure calculators (`calcularVencimientoGastoFijo`, `calculateAmortization`, `calculateMonthlyPayment`, `calculateAmortizedPendingDebt`).
- Depends on: Pure TypeScript standard library (and occasionally cross-feature model types like `ExpensePerson` from `src/app/features/gastos/data/expense.model.ts`, or `NotificationPayload` in `fixed-expense.model.ts`).
- Used by: Feature services, UI components, and tests.

**Outbound Ports Layer:**
- Purpose: Declares abstract infrastructure boundaries decoupled from Firebase, Capacitor, or HTTP SDKs.
- Location: `src/app/core/notifications/notification-provider.interface.ts`
- Contains: `NotificationPayload`, `NotificationResult`, `NotificationProvider`, and `NOTIFICATION_PROVIDER` (`InjectionToken<NotificationProvider>`).
- Depends on: `@angular/core` (`InjectionToken` only).
- Used by: `FixedExpenseAlertsService`, `FcmNotificationAdapter`, `src/app/app.config.ts`, and `MockNotificationProvider` in unit tests.

**Infrastructure & Platform Adapters Layer:**
- Purpose: Implements concrete communication with Supabase, Firebase, REST APIs, external TRM endpoints, and Capacitor native device bridges.
- Location: `src/app/core/notifications/adapters/fcm-notification.adapter.ts`, `src/app/core/services/supabase.service.ts`, `src/app/core/services/remote-config.service.ts`, `src/app/core/services/trm.service.ts`, `android/app/src/main/java/co/wearebdycr/expenseshome/MainActivity.java`
- Contains: `FcmNotificationAdapter` (HTTP POST to `/api/notify` or `${environment.apiUrl}/api/notify` on Capacitor), `SupabaseService` (creates `SupabaseClient` or test proxy), `RemoteConfigService` (Firebase Remote Config + `category_budgets` Supabase table + `localStorage`), `TrmService` (`datos.gov.co` -> `open.er-api.com` -> cached fallback).
- Depends on: `@supabase/supabase-js`, `firebase/*`, `@capacitor/core`, `@angular/common/http`, `src/environments/environment.ts`.
- Used by: Core orchestration services, feature services, and `app.config.ts`.

**Core Cross-Cutting Services Layer:**
- Purpose: Provides app-wide singletons for authentication/PIN lock, navigation state, toast feedback, daily client reminders, and legacy push notifications.
- Location: `src/app/core/services/*.ts` (`auth-pin.service.ts`, `supabase-auth.service.ts`, `navigation.service.ts`, `push-notification.service.ts`, `daily-reminder.service.ts`, `toast.service.ts`)
- Contains: Signal-based singletons (`AuthPinService`, `SupabaseAuthService`, `NavigationService`, `PushNotificationService`, `DailyReminderService`, `ToastService`).
- Depends on: Infrastructure adapters, Capacitor plugins (`@capacitor/app`, `@capacitor/push-notifications`, `@capacitor/local-notifications`, `@capgo/capacitor-native-biometric`), and (in legacy violations) certain feature models/services.
- Used by: `App` (`src/app/app.ts`), `Shared UI`, and feature services/components.

**Feature Application Services Layer:**
- Purpose: Manages reactive domain state, `localStorage` persistence, Supabase table queries/mutations, Realtime subscriptions, and cross-domain business workflows.
- Location: `src/app/features/*/data/*.service.ts`
- Contains: `ExpensesService`, `IncomesService`, `ResumenService`, `CategoriaService`, `FixedExpensesService`, `FixedExpenseAlertsService`, `DebtsService`, `TcService`, `ProjectsService`.
- Depends on: Core services (`SupabaseService`, `ToastService`, `PushNotificationService`, `RemoteConfigService`, `TrmService`), `NOTIFICATION_PROVIDER` (for `FixedExpenseAlertsService`), and cross-feature services (notably `ExpensesService` and `TcService`).
- Used by: Feature page components, modals, charts, and tables.

**Presentation / UI Layer:**
- Purpose: Renders responsive desktop/mobile interfaces using Angular 22 standalone components with `ChangeDetectionStrategy.OnPush`, Signals, and native control flow (`@if`, `@for`, `@switch`).
- Location: `src/app/app.ts`, `src/app/app.html`, `src/app/features/*/*.ts`, `src/app/features/*/components/*`, `src/app/shared/ui/*`, `src/app/shared/utils/*`
- Contains: Root `App` shell, 8 page components (`GastosPage`, `IngresosPage`, `ResumenPage`, `CategoriaPage`, `GastosFijosPage`, `DeudasPage`, `TcPage`, `ProyectosPage`), feature modals/filters/charts/tables, shared primitives (`Sidebar`, `AuthLogin`, `DailyReminderBanner`, `Modal`, `Select`, `Badge`, `Icon`, `ToastContainer`, plus unused `PinLock` and `SplashScreen`).
- Depends on: Feature services, Core services, `ng2-charts` / `chart.js`, `@capacitor/haptics`, `src/styles.css` design tokens.
- Used by: End users on Web PWA and Android Capacitor WebView.

**Serverless API & Automation Layer:**
- Purpose: Handles privileged server-side operations (Google OAuth2 JWT signing for FCM v1, token registry, daily scheduled cron checks, and Gmail bank-alert ingestion).
- Location: `api/*.js`, `public/firebase-messaging-sw.js`, `automation/bancolombia-sync/bancolombia-sync.gs`
- Contains: Vercel ESM handlers (`api/notify.js`, `api/fcm-token.js`, `api/cron-reminder.js`), FCM Web Push Service Worker (`public/firebase-messaging-sw.js`), Google Apps Script Gmail scanner (`bancolombia-sync.gs`).
- Depends on: `@supabase/supabase-js`, Node `crypto`, Google OAuth2/FCM v1 HTTP APIs, GmailApp/UrlFetchApp (GAS).
- Used by: Client app (`FcmNotificationAdapter`, `PushNotificationService`), Supabase `pg_net` database triggers, GitHub Actions `.github/workflows/reminders-cron.yml`, and Vercel Cron.

**Database & Reactive Trigger Layer:**
- Purpose: Stores household financial records, serves SQL-aggregated monthly summaries, enforces RLS policies, broadcasts Realtime changes, and triggers server webhooks on writes.
- Location: `supabase/*.sql`
- Contains: Tables (`persons`, `incomes`, `expenses`, `fixed_expenses`, `debts`, `tc_cards`, `tc_expenses`, `projects`, `project_expenses`, `category_budgets`, `fcm_tokens`, `app_users`), view (`public.v_monthly_summary`), trigger function `public.handle_expense_notify()` using `pg_net`.
- Depends on: Supabase PostgreSQL 15+, `pg_net` extension, `supabase_realtime` publication.
- Used by: Angular client (`SupabaseService`), Vercel functions (`api/*`), and Google Apps Script (`bancolombia-sync.gs`).

## Data Flow

### Primary Expense Mutation & Cross-Device Sync Path

1. User submits the unified modal `ExpenseFormModal` (`src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts`), choosing destination `'cuenta'` (normal expense), `'tc'` (shared credit card), `'deuda'` (debt payment), or `'proyecto'` (project expense), optionally converting `USD` via `TrmService.convertUsdToCop()`.
2. `GastosPage.onSave()` (`src/app/features/gastos/gastos.ts:54-62`) or modal dispatch calls the target feature service (`ExpensesService.addExpense()`, `TcService`, `DebtsService`, or `ProjectsService`).
3. `ExpensesService.addExpense()` (`src/app/features/gastos/data/expenses.service.ts:268`) inserts an optimistic `Expense` into the `expenses` signal immediately, updates `lastLocalMutationTime`, and executes `supabase.client.from('expenses').insert(...)`.
4. PostgreSQL persists the row in `public.expenses`, triggering two parallel asynchronous side effects:
   - **Realtime Sync:** `supabase_realtime` broadcasts `postgres_changes` to connected devices; each feature service's `setupRealtime()` refreshes signals if outside its local mutation cooldown.
   - **Server-Side Push (`supabase/database_webhooks_notifications.sql:26-69`):** Trigger `tr_notify_on_expense` invokes `public.handle_expense_notify()`, which fires `net.http_post` (`pg_net`) to `POST https://finanzas-hogar-control-familiar.vercel.app/api/notify`.
5. `api/notify.js` parses the Supabase webhook (`record` / `old_record`), loads device tokens from `public.fcm_tokens`, mints an RS256 Google OAuth2 token from `FIREBASE_SERVICE_ACCOUNT`, dispatches FCM v1 messages, and deletes `UNREGISTERED`/`NOT_FOUND` tokens.
6. Client receives push via `PushNotifications` listener (`PushNotificationService.initNative` on Android) or `public/firebase-messaging-sw.js` (`onBackgroundMessage` / `onMessage` on Web).

### Fixed-Expense Due Alert Flow (Wave 2 Dual Client + Cron)

1. **Pure Domain Evaluation:** Both `FixedExpensesService.monthlyStatuses` (`src/app/features/gastos-fijos/data/fixed-expenses.service.ts:101`) and `FixedExpenseAlertsService.evaluarAlertas` (`src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts:65`) pass each active unpaid `FixedExpense` into `calcularVencimientoGastoFijo()` (`src/app/features/gastos-fijos/utils/due-date-calculator.ts:77`), which normalizes calendar dates to UTC noon (`12:00:00Z`) and clamps `dia_limite_mes` to the last day of the month.
2. **Client Hexagonal Dispatch:** `FixedExpenseAlertsService.evaluarYDespacharAlertas()` filters unpaid active items where `calculo.requiereNotificacion === true` and calls the injected `NOTIFICATION_PROVIDER` (`FcmNotificationAdapter` configured in `src/app/app.config.ts:16`), which POSTs to `/api/notify`.
3. **Server Scheduled Cron:** `.github/workflows/reminders-cron.yml` (`0 0 * * *` UTC = 7:00 PM `America/Bogota`) and Vercel Cron (`vercel.json`) invoke `GET /api/cron-reminder` (`api/cron-reminder.js`).
4. `api/cron-reminder.js` validates Bearer authorization (`CRON_SECRET` / `SUPABASE_ANON_KEY`), enforces the 18:45–20:15 Colombia evening window (unless `?force=true`), deduplicates daily runs via sentinel keys `__cron_fixed_expenses__` and `__cron_reminder_7pm__` stored in `public.category_budgets`, checks `public.fixed_expenses` vs `public.expenses`, and dispatches FCM v1 notifications with deep links (`/#gastos-fijos` or `/#gastos`).

### Auth, Routing & Hardware Back-Button Flow

```text
[Window Load / Capacitor Launch]
        │
        ▼
  `App` (`src/app/app.ts`)
  checks `authPinService.isUnlocked()` (`src/app/app.html:1`)
        ├── false ──► renders `<app-auth-login>` (`src/app/shared/ui/auth-login/auth-login.ts`)
        │             - On native Android, auto-prompts `NativeBiometric.verifyIdentity()`
        │             - Or validates salted SHA-256 against `localStorage` (`expenses_home_security_users_v2`)
        │               (seeded defaults: charlie, benny, admin; sign-up also inserts into `public.app_users`)
        │             - Grants 10-min sliding session (`INACTIVITY_TIMEOUT_MS`); 5 fails -> 30s lockout
        │
        └── true  ──► renders `.app-shell` (`<app-sidebar>`, `<app-daily-reminder-banner>`, `@switch (currentPage())`)
                      - `NavigationService` (`src/app/core/services/navigation.service.ts`) resolves initial page:
                        `window.location.hash` -> `localStorage['expenses_home_active_page']` -> `'gastos'`
                      - Hardware Back Button (`CapApp.addListener('backButton')`) priority order:
                        1. Close `.change-pin-modal` if locked, else `exitApp()`
                        2. Execute custom modal closer (e.g. `showFixedExpensesQuickModal`)
                        3. Click `.modal-backdrop .modal-close` / `.btn-cancel`
                        4. Close mobile `.sidebar.is-open`
                        5. Navigate back to `'gastos'` if on another tab
                        6. `CapApp.exitApp()`
```

- **Important Routing Reality:** `src/app/app.routes.ts` exports `routes: Routes = []` and `app.config.ts` registers `provideRouter(routes)`, but `src/app/app.html` uses **no `<router-outlet>`** and **no Angular Router guards (`CanActivateFn`)**. View switching is exclusively controlled by `NavigationService.currentPage` and `@switch (currentPage())`.
- **Supabase Auth vs Open RLS:** `SupabaseAuthService` (`src/app/core/services/supabase-auth.service.ts`) is injected in `App` (and invoked by `onSignOutSupabase()`), yet `app.html` does not block UI rendering on `supabaseAuth.isAuthenticated()`. Because `supabase/fix_rls_for_automation.sql` configures `FOR ALL TO anon, authenticated USING (true)` on business tables so Google Apps Script (`bancolombia-sync.gs`) and unlocked devices can read/write with `supabaseAnonKey`, Supabase queries execute under the `anon` role unless a user explicitly signs into Supabase Auth.

### External Bancolombia Sync & Environment Build Flow

1. **Build-Time Environment Generation:** `npm start`, `npm run build`, and `npm test` all trigger `pre*` hooks in `package.json` executing `node scripts/set-env.js`. It reads `.env` (locally) or CI secrets/branch (`main` -> `prod`, `develop` -> `dev`), then writes gitignored `src/environments/environment.ts` and `src/environments/environment.development.ts`.
2. **External Gmail Ingestion (`automation/bancolombia-sync/bancolombia-sync.gs`):** Runs on a Google Apps Script time trigger (`TRIGGER_EVERY_MINUTES = 10`), scans Gmail messages from `notificacionesbancolombia.com`, classifies merchants against `CATEGORY_KEYWORDS`, routes shared card digits (`SHARED_TC_DIGITS`) to `public.tc_expenses` and personal/debit/PSE/transfers to `public.expenses` (or `public.incomes`), and triggers Supabase Realtime + `pg_net` push alerts automatically.

**State Management:**
- **No external store (NgRx/Ngxs):** All reactive state resides in `providedIn: 'root'` services using Angular `signal()`, `computed()`, and `effect()`, exposed via `.asReadonly()` where encapsulated.
- **RxJS usage is minimal:** Used only by Angular `HttpClient` + `firstValueFrom()` in `FcmNotificationAdapter` (`src/app/core/notifications/adapters/fcm-notification.adapter.ts:3,72`) and internal router/chart APIs.
- **Persistence Keys in `localStorage`:** Active page (`expenses_home_active_page`), security session/users (`expenses_home_security_session_v2`, `expenses_home_security_users_v2`, `expenses_home_biometric_enrolled_v2`, `expenses_home_login_failed_v2`), fixed expenses (`expenses_home_fixed_expenses_v1`), debts (`expenses_home_debts_v2`), TC cards & expenses (`expenses_home_tc_cards_v1`, `expenses_home_tc_v1`), projects (`expenses_home_projects_v1`, `expenses_home_project_expenses_v1`), custom budgets (`expenses_home_category_budgets_v1`), TRM cache (`expenses_home_trm_v2`), FCM token (`fcm_device_token`), and daily reminder dismissal (`last_daily_reminder_dismissed`).

## Key Abstractions

**`NotificationProvider` & `NOTIFICATION_PROVIDER`:**
- Purpose: Decouples alert orchestration from specific transport SDKs (FCM HTTP backend, Web Push, or in-memory test mocks).
- Examples: `src/app/core/notifications/notification-provider.interface.ts`, `src/app/core/notifications/adapters/fcm-notification.adapter.ts`, `src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts`
- Pattern: Hexagonal Outbound Port + Angular `InjectionToken` (`{ provide: NOTIFICATION_PROVIDER, useExisting: FcmNotificationAdapter }` in `src/app/app.config.ts`).

**`INavigationService` & `isValidSidebarPage`:**
- Purpose: Encapsulates hash-based navigation, `localStorage` persistence, and Capacitor Android hardware back-button resolution behind a strongly typed contract.
- Examples: `src/app/core/services/navigation.service.ts`
- Pattern: Reactive Signal Service + Type Guard (`isValidSidebarPage`) + Discriminated Union (`BackButtonActionResult`).

**`SupabaseService` Test-Safe Client Wrapper:**
- Purpose: Provides a single `SupabaseClient` instance across all data services while transparently intercepting Vitest runs (`VITEST` / `NODE_ENV === 'test'`) with a recursive JS `Proxy` mock so unit tests never perform real network I/O.
- Examples: `src/app/core/services/supabase.service.ts`
- Pattern: Singleton Factory + Environment-aware Mock Proxy.

**Pure Financial & Temporal Engines:**
- Purpose: Isolate error-prone date clamping and amortization mathematics into deterministic, testable functions.
- Examples: `calcularVencimientoGastoFijo` (`src/app/features/gastos-fijos/utils/due-date-calculator.ts`), `calculateAmortizedPendingDebt` (`src/app/features/tc-compartida/data/tc.service.ts`), `calculateAmortization` / `calculateMonthlyPayment` (`src/app/features/deudas/data/debt.model.ts`).
- Pattern: Pure functional domain kernels returning immutable (`Object.freeze`) or fresh result objects.

## Entry Points

**Angular Web / PWA Entry:**
- Location: `src/index.html`, `src/main.ts`, `src/app/app.config.ts`, `src/app/app.ts`
- Triggers: Browser load or Capacitor WebView load of `dist/expenses-home/browser/index.html`
- Responsibilities: Bootstraps `App` via `bootstrapApplication(App, appConfig)`, registers providers (`provideHttpClient`, `provideCharts`, `NOTIFICATION_PROVIDER`), enforces auth gate, mounts shell.

**Web Push Service Worker:**
- Location: `public/firebase-messaging-sw.js`
- Triggers: Registered by `PushNotificationService.initWeb()` (`src/app/core/services/push-notification.service.ts:225`) with Firebase config query params / `postMessage`
- Responsibilities: Handles background FCM messages (`onBackgroundMessage`) and notification click routing (`/#gastos`, `/#categoria`, `/#gastos-fijos`).

**Vercel Serverless Endpoints & Cron:**
- Location: `api/notify.js`, `api/fcm-token.js`, `api/cron-reminder.js` (configured by `vercel.json`)
- Triggers: Client HTTP (`FcmNotificationAdapter`, `PushNotificationService`), Supabase `pg_net` triggers (`tr_notify_on_*`), Vercel Cron (`0 0 * * *`), GitHub Actions (`.github/workflows/reminders-cron.yml`)
- Responsibilities: Registers/cleans `fcm_tokens`, signs Google OAuth2 JWTs for FCM v1, evaluates unpaid fixed expenses and daily missing entries at 7:00 PM Colombia time.

**Android Native Entry (Capacitor 8):**
- Location: `capacitor.config.ts`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/co/wearebdycr/expenseshome/MainActivity.java`
- Triggers: Android OS launcher intent (`MAIN`/`LAUNCHER`, `singleTask`)
- Responsibilities: Extends `BridgeActivity`, enables edge-to-edge layout (`WindowCompat.setDecorFitsSystemWindows(false)`), measures system bars/display cutouts, and injects `--safe-area-top` / `--safe-area-bottom` CSS properties into the WebView.

**Google Apps Script Bank Sync:**
- Location: `automation/bancolombia-sync/bancolombia-sync.gs`
- Triggers: Time-based GAS trigger created by `installTrigger()`
- Responsibilities: Polls Gmail Bancolombia alert emails and inserts parsed transactions into Supabase `expenses`, `tc_expenses`, and `incomes`.

**DevOps & Database Bootstrap Scripts:**
- Location: `scripts/set-env.js`, `scripts/patch-google-services.js`, `supabase/schema.sql`, `supabase/fix_all_tables_rls_and_schemas.sql`, `supabase/database_webhooks_notifications.sql`
- Triggers: npm `prestart`/`prebuild`/`pretest` hooks, CI workflows (`.github/workflows/`, `.gitlab/ci/`), manual Supabase SQL Editor runs
- Responsibilities: Environment file generation, Android flavor patching, schema/RLS/trigger setup.

## Architectural Constraints

- **Threading & Execution Context:** Single-threaded Angular Zone/Signal execution in browser/WebView; background Web Push runs in an isolated Service Worker (`public/firebase-messaging-sw.js`) without DOM or `localStorage` access.
- **Global Mutable Singleton State:** All core and feature services use `@Injectable({ providedIn: 'root' })` with constructor side effects (`loadExpenses()`, `setupRealtime()`, `initAuth()`, `initRemoteConfig()`, `refreshTrm()`, `startSessionExpiryMonitor()`) and shared `localStorage` keys.
- **Cross-Feature Coupling & Circular Risks:** `ExpensesService`, `TcService`, `DebtsService`, `FixedExpensesService`, and `ProjectsService` form a tight dependency graph around `ExpensesService` (`DebtsService` -> `TcService` + `ExpensesService`; `ProjectsService` -> `TcService` + `ExpensesService`; `TcService` -> `ExpensesService`; `FixedExpensesService` -> `ExpensesService`). Adding an import from `ExpensesService` back to any of those services will create a circular DI error.
- **SDD Governance Limits (`.antigravity/rules.md`, `CONTEXT.md`):** Strict TypeScript (`noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `strict` in `tsconfig.app.json`) forbids `any` in new code; `CONTEXT.md` designates `tc.service.ts` (1,112 lines), `push-notification.service.ts` (919 lines), `expense-form-modal.ts` (795 lines), `projects.service.ts` (786 lines), `debts.service.ts` (641 lines), `auth-pin.service.ts` (636 lines), and `scripts/set-env.js` (131 lines) as protected zones requiring regression tests before modification.
- **Build-Time Credential Baking:** Client builds embed `supabaseUrl`, `supabaseAnonKey`, and `firebase` keys into `src/environments/environment.ts` via `scripts/set-env.js` before bundling; native Capacitor builds require `environment.apiUrl` for `/api/*` calls.

## Anti-Patterns

### Core Service Importing Feature Models (Inverse Dependency)

**What happens:** `PushNotificationService` (`src/app/core/services/push-notification.service.ts:13-17`) imports domain types and `formatCOP` directly from five feature modules (`gastos`, `tc-compartida`, `ingresos`, `deudas`, `categoria`).
**Why it's wrong:** Violates dependency direction (`core` must never depend on `features`), couples core push mechanics to every feature schema change, and makes `PushNotificationService` a 919-line monolith.
**Do this instead:** Use the Wave 2 hexagonal contract in `src/app/core/notifications/notification-provider.interface.ts` (`NOTIFICATION_PROVIDER` + `NotificationPayload`) and compose feature-specific payloads inside feature orchestrators like `FixedExpenseAlertsService` (`src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts`).

### Cross-Feature God Modal (`ExpenseFormModal`)

**What happens:** `ExpenseFormModal` (`src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts:48-55`) spans 795 lines and injects 6 services across 5 domains (`DebtsService`, `TcService`, `ExpensesService`, `ProjectsService`, `FixedExpensesService`, `TrmService`).
**Why it's wrong:** Concentrates multi-domain routing, TRM currency math, credit-card selection, debt installment logic, and project linking inside a single UI modal component.
**Do this instead:** Keep modals focused on form inputs/validation and delegate cross-domain submission orchestration to dedicated application facades or specialized sub-components per payment destination.

### Core & Shared UI Importing Feature Services

**What happens:** `NavigationService` (`src/app/core/services/navigation.service.ts:9,77`) injects `TcService`, `DailyReminderService` (`src/app/core/services/daily-reminder.service.ts:2,24`) injects `ExpensesService`, and `DailyReminderBanner` (`src/app/shared/ui/daily-reminder-banner/daily-reminder-banner.ts:8,20`) injects `ExpensesService`.
**Why it's wrong:** Ties reusable `core/` and `shared/ui/` primitives directly to feature-level Supabase services, creating hidden instantiation side effects and coupling shared components to `ExpensesService` state.
**Do this instead:** Expose lightweight state/event tokens in `core/` (e.g., a navigation hook or expense-activity signal/callback) or pass signals/outputs from `App` down into `DailyReminderBanner`.

### Duplicated Business Logic & Formatting Across Modules and Serverless Functions

**What happens:** `formatCOP` is reimplemented independently across 5 feature model files (`expense.model.ts`, `income.model.ts`, `categoria.model.ts`, `resumen.model.ts`, `debt.model.ts`), and `calcularVencimientoCron` in `api/cron-reminder.js:92-142` duplicates `calcularVencimientoGastoFijo` from `src/app/features/gastos-fijos/utils/due-date-calculator.ts`.
**Why it's wrong:** Divergence risk if rounding, locale formatting, or due-date clamping rules change in one copy without updating the others.
**Do this instead:** Consolidate pure UI formatters into `src/app/shared/utils/format.utils.ts` and keep client/server due-date algorithms strictly aligned by contract tests (or a shared pure JS module if ESM packaging permits).

### Inline Test-Environment Branching Instead of DI Overrides

**What happens:** `SupabaseService`, `SupabaseAuthService`, and `RemoteConfigService` inspect `globalThis.process.env['VITEST']` / `NODE_ENV === 'test'` inside production constructors/methods to swap behavior or skip DB calls.
**Why it's wrong:** Ships test-detection code into production bundles and bypasses Angular's DI override mechanisms.
**Do this instead:** Follow the Wave 2 pattern in `src/app/app.config.ts` and `fixed-expense-alerts.service.spec.ts` — inject abstract ports/providers (`InjectionToken`) and provide test doubles via `TestBed` in `.spec.ts` files.

### Unused Router & Orphaned Shared Auth/Splash Components

**What happens:** `provideRouter(routes)` is configured in `src/app/app.config.ts:14` with an empty `routes = []` in `src/app/app.routes.ts` and no `<router-outlet>` in `src/app/app.html`; meanwhile `PinLock` (`src/app/shared/ui/pin-lock/pin-lock.ts`) and `SplashScreen` (`src/app/shared/ui/splash-screen/splash-screen.ts`) exist without being mounted in `App`.
**Why it's wrong:** Adds dead configuration/bundle surface and creates confusion for contributors expecting Angular Router navigation or `PinLock` auth flow.
**Do this instead:** Either remove unused router/legacy UI artifacts when retired or explicitly document and migrate `NavigationService` onto Angular Router if deep-link routing grows.

## Error Handling

**Strategy:** Resilient **fail-soft local-first degradation** on the client coupled with explicit user-facing toast notifications (`ToastService`) and structured result objects (`NotificationResult`) in Wave 2 adapters.

**Patterns:**
- **Optimistic Rollback / Toast Surfacing:** Feature services (`ExpensesService`, `IncomesService`, `TcService`, `DebtsService`, `FixedExpensesService`, `ProjectsService`) update local signals immediately, persist to `localStorage` where applicable, and show `ToastService.error()` / console warnings if Supabase writes fail.
- **Non-Throwing Adapter Results:** `FcmNotificationAdapter.sendNotification()` (`src/app/core/notifications/adapters/fcm-notification.adapter.ts:48-105`) catches both logical API errors (`success: false`) and `HttpErrorResponse` network failures, returning an immutable `NotificationResult` (`{ success: false, error, timestamp }`); `FixedExpenseAlertsService.despacharAlertas()` aggregates batches via `Promise.allSettled`.
- **Multi-Tier External Fallbacks:** `TrmService.refreshTrm()` cascades `datos.gov.co` -> `open.er-api.com` -> `localStorage` -> `DEFAULT_TRM` (`3155`); `ResumenService` cascades SQL view `v_monthly_summary` -> in-memory aggregation over `IncomesService` + `ExpensesService`; `RemoteConfigService` falls back to `DEFAULT_REMOTE_CONFIG` when offline or unconfigured.
- **Serverless Validation & Token Pruning:** `api/notify.js` and `api/cron-reminder.js` verify Bearer secrets (`CRON_SECRET`, `NOTIFY_SECRET`, `SUPABASE_ANON_KEY`, or Supabase JWT), validate payload sizes/types (`400`/`401`/`405`/`500`), and automatically purge stale tokens (`UNREGISTERED`, `NOT_FOUND`, `INVALID_ARGUMENT`) from `public.fcm_tokens`.

## Cross-Cutting Concerns

**Logging:** Uses standard `console.log` / `console.warn` / `console.error` across Angular services, Vercel functions, and Service Worker; user-visible operational feedback routes through `ToastService` (`src/app/core/services/toast.service.ts`) rendered by `<app-toast-container>`.

**Validation & Sanitization:**
- Domain type guards in `src/app/features/gastos-fijos/data/fixed-expense.model.ts` (`isValidDiaLimiteMes`, `isValidDiasAnticipacionAlerta`, `isGastoFijoAlerta`) and `src/app/core/services/navigation.service.ts` (`isValidSidebarPage`).
- XSS protection via `escapeHtml()` in `src/app/shared/utils/security.util.ts` for HTML chart tooltips (`chart-tooltip.ts` and chart components) and `eslint-plugin-security` static SAST rules in `eslint.config.mjs`.
- Payload length bounds (`title <= 200`, `body <= 1000`) in `api/notify.js` and SSRF domain restriction (`*.supabase.co`) in `scripts/migrate-compartido.js` and `scripts/populate-dev.js`.

**Authentication & Security:**
- Device access lock via `AuthPinService` (salted SHA-256 via `crypto.subtle.digest`, 10-minute sliding session, 5-attempt / 30s lockout, `@capgo/capacitor-native-biometric` on Android).
- Vercel CSP & security headers configured in `vercel.json` (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Note on DB RLS: `supabase/fix_rls_for_automation.sql` allows `anon` + `authenticated` access to core financial tables so Google Apps Script and device sessions work without requiring per-user Supabase Auth login; `api/notify.js` and `api/cron-reminder.js` require Bearer token validation in production.

**Currency & Timezone Normalization:**
- Default currency is Colombian Pesos (`COP`); `ProjectsService`, `ExpensesService`, and `TcService` support `USD` entries converted using `TrmService`.
- Due-date calculations (`calcularVencimientoGastoFijo` and `calcularVencimientoCron`) normalize calendar dates to UTC noon (`12:00:00Z`) and server cron executions lock timestamps to `America/Bogota` (`Intl.DateTimeFormat`) to eliminate midnight/DST drift.

**Styling & Mobile Safe Areas:**
- Native CSS3 with global design tokens in `src/styles.css` (no Tailwind/CSS utility frameworks) and component-scoped `.css` files.
- Android edge-to-edge safe areas dynamically injected by `MainActivity.java` via `--safe-area-top` and `--safe-area-bottom` CSS custom properties, paired with `viewport-fit=cover` in `src/index.html`.

---

*Architecture analysis: 2026-11-11*
