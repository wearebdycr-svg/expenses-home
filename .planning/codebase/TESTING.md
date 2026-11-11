# Testing Patterns

**Analysis Date:** 2026-11-11

## Test Framework

**Runner:**
- Vitest (`^4.0.8` in `package.json`; runtime `v4.1.10`) via Angular CLI builder `@angular/build:unit-test` (`angular.json` lines 76–78).
- DOM environment: `jsdom` (`^28.0.0`).
- Config files: No standalone `vitest.config.*`, `jest.config.*`, or `karma.conf.js` exists; runner behavior is configured via `angular.json` (`test` target) and `tsconfig.spec.json` (`"types": ["vitest/globals"]`, includes `src/**/*.d.ts` and `src/**/*.spec.ts`).
- Note on legacy artifacts: `.vscode/launch.json` still lists a legacy Karma URL (`http://localhost:9876/debug.html`), and `.claude/skills/angular-frontend-dev/references/testing.md` references Jest/Karma syntax; always use Vitest (`vi.fn()`, `vi.spyOn()`, `expect`) in this repo.
- Pre-test hook (`package.json`): `pretest`, `test`, `pretest:ci`, and `test:ci` execute `node scripts/set-env.js` to generate `src/environments/environment.ts` and `src/environments/environment.development.ts` before compiling tests.

**Assertion Library:**
- Vitest `expect` (global via `tsconfig.spec.json` or explicitly imported from `'vitest'`).

**Run Commands:**
```bash
HOME=/tmp npm run test:ci                                      # Full suite single-run (sandbox-safe)
npm run test:ci                                                # Full suite single-run (local shell with writable $HOME)
npm test                                                       # Interactive watch mode
HOME=/tmp npx ng test --watch=false                            # Run Vitest directly without re-running set-env.js
HOME=/tmp npx ng test --include=src/app/smoke.spec.ts --watch=false  # Run a single spec file
HOME=/tmp npx ng test --filter="^App" --watch=false            # Filter suites/tests by regex
```
*(Pass `HOME=/tmp` in sandboxed/CI environments where `~/.angular-config.json` is read-only.)*

**Lint, Typecheck & Build Commands:**
```bash
npx tsc --noEmit                                               # Typecheck application code (tsconfig.json -> tsconfig.app.json)
npx tsc --noEmit -p tsconfig.spec.json                         # Typecheck test files
HOME=/tmp npm run lint                                         # ESLint + angular-eslint + eslint-plugin-security
npm run lint:fix                                               # Auto-fix ESLint warnings/errors where supported
npm run build                                                  # Production build (runs prebuild -> set-env.js + ng build)
npm run build:dev                                              # Force DEV environment + ng build
npm run build:prod                                             # Force PROD environment + ng build
npm run audit                                                  # npm audit --audit-level=high
node --check api/cron-reminder.js                              # Syntax check Node ESM serverless functions
```

## Test File Organization

**Location:**
- Co-located next to the source module under `src/app/` (`<module>.spec.ts` alongside `<module>.ts`).
- Global smoke tests live at `src/app/smoke.spec.ts`; root bootstrap/DI tests live at `src/app/app.spec.ts` and `src/app/app.config.spec.ts`.

**Naming:**
- Always suffix test files with `.spec.ts` (enforced by `tsconfig.spec.json` include pattern `src/**/*.spec.ts` and `eslint.config.mjs` override `**/*.spec.ts`).

**Structure:**
```text
src/app/
├── app.config.spec.ts
├── app.spec.ts
├── smoke.spec.ts
├── core/
│   ├── notifications/adapters/fcm-notification.adapter.spec.ts
│   └── services/*.service.spec.ts
├── features/
│   └── <feature>/
│       ├── <feature>.spec.ts
│       ├── components/<name>/<name>.spec.ts
│       ├── data/<name>.service.spec.ts
│       └── utils/<name>.spec.ts
└── shared/
    ├── ui/<name>/<name>.spec.ts
    └── utils/<name>.spec.ts
```

## Test Structure

