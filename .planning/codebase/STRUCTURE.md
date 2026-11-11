# Codebase Structure

**Analysis Date:** 2026-11-11

## Directory Layout

```text
expenses-home/
├── .antigravity/                       # SDD agentic workflow governance rules (`rules.md`)
├── .claude/                            # Local Claude/AI development skills (`angular-frontend-dev/`)
├── .github/workflows/                  # GitHub Actions CI/CD, SAST scan, Android APK, and 7 PM cron
├── .gitlab/ci/                         # GitLab modular child CI pipelines (tests, scan, deploy, android)
├── .planning/codebase/                 # Generated GSD codebase analysis documentation
├── .vscode/                            # VS Code workspace tasks, launch configs, and recommended extensions
├── HUS/                                # Functional & technical user stories (`HU01`–`HU09`) + UI mockups (`img/`)
├── android/                            # Native Capacitor 8 Gradle/Android project (`co.wearebdycr.expenseshome`)
├── api/                                # Vercel Node.js ESM serverless functions (push dispatch, tokens, cron)
├── apk/                                # Local APK build output directory (gitignored)
├── automation/bancolombia-sync/        # Google Apps Script email parser (`bancolombia-sync.gs`) & setup guide
├── public/                             # Static web assets, PWA manifest, and FCM Service Worker
├── scripts/                            # Node/Python build, environment, Android asset, and DB helper scripts
├── src/                                # Angular 22 frontend application source
│   ├── environments/                   # Auto-generated DEV/PROD config (`environment*.ts`, gitignored)
│   ├── index.html                      # Root HTML document (PWA manifest & viewport-fit=cover)
│   ├── main.ts                         # Browser bootstrap entry point (`bootstrapApplication`)
│   ├── styles.css                      # Global CSS3 design tokens (`--sidebar`, `--accent`) & Chart.js tooltips
│   └── app/
│       ├── app.config.ts               # Root `ApplicationConfig` & `NOTIFICATION_PROVIDER` DI binding
│       ├── app.routes.ts               # Empty `Routes` array (hash navigation used instead of router-outlet)
│       ├── app.ts / .html / .css / .spec.ts  # Root shell (`App`), auth gate, and `@switch` page container
│       ├── smoke.spec.ts               # Critical shell bootstrap & expense pipeline smoke tests
│       ├── core/
│       │   ├── notifications/          # Hexagonal notification port (`notification-provider.interface.ts`)
│       │   │   └── adapters/           # Concrete adapters (`fcm-notification.adapter.ts`)
│       │   └── services/               # App-wide `providedIn: 'root'` singletons (auth, nav, push, TRM, etc.)
│       ├── features/                   # 8 vertical domain feature modules
│       │   ├── categoria/              # Category spending breakdown, charts, and budget limit modals
│       │   ├── deudas/                 # Debt cards, French 36-month amortization projections, prepayments
│       │   ├── gastos/                 # Daily expenses page, unified multi-destination modal, filters, charts
│       │   ├── gastos-fijos/           # Recurring fixed expenses, quick modal, due-date engine & alert service
│       │   ├── ingresos/               # Income entries, trends, bar charts, and seed fixtures
│       │   ├── proyectos/              # Multi-currency (COP/USD) projects & events tracking
│       │   ├── resumen/                # Monthly & annual balance dashboard backed by `v_monthly_summary`
│       │   └── tc-compartida/          # Multi-card shared credit cards & chronological FIFO amortization
│       └── shared/
│           ├── ui/                     # Reusable standalone UI primitives (`sidebar`, `modal`, `select`, etc.)
│           └── utils/                  # Pure formatting, color, and HTML-escaping utilities
├── supabase/                           # PostgreSQL schemas, migrations, RLS hardening, SQL views & `pg_net` triggers
├── .editorconfig / .prettierrc / eslint.config.mjs  # Formatting & ESLint + SAST configuration
├── .env / .env.example                 # Local environment credentials (never read/commit `.env`) & template
├── .gitlab-ci.yml                      # GitLab CI parent pipeline orchestrator
├── angular.json / tsconfig*.json       # Angular CLI build/test/lint and strict TypeScript configuration
├── capacitor.config.ts                 # Capacitor 8 Android app metadata & native plugin configuration
├── config.json / remote_config.json    # Firebase Remote Config parameter templates (defaults & descriptions)
├── package.json / package-lock.json    # Dependencies, npm build/test/lint/APK scripts
├── vercel.json                         # Vercel SPA rewrites, security headers (CSP), and `/api/cron-reminder` cron
└── CONTEXT.md / PLAN.md / SUMMARY.md   # SDD baseline architecture, phased Wave tasks, and execution log
```

