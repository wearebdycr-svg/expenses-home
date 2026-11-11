# ROADMAP.md — Hoja de Ruta del Milestone de Estabilización

> **Proyecto:** Finanzas Hogar (`expenses-home`)  
> **Última actualización:** 2026-11-11  
> **Orden acordado:** `Fase 1 (P1.1 + Cron/CI)` -> `Fase 2 (P1.2 + Realtime/Rollback)` -> `Fase 3 (P1.3 + strict por etapas)` -> `Fase 4 (P1.4 + Bancolombia Auth)`

---

## 1. Visión General de Fases

```text
[Fase 1] Estado Cron & Presupuestos + Tests Cron + Gate CI
    │
    ▼
[Fase 2] Resumen Anual, Bugs TcService, Estabilidad Realtime & Rollback Optimista
    │
    ▼
[Fase 3] Higiene ESLint (no-explicit-any: error), strict: true en 2 Etapas & Cierre PLAN 2.9
    │
    ▼
[Fase 4] Migraciones SQL Versionadas, Higiene de Scripts & api/bancolombia-sync.js
```

### Gates Transversales de Cierre por Fase
Ninguna fase se da por terminada hasta verificar localmente (y en verde en GitHub Actions al integrar a `develop`):
1. `npx tsc --noEmit` sin errores.
2. `HOME=/tmp npm run lint` sin errores (ni aumento de advertencias; a partir de Fase 3, `0` usos de `any` en producción).
3. `HOME=/tmp npx ng test --watch=false` con 100 % de suites/tests pasando.
4. `node --test api/*.test.mjs` con 100 % de tests pasando.
5. `HOME=/tmp npm run build` exitoso.

---

## 2. Detalle de Fases

### Fase 1: Integridad de Presupuestos, Estado Cron y Cobertura `api/` (`P1.1` + Tests Cron + CI)
- **Objetivo:** Separar el estado interno de ejecución de crons respecto a los presupuestos familiares, impedir que presupuestos eliminados reaparezcan desde `localStorage`, cubrir `api/cron-reminder.js` con pruebas unitarias offline y blindar GitHub Actions con `tsc` y pruebas Node `api/`.
- **Requerimientos:** `REQ-CRON-01`, `REQ-BUD-01`, `REQ-TEST-01`, `REQ-CI-01`.
- **Áreas y Archivos Impactados:**
  - `api/cron-reminder.js` (leer/escribir en `cron_executions` en vez de `category_budgets`).
  - `api/cron-reminder.test.mjs` (nueva suite con `node --test`).
  - `supabase/` (script idempotente para `public.cron_executions` con RLS y limpieza de filas sentinela `__cron_*` en `category_budgets`; base para `supabase/migrations/` en Fase 4).
  - `src/app/core/services/remote-config.service.ts` y su spec (`loadBudgetsFromDb()` + limpieza de borrados en `localStorage`).
  - `.github/workflows/tests.yml` (añadir pasos `npx tsc --noEmit` y `node --test api/*.test.mjs`).
- **Entregables:**
  1. Tabla `public.cron_executions` + guía/script de migración segura para DEV y PROD sin duplicar recordatorios en el cambio.
  2. `RemoteConfigService` inmune a sentinela `__cron_*` y a resurrección de presupuestos eliminados en caché local.
  3. Suite `api/cron-reminder.test.mjs` verde sin dependencias de red.
  4. Workflow `.github/workflows/tests.yml` ejecutando tests Angular + tests Node API + `tsc --noEmit`.
- **Verificación de Cierre:** Tests nuevos en `api/cron-reminder.test.mjs` y `remote-config.service.spec.ts` en verde; cero referencias a `__cron_` como filas en `category_budgets`.

---

### Fase 2: Sincronización Realtime, Rollback Optimista y Resumen Anual (`P1.2` + `P2` Realtime/Rollback)
- **Objetivo:** Corregir desfaces de datos en resumen anual y tarjetas compartidas, estabilizar el ciclo de vida de canales WebSocket y cargas iniciales, y garantizar rollback optimista con notificación vía toast sin diálogos `confirm()` bloqueantes.
- **Requerimientos:** `REQ-SYNC-01`, `REQ-SYNC-02`, `REQ-RT-01`, `REQ-UX-01`, `REQ-UX-02`.
- **Áreas y Archivos Impactados:**
  - `src/app/features/resumen/data/resumen.service.ts`, `src/app/features/gastos/data/expenses.service.ts`, `src/app/features/ingresos/data/incomes.service.ts`.
  - 🔴 **Zona Crítica (`CONTEXT.md`):** `src/app/features/tc-compartida/data/tc.service.ts` y `tc.service.spec.ts` (requiere tests de caracterización previos para amortización FIFO y cuotas 50/50).
  - Servicios con Realtime / mutaciones optimistas: `debts.service.ts`, `projects.service.ts`, `fixed-expenses.service.ts`, `categoria.service.ts`, `ToastService`.
  - Componentes con `confirm()` / `window.confirm()`: `gastos-fijos.ts`, `proyectos.ts`, `tc.ts`, `tc-cards-grid.ts`, `tc-table.ts`, `debt-table.ts`, `income-table.ts`, `expense-table.ts` + nuevo diálogo/servicio reutilizable en `src/app/shared/ui/`.
- **Entregables:**
  1. Invalidación/recarga automática de `ResumenService.loadYearSummary()` ante cambios en gastos e ingresos.
  2. Correcciones en `TcService`: `lastLocalMutationTime = Date.now()` en update/delete, preservación de campos USD en undo y persistencia de eliminación de tarjetas en `tc_cards`.
  3. Limpieza de canales Realtime (`removeChannel`), intervalos y listeners mediante `DestroyRef`, y eliminación de carrera de auto-migración en `ExpensesService.loadExpenses()`.
  4. Rollback optimista al snapshot previo + `ToastService` en errores de Supabase en todos los servicios CRUD, y reemplazo de los `confirm()` nativos en la UI.