**Suite Organization (Standalone Components & Services):**
```typescript
// src/app/features/gastos-fijos/components/fixed-expense-modal/fixed-expense-modal.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FixedExpenseModal } from './fixed-expense-modal';

describe('FixedExpenseModal', () => {
  let fixture: ComponentFixture<FixedExpenseModal>;
  let component: FixedExpenseModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FixedExpenseModal],
    }).compileComponents();

    fixture = TestBed.createComponent(FixedExpenseModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits save event with dia_limite_mes and dias_anticipacion_alerta when valid', () => {
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);
    // ... dispatch DOM events and assert
  });
});
```

**Patterns:**
- **Import style:** Newer Wave 0–2 specs explicitly import `{ describe, it, expect, beforeEach, afterEach, vi }` from `'vitest'`; older specs import only `vi` (or rely on `vitest/globals`). Prefer explicit `vitest` imports in new specs.
- **Storage isolation:** Stateful tests clear `localStorage.clear()` and `sessionStorage.clear()` (and reset `window.location.hash = ''` when testing navigation) in both `beforeEach` and `afterEach`, paired with `vi.restoreAllMocks()`.
- **Signal inputs & outputs:** Set signal `input()` values via `fixture.componentRef.setInput('fixedExpense', existing)` followed by `fixture.detectChanges()`, and subscribe to `output()` emitters with `vi.fn()`.
- **Protected signal inspection:** Specs read `protected` component signals via bracket indexing (`component['pin']()`, `component['currentPage']()`, `app['showFixedExpensesQuickModal']()`) to satisfy TypeScript visibility rules.
- **Pure unit tests without `TestBed`:** Pure functions (`src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts`, `src/app/shared/utils/format.utils.spec.ts`, `src/app/shared/utils/security.util.spec.ts`) import and execute functions directly without initializing `TestBed`.

## Mocking

**Framework:** Vitest `vi.fn()`, `vi.spyOn()`, `vi.useFakeTimers()`, `vi.setSystemTime()`, plus Angular `TestBed` provider overrides and `HttpTestingController`.

**Built-in Supabase & Realtime Auto-Mocking:**
- `src/app/core/services/supabase.service.ts` detects Vitest (`process.env['VITEST'] || process.env['NODE_ENV'] === 'test'`) and injects `createMockClient()` — an ES `Proxy` returning `{ data: [], error: null }` on awaited queries, `{ data: { id: 'mock-id' }, error: null }` on `.single()`, no-op `.channel()`, and a mock `auth` session (`test@familia.com`).
- `ExpensesService.setupRealtime()` (`src/app/features/gastos/data/expenses.service.ts`) exits early when `VITEST` or `NODE_ENV === 'test'` is set.
- `SupabaseAuthService` (`src/app/core/services/supabase-auth.service.ts`) initializes `isAuthenticated = signal(true)` in test environments.

**Patterns:**
```typescript
// 1. Port/Interface DI Mock (src/app/features/gastos-fijos/data/fixed-expense-alerts.service.spec.ts)
class MockNotificationProvider implements NotificationProvider {
  readonly providerName = 'mock-provider';
  supported = true;
  sentCalls: { recipientId: string; payload: NotificationPayload }[] = [];
  // ...
}

TestBed.configureTestingModule({
  providers: [
    FixedExpenseAlertsService,
    { provide: NOTIFICATION_PROVIDER, useValue: mockProvider },
  ],
});

// 2. Angular HttpClient Testing (src/app/core/notifications/adapters/fcm-notification.adapter.spec.ts)
TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting(), FcmNotificationAdapter],
});
const req = httpTesting.expectOne('/api/notify');
req.flush({ success: true, messageId: 'msg-abc-987' });
httpTesting.verify(); // in afterEach

// 3. Capacitor Native Platform Spy (src/app/app.spec.ts, fcm-notification.adapter.spec.ts)
vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

// 4. Deterministic Clock / Fake Timers (src/app/features/deudas/data/debts.service.spec.ts)
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
// afterEach -> vi.useRealTimers();
```

**What to Mock:**
- External notification channels behind `NOTIFICATION_PROVIDER` (`MockNotificationProvider`)
- HTTP requests (`provideHttpClientTesting()` + `HttpTestingController`)
- Native platform bridges (`Capacitor.isNativePlatform`)
- Current clock (`vi.useFakeTimers()`, `vi.spyOn(Date, 'now')`, or explicit `fechaReferencia` arguments)
- Side-effect dispatchers on `PushNotificationService` (`vi.spyOn(service, 'dispatchPushNotification').mockResolvedValue()`)