## Directory Purposes

### Frontend Source (`src/app/`)

**`src/app/core/notifications/`:**
- Purpose: Hosts the Wave 2 hexagonal notification boundary decoupling domain alert logic from FCM/Capacitor/HTTP details.
- Contains: Port interface & `InjectionToken` (`notification-provider.interface.ts`) and concrete adapter subfolder (`adapters/fcm-notification.adapter.ts` + `.spec.ts`).

**`src/app/core/services/`:**
- Purpose: App-wide singleton services (`providedIn: 'root'`) handling infrastructure clients, authentication, navigation, remote configuration, notifications, and exchange rates.
- Key files: `supabase.service.ts`, `supabase-auth.service.ts`, `navigation.service.ts`, `push-notification.service.ts`, `remote-config.service.ts`, `daily-reminder.service.ts`, `trm.service.ts`, `toast.service.ts`.

**`src/app/features/gastos/`:**
- Purpose: Daily expenses hub and primary transaction creation entry point (`GastosPage`, `ExpensesService`).
- Contains: `data/` (`expense.model.ts`, `expenses.service.ts`), `components/` (`expense-filters/`, `expense-daily-chart/`, `expense-category-chart/`, `expense-table/`, `expense-form-modal/` — unified modal routing gastos, TC charges, debt payments, fixed expenses, and project expenses).

**`src/app/features/ingresos/`:**
- Purpose: Household income tracking (`Benny` / `Charlie`) with monthly bar & trend charts (`IngresosPage`, `IncomesService`).
- Contains: `data/` (`income.model.ts`, `incomes.seed.ts`, `incomes.service.ts`), `charts/` (`chart-tooltip.ts`, `chart-utils.ts`), `components/` (`income-filters/`, `income-bar-chart/`, `income-trend-chart/`, `income-table/`, `income-form-modal/`).

**`src/app/features/resumen/`:**
- Purpose: Executive monthly/yearly income vs. expense summary, savings rate, and cumulative balance (`ResumenPage`, `ResumenService`).
- Contains: `data/` (`resumen.model.ts`, `resumen.service.ts` reading `public.v_monthly_summary` with local fallback), `components/` (`resumen-filters/`, `resumen-kpis/`, `resumen-bar-chart/`, `resumen-line-chart/`, `resumen-table/`).

**`src/app/features/categoria/`:**
- Purpose: Category expenditure distribution and per-category monthly budget threshold management (`CategoriaPage`, `CategoriaService`).
- Contains: `data/` (`categoria.model.ts`, `categoria.service.ts`), `components/` (`categoria-filters/`, `categoria-bar-chart/`, `categoria-donut-chart/`, `categoria-table/`, `category-budget-modal/`).

**`src/app/features/gastos-fijos/`:**
- Purpose: Recurring monthly obligations matrix, quick unpaid checklist modal, deterministic due-date calculation, and hexagonal alert orchestration (`GastosFijosPage`, `FixedExpensesService`, `FixedExpenseAlertsService`).
- Contains: `data/` (`fixed-expense.model.ts`, `fixed-expenses.service.ts`, `fixed-expense-alerts.service.ts`), `utils/` (`due-date-calculator.ts`), `components/` (`fixed-expense-modal/`, `fixed-expenses-quick-modal/`).

