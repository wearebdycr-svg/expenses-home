# Coding Conventions

**Analysis Date:** 2026-11-11

## Naming Patterns

**Files:**
- Omit the `.component` suffix for standalone components (Angular 17+ style per `.claude/skills/angular-frontend-dev/SKILL.md`), placing each component in a kebab-case folder with co-located `.ts`, `.html`, `.css`, and `.spec.ts` files:
  - Pages: `src/app/features/gastos/gastos.ts`, `src/app/features/gastos-fijos/gastos-fijos.ts`
  - UI & feature subcomponents: `src/app/shared/ui/modal/modal.ts`, `src/app/features/gastos-fijos/components/fixed-expense-modal/fixed-expense-modal.ts`
- Append role suffixes for non-component TypeScript modules:
  - Services: `*.service.ts` (`src/app/core/services/navigation.service.ts`, `src/app/features/gastos-fijos/data/fixed-expenses.service.ts`)
  - Domain models & types: `*.model.ts` (`src/app/features/gastos/data/expense.model.ts`, `src/app/features/gastos-fijos/data/fixed-expense.model.ts`)
  - Port contracts: `*.interface.ts` (`src/app/core/notifications/notification-provider.interface.ts`)
  - Port adapters: `*.adapter.ts` (`src/app/core/notifications/adapters/fcm-notification.adapter.ts`)
  - Seed data: `*.seed.ts` (`src/app/features/ingresos/data/incomes.seed.ts`)
  - Utilities: `*.utils.ts`, `*.util.ts`, or descriptive kebab-case (`src/app/shared/utils/format.utils.ts`, `src/app/shared/utils/security.util.ts`, `src/app/features/gastos-fijos/utils/due-date-calculator.ts`)
  - Unit tests: co-located `*.spec.ts` (`src/app/core/services/navigation.service.spec.ts`)
- Name serverless handlers (`api/*.js`), DevOps scripts (`scripts/*.js`, `scripts/*.py`), and SQL migrations (`supabase/*.sql`) in kebab-case (JS/Python) or snake_case (SQL, e.g., `supabase/add_due_alert_columns_to_fixed_expenses.sql`).

**Classes & Selectors:**
- Drop the `Component` suffix on component classes:
  - Root shell: `App` (`src/app/app.ts`)
  - Feature page containers end in `Page`: `GastosPage` (`src/app/features/gastos/gastos.ts`), `CategoriaPage` (`src/app/features/categoria/categoria.ts`), `GastosFijosPage` (`src/app/features/gastos-fijos/gastos-fijos.ts`), `DeudasPage`, `IngresosPage`, `ProyectosPage`, `ResumenPage`, `TcPage`
  - Shared/feature subcomponents use descriptive PascalCase: `Sidebar`, `Modal`, `Badge`, `Select`, `FixedExpenseModal`, `ExpenseFormModal`
- Enforce selector prefixes via `eslint.config.mjs`:
  - Components: element selector with `app-` kebab-case prefix (`selector: 'app-fixed-expense-modal'`, `selector: 'app-gastos-page'`)
  - Directives: attribute selector with `app` camelCase prefix (`@angular-eslint/directive-selector`)
- Suffix services with `Service` (`ExpensesService`, `FixedExpenseAlertsService`), adapters with `Adapter` (`FcmNotificationAdapter`), and database row interfaces with `DatabaseRow` (`FixedExpenseDatabaseRow`).

**Functions & Variables:**
- Use `camelCase` for functions, methods, signals, and local variables (`addExpense`, `formatThousands`, `isValidSidebarPage`, `monthlyStatuses`, `diaLimiteMes`).
- Prefix boolean predicates and Type Guards with `is` or `has` (`isValidDiaLimiteMes`, `isGastoFijoAlerta`, `isValidSidebarPage`, `isEditMode`, `hasErrors`, `hasSubcategories`).
- Use `UPPER_SNAKE_CASE` for module constants, storage keys, InjectionTokens, and immutable lookup arrays/maps (`ACTIVE_PAGE_STORAGE_KEY`, `EXPENSE_CATEGORIES`, `DEFAULT_REMOTE_CONFIG`, `NOTIFICATION_PROVIDER`, `MS_POR_DIA`).