**What NOT to Mock:**
- Pure mathematical/domain functions (`calcularVencimientoGastoFijo`, `calculateAmortization`, `formatThousands`, `escapeHtml`)
- Angular Signals/computed pipelines inside feature services (`ExpensesService`, `TcService`, `ResumenService`, `FixedExpensesService`) — test actual signal recomputations against clean `localStorage` state
- `SupabaseService` in standard service tests (relies on its built-in test proxy unless testing specific DB failures)

## Fixtures and Factories

**Test Data:**
- Define inline fixture objects or module-scoped base templates directly inside `*.spec.ts` files (no shared `src/testing/` or `fixtures/` directory exists):
  ```typescript
  // src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts
  const mockGastoBase: GastoFijoAlerta = {
    id: 'gf-101',
    nombre: 'Servicio de Internet',
    monto: 85_000,
    dia_limite_mes: 15,
    dias_anticipacion_alerta: 3,
  };
  ```
- Freeze inputs with `Object.freeze(...)` when verifying pure-function immutability (`due-date-calculator.spec.ts`).
- Note: `src/app/features/ingresos/data/incomes.seed.ts` exports `INCOME_SEED` as runtime/API fallback seed data, not as a test factory.

**Location:**
- Inline within each `*.spec.ts` file.

## Coverage

**Requirements & Tooling Status:**
- **No coverage threshold** is configured in `angular.json` or enforced in CI (`.github/workflows/tests.yml`, `.gitlab/ci/tests.gitlab-ci.yml`).
- Running `HOME=/tmp npx ng test --watch=false --coverage` fails because neither `@vitest/coverage-v8` nor `@vitest/coverage-istanbul` is installed in `package.json`.

**Current Observed Suite Metrics (verified 2026-11-11):**
- **62** test suites (`*.spec.ts`) passing, **346** unit/component/smoke tests passing (`HOME=/tmp npx ng test --watch=false`).
- Note on stderr noise during `app.spec.ts`: Firebase Remote Config logs `ReferenceError: indexedDB is not defined` in `jsdom` and falls back to `DEFAULT_REMOTE_CONFIG` without failing tests.

**Coverage Status Across Repository Areas:**

| Area | Non-Spec Code Files | Spec Files | Status & Gaps |
| :--- | :---: | :---: | :--- |
| `src/app/` root (`app.ts`, `app.config.ts`, `app.routes.ts`) | 3 | 3 (`app.spec.ts`, `app.config.spec.ts`, `smoke.spec.ts`) | Root shell, DI provider bindings, and critical smoke flows covered. |
| `src/app/core/` | 11 | 9 | Missing spec for `src/app/core/services/supabase.service.ts` (`createMockClient` proxy & client init untested directly). |
| `src/app/shared/` | 13 | 8 | Missing specs for `badge.ts`, `icon.ts`, `modal.ts`, `select.ts`, and `utils/color.ts`. |
| `src/app/features/categoria/` | 8 | 7 | All components, page, and service tested (`categoria.model.ts` is types/formatters). |
| `src/app/features/deudas/` | 10 | 9 | All components, page, and service tested (`debt.model.ts` math tested via `debts.service.spec.ts`). |
| `src/app/features/gastos/` | 8 | 4 | Missing specs for `gastos.ts`, `expense-category-chart.ts`, and `expense-daily-chart.ts`. |
| `src/app/features/gastos-fijos/` | 7 | 5 | Missing spec for `gastos-fijos.ts` page container (`due-date-calculator`, alerts service, service, and both modals covered). |
| `src/app/features/ingresos/` | 11 | 4 | Missing specs for `ingresos.ts`, `income-bar-chart.ts`, `income-trend-chart.ts`, `charts/chart-tooltip.ts`, `charts/chart-utils.ts`. |
| `src/app/features/proyectos/` | 7 | 3 | Missing specs for `project-card.ts`, `project-detail.ts`, `project-form-modal.ts`. |
| `src/app/features/resumen/` | 8 | 3 | Missing specs for `resumen-bar-chart.ts`, `resumen-filters.ts`, `resumen-kpis.ts`, `resumen-line-chart.ts`. |
| `src/app/features/tc-compartida/` | 11 | 7 | Missing specs for `tc-card-modal.ts` and `tc-cards-grid.ts`. |
| `api/` (Vercel Serverless) | 3 JS files | **0** | **100% untested:** `api/cron-reminder.js` (681 lines, includes duplicated `calcularVencimientoCron` and deduplication logic), `api/notify.js` (382 lines), `api/fcm-token.js` (83 lines). |
| `scripts/` (Node/Python DevOps) | 5 files | **0** | **100% untested:** `scripts/set-env.js`, `scripts/patch-google-services.js`, `scripts/migrate-compartido.js`, `scripts/populate-dev.js`, `scripts/generate-android-assets.py`. |
| `supabase/` (PostgreSQL DDL/RLS) | 30 SQL files | **0** | **100% untested:** No pgTAP, RLS policy tests, or migration verification scripts for `supabase/*.sql` (including `supabase/security_hardening_rls.sql`, `supabase/v_monthly_summary.sql`). |
| `automation/` (Apps Script) | 1 `.gs` file | **0** | **100% untested:** `automation/bancolombia-sync/bancolombia-sync.gs` (815 lines of email parsing/categorization). |