**`src/app/features/deudas/`:**
- Purpose: Debt tracking, 36-month French amortization projections, and extraordinary prepayments (`DeudasPage`, `DebtsService`).
- Contains: `data/` (`debt.model.ts`, `debts.service.ts`), `components/` (`debt-cards/`, `debt-filters/`, `debt-form-modal/`, `debt-payments-chart/`, `debt-prepayment-modal/`, `debt-projection-chart/`, `debt-table/`).

**`src/app/features/tc-compartida/`:**
- Purpose: Multi-card shared credit card management, 50/50 split metrics, and chronological FIFO payment amortization (`TcPage`, `TcService`).
- Contains: `data/` (`tc.model.ts`, `tc-card.model.ts`, `tc.service.ts`), `components/` (`tc-cards-grid/`, `tc-card-modal/`, `tc-filters/`, `tc-form-modal/`, `tc-kpis/`, `tc-payments-list/`, `tc-table/`).

**`src/app/features/proyectos/`:**
- Purpose: Goal/event budgeting (trips, events) supporting multi-currency `COP`/`USD` conversion via `TrmService` and linked card/daily expenses (`ProyectosPage`, `ProjectsService`).
- Contains: `data/` (`project.model.ts`, `projects.service.ts`), `components/` (`project-card/`, `project-detail/`, `project-expense-modal/`, `project-form-modal/`).

**`src/app/shared/`:**
- Purpose: Cross-feature presentational components and pure utility helpers.
- `ui/`: `auth-login/`, `badge/`, `daily-reminder-banner/`, `icon/`, `modal/`, `select/`, `sidebar/`, `splash-screen/` (unused/legacy), `toast-container/`.
- `utils/`: `color.ts` (`hexToRgba`), `format.utils.ts` (`formatThousands`, `parseThousands`), `security.util.ts` (`escapeHtml`).

### Backend, Mobile, Automation & Tooling

**`api/`:**
- Purpose: Vercel Node.js ESM serverless functions deployed alongside the Angular SPA.
- Key files: `api/notify.js` (FCM v1 push dispatcher + Supabase DB webhook handler), `api/fcm-token.js` (token CRUD in `public.fcm_tokens`), `api/cron-reminder.js` (7 PM Colombia fixed-expense due alerts & missing-expense reminder).

**`supabase/`:**
- Purpose: PostgreSQL DDL schemas, incremental feature migrations, RLS policies, SQL views, and `pg_net` database webhook triggers.
- Key files: `schema.sql` (base tables), `fix_all_tables_rls_and_schemas.sql` (consolidated schema/RLS), `security_hardening_rls.sql`, `fix_rls_for_automation.sql` (grants `anon` + `authenticated` access for GAS & app), `v_monthly_summary.sql`, `database_webhooks_notifications.sql`, `add_due_alert_columns_to_fixed_expenses.sql`, `fcm_tokens_schema.sql`, `create_app_users.sql`, plus table-specific schemas (`debts_schema.sql`, `projects_schema.sql`, `tc_cards_schema.sql`, `tc_expenses_schema.sql`, `category_budgets_schema.sql`, `deploy_*.sql`, `seed_dev.sql`, `populate_prod_from_dev.sql`).

**`android/`:**
- Purpose: Capacitor 8 Android Gradle project (`appId: co.wearebdycr.expenseshome`, `.dev` suffix on `debug` buildType).
- Key files: `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/co/wearebdycr/expenseshome/MainActivity.java`, `android/app/src/main/res/` (generated icons/splashes).