- **Verificación de Cierre:** Suite completa Vitest verde incluyendo pruebas de error/rollback, caracterización `TcService`, limpieza de canales y ausencia de `confirm()` nativo en `src/app/`.

---

### Fase 3: Tipado Estricto Progresivo, ESLint y Cierre `PLAN.md` 2.9 (`P1.3`)
- **Objetivo:** Erradicar el uso de `any` en el código fuente productivo, reforzar `eslint.config.mjs`, proteger el formato de tags en el modal maestro de gastos, habilitar `"strict": true` por etapas en `tsconfig.json` y cerrar oficialmente la tarea pendiente `2.9` de `PLAN.md`.
- **Requerimientos:** `REQ-LINT-01`, `REQ-VAL-01`, `REQ-TS-01`, `REQ-TS-02`.
- **Áreas y Archivos Impactados:**
  - `eslint.config.mjs` (agregar `ignores` para `android/**`, `dist/**`, `.planning/**`; cambiar `@typescript-eslint/no-explicit-any` a `'error'`).
  - Los 20 archivos con advertencias `no-explicit-any` actuales (liderados por `tc.service.ts`, `expenses.service.ts`, `debts.service.ts`, `projects.service.ts`, `incomes.service.ts`, `push-notification.service.ts`, `supabase.service.ts`, `remote-config.service.ts` y gráficos Chart.js).
  - 🔴 **Zona Crítica (`CONTEXT.md`):** `src/app/features/gastos/components/expense-form-modal/expense-form-modal.ts` y `expense-form-modal.spec.ts` (validación previa de longitud de `[Deuda: ...]` / `[Evento: ...]` antes de truncar).
  - `tsconfig.json` (Sub-etapa 1: flags sin nullability; Sub-etapa 2: `strictNullChecks` + `"strict": true`).
  - `PLAN.md` (cierre de tarea `2.9`).
- **Entregables:**
  1. **Sub-etapa 3A:** `0` usos de `any` fuera de `*.spec.ts`, regla `no-explicit-any: 'error'`, exclusiones ESLint configuradas, validación de tags `[Deuda: ...]` / `[Evento: ...]` probada, y Sub-etapa 1 de flags TS compilando en `0` errores.
  2. **Sub-etapa 3B:** `"strict": true` completo activo en `tsconfig.json` compilando con `0` errores, calidad total validada y tarea `2.9` de `PLAN.md` cerrada.
- **Verificación de Cierre:** `npx tsc --noEmit`, `HOME=/tmp npm run lint` (`0` errores y `0` `no-explicit-any`), `npx eslint .` ejecutable sin ruido de `android/`, tests y build en verde.

---

### Fase 4: Migraciones SQL Versionadas, Higiene de Scripts y Auth Bancolombia Sync (`P1.4` + Bancolombia Auth)
- **Objetivo:** Consolidar la definición dispersa de base de datos en migraciones ordenadas en `supabase/migrations/`, limpiar datos personales/IDs de producción hardcoded del repositorio y migrar `bancolombia-sync.gs` hacia un endpoint `api/bancolombia-sync.js` sin `SUPABASE_SERVICE_ROLE_KEY` en Google Apps Script.
- **Requerimientos:** `REQ-DB-01`, `REQ-HYG-01`, `REQ-SEC-01`.
- **Áreas y Archivos Impactados:**
  - `supabase/migrations/` (nuevo esquema consolidado y versionado reconciliando tipos `UUID`/`TEXT`, `smallint`/`INTEGER`, `CHECK`s, `cron_executions`, `v_monthly_summary` y RLS).
  - `supabase/*.sql` legacy (`fix_all_tables_rls_and_schemas.sql`, `populate_prod_from_dev.sql`, etc.: saneo de datos personales/balances/IDs de producción y documentación de reemplazo por migraciones).
  - `api/bancolombia-sync.js` + pruebas en `api/` (validación con `BANCOLOMBIA_SYNC_SECRET` en tiempo constante, whitelist de tablas, deduplicación, inserción server-side).
  - `automation/bancolombia-sync/bancolombia-sync.gs` (consumir `/api/bancolombia-sync`, eliminar `SUPABASE_SERVICE_ROLE_KEY` y valores/literales personales por defecto).
  - `.env.example` / documentación operativa de despliegue.
- **Entregables:**
  1. Cadena limpia de migraciones bajo `supabase/migrations/`.
  2. Repositorio libre de balances personales, IDs o URLs de producción sensibles en scripts SQL y `.gs`.
  3. Endpoint `api/bancolombia-sync.js` probado y `bancolombia-sync.gs` actualizado con guía de variables `BANCOLOMBIA_SYNC_SECRET` en Vercel y `ScriptProperties`.
- **Verificación de Cierre:** Inspección de migraciones y auditoría de scripts sin secretos/datos reales; `node --test api/*.test.mjs` verificando auth fail-closed, rechazo de tabla no permitida y flujo válido de `api/bancolombia-sync.js`; suite completa en verde.

---

## 3. Trabajo Diferido (*Out of Scope*)

Todo lo listado en la sección 3 de `REQUIREMENTS.md` (refactorización de alertas/notificaciones `P2`, parches incrementales Realtime/lazy routes `P2`, bloque completo `P3` y nuevas funcionalidades) queda fuera de estas 4 fases y podrá planificarse en un milestone posterior una vez cerrada la Fase 4.