**Types & Interfaces:**
- Use `PascalCase` without `I` prefix for domain models, DTOs, and ports (`Expense`, `ExpenseDraft`, `FixedExpense`, `NotificationProvider`, `NotificationPayload`, `NotificationResult`).
- Exception observed: `INavigationService` in `src/app/core/services/navigation.service.ts` uses an `I` prefix for an explicit service interface contract.
- Use `Readonly<T>` and `readonly` interface properties for immutable domain contracts and pure-function inputs/outputs (established in `src/app/core/notifications/notification-provider.interface.ts` and `src/app/features/gastos-fijos/data/fixed-expense.model.ts`).

**Bilingual Domain Naming (Spanish vs. English):**
- Follow the codebase split consistently:
  - **English** for technical infrastructure, CRUD methods, legacy models, and generic UI primitives (`ExpensesService`, `addExpense`, `updateExpense`, `deleteExpense`, `loading`, `error`, `ToastService`, `Modal`, `Select`, `Sidebar`, `FcmNotificationAdapter`).
  - **Spanish** for feature folders/pages, household domain literals, SQL/Wave 2 domain contracts, UI copy, comments, and error messages:
    - Feature directories: `gastos`, `ingresos`, `resumen`, `categoria`, `gastos-fijos`, `deudas`, `tc-compartida`, `proyectos`
    - Household domain unions: `ExpensePerson = 'Benny' | 'Charlie' | 'Compartido'`, `FixedExpenseStatus = 'activo' | 'inactivo'`
    - Wave 2 pure domain models & snake_case DB fields matching PostgreSQL (`src/app/features/gastos-fijos/data/fixed-expense.model.ts`, `src/app/features/gastos-fijos/utils/due-date-calculator.ts`): `GastoFijoAlerta`, `EstadoVencimiento` (`'al_dia' | 'proximo' | 'vence_hoy' | 'vencido'`), `ResultadoCalculoVencimiento`, `calcularVencimientoGastoFijo`, `dia_limite_mes`, `dias_anticipacion_alerta`, `evaluarAlertas`, `despacharAlertas`.

## Code Style

**Formatting:**
- Prettier (`^3.8.1` in `package.json`, `.prettierrc`):
  - `printWidth: 100`
  - `singleQuote: true`
  - `*.html` files use `"parser": "angular"`
- EditorConfig (`.editorconfig`):
  - `charset = utf-8`, `indent_style = space`, `indent_size = 2`, `insert_final_newline = true`, `trim_trailing_whitespace = true`
  - `[*.ts]`: `quote_type = single`, `ij_typescript_use_double_quotes = false`
  - `[*.md]`: `max_line_length = off`, `trim_trailing_whitespace = false`
- Global styling uses native CSS3 with custom properties in `src/styles.css` (`--sidebar`, `--accent`, `.chartjs-tooltip`) and per-component `.css` files (`styleUrl`). Do not import CSS utility frameworks such as Tailwind.

**Linting (`eslint.config.mjs`):**
- Flat config combining `typescript-eslint` recommended, `angular-eslint` TS/template/templateAccessibility recommended, and `eslint-plugin-security` recommended (`^4.2.0`), with `angular.processInlineTemplates` enabled.
- Active TypeScript & Angular rules:
  - `@angular-eslint/directive-selector`: `'error'` (`type: 'attribute'`, `prefix: 'app'`, `style: 'camelCase'`)
  - `@angular-eslint/component-selector`: `'error'` (`type: 'element'`, `prefix: 'app'`, `style: 'kebab-case'`)
  - `@angular-eslint/no-output-native`: `'warn'` (currently 12 legacy warnings on `cancel`/`close` outputs in modals such as `src/app/shared/ui/modal/modal.ts` and `src/app/features/gastos-fijos/components/fixed-expense-modal/fixed-expense-modal.ts`; avoid naming new `output()` signals after native DOM events)
  - `@typescript-eslint/no-explicit-any`: `'warn'` (currently 90 legacy warnings across pre-SDD services and Chart.js tooltips; prohibited in new SDD code)
  - `@typescript-eslint/no-unused-vars`: `'warn'` with `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }` (7 legacy warnings)
  - `security/detect-object-injection`: `'off'` (disabled to avoid false positives on TypeScript dictionary/record indexing)
  - `security/detect-unsafe-regex`: `'warn'` from `pluginSecurity.configs.recommended` (2 legacy warnings in `src/app/features/categoria/data/categoria.model.ts` and `src/app/features/deudas/data/debt.model.ts`)
