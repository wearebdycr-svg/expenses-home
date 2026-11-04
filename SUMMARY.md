# SUMMARY.md - Bitácora de Refactorización y Estabilización

## Wave 0: Red de Seguridad y Diagnóstico

### Tarea 0.1: Diagnóstico de Tipos y Linter
- **Fecha:** 2026-11-03
- **Estado:** Completada
- **Diagnóstico Estático:**
  - TypeScript Compiler (`tsc --noEmit` y `tsc --strict`): 0 errores sintácticos de compilación directa.
  - ESLint (`ng lint`): 0 errores, 143 advertencias registradas:
    - 95 advertencias `@typescript-eslint/no-explicit-any` concentradas en servicios de datos Supabase (`tc.service`, `expenses.service`, `debts.service`, etc.) y callbacks de Chart.js.
    - 12 advertencias `@angular-eslint/no-output-native` por nombres de outputs conflictivos con DOM nativo (`cancel`, `close`).
    - 23 advertencias de accesibilidad en plantillas HTML (eventos `click` sin soporte de teclado o `role="button"`).
    - 10 variables/imports huérfanos (`@typescript-eslint/no-unused-vars`).
    - 2 advertencias ReDoS (`security/detect-unsafe-regex`) en formateador `formatCOP`.
    - 1 falsa alarma de timing attack en `app.ts` (`security/detect-possible-timing-attacks` sobre URL hash).
  - Vitest CI: 283 pruebas unitarias pasando intactas (55 suites).
- **Hallazgos Críticos:**
  - Identificación de "God Files" que violan el invariante de 150 líneas: `tc.service.ts` (1,112 líneas), `push-notification.service.ts` (919 líneas), `expense-form-modal.ts` (795 líneas), `projects.service.ts` (786 líneas), `debts.service.ts` (641 líneas).
  - Duplicación de lógica: `formatCOP` replicado en 5 modelos diferentes.
- **Entregables:**
  - Actualización de stack y zonas protegidas en `CONTEXT.md`.
  - Reporte exhaustivo en Artifact `diagnostico-tipos-linter.md`.

### Tarea 0.2: Pruebas de Humo Críticas
- **Fecha:** 2026-11-03
- **Estado:** Completada
- **Tests Añadidos (`src/app/smoke.spec.ts`):**
  1. *Smoke Test 1 (Application Entry Point & Shell Bootstrap):* Valida inicialización de `App` (`src/main.ts`), autenticación desbloqueada, página inicial por defecto (`gastos`) y renderizado del shell (`.app-shell`, `app-sidebar`, `main.app-content`, `app-gastos-page`).
  2. *Smoke Test 2 (Core Business Pipeline - Ingestion & Aggregation):* Valida el flujo central de `ExpensesService` ingresando un gasto (`addExpense`) y verificando su reflejo en `allExpenses()`, `totalPeriod()` y `transactionCount()`.
- **Comandos de Ejecución:**
  - Aislado (solo pruebas de humo): `HOME=/tmp npx ng test --include=src/app/smoke.spec.ts --watch=false`
  - Suite completa: `HOME=/tmp npm run test:ci`
- **Resultado:** 2/2 pruebas de humo pasando (285/285 tests globales pasando en verde).
- **Entregables:**
  - Archivo de pruebas [src/app/smoke.spec.ts](file:///Users/Carlos.Valencia/Desktop/CR_proyectos/expenses-home/src/app/smoke.spec.ts).
  - Especificación en Artifact `smoke-tests-proposal.md`.