**`scripts/`:**
- Purpose: Build-time environment injection, Firebase/Android packaging automation, and one-off DB maintenance scripts.
- Key files: `scripts/set-env.js` (generates `src/environments/environment*.ts`), `scripts/patch-google-services.js` (clones prod Firebase client to `.dev` package in `google-services.json`), `scripts/generate-android-assets.py` (rasterizes `public/favicon.svg` via ImageMagick), `scripts/migrate-compartido.js`, `scripts/populate-dev.js`.

**`automation/bancolombia-sync/`:**
- Purpose: External Gmail automation reading Bancolombia purchase/transfer emails into Supabase.
- Key files: `automation/bancolombia-sync/bancolombia-sync.gs`, `automation/bancolombia-sync/README.md`.

**`public/`:**
- Purpose: Root static assets copied directly into `dist/expenses-home/browser/` by `angular.json`.
- Key files: `public/firebase-messaging-sw.js`, `public/manifest.json`, `public/favicon.svg`, `public/favicon.ico`.

**`HUS/`:**
- Purpose: Product requirements and user stories (`HU01-sidebar.md` through `HU09-tec3.md`) plus reference UI screenshots (`HUS/img/*.png`).

**`.antigravity/`, `.claude/`, `.github/`, `.gitlab/`:**
- Purpose: SDD workflow rules (`.antigravity/rules.md`), Angular 17+ coding skill references (`.claude/skills/angular-frontend-dev/SKILL.md` + `references/*.md`), GitHub Actions (`.github/workflows/tests.yml`, `scan.yml`, `deploy.yml`, `android-apk.yml`, `reminders-cron.yml`), and GitLab modular CI (`.gitlab/ci/*.gitlab-ci.yml`).

## Key File Locations

**Entry Points:**
- `src/index.html`: HTML shell, PWA manifest link, safe-area viewport meta tag.
- `src/main.ts`: Angular `bootstrapApplication(App, appConfig)` bootstrap.
- `src/app/app.config.ts`: Global providers and `NOTIFICATION_PROVIDER` binding.
- `src/app/app.ts` & `src/app/app.html`: Root component, auth lock gate, `@switch` view router.
- `public/firebase-messaging-sw.js`: Web Push background Service Worker.
- `api/notify.js`, `api/fcm-token.js`, `api/cron-reminder.js`: Serverless API & scheduled cron handlers.
- `android/app/src/main/java/co/wearebdycr/expenseshome/MainActivity.java`: Android native WebView activity.
- `automation/bancolombia-sync/bancolombia-sync.gs`: External Gmail ingestion script.