- Spec file override (`**/*.spec.ts`): disables `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` for flexible test mocking.
- HTML template rules (`**/*.html`):
  - `@angular-eslint/template/click-events-have-key-events`: `'warn'` (12 legacy warnings)
  - `@angular-eslint/template/interactive-supports-focus`: `'warn'` (11 legacy warnings)
- Current baseline (`HOME=/tmp npx ng lint`): **0 errors, 134 warnings** (90 `no-explicit-any`, 12 `click-events-have-key-events`, 12 `no-output-native`, 11 `interactive-supports-focus`, 7 `no-unused-vars`, 2 `detect-unsafe-regex`).

**TypeScript Compiler Strictness (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`):**
- Compiler flags enabled in `tsconfig.json`:
  - `noImplicitOverride: true`
  - `noPropertyAccessFromIndexSignature: true` (always use bracket syntax `obj['key']` when reading/writing index signatures or `Record<string, unknown>`, e.g., `errs['name']` and `candidate['id']`)
  - `noImplicitReturns: true`
  - `noFallthroughCasesInSwitch: true`
  - `isolatedModules: true`
  - `experimentalDecorators: true`
  - `target: "ES2022"`, `module: "preserve"`
- Angular compiler flags enabled in `tsconfig.json`:
  - `enableI18nLegacyMessageIdFormat: false`
  - `strictInjectionParameters: true`
  - `strictInputAccessModifiers: true`
- **Important baseline note:** `"strict": true` and `"strictTemplates": true` are NOT set in `tsconfig.json`, `tsconfig.app.json`, or `tsconfig.spec.json` (verified via `npx tsc --showConfig -p tsconfig.app.json`), despite `CONTEXT.md` referencing `strict: true`. Write new code as if full strictness is enabled (explicit parameter/return types, null checks, no `any`).
- `tsconfig.app.json` sets `"types": []` and excludes `src/**/*.spec.ts`; `tsconfig.spec.json` sets `"types": ["vitest/globals"]`.

## Angular & Architecture Conventions

**Standalone Components & Change Detection:**
- All 59 `@Component` classes are standalone (`0` `NgModule` files exist). Older components specify `standalone: true` explicitly (35 occurrences); Angular 19+ components omit `standalone: true` as implicit (`App`, `Sidebar`, `Modal`, `Badge`, `Select`, `GastosPage`).
- **Mandatory `OnPush`:** 59 of 59 `@Component` classes set `changeDetection: ChangeDetectionStrategy.OnPush`.
- **Modern Template Control Flow:** Use `@if` / `@else`, `@for (...; track ...)` with `@empty`, and `@switch` / `@case` / `@default` exclusively (`0` `*ngIf`, `*ngFor`, `*ngSwitch` usages exist in `src/`).

**Signals vs. RxJS:**
- Use Signals for all component and service state (`signal()`, `computed()`, `effect()`, `input()`, `input.required()`, `output()`, `model()`, `viewChild()`). `0` `@Input`/`@Output` decorators and `0` `Subject`/`BehaviorSubject` instances exist in `src/`.
- Expose service state as readonly signals (`readonly allExpenses = this.expenses.asReadonly()` in `src/app/features/gastos/data/expenses.service.ts`, `readonly trm = this.trmSignal.asReadonly()` in `src/app/core/services/trm.service.ts`) while mutating internal `private readonly` signals immutably via `.set()` or `.update()`.
- Reserve RxJS `firstValueFrom()` for bridging Angular `HttpClient` observables to `async`/`await` Promises (example: `src/app/core/notifications/adapters/fcm-notification.adapter.ts`).
- Note on routing: `src/app/app.routes.ts` is intentionally empty (`[]`); page switching uses `NavigationService.currentPage` (`signal<SidebarPageId>`) synced with `window.location.hash` and `localStorage` instead of `<router-outlet>`.

**Dependency Injection (`inject()`):**
- Inject dependencies as `private readonly` or `protected readonly` class fields using `inject()` — never constructor parameter injection:
  ```typescript
  // src/app/core/services/navigation.service.ts
  private readonly destroyRef: DestroyRef | null = inject(DestroyRef, { optional: true });
  private readonly tcService: TcService = inject(TcService);
  private readonly authPinService: AuthPinService = inject(AuthPinService);
  ```
- Use `{ optional: true }` when injecting environment-dependent services or port tokens (`NOTIFICATION_PROVIDER`, `DestroyRef`).
- Reserve `constructor()` exclusively for registering DOM/Capacitor listeners, initial data loading, or reactive `effect()` blocks (`src/app/app.ts`, `src/app/features/gastos/gastos.ts`).
- Register application-wide services with `@Injectable({ providedIn: 'root' })`.

**`any` Restrictions & Type Safety:**
- Prohibit `any` in all new or refactored code (Wave 1+ rule in `.antigravity/rules.md`). Replace `any` with:
  - Typed Supabase row interfaces (e.g., `FixedExpenseDatabaseRow` in `src/app/features/gastos-fijos/data/fixed-expenses.service.ts`)
  - `unknown` in `catch (error: unknown)` and Type Guards (`error instanceof HttpErrorResponse`, `isValidSidebarPage`, `isGastoFijoAlerta`)
  - Typed input event handlers on component classes (`onNameInput(event: Event): void` in `FixedExpenseModal`) instead of `$any($event.target)` in HTML templates.

**Ports & Adapters (Dependency Inversion Principle):**
- Isolate domain/orchestration logic from external SDKs (Firebase, Capacitor, Web Push) behind `InjectionToken` interfaces:
  - **Port:** `src/app/core/notifications/notification-provider.interface.ts` defines `NotificationProvider`, `NotificationPayload`, `NotificationResult`, and `NOTIFICATION_PROVIDER`.
  - **Adapter:** `src/app/core/notifications/adapters/fcm-notification.adapter.ts` implements `NotificationProvider` via Angular `HttpClient` and `Capacitor.isNativePlatform()`.
  - **Binding:** `src/app/app.config.ts` wires `{ provide: NOTIFICATION_PROVIDER, useExisting: FcmNotificationAdapter }`.
  - **Consumer:** `src/app/features/gastos-fijos/data/fixed-expense-alerts.service.ts` injects `NOTIFICATION_PROVIDER` optionally and composes the pure calculator `calcularVencimientoGastoFijo` from `src/app/features/gastos-fijos/utils/due-date-calculator.ts`.

## Import Organization

**Order:**
1. Angular core/common/HTTP/testing packages (`@angular/core`, `@angular/common`, `@angular/common/http`, `@angular/core/testing`)
2. Third-party runtime or test libraries (`@capacitor/*`, `@supabase/supabase-js`, `rxjs`, `chart.js`, `ng2-charts`, `vitest`)
3. Core & shared internal modules (`environment`, `src/app/core/*`, `src/app/shared/*`)
4. Feature-local models, utilities, and sibling services/components (`./data/*.model`, `../utils/*`)

- Use `import type { ... }` for type-only imports (`import type { ExpensePerson } from '../../gastos/data/expense.model'`).

**Path Aliases & Barrel Files:**
- Do not use path aliases (`tsconfig.json` defines no `baseUrl` or `paths`); use relative paths.
- Do not create barrel (`index.ts`) files (`0` `index.ts` files exist in `src/`). Import directly from the target module path.

## Error Handling

**Client Data Services (`ExpensesService`, `FixedExpensesService`):**
- Apply optimistic signal updates (`this.expenses.update(...)`) and persist to `localStorage` immediately, then sync asynchronously with `this.supabase.client`.
- Wrap Supabase calls in `try/catch` AND inspect `{ data, error }` explicitly:
  - On critical insert failures (`ExpensesService.addExpense`), revert the optimistic signal state, update `error` signal, and notify via `ToastService.error(...)`.
  - On schema-cache column mismatch in backwards-compatible deployments (`FixedExpensesService.addFixedExpense` / `updateFixedExpense`), inspect `error.message.includes('schema cache')` and retry without newly added DB columns (`dia_limite_mes`, `dias_anticipacion_alerta`).
  - Guard `localStorage` and Capacitor native calls (`CapApp`, `window`) in `try/catch` or `typeof window !== 'undefined'` checks so SSR/jsdom/Web environments degrade cleanly.

**Port Adapters & Orchestrators:**
- Never throw unhandled exceptions out of a `NotificationProvider` implementation. `FcmNotificationAdapter.sendNotification()` catches both `HttpErrorResponse` and unknown errors and returns `{ success: false, error, timestamp }`.
- Batch dispatchers (`FixedExpenseAlertsService.despacharAlertas`) use `Promise.allSettled()` so individual provider failures increment `fallidas` without aborting remaining alerts.

**Serverless Endpoints (`api/*.js`) & Scripts (`scripts/*.js`):**
- Handle `OPTIONS` preflight, reject unsupported HTTP methods with `405`, verify Bearer tokens (`CRON_SECRET`, `NOTIFY_SECRET`, `supabaseAnonKey`, or `supabase.auth.getUser(token)` -> `401`), validate payload types/lengths (`400`), and return JSON errors (`500`).
- Validate external Supabase URLs in CLI scripts (`scripts/migrate-compartido.js`, `scripts/populate-dev.js`) against `https:` and `*.supabase.co` to prevent SSRF.
- Sanitize strings interpolated into Chart.js HTML tooltips using `escapeHtml()` from `src/app/shared/utils/security.util.ts`.

## Logging

**Framework:** Standard `console.log`, `console.warn`, and `console.error` (no logging library; 114 calls in `src/` non-spec files, 29 in `api/`).

**Patterns:**
- Prefix log messages with bracketed subsystem tags (`[Native Push]`, `[Cron FCM]`, `[Cron Gastos Fijos]`, `[ENV]`, `[AUTO-MIGRATION]`, `[patch-google-services]`).
- Surface user-facing errors through `ToastService` (`success`, `info`, `warning`, `error`) rather than relying solely on `console`.

## Comments

**When to Comment:**
- Write comments and JSDoc in Spanish explaining business invariants, timezone normalization rationale, database schema fallbacks, or real-time echo suppression windows (e.g., `// Ignorar eventos de eco causados por mutaciones de este mismo cliente` in `src/app/features/gastos/data/expenses.service.ts`).
- Mark deprecated backward-compatibility fields with `@deprecated` JSDoc tags (e.g., `dueDay?: number` in `src/app/features/gastos-fijos/data/fixed-expense.model.ts`).

**JSDoc/TSDoc:**
- Document exported interfaces, pure domain functions, Type Guards, and service methods using `/** ... */` blocks with `@param` and `@returns` tags (158 JSDoc blocks across `src/app/`).

## Function Design

**Pure Domain Logic:**
- Isolate deterministic calculations into side-effect-free functions under `utils/` (`src/app/features/gastos-fijos/utils/due-date-calculator.ts`):
  - Inject reference dates as parameters (`fechaReferencia: Date | string`) — never call `new Date()` or `Date.now()` inside pure domain functions.
  - Freeze returned domain objects with `Object.freeze(...)` and annotate inputs with `Readonly<T>`.
- Target <150 lines per component or focused module (enforced during Wave 1/2 refactoring: `App` = 107 lines, `FcmNotificationAdapter` = 106 lines, `due-date-calculator.ts` = 119 lines, `FixedExpenseAlertsService` = 134 lines).

**Parameters & Return Values:**
- Provide explicit return types on all exported and class methods (`: void`, `: Promise<NotificationResult>`, `: ResultadoCalculoVencimiento`).
- Use discriminated union return types (`BackButtonActionResult`, `EstadoVencimiento`) and structured result objects (`ResultadoDespachoAlertas`) instead of untyped tuples or magic strings.

## Module Design

**Exports & Organization:**
- Use named exports exclusively across TypeScript modules (`export class ...`, `export function ...`, `export interface ...`); avoid `export default` in `src/`. (Vercel serverless endpoints in `api/*.js` use `export default async function handler(req, res)` as required by Vercel Node ESM runtime.)
- Organize code by feature vertical under `src/app/features/<feature>/` (`components/`, `data/`, `utils/`, `charts/`) with shared primitives under `src/app/shared/` and singletons/ports under `src/app/core/`.

## Git & SDD Workflow Conventions

**Git Commit Format (Conventional Commits):**
- Format: `<type>(<scope>): <description>` (or `<type>: <description>` for cross-cutting changes).
- Observed types: `feat`, `fix`, `refactor`, `test`, `chore`, `style`, `perf`.
- Observed scopes: `wave-0`, `wave-1`, `wave-2`, `sdd`, `gastos`, `gastos-fijos`, `notifications`, `cron`, `deudas`, `tcs`, `tc`, `categoria`, `categorias`, `proyectos`, `auth`, `security`, `lint`, `ci`, `db`, `ui`, `automation`, `expenses`, `trm`, `multidivisa`, `sidebar`.
- Example: `feat(gastos-fijos): implement pure due date calculation logic with timezone normalization`.

**Agentic SDD & GSD Rules (`.antigravity/rules.md` & `CONTEXT.md`):**
- Maintain the planning triad (`CONTEXT.md`, `PLAN.md`, `SUMMARY.md`) strictly across the 5-step protocol:
  - **PASO 0 (Bootstrap):** Establish `CONTEXT.md`, `PLAN.md`, `SUMMARY.md` before writing code.
  - **PASO 1 (Architecture):** Read `CONTEXT.md` first, define data models/pure rules/ports, and present a diff/proposal before touching implementation files.
  - **PASO 2 (Wave Breakdown):** Decompose `PLAN.md` tasks (`- [ ] X.Y`) in strictly increasing coupling order: Phase A (Contracts/Models) -> Phase B (Pure Logic + TDD) -> Phase C (Adapters/Orchestrators via DIP) -> Phase D (UI/Cron/Endpoint integration).
  - **PASO 3 (Atomic Execution):** Implement only the assigned task `- [ ] X.Y`, with zero `any`, closed scope, and an accompanying typecheck/test command.
  - **PASO 4 (Certification & Sync):** Verify `tsc --noEmit`, `ng lint`, and `ng test` pass with 0 regressions, mark `- [X] X.Y` in `PLAN.md`, log deliverables/metrics in `SUMMARY.md`, and produce the conventional commit message.
- **Protected No-Touch Zones (`CONTEXT.md` §5):** Do not modify or refactor `src/app/features/tc-compartida/data/tc.service.ts` (1,112 lines), `src/app/core/services/push-notification.service.ts` (919 lines), `src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts` (795 lines), `src/app/features/proyectos/data/projects.service.ts` (786 lines), `src/app/features/deudas/data/debts.service.ts` (641 lines), `src/app/core/services/auth-pin.service.ts` (636 lines), or `scripts/set-env.js` (131 lines) without prior regression tests and explicit approval.

---

*Convention analysis: 2026-11-11*
