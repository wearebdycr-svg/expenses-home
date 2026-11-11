# Codebase Concerns

**Analysis Date:** 2026-11-11

## Security Considerations

### Permissive `anon` Row-Level Security Across All Tables
- **Risk:** Earlier hardening in `supabase/security_hardening_rls.sql` restricted policies `TO authenticated`, but later scripts replaced them with `FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)` across `persons`, `expenses`, `incomes`, `debts`, `tc_cards`, `tc_expenses`, `projects`, `project_expenses`, `category_budgets`, `fcm_tokens`, `fixed_expenses`, and `app_users`, alongside `GRANT SELECT ON public.v_monthly_summary TO anon, authenticated`. Anyone extracting the public `supabaseAnonKey` from the frontend bundle can read, mutate, or delete all household financial data and read `app_users` password hashes and salts.
- **Files:** `supabase/fix_all_tables_rls_and_schemas.sql` (lines 29, 58, 80, 115, 146, 177, 221, 229, 245, 263, 280), `supabase/fix_rls_for_automation.sql`, `supabase/deploy_fixed_expenses.sql` (`line 27`), `supabase/create_app_users.sql` (`lines 22-35`).
- **Current mitigation:** None effective against `anon` callers; `supabase/security_hardening_rls.sql` was superseded.
- **Recommendations:** Restore `TO authenticated` RLS policies scoped by `auth.uid()` across all tables, revoke `anon` grants on `public.app_users` and `public.v_monthly_summary`, and use `service_role` strictly inside server-side functions and automation.

### Broken Two-Phase Auth Gate, Seeded Credentials, and Weak Client-Side Auth
- **Risk:** `CONTEXT.md` §3 documents a two-phase authentication architecture (`SupabaseAuthService` followed by `AuthPinService`), but `src/app/app.html:1` gates the application solely on `!authPinService.isUnlocked()`. `SupabaseAuthService` (`src/app/core/services/supabase-auth.service.ts`) is only injected in `src/app/app.ts:56,100` for `signOut()`; `signInWithPassword` and `signUp` are never called anywhere. Furthermore:
  - `SupabaseAuthService.hasSavedSupabaseSession()` (`src/app/core/services/supabase-auth.service.ts:13-28,42-47`) sets `isAuthenticated` synchronously to `true` from `localStorage` (`sb-*-auth-token`) before `getSession()` validates token expiry.
  - `AuthPinService.seedDefaultUsers()` (`src/app/core/services/auth-pin.service.ts:114-151`) seeds default accounts (`charlie`, `benny`, `admin`) into `localStorage` (`USERS_STORAGE_KEY`), and `DEFAULT_INITIAL_PIN` (`src/app/core/services/auth-pin.service.ts:33`) provides a hardcoded default fallback PIN.
  - `sha256()` (`src/app/core/services/auth-pin.service.ts:36-52`) applies single-pass `SHA-256(salt + password)` with zero key stretching (PBKDF2/Argon2) and falls back to a non-cryptographic 32-bit hash if `crypto.subtle` is absent.
  - `AuthPinService.loginWithCredentials()` (`src/app/core/services/auth-pin.service.ts:352-360`) only checks `localStorage` and never queries `public.app_users` (while `registerUser()` writes to `app_users` at `lines 422-433`), preventing registered users from logging in on another device.
  - Lockout (`FAILED_ATTEMPTS_KEY`) and session TTL (`SESSION_STORAGE_KEY`) are `localStorage`-only, and `checkInitialState()` (`src/app/core/services/auth-pin.service.ts:158-160`) unlocks unconditionally (`isUnlocked(true)`) if `localStorage` is undefined.
  - `AuthPinService.unlockWithBiometric()` (`src/app/core/services/auth-pin.service.ts:531`) defaults to `{ username: 'charlie', name: 'Charlie' }` when `currentUser()` is `null`, risking session/audit misattribution after storage clears.
- **Files:** `src/app/app.html`, `src/app/app.ts`, `src/app/core/services/supabase-auth.service.ts`, `src/app/core/services/auth-pin.service.ts`.
- **Current mitigation:** Client-side `localStorage` lockout and session expiry timer only.
- **Recommendations:** Wire real Supabase Auth sign-in (`signInWithPassword`) and enforce `supabaseAuth.isAuthenticated()` in `src/app/app.html`; remove `seedDefaultUsers()`, `DEFAULT_INITIAL_PIN`, and the 32-bit hash fallback; fail closed in `checkInitialState()` and `unlockWithBiometric()` when no verified user session exists.

### Vercel Serverless Auth Bypass, Fail-Open Cron Secret, and Wildcard CORS
- **Risk:**
  - `api/notify.js:122` and `api/cron-reminder.js:286` accept `Authorization: Bearer <SUPABASE_ANON_KEY>` as valid authentication, even though `SUPABASE_ANON_KEY` is public in the client bundle and sent directly by `PushNotificationService.dispatchPushNotification()` (`src/app/core/services/push-notification.service.ts:610`) and `FcmNotificationAdapter.sendNotification()` (`src/app/core/notifications/adapters/fcm-notification.adapter.ts:56-57`). Any external caller with the anon key can broadcast push notifications to all registered devices.
  - `api/cron-reminder.js:292` evaluates `if (expectedSecret && !isAuthorized)`, causing authentication to fail open if both `CRON_SECRET` and `NOTIFY_SECRET` environment variables are unset.
  - `api/fcm-token.js` enforces zero authentication on `GET`, `POST`, and `DELETE`, allowing unauthenticated token count enumeration, token registration, and token deletion.
  - All three endpoints (`api/fcm-token.js:9`, `api/notify.js:90`, `api/cron-reminder.js:269`) send `Access-Control-Allow-Origin: *`.