## Test Types

**Unit Tests:**
- Pure function & math suites (`src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts`, `src/app/shared/utils/format.utils.spec.ts`, `src/app/shared/utils/security.util.spec.ts`).
- Angular Signal & business-logic service suites (`expenses.service.spec.ts`, `debts.service.spec.ts`, `tc.service.spec.ts`, `fixed-expenses.service.spec.ts`, `fixed-expense-alerts.service.spec.ts`, `auth-pin.service.spec.ts`, `navigation.service.spec.ts`).
- Adapter HTTP & platform contract suites (`fcm-notification.adapter.spec.ts`, `app.config.spec.ts`).

**Component / Integration Tests (TestBed + jsdom):**
- Standalone component rendering, DOM events, input/output bindings, and service signal integration (`app.spec.ts`, `expense-form-modal.spec.ts`, `fixed-expense-modal.spec.ts`, `sidebar.spec.ts`, `pin-lock.spec.ts`, `auth-login.spec.ts`).
- Critical smoke tests in `src/app/smoke.spec.ts` verifying root shell bootstrap (`App`) and core reactive pipeline (`ExpensesService.addExpense`).

**E2E Tests:**
- Not used (no Playwright, Cypress, or Capacitor device test suite exists; CI runs Vitest unit tests via `.github/workflows/tests.yml` and `.gitlab/ci/tests.gitlab-ci.yml`).

## Common Patterns

**Async & Error Testing (`async`/`await` + HTTP / Promise Rejection):**
```typescript
// src/app/core/notifications/adapters/fcm-notification.adapter.spec.ts
it('debe capturar errores HTTP 400/500 de forma segura sin romper la promesa', async () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

  const sendPromise = adapter.sendNotification('fcm-token-123', mockPayload);

  const req = httpTesting.expectOne('/api/notify');
  req.flush(
    { error: 'Unauthorized: Se requiere token de autorización válido' },
    { status: 401, statusText: 'Unauthorized' }
  );

  const result = await sendPromise;
  expect(result.success).toBe(false);
  expect(result.error).toContain('Unauthorized');
});
```

**Signal Effect & Async Stability Testing:**
```typescript
// src/app/features/gastos/components/expense-form-modal/expense-form-modal.spec.ts
fixture.componentRef.setInput('expense', existing);
fixture.detectChanges();
await fixture.whenStable();
expect(component['amount']()).toBe('161.657');
```

**Immutability & Pure Determinism Testing:**
```typescript
// src/app/features/gastos-fijos/utils/due-date-calculator.spec.ts
const gastoOriginal: GastoFijoAlerta = Object.freeze({ ...mockGastoBase, dia_limite_mes: 25 });
const result = calcularVencimientoGastoFijo(gastoOriginal, '2026-11-20');
expect(Object.isFrozen(result)).toBe(true);
```

---

*Testing analysis: 2026-11-11*