**Configuration & SDD Governance:**
- `CONTEXT.md`, `PLAN.md`, `SUMMARY.md`, `.antigravity/rules.md`: SDD baseline, Wave task checklist, and verification log.
- `scripts/set-env.js`: Pre-build/pre-test generator for `src/environments/environment.ts`.
- `angular.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `eslint.config.mjs`: Compiler, build, test, and SAST lint rules.
- `capacitor.config.ts`, `vercel.json`: Mobile runtime and Vercel hosting/CSP/cron config.

**Core Logic & Abstractions:**
- `src/app/core/notifications/notification-provider.interface.ts`: Outbound notification port contract.
- `src/app/core/notifications/adapters/fcm-notification.adapter.ts`: FCM serverless HTTP adapter.
- `src/app/features/gastos-fijos/utils/due-date-calculator.ts`: Pure UTC-noon due-date calculator.
- `src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts`: Hexagonal fixed-expense alert orchestrator.
- `src/app/core/services/navigation.service.ts`: Hash/storage navigation + Capacitor back-button handler.
- `src/app/core/services/supabase-auth.service.ts`: Supabase Auth email login, 10-min inactivity token expiry, 5-attempt lockout.
- `src/app/features/tc-compartida/data/tc.service.ts`: FIFO shared credit-card amortization (`calculateAmortizedPendingDebt`).
- `src/app/features/deudas/data/debt.model.ts`: French amortization formulas (`calculateAmortization`, `calculateMonthlyPayment`).

**Testing:**
- `src/app/smoke.spec.ts`: Critical bootstrap and ingestion smoke tests.
- `src/app/**/*.spec.ts`: Co-located Vitest unit specs (62+ suites covering core services, adapters, pure utilities, feature services, and components).

## Naming Conventions

**Files:**
- **Angular components (suffix-less modern style):** `<kebab-name>.ts`, `<kebab-name>.html`, `<kebab-name>.css`, `<kebab-name>.spec.ts` (e.g., `gastos.ts`, `expense-form-modal.ts`, `sidebar.ts`, `auth-login.ts`). Do **not** append `.component.ts`.
- **Services:** `<kebab-name>.service.ts` and `<kebab-name>.service.spec.ts` (e.g., `expenses.service.ts`, `fixed-expense-alerts.service.ts`).
- **Models & Contracts:** `<singular-domain>.model.ts` (e.g., `expense.model.ts`, `fixed-expense.model.ts`) and `<port-name>.interface.ts` (e.g., `notification-provider.interface.ts`).
- **Adapters & Utilities:** `<name>.adapter.ts` inside `adapters/`, `<name>.util.ts` / `<name>.utils.ts` or pure feature helpers under `utils/` (`due-date-calculator.ts`, `format.utils.ts`, `security.util.ts`).
- **Serverless & Scripts:** `<kebab-name>.js` for Vercel/Node scripts (`cron-reminder.js`, `set-env.js`); `<snake_name>.sql` for Supabase SQL scripts.

**Symbols & Selectors:**
- **Page components:** `<Feature>Page` with selector `app-<feature>-page` (e.g., `GastosPage` -> `app-gastos-page`, `TcPage` -> `app-tc-page`).
- **Child / Shared components:** PascalCase class without `Component` suffix (`Sidebar`, `AuthLogin`, `ExpenseFormModal`, `FixedExpenseModal`), selector `app-<kebab-name>`.
- **Domain & Business naming:** Financial domain types and UI copy use Spanish domain terms (`gastos`, `ingresos`, `deudas`, `proyectos`, `resumen`, `tc-compartida`, `GastoFijoAlerta`, `calcularVencimientoGastoFijo`) paired with English technical scaffolding (`Service`, `Adapter`, `NotificationProvider`).

**Directories:**
- Use `kebab-case` for all feature, component, and utility directories (`gastos-fijos/`, `tc-compartida/`, `daily-reminder-banner/`).

## Where to Add New Code

**New Feature Module:**
- Primary feature folder: `src/app/features/<feature-kebab>/`
  - Page component: `src/app/features/<feature-kebab>/<feature-kebab>.ts` (+ `.html`, `.css`, `.spec.ts`)
  - Domain contracts & state service: `src/app/features/<feature-kebab>/data/<entity>.model.ts` and `<feature>.service.ts` (+ `.spec.ts`)
  - Pure domain logic: `src/app/features/<feature-kebab>/utils/<calculator>.ts` (+ `.spec.ts`)
  - Sub-components & modals: `src/app/features/<feature-kebab>/components/<subcomponent-kebab>/`
- Wire navigation: Register the new `SidebarPageId` in `src/app/shared/ui/sidebar/sidebar.ts`, `VALID_SIDEBAR_PAGES` in `src/app/core/services/navigation.service.ts`, and add the `@case` branch in `src/app/app.html` + import in `src/app/app.ts`.

**New Component or Modal inside an Existing Feature:**
- Place under `src/app/features/<feature>/components/<component-kebab>/<component-kebab>.{ts,html,css,spec.ts}`.
- Use `standalone: true` (implicit in Angular 22), `ChangeDetectionStrategy.OnPush`, `inject()`, `input()` / `output()` / `signal()`, and `@if`/`@for`/`@switch`.

**New Outbound Port & Infrastructure Adapter (Hexagonal Pattern):**
- Define the abstract port interface, immutable DTOs, and `InjectionToken` in `src/app/core/<capability>/<capability>-provider.interface.ts`.
- Implement concrete SDK/HTTP adapters in `src/app/core/<capability>/adapters/<impl>.adapter.ts` (+ `.spec.ts`).
- Bind the token in `src/app/app.config.ts` (`{ provide: TOKEN, useExisting: ConcreteAdapter }`).

**New Core Cross-Cutting Service:**
- Place in `src/app/core/services/<name>.service.ts` (+ `.spec.ts`) with `@Injectable({ providedIn: 'root' })`.
- Never import from `src/app/features/*`; depend only on `core/` interfaces/adapters or `shared/utils/`.

**New Shared UI Primitive or Utility:**
- Shared UI component: `src/app/shared/ui/<component-kebab>/<component-kebab>.{ts,html,css,spec.ts}` (avoid importing feature services).
- Pure shared utility: `src/app/shared/utils/<name>.utils.ts` (+ `.spec.ts`).

**New Vercel Serverless Endpoint:**
- Add an ESM handler (`export default async function handler(req, res)`) at `api/<endpoint-kebab>.js`.
- If scheduled, add a cron entry to `vercel.json` or `.github/workflows/`. Verify `/api/*` bypasses the SPA rewrite in `vercel.json`.

**New Database Table, Column Migration, or Trigger:**
- Add an idempotent SQL script in `supabase/<descriptive_snake_case>.sql` (include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, policies, `ALTER PUBLICATION supabase_realtime`, and `NOTIFY pgrst, 'reload schema'` when altering PostgREST columns).
- Mirror consolidated schema changes in `supabase/fix_all_tables_rls_and_schemas.sql` if full bootstrap parity is required.

**New Build/DevOps Script:**
- Add Node or Python tooling under `scripts/<kebab-name>.{js,py}` and invoke via `package.json` scripts or `.github/workflows/`.

**New Tests:**
- Co-locate Vitest `.spec.ts` files directly alongside the unit under test (`<file>.spec.ts`).
- Mock external boundaries (`MockNotificationProvider`, `HttpTestingController`, or `SupabaseService` proxy) rather than making live network calls.

## Special Directories

| Directory | Purpose | Generated? | Committed to Git? |
|-----------|---------|------------|-------------------|
| `src/environments/` | Environment configs (`environment.ts`, `environment.development.ts`) generated by `scripts/set-env.js` | Yes | No (gitignored in `.gitignore`) |
| `dist/` | Production Angular browser bundle (`dist/expenses-home/browser`) | Yes | No (gitignored in `.gitignore`) |
| `apk/` | Local compiled APK artifacts (`FinanzasHogar-*.apk`) | Yes | No (gitignored in `.gitignore`) |
| `android/app/src/main/assets/` | Capacitor-synced web bundle (`public/`), `capacitor.config.json`, `capacitor.plugins.json` | Yes | No (gitignored in `android/.gitignore`) |
| `android/app/build/`, `android/.gradle/`, `android/capacitor-cordova-android-plugins/` | Gradle build outputs and synced Capacitor plugin bridge | Yes | No (gitignored in `android/.gitignore`) |
| `.angular/cache/` | Angular CLI build cache | Yes | No (gitignored in `.gitignore`) |
| `node_modules/`, `.npm/` | Installed npm packages and local npm cache | Yes | No (gitignored in `.gitignore`) |
| `.planning/codebase/` | GSD codebase exploration documents (`ARCHITECTURE.md`, `STRUCTURE.md`) | Yes (GSD) | Optional (not gitignored; check team preference) |
| `CONTEXT.md`, `PLAN.md`, `SUMMARY.md`, `.antigravity/` | SDD governance triad and workflow rules | No | Yes |
| `.claude/` | Local AI Angular skill guidelines (`SKILL.md`, `references/*.md`) | No | Yes |

---

*Structure analysis: 2026-11-11*