- **Files:** `api/notify.js`, `api/cron-reminder.js`, `api/fcm-token.js`, `src/app/core/services/push-notification.service.ts`, `src/app/core/notifications/adapters/fcm-notification.adapter.ts`.
- **Current mitigation:** Bearer check against `NOTIFY_SECRET`/`CRON_SECRET`/`SUPABASE_ANON_KEY` on two of three routes.
- **Recommendations:** Remove `SUPABASE_ANON_KEY` as a valid server bearer secret; verify user Supabase JWTs on `/api/notify` and `/api/fcm-token`; fail closed (`500` or `401`) when `CRON_SECRET`/`NOTIFY_SECRET` are missing in `api/cron-reminder.js`; restrict CORS origins to deployed app URLs.

### CSP Blocks Production TRM Fetches and Allows `'unsafe-inline'` Styles
- **Risk:** `vercel.json:24` defines `connect-src` as `'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.firebaseio.com`, omitting `https://www.datos.gov.co` and `https://open.er-api.com` called by `TrmService.refreshTrm()` (`src/app/core/services/trm.service.ts:76,99`). In production web deployments, CSP silently blocks TRM lookups and forces fallback to hardcoded `DEFAULT_TRM = 3155`. `style-src` also requires `'unsafe-inline'`.
- **Files:** `vercel.json`, `src/app/core/services/trm.service.ts`.
- **Current mitigation:** Hardcoded `DEFAULT_TRM` fallback masks CSP failures.
- **Recommendations:** Add `https://www.datos.gov.co` and `https://open.er-api.com` to `connect-src` in `vercel.json` (or proxy TRM through a `/api/` route) and audit inline styles to tighten `style-src`.

### Android Debug Signing Fallback, Disabled Minification, and ADB Backup Enabled
- **Risk:** `android/app/build.gradle:21-46,53-58` falls back to `initWith debug` for `release` builds when `RELEASE_STORE_FILE` is not set (neither `.github/workflows/android-apk.yml` nor `.gitlab/ci/android.gitlab-ci.yml` provides release keystore variables) and keeps `minifyEnabled false` on `release`. Meanwhile, `android/app/src/main/AndroidManifest.xml:5` sets `android:allowBackup="true"`, allowing WebView `localStorage` data (cached credentials/hashes/financial state) to be extracted via ADB backup.
- **Files:** `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `.github/workflows/android-apk.yml`, `.gitlab/ci/android.gitlab-ci.yml`.
- **Current mitigation:** None.
- **Recommendations:** Set `android:allowBackup="false"` in `AndroidManifest.xml`, enable `minifyEnabled true` for release builds, and require explicit CI signing keystore configuration rather than falling back to debug keys.

### Secrets Hygiene, Tracked Config Files, SW Query Params, and Committed Data
- **Risk:**
  - `.npmrc` and `.env.example` are tracked in `git ls-files` (alongside `scripts/patch-google-services.js`), while `.env` is ignored via `.gitignore:52`. Tracked `.npmrc` files present a recurring risk of accidental auth token commits (contents intentionally unread per secret hygiene rules).
  - `PushNotificationService.initWeb()` (`src/app/core/services/push-notification.service.ts:213-222`) appends Firebase configuration properties (including `apiKey`) as URL query parameters to `/firebase-messaging-sw.js?...` and prints FCM device tokens via `console.log` (`lines 145, 324`).
  - Hardcoded production Supabase project identifiers, `SHARED_TC_DIGITS`, real personal debt balances, and `ON CONFLICT DO UPDATE` production data rows (including duplicate rows) are committed in `automation/bancolombia-sync/bancolombia-sync.gs:32,47`, `supabase/fix_all_tables_rls_and_schemas.sql:374-424`, and `supabase/populate_prod_from_dev.sql:3`.
- **Files:** `.npmrc`, `.env.example`, `src/app/core/services/push-notification.service.ts`, `public/firebase-messaging-sw.js`, `automation/bancolombia-sync/bancolombia-sync.gs`, `supabase/fix_all_tables_rls_and_schemas.sql`, `supabase/populate_prod_from_dev.sql`.
- **Current mitigation:** `.env` is listed in `.gitignore:52`.
- **Recommendations:** Verify `.npmrc` history contains no tokens and remove `.npmrc` from git if unneeded; generate `public/firebase-messaging-sw.js` config at build time in `scripts/set-env.js` instead of query params; remove token `console.log` calls; move production project IDs and `SHARED_TC_DIGITS` to Apps Script Properties and purge real balances/seed upserts from SQL migration scripts.

---

## Tech Debt

### Violation of `.antigravity/rules.md` Strict `any` Ban & Incomplete SDD Wave 2 Verification
- **Issue:** `.antigravity/rules.md` mandates `"Tipado estricto sin excepciones: Prohibido terminantemente el uso de any"`, yet `eslint.config.mjs:34` downgrades `@typescript-eslint/no-explicit-any` to `'warn'`. `npx eslint .` currently emits `90` `@typescript-eslint/no-explicit-any` warnings (`82` explicit `any` occurrences observed in non-spec `src/` files), led by `src/app/features/tc-compartida/data/tc.service.ts` (16 `any` warnings). Additionally, `PLAN.md` Task `2.9` (`Verificación integral de calidad`) remains unchecked.
- **Files:** `.antigravity/rules.md`, `eslint.config.mjs`, `PLAN.md`, `src/app/features/tc-compartida/data/tc.service.ts`.
- **Impact:** Runtime type mismatches in Supabase row mappers and modal handlers bypass compiler checks and contravene project governance rules.
- **Fix approach:** Replace all `any` usages in `src/app/` with typed Supabase row interfaces (`unknown` + type guards where dynamic), promote `@typescript-eslint/no-explicit-any` to `'error'` in `eslint.config.mjs`, and complete `PLAN.md` Task `2.9`.

### Orphaned Hexagonal Alerts Layer & Duplicated Cron Logic (`CONTEXT.md` §7.3 Violation)
- **Issue:** `FixedExpenseAlertsService` (`src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts`) and `NOTIFICATION_PROVIDER` / `FcmNotificationAdapter` (`src/app/app.config.ts:16`, `src/app/core/notifications/notification-provider.interface.ts`, `src/app/core/notifications/adapters/fcm-notification.adapter.ts`) have zero runtime callers outside unit tests, and `FcmNotificationAdapter.sendNotification()` sends a `recipientId` field ignored by `api/notify.js`. Meanwhile, `PushNotificationService` (`src/app/core/services/push-notification.service.ts`, 919 lines) directly imports domain models from 5 features (`expense.model.ts`, `tc.model.ts`, `income.model.ts`, `debt.model.ts`, `categoria.model.ts`) and performs direct `fetch('/api/notify')` calls. Simultaneously, `api/cron-reminder.js:92-142` duplicates `esBisiesto`, `obtenerDiasDelMes`, and `calcularVencimientoCron` instead of sharing the calculation contract with `src/app/features/gastos-fijos/utils/due-date-calculator.ts`.
- **Files:** `src/app/app.config.ts`, `src/app/core/notifications/notification-provider.interface.ts`, `src/app/core/notifications/adapters/fcm-notification.adapter.ts`, `src/app/core/services/push-notification.service.ts`, `src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts`, `src/app/features/gastos-fijos/utils/due-date-calculator.ts`, `api/cron-reminder.js`, `api/notify.js`.
- **Impact:** Alerts logic is disconnected from the live app; cron and client due-date rules can drift silently; push delivery couples `core` to every feature domain model.
- **Fix approach:** Route alert triggers through `FixedExpenseAlertsService` and `NOTIFICATION_PROVIDER`, implement `recipientId` filtering in `api/notify.js`, strip domain-model imports out of `PushNotificationService`, and share due-date logic across client and cron.

### Unauthenticated Database Webhook Trigger (`supabase/database_webhooks_notifications.sql`)
- **Issue:** `handle_expense_notify()` posts to a hardcoded production `/api/notify` URL with only `Content-Type: application/json` (no `Authorization` header), triggers on `DELETE` as well as writes, and conceptually duplicates frontend pushes sent by `PushNotificationService`.
- **Files:** `supabase/database_webhooks_notifications.sql`, `api/notify.js`.
- **Impact:** Webhook calls fail with `401 Unauthorized` against `api/notify.js:115-138`, or risk duplicate push notifications if auth were relaxed.
- **Fix approach:** Decide on a single push dispatch authority (server trigger vs client), inject Vault/secret bearer credentials if database webhooks are kept, and remove hardcoded URLs.

### Oversized Services/Components & Tight Cross-Feature Coupling
- **Issue:** Core state and presentation files exceed maintainable single-responsibility boundaries: `src/app/features/tc-compartida/data/tc.service.ts` (1,112 lines), `src/app/core/services/push-notification.service.ts` (919 lines), `src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts` (795 lines), `src/app/features/proyectos/data/projects.service.ts` (786 lines), `api/cron-reminder.js` (681 lines), `src/app/features/deudas/data/debts.service.ts` (641 lines), `src/app/core/services/auth-pin.service.ts` (636 lines). `ExpenseFormModal` injects 6 services (`DebtsService`, `TcService`, `ExpensesService`, `ProjectsService`, `FixedExpensesService`, `TrmService`) and performs direct cross-service mutations during submission.
- **Files:** `src/app/features/tc-compartida/data/tc.service.ts`, `src/app/core/services/push-notification.service.ts`, `src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts`, `src/app/features/proyectos/data/projects.service.ts`, `api/cron-reminder.js`, `src/app/features/deudas/data/debts.service.ts`, `src/app/core/services/auth-pin.service.ts`.
- **Impact:** High regression risk when modifying payment, card, debt, or modal workflows; difficult unit testing without extensive mocking.
- **Fix approach:** Split `TcService` into card catalog, installment/amortization engine, and expense repository services; decouple `ExpenseFormModal` via an application facade/command output; break `PushNotificationService` into registration, transport, and message formatting.

### Unused Angular Router & Eager Monolithic Bundle
- **Issue:** `src/app/app.routes.ts` exports an empty `[]` array despite `provideRouter(routes)` in `src/app/app.config.ts:14`. `src/app/app.ts:7-14,33-47` eagerly imports all 8 feature page components (and Chart.js/`ng2-charts`), managing navigation manually via `window.location.hash` and `localStorage`.
- **Files:** `src/app/app.routes.ts`, `src/app/app.config.ts`, `src/app/app.ts`.
- **Impact:** Increases initial JS bundle download/parse latency on mobile web and Capacitor WebView and prevents route guards (`canActivate`) or lazy chunking.
- **Fix approach:** Migrate tab views to lazy-loaded routes (`loadComponent`) in `src/app/app.routes.ts` protected by an auth guard and replace hash/localStorage state switching in `App`.

### Duplicated Currency Helpers (`formatCOP`)
- **Issue:** Duplicate `formatCOP` functions are exported across 5 separate feature model files plus component-level helpers (e.g., `GastosFijosPage.formatCOP` at `src/app/features/gastos-fijos/gastos-fijos.ts:121-123`) instead of living in `src/app/shared/utils/format.utils.ts`.
- **Files:** `src/app/features/deudas/data/debt.model.ts:54`, `src/app/features/categoria/data/categoria.model.ts:81`, `src/app/features/ingresos/data/income.model.ts:87`, `src/app/features/resumen/data/resumen.model.ts:84`, `src/app/features/gastos/data/expense.model.ts:177`, `src/app/features/gastos-fijos/gastos-fijos.ts:121-123`, `src/app/shared/utils/format.utils.ts`.
- **Impact:** Minor formatting divergence risk and unnecessary duplication.
- **Fix approach:** Consolidate `formatCOP` into `src/app/shared/utils/format.utils.ts` and re-export or import across features.

### Dead Code, Duplicate Configs, Redundant CI Pipelines, and Heavy Tracked Artifacts
- **Issue:**
  - Dead UI components/methods: `PinLock` (`src/app/shared/ui/pin-lock/`) and `SplashScreen` (`src/app/shared/ui/splash-screen/`) are never rendered by `src/app/app.ts` / `app.html` (only tested by their own specs and explicitly asserted absent in `src/app/app.spec.ts`); `AuthLogin.fillQuickAccount()` (`src/app/shared/ui/auth-login/auth-login.ts:60`) is unused.
  - Duplicate Remote Config files: both `config.json` (2,585 bytes) and `remote_config.json` (2,586 bytes) are tracked in git and differ by 1 byte.
  - Redundant CI/CD systems: both `.github/workflows/*.yml` and `.gitlab-ci.yml` + `.gitlab/ci/*.yml` maintain duplicate pipelines; `.github/workflows/reminders-cron.yml` duplicates the `'0 0 * * *'` cron trigger configured in `vercel.json`.
  - Heavy/ad-hoc artifacts: `HUS/` tracks 31 Markdown/PNG story/mockup files (2.01 MB); `apk/` (gitignored via `.gitignore:8`) stores 3 local APK builds totaling 13.69 MB (`FinanzasHogar-debug.apk`, `FinanzasHogar-dev.apk`, `FinanzasHogar-release.apk`); `scripts/migrate-compartido.js` and `scripts/populate-dev.js` are one-off scripts overlapping with `supabase/*.sql`.
- **Files:** `src/app/shared/ui/pin-lock/`, `src/app/shared/ui/splash-screen/`, `src/app/shared/ui/auth-login/auth-login.ts`, `config.json`, `remote_config.json`, `.github/workflows/reminders-cron.yml`, `.gitlab-ci.yml`, `.gitlab/ci/`, `HUS/`, `apk/`, `scripts/migrate-compartido.js`, `scripts/populate-dev.js`.
- **Impact:** Clutters repository checkout size, creates drift risk between duplicate Remote Config templates and dual CI workflows, and risks double-running or competing cron schedules.
- **Fix approach:** Remove `PinLock`, `SplashScreen`, `fillQuickAccount()`, duplicate `config.json`, and retired migration scripts; consolidate onto one CI provider and one cron scheduler; move `HUS/` screenshots out of git or into a dedicated docs branch/wiki.

---

## Known Bugs

### Cron Dedup Sentinels Pollute `category_budgets` & Deleted Budgets Resurrect
- **Symptoms:** Internal cron marker keys (`__cron_fixed_expenses__`, `__cron_reminder_7pm__` with `YYYYMMDD` stored as `amount`) appear in budget maps and `localStorage`; budgets explicitly cleared (`amount: 0`, which deletes the DB row) reappear after reload.
- **Files:** `api/cron-reminder.js` (`lines 402-406, 536-543, 569-573, 633-640`), `src/app/core/services/remote-config.service.ts` (`lines 178-197`).
- **Trigger:** Running `/api/cron-reminder` followed by `RemoteConfigService.loadBudgetsFromDb()` (which calls `select('*')` without filtering `__cron_%` and merges with `localStorage` via `{ ...local }`).
- **Workaround:** None in runtime code.

### `ResumenService` Returns Stale `v_monthly_summary` Snapshot After In-Session Mutations
- **Symptoms:** Adding, editing, or deleting expenses/incomes does not update `ResumenPage` annual figures for the active year until a full page reload or year switch.
- **Files:** `src/app/features/resumen/data/resumen.service.ts` (`lines 56-90, 103`).
- **Trigger:** Navigating to `Resumen` after `loadYearSummary()` populates `dbRows()` — `summaryRows()` continues returning cached `dbRows()` with no Supabase Realtime listener or invalidation signal from `ExpensesService` or `IncomesService`.
- **Workaround:** Switch the selected year back and forth or reload the app.

### `TcService` Self-Echo, Lossy Undo on Delete, and Deleted Card Resurrection
- **Symptoms:** Updating or deleting a credit card expense triggers redundant Realtime reloads and duplicate delete notifications; clicking undo after `deleteTcExpense` restores COP fields while dropping `currency`, `amountUsd`, and `exchangeRate`; deleting a credit card on one device causes a second device to re-insert it on startup.
- **Files:** `src/app/features/tc-compartida/data/tc.service.ts` (`lines 160-169, 957-969`).
- **Trigger:** `updateTcExpense()` and `deleteTcExpense()` omit `lastLocalMutationTime = Date.now()`; `deleteTcExpense` undo omits USD fields; `loadCards()` tracks deleted cards only in `localStorage` (`STORAGE_DELETED_CARDS_KEY`) while `addCard`/`updateCard`/`deleteCard` run fire-and-forget.
- **Workaround:** Reloading syncs remote state; deleted cards require deletion on every device or DB cleanup.

### Description Length Exceeds `VARCHAR(100)` When Linking Debt or Project Tags
- **Symptoms:** Supabase inserts/updates fail on databases enforcing `schema.sql` column constraints when long descriptions are linked to a debt or project.
- **Files:** `src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts` (`lines 614, 684, 711`), `supabase/schema.sql` (`line 65`).
- **Trigger:** Entering a 90–100 character description (truncated via `slice(0, 100)` at line 614) and attaching `[Deuda: ...]` or `[Evento: ...]` afterward at lines 684/711.
- **Workaround:** Keep descriptions under ~70 characters or rely on databases modified by `fix_all_tables_rls_and_schemas.sql` (`TEXT` column).

### Unscoped Root `npx eslint .` Reports Errors on Android Build Artifacts
- **Symptoms:** Running `npx eslint .` reports `140` problems (`2` errors, `138` warnings), with the `2` errors triggered inside `android/app/build/intermediates/assets/debug/mergeDebugAssets/native-bridge.js:1007:13` and `android/app/build/intermediates/assets/release/mergeReleaseAssets/native-bridge.js:1007:13` (`Definition for rule '@typescript-eslint/no-unused-vars' was not found`). Additionally, `npm run lint` fails to load `$HOME/.angular-config.json` in restricted environments unless `HOME=/tmp` is supplied.
- **Files:** `eslint.config.mjs`, `android/app/build/intermediates/assets/debug/mergeDebugAssets/native-bridge.js`, `android/app/build/intermediates/assets/release/mergeReleaseAssets/native-bridge.js`.
- **Trigger:** Executing `npx eslint .` after building Android assets locally because `android/` build outputs are not ignored in `eslint.config.mjs`.
- **Workaround:** Run `HOME=/tmp npm run lint` (`ng lint`, which restricts scanning to `src/` and completes with `0` errors and `134` warnings).

---

## Fragile Areas

### Unversioned `supabase/*.sql` Scripts & Schema/Type/Constraint Drift
- **Files:** `supabase/` (30 unversioned `.sql` scripts, including `schema.sql`, `fix_all_tables_rls_and_schemas.sql`, `deploy_fixed_expenses.sql`, `add_due_alert_columns_to_fixed_expenses.sql`, `projects_schema.sql`, `debts_schema.sql`, `tc_cards_schema.sql`, `tc_expenses_schema.sql`, `category_budgets_schema.sql`).
- **Why fragile:** No sequential migration runner or `supabase/migrations/` tracking exists. Column types and constraints disagree across scripts:
  - `id` is `TEXT` in `supabase/schema.sql`, `supabase/projects_schema.sql`, `supabase/tc_cards_schema.sql`, `supabase/tc_expenses_schema.sql`, and `supabase/deploy_fixed_expenses.sql`, vs `UUID` in `supabase/debts_schema.sql` and `supabase/fix_all_tables_rls_and_schemas.sql` (`expenses`, `incomes`, `debts`, `tc_expenses`, `category_budgets`, `fcm_tokens`, `app_users`).
  - `supabase/schema.sql` enforces strict `CHECK (category IN (...))`, `VARCHAR(100)` description, and `amount > 0`, whereas `supabase/fix_all_tables_rls_and_schemas.sql` removes `CHECK` constraints (`TEXT`, `amount >= 0`).
  - `CONTEXT.md` §7.1 requires `smallint` for `dia_limite_mes` and `dias_anticipacion_alerta`, whereas `supabase/add_due_alert_columns_to_fixed_expenses.sql:10-11` used `INTEGER`, and `fixed_expenses` is absent from `supabase/fix_all_tables_rls_and_schemas.sql`.
- **Safe modification:** Verify target environment column types directly in Supabase before running any script and consolidate schemas into versioned migrations.
- **Test coverage:** Zero SQL schema or migration validation tests.

### String-Encoded Foreign Keys & Substring Description Matching
- **Files:** `src/app/features/tc-compartida/data/tc.service.ts` (`lines 388-472, 468, 806-812, 854-857, 913-916`), `src/app/features/gastos-fijos/data/fixed-expenses.service.ts` (`line 123`), `src/app/features/deudas/data/debts.service.ts` (`lines 114-124`).
- **Why fragile:**
  - `TcService` embeds card identity inside `tc_expenses.description` as `[CARD:${cardId}] ...` instead of populating the `card_id` column.
  - `TcService.isPaymentForCard()` (`line 468`, `!desc.includes('nu')`), `FixedExpensesService.monthlyStatuses()` (`line 123`, `descNorm.includes(fixedNameNorm)` — e.g., `"Gas"` matches `"Gasolina"`), and `DebtsService.debtsWithLiveBalance()` (`lines 114-124`) link payments/transactions via case-insensitive text substrings. Renaming a card, debt, or fixed expense silently breaks historical payment links.
- **Safe modification:** Avoid renaming prefixes/tags (`[CARD:...]`, `[Deuda: ...]`, `[Evento: ...]`) without running a paired data backfill script; migrate to foreign-key columns.
- **Test coverage:** Partial unit coverage (`tc.service.spec.ts`, `fixed-expenses.service.spec.ts`, `debts.service.spec.ts`) using mocked datasets.

### Optimistic Updates Without Rollback, In-Place Signal Mutation, & Client Migration Race
- **Files:** `src/app/features/gastos/data/expenses.service.ts` (`lines 207-208, 229-266, 305-308`), `src/app/features/ingresos/data/incomes.service.ts` (`lines 192-195`), `src/app/features/tc-compartida/data/tc.service.ts`, `src/app/features/deudas/data/debts.service.ts`, `src/app/features/proyectos/data/projects.service.ts`, `src/app/features/gastos-fijos/data/fixed-expenses.service.ts`, `src/app/features/gastos-fijos/gastos-fijos.ts` (`lines 76-90`).
- **Why fragile:** Most services mutate UI signals immediately without restoring prior state when Supabase `update`/`delete` fails; `ExpensesService.addExpense()` and `IncomesService.addIncome()` mutate `found.id` directly on an object inside a signal array; `GastosFijosPage.onSave()` closes the modal synchronously without awaiting save completion or surfacing errors, and `onDelete()` blocks on browser `confirm()`. Furthermore, `ExpensesService.loadExpenses()` runs a client-side `Compartido` auto-migration inserting into `tc_expenses` and deleting from `expenses` with no concurrency lock, risking duplicate rows if two devices open simultaneously.
- **Safe modification:** Snapshot prior signal state before optimistic updates, roll back and surface toast/error messages on DB failure, and move data migrations to one-time SQL scripts.
- **Test coverage:** `GastosFijosPage` (`src/app/features/gastos-fijos/gastos-fijos.ts`) has no `.spec.ts`; error rollback branches across services are largely untested.

### Missing Interval/Listener Teardown & Due-Date Month Boundary Behavior
- **Files:** `src/app/core/services/auth-pin.service.ts` (`lines 200-230, 262`), `src/app/core/services/daily-reminder.service.ts` (`line 67`), `src/app/features/gastos-fijos/utils/due-date-calculator.ts` (`lines 45-67`), `src/app/features/gastos/data/expenses.service.ts`, `src/app/features/ingresos/data/incomes.service.ts`, `src/app/features/tc-compartida/data/tc.service.ts`, `src/app/features/deudas/data/debts.service.ts`, `src/app/features/proyectos/data/projects.service.ts`, `src/app/features/gastos-fijos/data/fixed-expenses.service.ts`.
- **Why fragile:** `AuthPinService` registers `setInterval` (`sessionCheckIntervalId`) and `window` listeners without `DestroyRef` cleanup; the 6 Realtime services open Supabase channels without calling `removeChannel` on teardown; `calcularVencimientoGastoFijo()` (`due-date-calculator.ts:45-67`) evaluates due dates only within the reference month (never rolling December → January for early-month due dates) and extracts local `getFullYear()/getMonth()/getDate()` for `Date` inputs versus explicit parsing for `YYYY-MM-DD` strings.
- **Safe modification:** Register `DestroyRef.onDestroy` cleanup on intervals/listeners/channels and cover cross-year due dates explicitly if upcoming-month rollovers are introduced.
- **Test coverage:** `due-date-calculator.spec.ts` exercises timezone/clamping within-month only.

---

## Performance Bottlenecks

### Unbounded Full-Table Queries & Full Reloads on Every Realtime Event
- **Problem:** Every domain service issues unfiltered `select('*')` scans on startup and reloads the entire table whenever any Supabase Realtime `*` event arrives.
- **Files:** `src/app/features/gastos/data/expenses.service.ts`, `src/app/features/ingresos/data/incomes.service.ts`, `src/app/features/tc-compartida/data/tc.service.ts`, `src/app/features/proyectos/data/projects.service.ts`, `src/app/features/deudas/data/debts.service.ts`, `src/app/features/gastos-fijos/data/fixed-expenses.service.ts`.
- **Cause:** Absence of date-window pagination/filters or incremental Realtime payload patching (`INSERT`/`UPDATE`/`DELETE` event application).
- **Improvement path:** Apply incremental Realtime delta handling in-memory and add server-side range/year filters or pagination for historical records.

### O(N×M) Client-Side Recomputation & Eager Bundle Loading
- **Problem:** `TcService.allCardsSummary`, `DebtsService.debtsWithLiveBalance`, and `ProjectsService.summary` re-scan full expense arrays and execute FIFO/amortization loops on every signal change; `src/app/app.ts` eagerly imports all 8 views and Chart.js upfront.
- **Files:** `src/app/features/tc-compartida/data/tc.service.ts`, `src/app/features/deudas/data/debts.service.ts`, `src/app/features/proyectos/data/projects.service.ts`, `src/app/app.ts`.
- **Cause:** Computed selectors lack indexed grouping maps by `cardId`/`debtName`/`projectId`, and `src/app/app.routes.ts` is unused.
- **Improvement path:** Index linked payments via `Map` lookups keyed by foreign IDs and convert tabs to lazy-loaded routes in `src/app/app.routes.ts`.

---

## Scaling Limits

### Sequential Push Dispatch & Hard 50-Token Ceiling
- **Current capacity:** `50` registered FCM device tokens (`MAX_DISPATCH_LIMIT` in `api/notify.js:235`, `MAX_CRON_TOKENS` in `api/cron-reminder.js:366`).
- **Limit:** Any devices beyond 50 are silently truncated; dispatching even up to 50 tokens uses a sequential `for...of await fetch(...)` loop, approaching Vercel serverless execution timeouts as token count grows.
- **Scaling path:** Replace the `for...of` HTTP loop with bounded concurrency (`Promise.allSettled` batching or FCM multicast/topic messaging) and store stale/unregistered token cleanup consistently.

---

## Dependencies at Risk

### Firebase SDK / Service Worker Compat Version Mismatch & Unmocked Test Coupling
- **Risk:** `package.json` declares `firebase ^12.19.0`, whereas `public/firebase-messaging-sw.js` loads pinned `10.13.0` compat scripts from `gstatic.com` CDN. Separately, running `HOME=/tmp npx ng test --watch=false` prints `ReferenceError: indexedDB is not defined` stderr exceptions in `src/app/app.spec.ts` because real `@firebase/remote-config` / `@firebase/installations` execute unmocked in Node/Vitest.
- **Impact:** Background push payload handling can diverge across major Firebase versions, and tests depend on network/fallback timeouts when `indexedDB` is absent.
- **Migration plan:** Align `public/firebase-messaging-sw.js` with `firebase` `12.x` (or bundle SW cleanly), provide an explicit `RemoteConfigService` mock in `src/app/app.spec.ts`, and pin external CDN imports cleanly.

### Bleeding-Edge Toolchain Constraints & Unscoped ESLint Config
- **Risk:** `package.json` uses `@angular/core ^22.2.1`, `typescript ~6.0.2`, `eslint ^10.11.0`, and `capacitor-native-biometric ^8.8.0`. Currently `npx eslint .` errors on generated `android/` JS files due to missing ignores in `eslint.config.mjs`, and `ng lint` fails when `$HOME/.angular-config.json` is unreadable (`HOME=/tmp` required in restricted environments).
- **Impact:** CI/local linting behaves inconsistently depending on whether `android/` assets exist or which lint command (`ng lint` vs `eslint .`) is invoked.
- **Migration plan:** Add `android/**`, `dist/**`, and `.planning/**` to `ignores` in `eslint.config.mjs` and keep CI lint/test scripts consistent (`HOME=/tmp` if sandboxed).

---

## Missing Critical Features

- **Server-Verified End-to-End Authentication:** Enforce `SupabaseAuthService` sign-in (`CONTEXT.md` §3 Phase 1) alongside `AuthPinService` and remove `localStorage`-only auth fallbacks (`src/app/app.html`, `src/app/core/services/supabase-auth.service.ts`, `src/app/core/services/auth-pin.service.ts`).
- **Versioned SQL Migration Pipeline:** Replace 30 unversioned scripts in `supabase/` with ordered, idempotent `supabase/migrations/` files and strict column/constraint parity (`UUID` vs `TEXT`, `smallint` vs `INTEGER`).
- **Dedicated Cron State Table & Per-Recipient Push Filtering:** Move `__cron_*` state out of `category_budgets` (`api/cron-reminder.js`, `src/app/core/services/remote-config.service.ts`) and implement `recipientId` filtering in `api/notify.js` for `FcmNotificationAdapter`.
- **Lazy Router Configuration & Guards:** Populate `src/app/app.routes.ts` with lazy feature routes and auth guards instead of eager component imports in `src/app/app.ts`.

---

## Test Coverage Gaps

### Verified Quality Baseline (`2026-11-11`)
- `npx tsc --noEmit`: `0` errors (`exit 0`).
- `HOME=/tmp npm run lint`: `0` errors, `134` warnings (`ng lint`, scoped to `src/`). Running unscoped `npx eslint .` reports `140` problems (`2` errors in `android/app/build/intermediates/assets/{debug,release}/.../native-bridge.js`, `138` warnings including `90` `@typescript-eslint/no-explicit-any`).
- `HOME=/tmp npx ng test --watch=false`: `62` test files passed (`62`), `346` tests passed (`346`), with unmocked Firebase Remote Config `indexedDB is not defined` errors logged to stderr in `src/app/app.spec.ts`.

### Zero Coverage on Backend, Service Worker, Apps Script, and Utility Scripts
- **What's not tested:** `api/cron-reminder.js` (681 lines), `api/notify.js` (382 lines), `api/fcm-token.js` (83 lines), `public/firebase-messaging-sw.js` (103 lines), `automation/bancolombia-sync/bancolombia-sync.gs` (815 lines), and `scripts/*.js` (`set-env.js`, `patch-google-services.js`, `migrate-compartido.js`, `populate-dev.js`).
- **Files:** `api/cron-reminder.js`, `api/notify.js`, `api/fcm-token.js`, `public/firebase-messaging-sw.js`, `automation/bancolombia-sync/bancolombia-sync.gs`, `scripts/`.
- **Risk:** Auth regressions (`api/notify.js`, `api/fcm-token.js`), cron dedup bugs, and email bank-sync parser regressions deploy unverified.
- **Priority:** High

### Untested Angular Pages, Components, and Core Infrastructure (`27` of `88` non-spec/non-model `.ts` files in `src/app/`)
- **What's not tested:**
  - Core & routing: `src/app/core/services/supabase.service.ts`, `src/app/core/notifications/notification-provider.interface.ts`, `src/app/app.routes.ts`.
  - Feature pages & modals: `src/app/features/gastos/gastos.ts`, `src/app/features/ingresos/ingresos.ts`, `src/app/features/gastos-fijos/gastos-fijos.ts`, `src/app/features/proyectos/components/project-card/project-card.ts`, `src/app/features/proyectos/components/project-detail/project-detail.ts`, `src/app/features/proyectos/components/project-form-modal/project-form-modal.ts`, `src/app/features/tc-compartida/components/tc-card-modal/tc-card-modal.ts`, `src/app/features/tc-compartida/components/tc-cards-grid/tc-cards-grid.ts`.
  - Charts, filters, KPIs, and seed: `src/app/features/gastos/components/expense-category-chart/expense-category-chart.ts`, `src/app/features/gastos/components/expense-daily-chart/expense-daily-chart.ts`, `src/app/features/ingresos/charts/chart-tooltip.ts`, `src/app/features/ingresos/charts/chart-utils.ts`, `src/app/features/ingresos/components/income-bar-chart/income-bar-chart.ts`, `src/app/features/ingresos/components/income-trend-chart/income-trend-chart.ts`, `src/app/features/ingresos/data/incomes.seed.ts`, `src/app/features/resumen/components/resumen-bar-chart/resumen-bar-chart.ts`, `src/app/features/resumen/components/resumen-filters/resumen-filters.ts`, `src/app/features/resumen/components/resumen-kpis/resumen-kpis.ts`, `src/app/features/resumen/components/resumen-line-chart/resumen-line-chart.ts`.
  - Shared UI & utils: `src/app/shared/ui/badge/badge.ts`, `src/app/shared/ui/icon/icon.ts`, `src/app/shared/ui/modal/modal.ts`, `src/app/shared/ui/select/select.ts`, `src/app/shared/utils/color.ts`.
- **Risk:** Template regressions, modal save/error handling bugs (`GastosFijosPage.onSave`), and accessibility warnings (`modal.html`, `tc-form-modal.ts`) go undetected. Meanwhile, `src/app/shared/ui/pin-lock/pin-lock.spec.ts` and `src/app/shared/ui/splash-screen/splash-screen.spec.ts` only cover dead components.
- **Priority:** Medium

---

## Prioritized Remediation Recommendations

### P0 — Security & Data Exposure (Immediate)
1. **Lock Down Vercel Serverless Endpoints:** Remove `SUPABASE_ANON_KEY` acceptance in `api/notify.js` and `api/cron-reminder.js`; fail closed when `CRON_SECRET`/`NOTIFY_SECRET` are unset; require verified Supabase user JWT auth on `api/notify.js` and `api/fcm-token.js`; replace wildcard `Access-Control-Allow-Origin: *` with allowed origins.
2. **Restore Strict RLS Policies:** Replace `TO anon, authenticated USING (true)` policies in `supabase/fix_all_tables_rls_and_schemas.sql`, `supabase/fix_rls_for_automation.sql`, `supabase/deploy_fixed_expenses.sql`, and `supabase/create_app_users.sql` with `TO authenticated` rules scoped via `auth.uid()` and revoke `anon` access from `app_users` and `v_monthly_summary`.
3. **Enforce Real Phase-1 Auth & Remove Seeded Default Credentials:** Gate `src/app/app.html` on `SupabaseAuthService.isAuthenticated()`, wire real `signInWithPassword` in `AuthLogin` (`src/app/shared/ui/auth-login/auth-login.ts`), remove `seedDefaultUsers()`, `DEFAULT_INITIAL_PIN`, and the 32-bit fallback hash in `AuthPinService` (`src/app/core/services/auth-pin.service.ts`), and disable automatic unlock / default `'charlie'` fallback in `checkInitialState()` and `unlockWithBiometric()`.
4. **Fix Production CSP & Android Hardening:** Add `https://www.datos.gov.co` and `https://open.er-api.com` to `vercel.json` `connect-src`; set `android:allowBackup="false"` in `android/app/src/main/AndroidManifest.xml`; remove debug keystore fallback and enable `minifyEnabled true` in `android/app/build.gradle`; move Firebase SW config out of URL query strings in `PushNotificationService.initWeb()` (`src/app/core/services/push-notification.service.ts`).

### P1 — Bug Fixes, Schema Alignment & Governance Compliance
1. **Separate Cron State from `category_budgets`:** Move `__cron_fixed_expenses__` and `__cron_reminder_7pm__` out of `category_budgets` in `api/cron-reminder.js` into a dedicated `cron_executions` table, filter sentinel rows defensively in `RemoteConfigService.loadBudgetsFromDb()` (`src/app/core/services/remote-config.service.ts`), and clear deleted budgets from `localStorage`.
2. **Fix Stale Summary & Realtime Bugs:** Invalidate/refresh `ResumenService.loadYearSummary()` (`src/app/features/resumen/data/resumen.service.ts`) on `expenses`/`incomes` mutations; set `lastLocalMutationTime = Date.now()` in `TcService.updateTcExpense()`/`deleteTcExpense()`, preserve USD fields in `deleteTcExpense` undo, and sync card deletions in `tc_cards` rather than `STORAGE_DELETED_CARDS_KEY` (`src/app/features/tc-compartida/data/tc.service.ts`).
3. **Enforce Strict TypeScript (`no-explicit-any`) & Complete `PLAN.md` Task `2.9`:** Eliminate all `82` non-spec `any` usages (starting with `TcService`), upgrade `@typescript-eslint/no-explicit-any` to `'error'` in `eslint.config.mjs`, ignore `android/**` in `eslint.config.mjs`, and validate `ExpenseFormModal` (`src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts`) tag length before truncation.
4. **Unify Schema into Versioned Migrations:** Reconcile `UUID` vs `TEXT` IDs, `smallint` vs `INTEGER` (`dia_limite_mes`, `dias_anticipacion_alerta`), and `CHECK` constraints into `supabase/migrations/`, and strip personal balances/hardcoded prod refs from committed `.sql` files and `automation/bancolombia-sync/bancolombia-sync.gs`.

### P2 — Architecture, Performance & Test Coverage
1. **Wire Hexagonal Notifications & Decouple Services:** Activate `FixedExpenseAlertsService` + `NOTIFICATION_PROVIDER` (`FcmNotificationAdapter`), support `recipientId` filtering in `api/notify.js`, decouple `PushNotificationService` from feature models, share one due-date rule across `due-date-calculator.ts` and `api/cron-reminder.js`, and move `FixedExpensesService`/`DebtsService`/`TcService` description-matching relationships to real foreign keys.
2. **Improve Persistence Rollback, Lifecycle Teardown, & Scaling:** Add optimistic rollback + UI error feedback across CRUD services and `GastosFijosPage.onSave()`, clean up intervals/listeners/Realtime channels via `DestroyRef`, replace full-table Realtime reloads with incremental patches, convert sequential FCM loops in `api/notify.js`/`api/cron-reminder.js` to batched parallel dispatch, and implement lazy-loaded routes in `src/app/app.routes.ts`.
3. **Close Automated Test Gaps:** Add integration/unit tests for `api/*.js`, `GastosFijosPage`, `GastosPage`, `IngresosPage`, and `SupabaseService`, and mock `RemoteConfigService` cleanly in `src/app/app.spec.ts` to eliminate `indexedDB` stderr noise.

### P3 — Repo Hygiene & Cleanup
1. **Consolidate Duplicates & Prune Dead Artifacts:** Remove unused `PinLock` (`src/app/shared/ui/pin-lock/`), `SplashScreen` (`src/app/shared/ui/splash-screen/`), `AuthLogin.fillQuickAccount()`, duplicate `config.json`, shared `formatCOP` copies (keep in `src/app/shared/utils/format.utils.ts`), and one-off `scripts/migrate-compartido.js`/`scripts/populate-dev.js`; standardize on one CI pipeline and archive `HUS/` binaries out of the primary repo tree.

---

*Concerns audit: 2026-11-11*
